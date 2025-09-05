import { ConType, DiceType, FuncType, InferFunc, VarType, FuncTypeCurried, Infer, TypeSchemeDict, TypeDict, Type } from './types'
import { Ops } from './parse'
import { Dice } from './execute'
import { mapValues } from 'remeda'
import { generalize } from './algorithmW'

export interface TypedBuiltin {
  type: Type
  value: any
}
export const TypedBuiltin = <T extends Type>(type: T, value: any /* Infer<T> */): TypedBuiltin => ({
  type,
  value,
})

export const builtinOps: Record<Ops, TypedBuiltin> = {
  '||': TypedBuiltin(
    FuncTypeCurried(ConType('Bool'), ConType('Bool'), ConType('Bool')),
    (lhs: boolean) => (rhs: boolean) => lhs || rhs,
  ),
  '&&': TypedBuiltin(
    FuncTypeCurried(ConType('Bool'), ConType('Bool'), ConType('Bool')),
    (lhs: boolean) => (rhs: boolean) => lhs && rhs,
  ),
  '==': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    (lhs: number) => (rhs: number) => lhs === rhs,
  ),
  '!=': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    (lhs: number) => (rhs: number) => lhs !== rhs,
  ),
  '<': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    (lhs: number) => (rhs: number) => lhs < rhs,
  ),
  '<=': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    (lhs: number) => (rhs: number) => lhs <= rhs,
  ),
  '>': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    (lhs: number) => (rhs: number) => lhs > rhs,
  ),
  '>=': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Bool')),
    (lhs: number) => (rhs: number) => lhs >= rhs,
  ),
  '+': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    (lhs: number) => (rhs: number) => lhs + rhs,
  ),
  '-': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    (lhs: number) => (rhs: number) => lhs - rhs,
  ),
  '*': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    (lhs: number) => (rhs: number) => lhs * rhs,
  ),
  '/': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    (lhs: number) => (rhs: number) => lhs / rhs,
  ),
  '%': TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    (lhs: number) => (rhs: number) => lhs % rhs,
  ),
  '.': TypedBuiltin(
    FuncTypeCurried(FuncType(VarType('b'), VarType('c')), FuncType(VarType('a'), VarType('b')), FuncType(VarType('a'), VarType('c'))),
    <a, b, c>(bc: (arg: b) => c) => (ab: (arg: a) => b): ((arg: a) => c) => (a: a) => bc(ab(a)),
  ),
  '$': TypedBuiltin(
    FuncTypeCurried(FuncType(VarType('a'), VarType('b')), VarType('a'), VarType('b')),
    <a, b>(ab: (arg: a) => b) => (a: a): b => ab(a),
  ),
}

export const builtinVars: Record<string, TypedBuiltin> = {
  True: TypedBuiltin(
    ConType('Bool'),
    true,
  ),
  False: TypedBuiltin(
    ConType('Bool'),
    false,
  ),

  id: TypedBuiltin(
    FuncTypeCurried(VarType('a'), VarType('a')),
    <a>(a: a): a => a,
  ),
  const: TypedBuiltin(
    FuncTypeCurried(VarType('a'), VarType('b'), VarType('a')),
    <a, b>(a: a) => (_: b): a => a,
  ),

  pure: TypedBuiltin(
    FuncType(VarType('a'), DiceType(VarType('a'))),
    <a>(a: a) => new Dice(() => a),
  ),
  map: TypedBuiltin(
    FuncTypeCurried(FuncType(VarType('a'), VarType('b')), DiceType(VarType('a')), DiceType(VarType('b'))),
    <a, b>(ab: (a: a) => b) => (da: Dice<a>): Dice<b> => new Dice(() => ab(da.roll()))
  ),
  bind: TypedBuiltin(
    FuncTypeCurried(FuncType(VarType('a'), DiceType(VarType('b'))), DiceType(VarType('a')), DiceType(VarType('b'))),
    <a, b>(adb: (a: a) => Dice<b>) => (da: Dice<a>): Dice<b> => new Dice(() => adb(da.roll()).roll())
  ),
  fix: TypedBuiltin(
    FuncType(DiceType(VarType('a')), DiceType(VarType('a'))),
    <a>(da: Dice<a>): Dice<a> => {
      let a: a | null = null
      return new Dice(() => a ??= da.roll())
    }
  ),

  max: TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    (lhs: number) => (rhs: number) => Math.max(lhs, rhs),
  ),
  min: TypedBuiltin(
    FuncTypeCurried(ConType('Num'), ConType('Num'), ConType('Num')),
    (lhs: number) => (rhs: number) => Math.min(lhs, rhs),
  ),
  abs: TypedBuiltin(
    FuncType(ConType('Num'), ConType('Num')),
    Math.abs,
  ),
}

const generalizeBuiltin = (dict: Record<string, TypedBuiltin>): TypeSchemeDict =>
  mapValues(dict, builtin => generalize(builtin.type))

export const builtinEnv: TypeSchemeDict = {
  ...generalizeBuiltin(builtinVars),
  ...generalizeBuiltin(builtinOps),
}