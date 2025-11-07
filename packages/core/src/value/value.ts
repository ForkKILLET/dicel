
import { SymId } from '@/sym'
import { Endo } from '@/utils/types'
import { pipe } from 'remeda'

export type NumValue = { ty: 'num', val: number }
export const NumValue = (val: number): NumValue => ({ ty: 'num', val })

export type CharValue = { ty: 'char', val: string }
export const CharValue = (val: string): CharValue => ({ ty: 'char', val })

export type DataValue = { ty: 'data', con: SymId, args: Value[] }
export const DataValue = (con: SymId, args: Value[]): DataValue => ({ ty: 'data', con, args })

export type RecordValue = { ty: 'record', con: SymId, fields: Value[] }
export const RecordValue = (con: SymId, fields: Value[]): RecordValue => ({ ty: 'record', con, fields })

export type FuncValue = { ty: 'func', func: Endo<Value> }
export const FuncValue = (func: Endo<Value>): FuncValue => ({ ty: 'func', func })

export const FuncMultiValue = (arity: number, func: (...args: Value[]) => Value): Value => {
  const curry = (ix: number, args: Value[]): Value => {
    if (ix === arity) return func(...args)
    return FuncValue(arg => curry(ix + 1, [...args, arg]))
  }
  return curry(0, [])
}

export const ListValue = (elems: Value[]) => elems.reduceRight(
  (head, tail) => DataValue('Builtin::', [tail, head]),
  DataValue('Builtin:[]', []),
)

export const UnitValue = () => DataValue('Builtin:', [])

export type Value =
  | NumValue
  | CharValue
  | DataValue
  | RecordValue
  | FuncValue

export type ValueTy = Value['ty']

export namespace Value {
  export const is = <const Ts extends ValueTy[]>(value: Value, tys: Ts): value is Value & { ty: Ts[number] } =>
    tys.includes(value.ty)

  export function assert<const Ts extends ValueTy[]>(value: Value, tys: Ts): asserts value is Value & { ty: Ts[number] } {
    if (! tys.includes(value.ty)) throw new Error(`Expected value of type ${tys.join(' | ')}, but got ${value.ty}`)
  }

  export const coerce = <const Ts extends ValueTy[]>(value: Value, tys: Ts): Value & { ty: Ts[number] } => {
    Value.assert(value, tys)
    return value
  }
}

export const extractListValue = (val: DataValue): Value[] => val.con === `Builtin:[]`
  ? []
  : pipe(
    val.args,
    ([head, tail]) => [head, ...extractListValue(Value.coerce(tail, ['data']))],
  )
