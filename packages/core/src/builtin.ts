import { entries, flat, fromEntries, map, mapValues, pipe } from 'remeda'
import { ConType, FuncType, VarType, FuncTypeCurried, TypeSchemeDict, Type, ApplyTypeCurried, Data, ApplyType } from './types'
import { ConValue, ErrValue, FuncValue, FuncValue2, FuncValueJ, FuncValueJ2, FuncValueN, Value } from './values'
import { Dice } from './execute'
import { generalize } from './infer'
import { Func, Endo } from './utils'

export interface TypedBuiltin {
  type: Type
  value: Value
}
export const TypedBuiltin = <T extends Type>(type: T, value: Value): TypedBuiltin => ({
  type,
  value,
})

export const builtinOps: Record<string, TypedBuiltin> = {
  '||': TypedBuiltin(
    FuncTypeCurried(ConType('Bool'), ConType('Bool'), ConType('Bool')),
    FuncValueJ2((lhs: boolean, rhs: boolean) => lhs || rhs),
  ),
  '&&': TypedBuiltin(
    FuncTypeCurried(ConType('Bool'), ConType('Bool'), ConType('Bool')),
    FuncValueJ2((lhs: boolean, rhs: boolean) => lhs && rhs),
  ),
  '==': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs === rhs),
  ),
  '!=': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs !== rhs),
  ),
  '<': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs < rhs),
  ),
  '<=': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs <= rhs),
  ),
  '>': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs > rhs),
  ),
  '>=': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    FuncValueJ2((lhs: number, rhs: number) => lhs >= rhs),
  ),
  '+': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs + rhs),
  ),
  '-': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs - rhs),
  ),
  '*': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs * rhs),
  ),
  '/': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs / rhs),
  ),
  '%': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2((lhs: number, rhs: number) => lhs % rhs),
  ),
  '.': TypedBuiltin(
    FuncTypeCurried(FuncType(VarType('b'), VarType('c')), FuncType(VarType('a'), VarType('b')), FuncType(VarType('a'), VarType('c'))),
    FuncValueJ2((bc: Endo<Value>, ab: Endo<Value>): Endo<Value> => (a: Value) => bc(ab(a))),
  ),
  '$': TypedBuiltin(
    FuncTypeCurried(FuncType(VarType('a'), VarType('b')), VarType('a'), VarType('b')),
    FuncValue2((ab, a) => Value.coerce(ab, 'func').val(a)),
  ),
}

export const builtinFuncs: Record<string, TypedBuiltin> = {
  undefined: TypedBuiltin(
    VarType('a'),
    ErrValue('Undefined'),
  ),

  id: TypedBuiltin(
    FuncTypeCurried(VarType('a'), VarType('a')),
    FuncValue(<a>(a: a): a => a),
  ),
  const: TypedBuiltin(
    FuncTypeCurried(VarType('a'), VarType('b'), VarType('a')),
    FuncValue2(<a, b>(a: a, _: b): a => a),
  ),

  roll: TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Dice.roll),
  ),

  not: TypedBuiltin(
    FuncType(ConType('Bool'), ConType('Bool')),
    FuncValueJ((b: boolean) => ! b),
  ),

  max: TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Math.max),
  ),
  min: TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    FuncValueJ2(Math.min),
  ),
  abs: TypedBuiltin(
    FuncType(ConType('Num'), ConType('Num')),
    FuncValueJ(Math.abs),
  ),
}

export const builtinData: Record<string, Data> = {
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
}

export const builtinDataCons: Record<string, TypedBuiltin> = pipe(
  builtinData,
  entries(),
  map(([id, { cons, typeParams }]) =>
    cons.map<[string, TypedBuiltin]>(({ id: conId, params }) => [
      conId,
      TypedBuiltin(
        FuncTypeCurried(...params, ApplyTypeCurried(ConType(id), ...typeParams.map(VarType))),
        FuncValueN(params.length)((...args: Value[]) => ConValue(conId, args)),
      )
    ])
  ),
  flat(),
  fromEntries(),
)

export const builtinVals = {
  ...builtinOps,
  ...builtinFuncs,
  ...builtinDataCons,
}

export const builtinEnv: TypeSchemeDict = 
  mapValues(builtinVals, builtin => generalize(builtin.type))