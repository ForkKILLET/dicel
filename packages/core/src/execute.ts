import { mapValues } from 'remeda'
import { Result } from 'fk-result'
import { builtinFuncs, builtinOps, builtinDataCons } from './builtin'
import { Expr } from './parse'
import { Value, NumValue, UnitValue, FuncValue, ErrValue } from './values'

export type Ref = { value: Value }
export type Scope = Record<string, Ref>

export type RuntimeEnv = {
  scope: Scope
  parent: RuntimeEnv | null
}

export namespace RuntimeEnv {
  export const root = (): RuntimeEnv => ({
    scope: mapValues(
      { ...builtinFuncs, ...builtinOps, ...builtinDataCons },
      (builtin): Ref => ({ value: builtin.value })
    ),
    parent: null,
  })

  export const extend = (parent: RuntimeEnv, scope: Scope): RuntimeEnv => ({
    scope,
    parent,
  })

  export const resolve = (id: string, env: RuntimeEnv): Value => {
    if (id in env.scope) return env.scope[id].value
    if (env.parent) return resolve(id, env.parent)
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

const _execute = (expr: Expr, env: RuntimeEnv): Value => {
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
        const { lhs: { id }, rhs } = expr.binding
        const ref: Ref = { value: ErrValue(`Uninitialized variable '${id}'`) }
        const envI = RuntimeEnv.extend(env, { [id]: ref })
        ref.value = _execute(rhs, envI)
        return _execute(expr.body, envI)
      }
      case 'apply': {
        const func = _execute(expr.func, env)
        Value.assert(func, 'func')
        return func.val(_execute(expr.arg, env))
      }
      case 'lambda':
        return FuncValue((arg: Value) => _execute(expr.body, RuntimeEnv.extend(env, {
          [expr.param.id]: { value: arg }
        })))
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

export const execute = (expr: Expr, env: RuntimeEnv = RuntimeEnv.root()): Result<Value, Error> =>
  Result.wrap(() => _execute(expr, env))

