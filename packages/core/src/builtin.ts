import { mapValues } from 'remeda'
import { ConType, FuncType, VarType, FuncTypeCurried, TypeSchemeDict, Type, ApplyTypeCurried } from './types'
import { Ops } from './parse'
import { BoolValue, ConValue, ErrValue, FuncValue, FuncValue2, FuncValueJ, FuncValueJ2, MVJ, Value } from './values'
import { Dice } from './execute'
import { generalize } from './algorithmW'
import { Func } from './utils'

export interface TypedBuiltin {
  type: Type
  value: Value
}
export const TypedBuiltin = <T extends Type>(type: T, value: Value): TypedBuiltin => ({
  type,
  value,
})

export const builtinOps: Record<Ops, TypedBuiltin> = {
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
    FuncValueJ2<Func, Func, Func>(<a, b, c>(bc: (arg: b) => c, ab: (arg: a) => b): ((arg: a) => c) => (a: a) => bc(ab(a))),
  ),
  '$': TypedBuiltin(
    FuncTypeCurried(FuncType(VarType('a'), VarType('b')), VarType('a'), VarType('b')),
    FuncValueJ2<Func, MVJ, MVJ>(<a, b>(ab: (arg: a) => b, a: a): b => ab(a)),
  ),
}

export const builtinVars: Record<string, TypedBuiltin> = {
  True: TypedBuiltin(
    ConType('Bool'),
    BoolValue(true),
  ),
  False: TypedBuiltin(
    ConType('Bool'),
    BoolValue(false),
  ),

  Left: TypedBuiltin(
    FuncType(VarType('a'), ApplyTypeCurried(ConType('Either'), VarType('a'), VarType('b'))),
    FuncValue(<a extends Value>(a: a) => ConValue('Left', [a])),
  ),
  Right: TypedBuiltin(
    FuncType(VarType('b'), ApplyTypeCurried(ConType('Either'), VarType('a'), VarType('b'))),
    FuncValue(<b extends Value>(b: b) => ConValue('Right', [b])),
  ),

  undefined: TypedBuiltin(
    VarType('a'),
    ErrValue('undefined'),
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

const generalizeBuiltin = (dict: Record<string, TypedBuiltin>): TypeSchemeDict =>
  mapValues(dict, builtin => generalize(builtin.type))

export const builtinEnv: TypeSchemeDict = {
  ...generalizeBuiltin(builtinVars),
  ...generalizeBuiltin(builtinOps),
}