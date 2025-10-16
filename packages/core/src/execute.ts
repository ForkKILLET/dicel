import { entries, fromEntries, map, mapValues, mergeAll, pick, pipe, values } from 'remeda'
import { Result } from 'fk-result'
import { builtinVals } from './builtin'
import { Value, NumValue, UnitValue, FuncValue, ErrValue, CharValue, ListValue } from './values'
import { Data } from './data'
import { BindingHostDes, ExprDes, ModDes, Node, NodeDes, PatternDes } from './nodes'
import { CompiledMod } from './mods'

export type Ref = { value: Value }
export type ValueEnv = Record<string, Ref>

export namespace ValueEnv {
  export const global = (): ValueEnv =>  mapValues(
    builtinVals,
    (builtin): Ref => ({ value: builtin.value })
  )

  export const resolve = (id: string, env: ValueEnv, expr: ExprDes): Value => {
    if (id in env) return env[id].value
    throw new EvaluateError(`Undefined variable '${id}' (unreachable)`, expr)
  }
}

export namespace Dice {
  export const roll = (times: number, sides: number): number | ErrValue => {
    if (! Number.isInteger(times) || times < 1)
      return ErrValue(`Expected times of rolls to be a positive integer, got ${times}`)
    if (! Number.isInteger(sides) || sides < 1)
      return ErrValue(`Expected sides of rolls to be a positive integer, got ${sides}`)

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

export const evaluatePattern = (pattern: PatternDes, subject: Value): ValueEnv | null => {
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
    default:
      throw new EvaluateError(`Unknown pattern type: ${(pattern as { sub: string }).sub} (unreachable)`, pattern)
  }
}

export const evaluateBindingHost = (
  bindingHost: BindingHostDes,
  env: ValueEnv
) => {
  const envI = {
    ...env,
    ...pipe(
      [...bindingHost.idSet],
      map((id): [string, Ref] => [
        id, { value: ErrValue(`Uninitialized variable '${id}'`) }
      ]),
      fromEntries(),
    )
  }

  for (const group of bindingHost.bindingGroups) {
    for (const { binding } of group.typedBindings) {
      const { lhs, rhs } = binding
      const envP = evaluatePattern(lhs, evaluate(rhs, envI))
      if (! envP) throw new EvaluateError('Non-exhaustive patterns in binding.', binding)
      Object.assign(envI, envP) // keep `envI` references held by mutually dependent bindings valid
    }
  }

  return envI
}

export class EvaluateError extends Error {
  name = 'EvaluateError'

  constructor(msg: string, public node: NodeDes) {
    super(msg)
  }
}

export const evaluate = (expr: ExprDes, env: ValueEnv): Value => {
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
      case 'char':
        return CharValue(expr.val)
      case 'str':
        return ListValue([...expr.val].map(CharValue))
      case 'var':
        return ValueEnv.resolve(expr.id, env, expr)
      case 'letDes': {
        const envP = evaluateBindingHost(expr.bindingHost, env)
        return evaluate(expr.body, envP)
      }
      case 'caseRes': {
        const subject = evaluate(expr.subject, env)
        for (const branch of expr.branches) {
          const branchEnv = evaluatePattern(branch.pattern, subject)
          if (! branchEnv) continue
          return evaluate(branch.body, { ...env, ...branchEnv })
        }
        throw new EvaluateError('Non-exhaustive patterns in case.', expr)
      }
      case 'apply': {
        const func = evaluate(expr.func, env)
        Value.assert(func, 'func')
        const arg = evaluate(expr.arg, env)
        const ret = func.val(arg)
        return ret
      }
      case 'lambdaRes':
        return FuncValue((arg: Value) => {
          const envP = evaluatePattern(expr.param, arg)
          if (! envP) throw new EvaluateError('Non-exhaustive patterns in param.', expr)
          console.log(mapValues(envP, ref => Value.show(ref.value)))
          return evaluate(expr.body, {
            ...env,
            ...envP,
          })
        })
      case 'ann':
        return evaluate(expr.expr, env)
    }
  }
  const val = _eval()
  if (val.tag === 'err') throw new EvaluateError(val.msg, expr)
  return val
}

export const execute = (expr: ExprDes, env: ValueEnv = ValueEnv.global()): Result<Value, EvaluateError> =>
  Result.wrap(() => evaluate(expr, env))

export namespace ExecuteMod {
  export type Options = {
    compiledMods: Record<string, CompiledMod>
  }
}

export const executeMod = (
  mod: ModDes,
  { compiledMods = {} }: Partial<ExecuteMod.Options> = {}
): Result<ValueEnv, EvaluateError | Error> => {
  const importValueEnv: ValueEnv = pipe(
    entries(mod.importDict),
    map(([modId, { idSet }]) => {
      const { valueEnv } = compiledMods[modId]
      return idSet ? pick(valueEnv, [...idSet]) : valueEnv
    }),
    mergeAll,
  )
  const dataValueEnv: ValueEnv = pipe(
    values(mod.dataDict),
    map(Data.getValueEnv),
    mergeAll,
  )
  const baseValueEnv = { ...ValueEnv.global(), ...importValueEnv, ...dataValueEnv }
  return Result
    .wrap<ValueEnv, EvaluateError | Error>(() =>
      evaluateBindingHost(mod.bindingHost, baseValueEnv)
    )
    .tapErr(err => {
      if (! (err instanceof EvaluateError)) console.error(err)
    })
}
