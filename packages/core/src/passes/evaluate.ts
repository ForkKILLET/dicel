import { Result } from 'fk-result'

import { BindingHostNode, Expr, Pat } from '@/node/node'
import { Core } from '@/node/stage'
import { Effect, Map } from '@/utils/data'
import { Bound } from '@/utils/decorators'
import { BindingGroupsMap } from '@/passes/bindingGroupResolve'
import { R } from '@/utils/compose'
import { PassAction } from '@/pipeline'
import { Value, NumValue, CharValue, UnitValue, ListValue, RecordValue, FuncValue } from '@/value/value'
import { BUILTIN_TYPED_VALUE_LIST } from '@/builtin/termType'
import { SymId } from '@/sym'

export type ValueRef = {
  value: Value | null
}

export class ValueScope {
  static builtin(): ValueScope {
    const scope = new ValueScope(null)
    for (const { id, value } of BUILTIN_TYPED_VALUE_LIST) scope.register(`Builtin:${id}`, value)
    return scope
  }

  static global(): ValueScope {
    return new ValueScope(ValueScope.builtin())
  }

  static derive(parent: ValueScope): ValueScope {
    return new ValueScope(parent)
  }

  private valueMap: Map<SymId, ValueRef> = Map.empty()

  constructor(
    public parent: ValueScope | null = null,
  ) {}

  lookup(symId: SymId): ValueRef | null {
    const value = this.valueMap.get(symId)
    return value ?? this.parent?.lookup(symId) ?? null
  }

  register(symId: SymId, value: Value): ValueRef {
    const ref: ValueRef = { value }
    this.valueMap.set(symId, ref)
    return ref
  }

  preserve(symId: SymId) {
    this.valueMap.set(symId, { value: null })
  }

  [Symbol.iterator]() {
    return this.valueMap[Symbol.iterator]()
  }
}

export class EvaluateError extends Error {
  name = 'EvalError'
}

export class Evaluator {
  static {
    Bound(Evaluator)
  }

  constructor(
    public readonly bindingGroupsMap: BindingGroupsMap,
  ) {}

  matchPat(pat: Pat<Core>, value: Value, scope: ValueScope, preserved: boolean): Effect | null {
    switch (pat.ty) {
      case 'wildcardPat':
        return Effect.empty
      case 'numPat':
        if (! Value.is(value, ['num'])) return null
        if (value.val !== pat.val) return null
        return Effect.empty
      case 'varPat': {
        if (preserved) {
          const ref = scope.lookup(pat.symId)!
          return () => {
            ref.value = value
          }
        }
        else {
          return () => {
            scope.register(pat.symId, value)
          }
        }
      }
      case 'dataPat': {
        if (! Value.is(value, ['data'])) return null
        if (value.con !== pat.con.symId) return null
        const updates: Effect[] = []
        for (const [patArg, valueArg] of R.zip(pat.args, value.args)) {
          const update = this.matchPat(patArg, valueArg, scope, preserved)
          if (! update) return null
          updates.push(update)
        }
        return Effect.sequenceV(updates)
      }
      case 'recordPat': {
        if (! Value.is(value, ['record'])) return null
        if (value.con !== pat.con.symId) return null
        const updates: Effect[] = []
        for (const [patField, valueField] of R.zip(pat.fields, value.fields)) {
          const update = this.matchPat(patField.pat, valueField, scope, preserved)
          if (! update) return null
          updates.push(update)
        }
        return Effect.sequenceV(updates)
      }
    }
  }

  matchPatOrThrow(pat: Pat<Core>, scrutinee: Value, scope: ValueScope, preserved: boolean): void {
    const update = this.matchPat(pat, scrutinee, scope, preserved)
    if (! update) {
      console.log(pat, scrutinee)
      throw new EvaluateError(`Non-exhaustive patterns.`)
    }
    update()
  }

  evaluateBindingHost(bindingHost: BindingHostNode<Core>, scope: ValueScope): void {
    const bindingGroups = this.bindingGroupsMap.get(bindingHost.astId)!
    for (const bindingGroup of bindingGroups) {
      for (const symId of bindingGroup.symIdSet) {
        scope.preserve(symId)
      }
      for (const binding of bindingGroup.bindings) {
        const bodyValue = this.evaluate(binding.body, scope)
        this.matchPatOrThrow(binding.pat, bodyValue, scope, true)
      }
    }
  }

  evaluate(expr: Expr<Core>, scope: ValueScope): Value {
    switch (expr.ty) {
      case 'num':
        return NumValue(expr.val)
      case 'char':
        return CharValue(expr.val)
      case 'unit':
        return UnitValue()
      case 'str':
        return ListValue([...expr.val].map(CharValue))
      case 'cond': {
        const condValue = this.evaluate(expr.cond, scope)
        Value.assert(condValue, ['data'])
        const condIsTrue = condValue.con === 'Builtin:True'
        return this.evaluate(condIsTrue ? expr.yes : expr.no, scope)
      }
      case 'record':
        return RecordValue(expr.con.symId, expr.fields.map(field => this.evaluate(field.val, scope)))
      case 'ann':
        return this.evaluate(expr.expr, scope)
      case 'var': {
        const varRef = scope.lookup(expr.symId)!
        if (! varRef.value) throw new EvaluateError(`Uninitialized variable #${expr.symId}`)
        return varRef.value
      }
      case 'let': {
        const subScope = ValueScope.derive(scope)
        this.evaluateBindingHost(expr.bindingHost, subScope)
        return this.evaluate(expr.body, subScope)
      }
      case 'lambda':
        return FuncValue(arg => {
          const subScope = ValueScope.derive(scope)
          this.matchPatOrThrow(expr.param, arg, subScope, false)
          return this.evaluate(expr.body, subScope)
        })
      case 'apply': {
        const funcValue = this.evaluate(expr.func, scope)
        Value.assert(funcValue, ['func'])
        const argValue = this.evaluate(expr.arg, scope)
        return funcValue.func(argValue)
      }
      case 'case': {
        const scrutineeValue = this.evaluate(expr.scrutinee, scope)
        for (const branch of expr.branches) {
          const branchScope = ValueScope.derive(scope)
          const update = this.matchPat(branch.pat, scrutineeValue, branchScope, false)
          if (! update) continue
          update()
          return this.evaluate(branch.body, branchScope)
        }
        throw new EvaluateError('Non-exhaustive patterns in case.')
      }
    }
  }
}

export namespace EvaluateMod {
  export type Ok = {
    globalScope: ValueScope
    introScope: ValueScope
  }

  export type Err = EvaluateError
}

export const evaluateMod: PassAction<'evaluate'> = (modId, store) => {
  const {
    nameResolve: { importMap },
    bindingGroupResolve: { bindingGroupsMap },
    classDesugar: { mod },
  } = store.use(modId, ['nameResolve', 'bindingGroupResolve', 'classDesugar'])!

  const evaluator = new Evaluator(
    bindingGroupsMap,
  )

  return Result.wrap(() => {
    const globalScope = ValueScope.global()

    for (const [modId, symTable] of importMap) {
      const { evaluate: { introScope: importScope } } = store.use(modId, ['evaluate'])
      for (const sym of symTable.byType.get('binding').values()) {
        const importRef = importScope.lookup(sym.originSymId!)!
        globalScope.register(sym.symId, importRef.value!)
      }
    }

    const introScope = ValueScope.derive(globalScope)

    evaluator.evaluateBindingHost(mod.bindingHost, introScope)

    return {
      globalScope,
      introScope,
    }
  })
}
