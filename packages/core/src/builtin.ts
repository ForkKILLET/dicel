import { entries, map, mapValues, mergeAll, pipe, values } from 'remeda'
import { ConType, VarType, FuncTypeMulti, ApplyTypeMulti, TypedValueEnv, TypedValue, KindEnv, TypeEnv, FuncNKind } from './type'
import { Data, KindedDataEnv } from './data'
import { ErrValue, FuncValueJ2 } from './value'
import { Dice } from './execute'

export const builtinOps: TypedValueEnv = {
  'eqNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs === rhs),
  ),
  'ltNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs < rhs),
  ),
  'leNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs <= rhs),
  ),
  'gtNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs > rhs),
  ),
  'geNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs >= rhs),
  ),
  'addNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs + rhs),
  ),
  'subNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs - rhs),
  ),
  'mulNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs * rhs),
  ),
  'divNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs / rhs),
  ),
  'modNum': TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs % rhs),
  ),
}

export const builtinFuncs: TypedValueEnv = {
  undefined: TypedValue(
    VarType('a'),
    ErrValue('Undefined'),
  ),

  roll: TypedValue(
    FuncTypeMulti(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Dice.roll),
  ),
}

const VarTypes = (...ids: string[]) => ids.map(VarType)

export const builtinData: KindedDataEnv = {
  'Num': {
    id: 'Num',
    typeParams: VarTypes(),
    cons: [],
    kind: FuncNKind(1),
  },
  'Char': {
    id: 'Char',
    typeParams: VarTypes(),
    cons: [],
    kind: FuncNKind(1),
  },
  '': {
    id: '',
    typeParams: VarTypes(),
    cons: [
      { id: '', params: [] }
    ],
    kind: FuncNKind(1),
  },
  '[]': {
    id: '[]',
    typeParams: VarTypes('a'),
    cons: [
      { id: '[]', params: [] },
      { id: '#', params: [VarType('a'), ApplyTypeMulti(ConType('[]'), VarType('a'))] },
    ],
    kind: FuncNKind(2),
  },
  ',': {
    id: ',',
    typeParams: VarTypes('a', 'b'),
    cons: [
      { id: ',', params: [VarType('a'), VarType('b')] }
    ],
    kind: FuncNKind(3),
  },
  ',,': {
    id: ',,',
    typeParams: VarTypes('a', 'b', 'c'),
    cons: [
      { id: ',,', params: [VarType('a'), VarType('b'), VarType('c')] }
    ],
    kind: FuncNKind(4),
  },
  ',,,': {
    id: ',,,',
    typeParams: VarTypes('a', 'b', 'c', 'd'),
    cons: [
      { id: ',,,', params: [VarType('a'), VarType('b'), VarType('c'), VarType('d')] }
    ],
    kind: FuncNKind(5),
  },
}

export const builtinVals: TypedValueEnv = {
  ...builtinOps,
  ...builtinFuncs,
  ...pipe(
    values(builtinData),
    map(Data.getTypedValueEnv),
    mergeAll,
  ),
}

export const builtinTypeEnv: TypeEnv = mapValues(builtinVals, builtin => builtin.typeScheme)

export const builtinKindEnv: KindEnv = mapValues(builtinData, data => data.kind)
