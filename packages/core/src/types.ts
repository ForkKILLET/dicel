import { Dice } from './execute'
import { Fn } from './utils'
import { match } from 'ts-pattern'
import { unreachable } from 'parsecond'
import { pipe } from 'remeda'

export interface ConType {
  sub: 'con'
  id: string
}
export type ConTypeId = 'Num' | 'Bool'
export const ConType = (id: ConTypeId): ConType => ({
  sub: 'con',
  id,
})

export interface DiceType<T extends Type = Type> {
  sub: 'dice'
  inner: T
}
export const DiceType = <T extends Type>(inner: T): DiceType<T> => ({
  sub: 'dice',
  inner,
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
  | DiceType
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
  .with({ sub: 'dice' }, ({ inner }) => `Dice ${showTypeParen(inner.sub === 'dice' || inner.sub === 'func')(inner)}`)
  .with({ sub: 'var' }, ({ id }) => id)
  .exhaustive()

export const showTypeScheme = ({ type, typeParams }: TypeScheme): string =>
  `${typeParams.size ? `forall ${[...typeParams].join(' ')}. ` : ''}${showType(type)}`

export const showTypeParen = (pred: boolean) => (type: Type): string => {
  const typeStr = showType(type)
  return pred ? `(${typeStr})` : typeStr
}

export type VTable = Record<string, unknown>

export type Dedup<Ts extends any[]>
  = Ts extends [infer Th, ...infer Tt]
    ? Th extends Tt[number]
      ? Dedup<Tt>
      : [Th, ...Dedup<Tt>]
    : []

export type FreeTypeVars<T extends Type> =
  T extends ConType ? [] :
  T extends DiceType<infer I extends Type> ? FreeTypeVars<I> :
  T extends FuncType<infer A extends Type, infer R extends Type> ?
    [FreeTypeVars<A>, FreeTypeVars<R>] extends [infer AVs extends string[], infer RVs extends string[]]
      ? Dedup<[...AVs, ...RVs]>
      : never
    :
  T extends VarType ? [T['id']] :
  never

export type InferFunc<TF extends FuncType, VT extends VTable = VTable, TL extends boolean = true>
  = TF extends FuncType<infer A extends Type, infer R extends Type>
    ? TL extends true
      ? FreeTypeVars<TF> extends infer Vs extends string[]
        ? Vs extends [infer T1 extends string]
          ? <V1>(arg: Infer<A, VT & Record<T1, V1>, false>) => Infer<R, VT & Record<T1, V1>, false>
        : Vs extends [infer T1 extends string, infer T2 extends string]
          ? <V1, V2>(arg: Infer<A, VT & Record<T1, V1> & Record<T2, V2>, false>) => Infer<R, VT & Record<T1, V1> & Record<T2, V2>, false>
        : Vs extends [infer T1 extends string, infer T2 extends string, infer T3 extends string]
          ? <V1, V2, V3>(arg: Infer<A, VT & Record<T1, V1> & Record<T2, V2> & Record<T3, V3>, false>) => Infer<R, VT & Record<T1, V1> & Record<T2, V2> & Record<T3, V3>, false>
        : Fn
      : never
    : (arg: Infer<A, VT, false>) => Infer<R, VT, false>
  : never

export type Infer<T extends Type, VT extends VTable = VTable, TL extends boolean = true>
  = T extends ConType
    ? T['id'] extends 'Num' ? number
    : T['id'] extends 'Bool' ? boolean
    : never
  : T extends DiceType
    ? Dice<Infer<T['inner'], VT, TL>>
  : T extends FuncType
    ? InferFunc<T, VT, TL>
  : T extends VarType
    ? VT[T['id']]
  : never

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
