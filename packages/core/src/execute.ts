import { fromEntries, map, mapValues, mergeAll, pipe } from 'remeda'
import { Result } from 'fk-result'
import { builtinFuncs, builtinOps, builtinVals } from './builtin'
import { Mod, ExprInt, Pattern, Binding } from './parse'
import { Value, NumValue, UnitValue, FuncValue, ErrValue } from './values'
import { collectPatternVars } from './infer'
import { Data } from './data'

export type Ref = { value: Value }
export type ValueEnv = Record<string, Ref>

export namespace ValueEnv {
  export const global = (): ValueEnv =>  mapValues(
    builtinVals,
    (builtin): Ref => ({ value: builtin.value })
  )

  export const resolve = (id: string, env: ValueEnv): Value => {
    if (id in env) return env[id].value
    throw new Error(`Undefined variable '${id}' (unreachable)`)
  }
}

export namespace Dice {
  export const roll = (times: number, sides: number): number => {
    if (! Number.isInteger(times) || times < 1)
      throw new Error(`Expected times of rolls to be a positive integer, got ${times}`)
    if (! Number.isInteger(sides) || sides < 1)
      throw new Error(`Expected sides of rolls to be a positive integer, got ${sides}`)

    const results: number[] = []
    let sum = 0
    for (let i = 0; i < times; i ++) {
      const roll = Math.floor(Math.random() * sides) + 1
      sum += roll
      results.push(roll)
    }
    return sum
  }
}

export const evaluatePattern = (pattern: Pattern, subject: Value): ValueEnv | null => {
  switch (pattern.sub) {
    case 'wildcard':
      return {}
    case 'num':
    Value.assert(subject, 'num')
    if (subject.val !== pattern.val) return null
    return {}
    case 'unit':
      Value.assert(subject, 'unit')
      return {}
    case 'var':
      return {
        [pattern.var.id]: { value: subject }
      }
    case 'con':
      Value.assert(subject, 'con')
      if (pattern.con.id !== subject.id) return null
      return pattern.args.reduce<ValueEnv | null>(
        (env, arg, index) => {
          if (! env) return null
          const argEnv = evaluatePattern(arg, subject.args[index])
          if (! argEnv) return null
          return { ...env, ...argEnv }
        },
        {}
      )
  }
}

export const evaluateBindings = (bindings: Binding<{}, '@exprInt'>[], env: ValueEnv) => {
  const patternVars = bindings.flatMap(({ lhs }) => collectPatternVars(lhs))
  const envI = {
    ...env,
    ...pipe(
      patternVars,
      map((id): [string, Ref] => [
        id, { value: ErrValue(`Uninitialized variable '${id}'`) }
      ]),
      fromEntries(),
    )
  }
  bindings.forEach(({ lhs, rhs }) => {
    const envP = evaluatePattern(lhs, evaluate(rhs, envI))
    Object.assign(envI, envP)
  })
  return envI
}

export const evaluate = (expr: ExprInt, env: ValueEnv): Value => {
  const _eval = (): Value => {
    switch (expr.type) {
      case 'num':
        return NumValue(expr.val)
      case 'unit':
        return UnitValue()
      case 'cond': {
        const cond = evaluate(expr.cond, env)
        Value.assert(cond, 'con')
        return cond.id === 'True' ? evaluate(expr.yes, env) : evaluate(expr.no, env)
      }
      case 'var':
        return ValueEnv.resolve(expr.id, env)
      case 'let': {
        const envP = evaluateBindings(expr.bindings, env)
        if (envP === null) throw new Error('Non-exhaustive patterns in let binding.')
        return evaluate(expr.body, envP)
      }
      case 'case': {
        const subject = evaluate(expr.subject, env)
        for (const branch of expr.branches) {
          const branchEnv = evaluatePattern(branch.pattern, subject)
          if (! branchEnv) continue
          return evaluate(branch.body, { ...env, ...branchEnv })
        }
        throw new Error('Non-exhaustive patterns in case.')
      }
      case 'apply': {
        const func = evaluate(expr.func, env)
        Value.assert(func, 'func')
        return func.val(evaluate(expr.arg, env))
      }
      case 'lambda':
        return FuncValue((arg: Value) => {
          const envP = evaluatePattern(expr.param, arg)
          if (envP === null) throw new Error('Non-exhaustive patterns in param.')
          return evaluate(expr.body, {
            ...env,
            ...envP,
          })
        })
      case 'ann':
        return evaluate(expr.expr, env)
      default:
        throw new Error(`Unknown expr type: ${(expr as { type: string }).type} (unreachable)`)
    }
  }
  const val = _eval()
  if (val.tag === 'err') throw new Error(val.msg)
  return val
}

export const execute = (expr: ExprInt, env: ValueEnv = ValueEnv.global()): Result<Value, Error> =>
  Result.wrap(() => evaluate(expr, env))

export const executeMod = (mod: Mod<{}, '@exprInt'>): Result<ValueEnv, Error> => {
  const dataRuntimeEnv = pipe(
    mod.dataDefs,
    map(({ data }) => Data.getValueEnv(data)),
    mergeAll,
  )
  const env = { ...ValueEnv.global(), ...dataRuntimeEnv }
  return Result.wrap(() => evaluateBindings(mod.defs.map(def => def.binding), env))
}
