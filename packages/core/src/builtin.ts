import { entries, map, mapValues, mergeAll, pipe } from 'remeda'
import { ConType, FuncType, VarType, FuncTypeCurried, TypeSchemeDict, ApplyTypeCurried, TypedValueEnv, TypedValue, ApplyType } from './types'
import { Data, DataEnv } from './data'
import { ConValue, ErrValue, FuncValue, FuncValue2, FuncValueJ, FuncValueJ2, NumValue, Value } from './values'
import { Dice } from './execute'
import { Endo } from './utils'


export const builtinOps: TypedValueEnv = {
  '||': TypedValue(
    FuncTypeCurried(ConType('Bool'), ConType('Bool'), ConType('Bool')),
    FuncValueJ2((lhs: boolean, rhs: boolean) => lhs || rhs),
  ),
  '&&': TypedValue(
    FuncTypeCurried(ConType('Bool'), ConType('Bool'), ConType('Bool')),
    FuncValueJ2((lhs: boolean, rhs: boolean) => lhs && rhs),
  ),
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

  // TODO: move to stdlib
  '.': TypedValue(
    FuncTypeCurried(FuncType(VarType('b'), VarType('c')), FuncType(VarType('a'), VarType('b')), FuncType(VarType('a'), VarType('c'))),
    FuncValueJ2((bc: Endo<Value>, ab: Endo<Value>): Endo<Value> => (a: Value) => bc(ab(a))),
  ),
  '$': TypedValue(
    FuncTypeCurried(FuncType(VarType('a'), VarType('b')), VarType('a'), VarType('b')),
    FuncValue2((ab, a) => Value.coerce(ab, 'func').val(a)),
  ),
  '|>': TypedValue(
    FuncTypeCurried(VarType('a'), FuncType(VarType('a'), VarType('b')), VarType('b')),
    FuncValue2((a, ab) => Value.coerce(ab, 'func').val(a)),
  ),
  '++': TypedValue(
    FuncTypeCurried(ApplyType(ConType('List'), VarType('a')), ApplyType(ConType('List'), VarType('a')), ApplyType(ConType('List'), VarType('a'))),
    FuncValue2((lhs: Value, rhs: Value) => {
      Value.assert(lhs, 'con')
      Value.assert(rhs, 'con')

      const cat = (l: ConValue, r: ConValue): ConValue => {
        if (l.id === '[]') return r
        return ConValue('#', [l.args[0], cat(Value.coerce(l.args[1], 'con'), r)])
      }
      
      return cat(lhs, rhs)
    }),
  ),
}

export const builtinFuncs: TypedValueEnv = {
  undefined: TypedValue(
    VarType('a'),
    ErrValue('Undefined'),
  ),

  id: TypedValue(
    FuncTypeCurried(VarType('a'), VarType('a')),
    FuncValue(<a>(a: a): a => a),
  ),
  const: TypedValue(
    FuncTypeCurried(VarType('a'), VarType('b'), VarType('a')),
    FuncValue2(<a, b>(a: a, _: b): a => a),
  ),

  roll: TypedValue(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Dice.roll),
  ),

  not: TypedValue(
    FuncType(ConType('Bool'), ConType('Bool')),
    FuncValueJ((b: boolean) => ! b),
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

  Infinity: TypedValue(
    ConType('Num'),
    NumValue(Infinity),
  ),
}

export const builtinData: DataEnv = {
  Maybe: {
    typeParams: ['a'],
    cons: [
      { id: 'Just', params: [VarType('a')] },
      { id: 'Nothing', params: [] },
    ]
  },
  Either: {
    typeParams: ['a', 'b'],
    cons: [
      { id: 'Left', params: [VarType('a')] },
      { id: 'Right', params: [VarType('b')] },
    ]
  },
  Bool: {
    typeParams: [],
    cons: [
      { id: 'True', params: [] },
      { id: 'False', params: [] },
    ]
  },
  List: {
    typeParams: ['a'],
    cons: [
      { id: '[]', params: [] },
      { id: '#', params: [VarType('a'), ApplyTypeCurried(ConType('List'), VarType('a'))] },
    ]
  },
  '': {
    typeParams: [],
    cons: [
      { id: '', params: [] }
    ]
  },
  ',': {
    typeParams: ['a', 'b'],
    cons: [
      { id: ',', params: [VarType('a'), VarType('b')] }
    ]
  },
  ',,': {
    typeParams: ['a', 'b', 'c'],
    cons: [
      { id: ',,', params: [VarType('a'), VarType('b'), VarType('c')] }
    ]
  },
  ',,,': {
    typeParams: ['a', 'b', 'c', 'd'],
    cons: [
      { id: ',,,', params: [VarType('a'), VarType('b'), VarType('c'), VarType('d')] }
    ]
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

export const builtinEnv: TypeSchemeDict = mapValues(builtinVals, builtin => builtin.typeScheme)

