import { mapValues } from 'remeda'
import { builtinVars, builtinOps } from './builtin'
import { Expr } from './parse'
import { Result } from 'fk-result'

export type Ref = { val: any }
export type Scope = Record<string, Ref>

export type RuntimeEnv = {
  scope: Scope
  parent: RuntimeEnv | null
}

export namespace RuntimeEnv {
  export const root = (): RuntimeEnv => ({
    scope: mapValues(builtinVars, (builtin): Ref => ({ val: builtin.value })),
    parent: null,
  })

  export const extend = (parent: RuntimeEnv, scope: Scope): RuntimeEnv => ({
    scope,
    parent,
  })

  export const resolve = (id: string, env: RuntimeEnv): any | null => {
    if (id in env.scope) return env.scope[id].val
    if (env.parent) return resolve(id, env.parent)
    return null
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

const _execute = (expr: Expr, env: RuntimeEnv): any => {
  switch (expr.type) {
    case 'num':
      return expr.val
    case 'unit':
      return null
    case 'cond': {
      const cond = _execute(expr.cond, env) as boolean
      return cond ? _execute(expr.yes, env) : _execute(expr.no, env)
    }
    case 'var':
      return RuntimeEnv.resolve(expr.id, env)
    case 'varOp':
      return builtinOps[expr.id].value
    case 'let': {
      const { lhs: { id }, rhs } = expr.binding
      const ref: Ref = { val: null }
      const envI = RuntimeEnv.extend(env, { [id]: ref })
      ref.val = _execute(rhs, envI)
      return _execute(expr.body, envI)
    }
    case 'apply':
      return _execute(expr.func, env)(_execute(expr.arg, env))
    case 'lambda':
      return (arg: any) => _execute(expr.body, RuntimeEnv.extend(env, {
        [expr.param.id]: { val: arg }
      }))
    case 'ann':
      return _execute(expr.expr, env)
    default:
      throw new Error(`Unknown expr: ${expr}`)
  }
}

export const execute = (expr: Expr, env: RuntimeEnv = RuntimeEnv.root()): Result<any, Error> =>
  Result.wrap(() => _execute(expr, env))

export const showValue = (val: any): string => {
  if (val === null) return '()'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'function') return 'λ'
  if (typeof val === 'boolean') return val ? 'True' : 'False'
  return '?'
}