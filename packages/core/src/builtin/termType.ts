import * as R from 'remeda'
import { pipe, replicate } from '@/utils/compose'

import { ConType, FuncTypeMulti, Type, TypeEnv, TypeScheme } from '@/type/type'
import { DataInfo } from '@/data'
import { SymIdHeadOptional } from '@/sym'
import { Dict } from '@/utils/data'

import { BUILTIN_DATA_LIST } from './typeKind'
import { DataValue, FuncValue, NumValue, UnitValue, Value } from '@/value/value'

export type TypedId<SH extends SymIdHeadOptional = {}> = SH & {
  id: string
  type: TypeScheme
}

export type TypedValue<SH extends SymIdHeadOptional = {}> = TypedId<SH> & {
  value: Value
}

export type JValue = number | boolean | null

export namespace JValue {
  export type Tag = 'num' | 'bool' | 'unit'

  export const wrappers = {
    num: NumValue,
    bool: (val: boolean) => DataValue(val ? 'Builtin:True' : 'Builtin:False', []),
    unit: UnitValue,
  }

  export const unwrappers = {
    num: (value: NumValue) => value.val,
    bool: (value: DataValue) => value.con === 'Builtin:True',
    unit: () => null,
  }

  export type FromTag<T extends Tag> =
    T extends 'num' ? number :
    T extends 'bool' ? boolean :
    T extends 'unit' ? null :
    never
}

export const JFuncValue = <const ATs extends JValue.Tag[], const RT extends JValue.Tag>(
  jArgTags: ATs,
  jRetTag: RT,
  jFunc: (...jArgs: { [I in keyof ATs]: JValue.FromTag<ATs[I]> }) => JValue.FromTag<RT>,
): FuncValue => {
  const curry = (ix: number, jArgs: JValue[]): Value => {
    if (ix === jArgTags.length) {
      const wrapperE = JValue.wrappers[jRetTag] as (value: JValue) => Value
      const jFuncE = jFunc as (...jArgs: JValue[]) => JValue
      return wrapperE(jFuncE(...jArgs))
    }

    const unwrapperE = JValue.unwrappers[jArgTags[ix]] as (value: Value) => JValue
    return FuncValue(arg => curry(
      ix + 1,
      [...jArgs, unwrapperE(arg)],
    ))
  }
  return curry(0, []) as FuncValue
}

export const BUILTIN_TYPED_BINDING_VALUE_LIST: TypedValue[] = [
  {
    id: 'addNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    value: JFuncValue(['num', 'num'], 'num', (lhs, rhs) => lhs + rhs),
  },
  {
    id: 'subNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    value: JFuncValue(['num', 'num'], 'num', (lhs, rhs) => lhs - rhs),
  },
  {
    id: 'mulNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    value: JFuncValue(['num', 'num'], 'num', (lhs, rhs) => lhs * rhs),
  },
  {
    id: 'divNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    value: JFuncValue(['num', 'num'], 'num', (lhs, rhs) => lhs / rhs),
  },
  {
    id: 'modNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    value: JFuncValue(['num', 'num'], 'num', (lhs, rhs) => lhs % rhs),
  },
  {
    id: 'eqNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    value: JFuncValue(['num', 'num'], 'bool', (lhs, rhs) => lhs === rhs),
  },
  {
    id: 'ltNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    value: JFuncValue(['num', 'num'], 'bool', (lhs, rhs) => lhs < rhs),
  },
  {
    id: 'leNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    value: JFuncValue(['num', 'num'], 'bool', (lhs, rhs) => lhs <= rhs),
  },
  {
    id: 'gtNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    value: JFuncValue(['num', 'num'], 'bool', (lhs, rhs) => lhs > rhs),

  },
  {
    id: 'geNum',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    value: JFuncValue(['num', 'num'], 'bool', (lhs, rhs) => lhs >= rhs),
  },
  {
    id: 'roll',
    type: FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    value: JFuncValue(['num', 'num'], 'num', (times, sides) =>
      R.sum(replicate(times, () => Math.floor(Math.random() * sides) + 1))
    ),
  }
].map(({ id, type, value }) => ({ id, type: Type.generalize(type), value }))

export const BUILTIN_TYPED_DATA_CON_VALUE_LIST: TypedValue[] = BUILTIN_DATA_LIST.flatMap(({ data }) => DataInfo.getTypedValues(data))

export const BUILTIN_ID_LIST: string[] = [
  ...BUILTIN_TYPED_BINDING_VALUE_LIST,
  ...BUILTIN_TYPED_DATA_CON_VALUE_LIST,
].map(R.prop('id'))

export const BUILTIN_TYPED_VALUE_LIST = [
  ...BUILTIN_TYPED_BINDING_VALUE_LIST,
  ...BUILTIN_TYPED_DATA_CON_VALUE_LIST,
]

export const BUILTIN_TYPE_ENV: TypeEnv = pipe(
  [...BUILTIN_TYPED_BINDING_VALUE_LIST, ...BUILTIN_TYPED_DATA_CON_VALUE_LIST],
  R.map(({ id, type }) => [`Builtin:${id}`, type] as const),
  Dict.of,
)
