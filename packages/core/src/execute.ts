import { mapValues } from 'remeda'
import { Result } from 'fk-result'
import { match } from 'ts-pattern'
import { builtinVars, builtinOps } from './builtin'
import { Expr } from './parse'
import { Value, NumValue, UnitValue, assertVal, FuncValue } from './values'

export type Ref = { val: Value }
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

  export const resolve = (id: string, env: RuntimeEnv): Value => {
    if (id in env.scope) return env.scope[id].val
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
        assertVal(cond, 'bool')
        return cond.val ? _execute(expr.yes, env) : _execute(expr.no, env)
      }
      case 'var':
        return RuntimeEnv.resolve(expr.id, env)
      case 'varOp':
        return builtinOps[expr.id].value
      case 'let': {
        const { lhs: { id }, rhs } = expr.binding
        const ref: Ref = { val: UnitValue() }
        const envI = RuntimeEnv.extend(env, { [id]: ref })
        ref.val = _execute(rhs, envI)
        return _execute(expr.body, envI)
      }
      case 'apply': {
        const func = _execute(expr.func, env)
        assertVal(func, 'func')
        return func.val(_execute(expr.arg, env))
      }
      case 'lambda':
        return FuncValue((arg: Value) => _execute(expr.body, RuntimeEnv.extend(env, {
          [expr.param.id]: { val: arg }
        })))
      case 'ann':
        return _execute(expr.expr, env)
      default:
        throw new Error(`Unknown expr: ${expr}`)
    }
  }
  const val = _eval()
  if (val.tag === 'err') throw new Error(val.msg)
  return val
}

export const execute = (expr: Expr, env: RuntimeEnv = RuntimeEnv.root()): Result<Value, Error> =>
  Result.wrap(() => _execute(expr, env))

export const showValue = (val: Value): string => _showValue(val)
const _showValue = (val: Value, withParen = false): string => (withParen ? '(' : '') + match(val)
  .with({ tag: 'num' }, ({ val }) => String(val))
  .with({ tag: 'bool' }, ({ val }) => val ? 'True' : 'False')
  .with({ tag: 'unit' }, () => '()')
  .with({ tag: 'func' }, () => 'Func')
  .with({ tag: 'con' }, ({ id, args }) =>
    `${id}${` ${args.map(arg => _showValue(arg, arg.tag === 'con')).join('')}`}`
  )
  .with({ tag: 'err' }, () => `Err`)
  .exhaustive() + (withParen ? ')' : '')
