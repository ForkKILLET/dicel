import { fromEntries, map, mapValues, pipe } from 'remeda'
import { Result } from 'fk-result'
import { builtinFuncs, builtinOps, builtinDataCons } from './builtin'
import { Mod, ExprInt, Pattern, Binding } from './parse'
import { Value, NumValue, UnitValue, FuncValue, ErrValue } from './values'
import { collectPatternVars } from './infer'

export type Ref = { value: Value }
export type RuntimeEnv = Record<string, Ref>

export namespace RuntimeEnv {
  export const global = (): RuntimeEnv =>  mapValues(
    { ...builtinFuncs, ...builtinOps, ...builtinDataCons },
    (builtin): Ref => ({ value: builtin.value })
  )

  export const resolve = (id: string, env: RuntimeEnv): Value => {
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


const _executePattern = (pattern: Pattern, subject: Value): RuntimeEnv | null => {
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
      return pattern.args.reduce<RuntimeEnv | null>(
        (env, arg, index) => {
          if (! env) return null
          const argEnv = _executePattern(arg, subject.args[index])
          if (! argEnv) return null
          return { ...env, ...argEnv }
        },
        {}
      )
  }
}

const _executeBindings = (bindings: Binding<{}, '@exprInt'>[], env: RuntimeEnv) => {
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
    Object.assign(envI, _executePattern(lhs, _execute(rhs, envI)))
  })
  return envI
}

const _execute = (expr: ExprInt, env: RuntimeEnv): Value => {
  const _eval = (): Value => {
    switch (expr.type) {
      case 'num':
        return NumValue(expr.val)
      case 'unit':
        return UnitValue()
      case 'cond': {
        const cond = _execute(expr.cond, env)
        Value.assert(cond, 'con')
        return cond.id === 'True' ? _execute(expr.yes, env) : _execute(expr.no, env)
      }
      case 'var':
        return RuntimeEnv.resolve(expr.id, env)
      case 'let': {
        const envI = _executeBindings(expr.bindings, env)
        return _execute(expr.body, envI)
      }
      case 'case': {
        const subject = _execute(expr.subject, env)
        for (const branch of expr.branches) {
          const branchEnv = _executePattern(branch.pattern, subject)
          if (! branchEnv) continue
          return _execute(branch.body, { ...env, ...branchEnv })
        }
        throw new Error('Non-exhaustive patterns in case.')
      }
      case 'apply': {
        const func = _execute(expr.func, env)
        Value.assert(func, 'func')
        return func.val(_execute(expr.arg, env))
      }
      case 'lambda':
        return FuncValue((arg: Value) => {
          const paramEnv = _executePattern(expr.param, arg)
          return _execute(expr.body, {
            ...env,
            ...paramEnv,
          })
        })
      case 'ann':
        return _execute(expr.expr, env)
      default:
        throw new Error(`Unknown expr type: ${(expr as { type: string }).type} (unreachable)`)
    }
  }
  const val = _eval()
  if (val.tag === 'err') throw new Error(val.msg)
  return val
}

export const execute = (expr: ExprInt, env: RuntimeEnv = RuntimeEnv.global()): Result<Value, Error> =>
  Result.wrap(() => _execute(expr, env))

export const executeMod = (mod: Mod<{}, '@exprInt'>, env: RuntimeEnv = RuntimeEnv.global()): Result<RuntimeEnv, Error> =>
  Result.wrap(() => _executeBindings(mod.defs.map(def => def.binding), env))