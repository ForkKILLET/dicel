import { describeToShow, Func, Reverse } from './utils'
import { match } from 'ts-pattern'
import { unreachable } from 'parsecond'
import { pipe } from 'remeda'

export interface ConType<K extends string = string> {
  sub: 'con'
  id: string
}
export const ConType = <K extends string>(id: K): ConType<K> => ({
  sub: 'con',
  id,
})

export type DataCon = {
  id: string
  params: Type[]
}

export type Data = {
  typeParams: string[]
  cons: DataCon[]
}

export interface ApplyType<F extends Type = Type, A extends Type = Type> {
  sub: 'apply'
  func: F
  arg: A
}
export const ApplyType = <F extends Type, A extends Type>(func: F, arg: A): ApplyType<F, A> => ({
  sub: 'apply',
  func,
  arg,
})
export type ApplyTypeCurried<As extends Type[] = []>
  = As extends [infer F extends Type]
    ? F
    : As extends [infer A extends Type, ...infer As extends Type[]]
      ? ApplyTypeCurried<As> extends infer F extends Type
        ? ApplyType<F, A>
        : never
      : never
const _ApplyTypeCurried = <const As extends Type[]>(...types: As): ApplyTypeCurried<As> => {
  if (! types.length) throw unreachable()
  const [head, ...tail] = types
  return (tail.length
    ? ApplyType(_ApplyTypeCurried(...tail), head)
    : head
  ) as ApplyTypeCurried<As>
}
export const ApplyTypeCurried = <const As extends Type[]>(...types: As) =>
  _ApplyTypeCurried(...types.toReversed()) as ApplyTypeCurried<Reverse<As>>

export interface VarType<T extends string = string> {
  sub: 'var'
  id: T
}
export const VarType = <T extends string>(id: T): VarType<T> => ({
  sub: 'var',
  id,
})

export interface FuncType<A extends Type = Type, R extends Type = Type> {
  sub: 'func'
  param: A
  ret: R
}
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

export type Type =
  | ConType
  | FuncType
  | VarType
  | ApplyType

export type TypeSub = Type['sub']

export const uncurryApplyType = (type: ApplyType): Type[] => type.func.sub === 'apply'
  ? [...uncurryApplyType(type.func), type.arg]
  : [type.func, type.arg]

export const uncurryFuncType = (type: FuncType): Type[] => type.ret.sub === 'func'
  ? [type.param, ...uncurryFuncType(type.ret)]
  : [type.param, type.ret]

export type TypeDesc =
  | { sub: 'con', id: string }
  | { sub: 'var', id: string }
  | { sub: 'apply', args: TypeDesc[] }
  | { sub: 'tuple', args: TypeDesc[] }
  | { sub: 'func', args: TypeDesc[] }

export type TypeDescSub = TypeDesc['sub']

export const typeNeedsParen = (self: TypeDesc, parent: TypeDesc | null): boolean => parent !== null && (
  self.sub === 'func' && parent.sub === 'func' ||
  self.sub === 'func' && parent.sub === 'apply' ||
  self.sub === 'apply' && parent.sub === 'apply'
)

export const describeType = (type: Type): TypeDesc => match<Type, TypeDesc>(type)
  .with({ sub: 'var' }, type => type)
  .with({ sub: 'con' }, type => {
    if (type.id === '') return { sub: 'tuple', args: [] }
    return type
  })
  .with({ sub: 'func' }, type => ({
    sub: 'func',
    args: uncurryFuncType(type).map(describeType),
  }))
  .with({ sub: 'apply' }, type => {
    const types = uncurryApplyType(type)
    const [func, ...args] = types
    if (func.sub === 'con' && func.id === ',')
      return { sub: 'tuple', args: args.map(describeType) }
    return { sub: 'apply', args: types.map(describeType) }
  })
  .exhaustive()

export namespace Type {
  export const is = (type: Type, subs: TypeSub[]): boolean => subs.includes(type.sub)

  export function assert<S extends TypeSub>(type: Type, sub: S): asserts type is Type & { sub: S } {
    if (type.sub !== sub) throw new TypeError(`Expected type of sub ${sub}, got ${type.sub}.`)
  }

  export const show = describeToShow(
    describeType,
    (desc, show) => match<TypeDesc, string>(desc)
      .with({ sub: 'con' }, { sub: 'var' }, type => type.id)
      .with({ sub: 'func' }, ({ args }) => args.map(show).join(' -> '))
      .with({ sub: 'apply' }, ({ args }) => `${args.map(show).join(' ')}`)
      .with({ sub: 'tuple' }, ({ args }) => `(${args.map(show).join(', ')})`)
      .exhaustive(),
    typeNeedsParen,
  )
}

export type TypePair<T extends Type = Type, U extends Type = Type> = [T, U]
export const TypePair = <T extends Type, U extends Type>(lhs: T, rhs: U): TypePair<T, U> => [lhs, rhs]
export type HomoPair<T extends Type = Type> = TypePair<T, T>

export const isHomoPair = (pair: TypePair): pair is HomoPair => pair[0].sub === pair[1].sub

export type HomoPairMatcher<I extends Type, O, S extends TypeSub = TypeSub> = {
  sub: <So extends S>(
    this: HomoPairMatcher<I, O, S>,
    sub: So,
    fn: (pair: HomoPair<I & { sub: So }>) => O
  ) => HomoPairMatcher<I, O, Exclude<S, So>>
  exhaustive: [S] extends [never] ? () => O : never
}
export const matchHomoPair = <I extends Type, O>(pair: HomoPair<I>) => {
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
  } as HomoPairMatcher<I, O, TypeSub>
  return matcher
}

export type TypeScheme = {
  typeParamSet: Set<string>
  type: Type
}
export namespace TypeScheme {
  export const pure = (type: Type): TypeScheme => ({
    typeParamSet: new Set,
    type,
  })

  export const map = (transform: (typeScheme: TypeScheme) => Type) =>
    (typeScheme: TypeScheme) => pipe(typeScheme, ({ typeParamSet }): TypeScheme => ({
      typeParamSet,
      type: transform(typeScheme),
    }))

  export const show = ({ type, typeParamSet }: TypeScheme): string =>
    `${typeParamSet.size ? `forall ${[...typeParamSet].join(' ')}. ` : ''}${Type.show(type)}`
}

export type TypeDict = Record<string, Type>
export type TypeSchemeDict = Record<string, TypeScheme>

