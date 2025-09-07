import { Dice } from './execute'
import { Fn } from './utils'
import { match } from 'ts-pattern'
import { unreachable } from 'parsecond'
import { pipe } from 'remeda'

export interface ConType {
  sub: 'con'
  id: string
}
export type ConTypeId = 'Num' | 'Bool' | '()'
export const ConType = (id: ConTypeId): ConType => ({
  sub: 'con',
  id,
})

export interface VarType<T extends string = string> {
  sub: 'var'
  id: T
}
export const VarType = <T extends string>(id: T): VarType<T> => ({
  sub: 'var',
  id,
})

export const FuncType = <A extends Type, R extends Type>(param: A, ret: R): FuncType<A, R> => ({
  sub: 'func',
  param,
  ret,
})

export type FuncTypeCurried<As extends Type[] = []>
  = As extends [infer R extends Type]
    ? R
    : As extends [infer A extends Type, ...infer Rs extends Type[]]
      ? FuncTypeCurried<Rs> extends infer R extends Type
        ? FuncType<A, R>
        : never
      : never
export const FuncTypeCurried = <const As extends Type[]>(...types: As): FuncTypeCurried<As> => {
  if (! types.length) throw unreachable()
  const [head, ...tail] = types
  return (tail.length
    ? FuncType(head, FuncTypeCurried(...tail))
    : head
  ) as FuncTypeCurried<As>
}

export interface FuncType<A extends Type = Type, R extends Type = Type> {
  sub: 'func'
  param: A
  ret: R
}

export type Type =
  | ConType
  | FuncType
  | VarType

export type TypeSub = Type['sub']

export type TypeScheme = {
  typeParams: Set<string>
  type: Type
}
export namespace TypeScheme {
  export const pure = (type: Type): TypeScheme => ({
    typeParams: new Set,
    type,
  })

  export const map = (transform: (typeScheme: TypeScheme) => Type) =>
    (typeScheme: TypeScheme) => pipe(typeScheme, ({ typeParams }): TypeScheme => ({
      typeParams,
      type: transform(typeScheme),
    }))
}

export type TypeDict = Record<string, Type>
export type TypeSchemeDict = Record<string, TypeScheme>

export const showFuncType = (type: FuncType): string =>
  `${showTypeParen(type.param.sub === 'func')(type.param)} -> ${showType(type.ret)}`

export const showType = (type: Type): string => match(type)
  .with({ sub: 'con' }, ({ id }) => id)
  .with({ sub: 'func' }, type => showFuncType(type))
  .with({ sub: 'var' }, ({ id }) => id)
  .exhaustive()

export const showTypeScheme = ({ type, typeParams }: TypeScheme): string =>
  `${typeParams.size ? `forall ${[...typeParams].join(' ')}. ` : ''}${showType(type)}`

export const showTypeParen = (pred: boolean) => (type: Type): string => {
  const typeStr = showType(type)
  return pred ? `(${typeStr})` : typeStr
}

export type TypePair<T extends Type = Type, U extends Type = Type> = [T, U]
export const TypePair = <T extends Type, U extends Type>(lhs: T, rhs: U): TypePair<T, U> => [lhs, rhs]
export type HomoTypePair<T extends Type = Type> = TypePair<T, T>

export const isHomoPair = (pair: TypePair): pair is HomoTypePair => pair[0].sub === pair[1].sub

export type HomoTypePairMatcher<I extends Type, O, S extends TypeSub = TypeSub> = {
  sub: <So extends S>(
    this: HomoTypePairMatcher<I, O, S>,
    sub: So,
    fn: (pair: HomoTypePair<I & { sub: So }>) => O
  ) => HomoTypePairMatcher<I, O, Exclude<S, So>>
  exhaustive: (this: HomoTypePairMatcher<I, O, never>) => O
}
export const matchHomoPair = <I extends Type, O>(pair: HomoTypePair<I>) => {
  let result: any = null
  const matcher = {
    sub(sub: TypeSub, fn: (pair: TypePair) => any) {
      if (pair[0].sub === sub) result = fn(pair)
      return matcher
    },
    exhaustive() {
      if (result === null) throw unreachable()
      return result
    }
  } as HomoTypePairMatcher<I, O, Type['sub']>
  return matcher
}
