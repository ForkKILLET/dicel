import { entries, map, mapValues, mergeAll, pipe, values } from 'remeda'
import { ConType, FuncType, VarType, FuncTypeCurried, TypeSchemeDict, ApplyTypeCurried, TypedValueEnv, TypedValue, ApplyType, KindEnv, TypeEnv, FuncKind, FuncNKind, TypeKind } from './types'
import { Data, DataEnv, KindedDataEnv } from './data'
import { ErrValue, FuncValue, FuncValue2, FuncValueJ, FuncValueJ2, NumValue } from './values'
import { Dice } from './execute'
import { KindInferer } from './infer'


export const builtinOps: TypedValueEnv = {
  '==': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs === rhs),
  ),
  '!=': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs !== rhs),
  ),
  '<': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs < rhs),
  ),
  '<=': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs <= rhs),
  ),
  '>': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs > rhs),
  ),
  '>=': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs >= rhs),
  ),
  '+': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs + rhs),
  ),
  '-': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs - rhs),
  ),
  '*': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs * rhs),
  ),
  '/': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs / rhs),
  ),
  '%': TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs % rhs),
  ),
}

export const builtinFuncs: TypedValueEnv = {
  undefined: TypedValue(
    VarType('a'),
    ErrValue('Undefined'),
  ),

  roll: TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Dice.roll),
  ),

  neg: TypedValue(
    FuncType(ConType('Num'), ConType('Num')),
    FuncValueJ((n: number) => - n),
  ),
  max: TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Math.max),
  ),
  min: TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Math.min),
  ),
  abs: TypedValue(
    FuncType(ConType('Num'), ConType('Num')),
    FuncValueJ(Math.abs),
  ),
}

export const builtinData: KindedDataEnv = {
  'Num': {
    id: 'Num',
    typeParams: [],
    cons: [],
    kind: FuncNKind(1),
  },
  '': {
    id: '',
    typeParams: [],
    cons: [
      { id: '', params: [] }
    ],
    kind: FuncNKind(1),
  },
  List: {
    id: 'List',
    typeParams: ['a'],
    cons: [
      { id: '[]', params: [] },
      { id: '#', params: [VarType('a'), ApplyTypeCurried(ConType('List'), VarType('a'))] },
    ],
    kind: FuncNKind(2),
  },
  ',': {
    id: ',',
    typeParams: ['a', 'b'],
    cons: [
      { id: ',', params: [VarType('a'), VarType('b')] }
    ],
    kind: FuncNKind(3),
  },
  ',,': {
    id: ',,',
    typeParams: ['a', 'b', 'c'],
    cons: [
      { id: ',,', params: [VarType('a'), VarType('b'), VarType('c')] }
    ],
    kind: FuncNKind(4),
  },
  ',,,': {
    id: ',,,',
    typeParams: ['a', 'b', 'c', 'd'],
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
    entries(builtinData),
    map(([id, data]) => Data.getTypedValueEnv(id, data)),
    mergeAll,
  ),
}

export const builtinTypeEnv: TypeEnv = mapValues(builtinVals, builtin => builtin.typeScheme)

export const builtinKindEnv: KindEnv = mapValues(builtinData, data => data.kind)
