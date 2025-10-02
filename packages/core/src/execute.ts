import { fromEntries, map, mapValues, mergeAll, pick, pipe } from 'remeda'
import { Result } from 'fk-result'
import { builtinVals } from './builtin'
import { Value, NumValue, UnitValue, FuncValue, ErrValue } from './values'
import { collectPatternVars } from './infer'
import { Data } from './data'
import { Binding, ExprInt, Mod, PatternInt } from './nodes'
import { P } from 'ts-pattern'
import { CompiledMod } from './std'

export type Ref = { value: Value }
export type ValueEnv = Record<string, Ref>

export namespace ValueEnv {
  export const global = (): ValueEnv =>  mapValues(
    builtinVals,
    (builtin): Ref => ({ value: builtin.value })
  )

  export const resolve = (id: string, env: ValueEnv, expr: ExprInt): Value => {
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

export const evaluatePattern = (pattern: PatternInt, subject: Value): ValueEnv | null => {
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

export const evaluateBindings = (bindings: Binding<{}, 'int'>[], env: ValueEnv) => {
  const patternVars = bindings.flatMap(({ lhs }) => Array.from(collectPatternVars(lhs)))
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

export class EvaluateError extends Error {
  name = 'EvaluateError'

  constructor(msg: string, public expr: ExprInt) {
    super(msg)
  }
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
        return ValueEnv.resolve(expr.id, env, expr)
      case 'let': {
        const envP = evaluateBindings(expr.bindings, env)
        if (envP === null) throw new EvaluateError('Non-exhaustive patterns in let binding.', expr)
        return evaluate(expr.body, envP)
      }
      case 'case': {
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
        return func.val(evaluate(expr.arg, env))
      }
      case 'lambda':
        return FuncValue((arg: Value) => {
          const envP = evaluatePattern(expr.param, arg)
          if (envP === null) throw new EvaluateError('Non-exhaustive patterns in param.', expr)
          return evaluate(expr.body, {
            ...env,
            ...envP,
          })
        })
      case 'ann':
        return evaluate(expr.expr, env)
      default:
        throw new EvaluateError(`Unknown expr type: ${(expr as { type: string }).type} (unreachable)`, expr)
    }
  }
  const val = _eval()
  if (val.tag === 'err') throw new EvaluateError(val.msg, expr)
  return val
}

export const execute = (expr: ExprInt, env: ValueEnv = ValueEnv.global()): Result<Value, EvaluateError> =>
  Result.wrap(() => evaluate(expr, env))

export namespace ExecuteMod {
  export type Options = {
    compiledMods: Record<string, CompiledMod>
  }
}

export const executeMod = (
  mod: Mod<{}, 'int'>,
  { compiledMods = {} }: Partial<ExecuteMod.Options> = {}
): Result<ValueEnv, EvaluateError | Error> => {
  const importEnv = pipe(
    mod.imports,
    map(({ modName, ids }) => pick(compiledMods[modName].valueEnv, ids)),
    mergeAll,
  )
  const dataValueEnv = pipe(
    mod.dataDefs,
    map(({ data }) => Data.getValueEnv(data)),
    mergeAll,
  )
  const env = { ...ValueEnv.global(), ...importEnv, ...dataValueEnv }
  return Result
    .wrap<ValueEnv, EvaluateError | Error>(() => evaluateBindings(mod.defs.map(def => def.binding), env))
    .tapErr(err => {
      if (! (err instanceof EvaluateError)) console.error(err)
    })
}
