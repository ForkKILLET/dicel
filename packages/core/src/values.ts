import { match } from 'ts-pattern'
import { Func } from './utils'

export type NumValue = { tag: 'num', val: number }
export const NumValue = (val: number): NumValue => ({ tag: 'num', val })

export type BoolValue = { tag: 'bool', val: boolean }
export const BoolValue = (val: boolean): BoolValue => ({ tag: 'bool', val })

export type UnitValue = { tag: 'unit' }
export const UnitValue = (): UnitValue => ({ tag: 'unit' })

export type FuncValue = { tag: 'func', val: (arg: Value) => Value }
export const FuncValue = (val: (arg: Value) => Value): FuncValue => ({ tag: 'func', val })
export const FuncValue2 = (val: (arg1: Value, arg2: Value) => Value) =>
  FuncValue(arg1 => FuncValue(arg2 => val(arg1, arg2)))
export const FuncValue3 = (val: (arg1: Value, arg2: Value, arg3: Value) => Value) =>
  FuncValue(arg1 => FuncValue(arg2 => FuncValue(arg3 => val(arg1, arg2, arg3))))

export type ConValue = { tag: 'con', id: string, args: Value[] }
export const ConValue = (id: string, vals: Value[]): ConValue => ({ tag: 'con', id, args: vals })

export type ErrValue = { tag: 'err', msg: string }
export const ErrValue = (msg: string): ErrValue => ({ tag: 'err', msg })

export type Value =
  | NumValue
  | BoolValue
  | UnitValue
  | FuncValue
  | ConValue
  | ErrValue
export type ValueTag = Value['tag']

export type MappableValueTag = 'num' | 'bool' | 'unit' | 'func'
export type MappableValue = Extract<Value, { tag: MappableValueTag }>
export type MappableValueJ = number | boolean | null | Func
export type MVJ = MappableValueJ
export const wrapVal = (valj: MappableValueJ): Value => match(valj)
  .when(val => typeof val === 'number', NumValue)
  .when(val => typeof val === 'boolean', BoolValue)
  .when(val => typeof val === 'function', FuncValue)
  .when(val => val === null, UnitValue)
  .run()

export const unwrapVal = (val: MappableValue): MappableValueJ => match(val)
  .with({ tag: 'unit' }, () => null)
  .otherwise(({ val }) => val)
  
export const unsafeMapVals = <const Vs extends MappableValueJ[]>(
  vals: { [I in keyof Vs]: Value },
  transform: (...vals: Vs) => MappableValueJ,
): Value => wrapVal(transform(...(vals as MappableValue[]).map(unwrapVal) as Vs))

export const FuncValueJ = <T1 extends MVJ, T2 extends MVJ>(
  func: (a1: T1) => T2
) => FuncValue(v1 => unsafeMapVals([v1], func))
export const FuncValueJ2 = <T1 extends MVJ, T2 extends MVJ, T3 extends MVJ>(
  func: (a1: T1, a2: T2) => T3
) => FuncValue(v1 => FuncValue(v2 => unsafeMapVals([v1, v2], func)))
export const FuncValueJ3 = <T1 extends MVJ, T2 extends MVJ, T3 extends MVJ, T4 extends MVJ>(
  func: (a1: T1, a2: T2, a3: T3) => T4
) => FuncValue(v1 => FuncValue(v2 => FuncValue(v3 => unsafeMapVals([v1, v2, v3], func))))

export function assertVal<T extends ValueTag>(val: Value, tag: T): asserts val is Extract<Value, { tag: T }> {
  if (val.tag !== tag) throw new TypeError(`Expected ${tag}, got ${val.tag}`)
}