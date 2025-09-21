import { match } from 'ts-pattern'
import { pipe, range } from 'remeda'
import { describeToShow, notEmpty, unsnoc } from './utils'
import { generalize, TypeSubst } from './infer'
import { Value } from './values'

export interface ConType<K extends string = string> {
  sub: 'con'
  id: string
}
export const ConType = <K extends string>(id: K): ConType<K> => ({
  sub: 'con',
  id,
})

export interface ApplyType {
  sub: 'apply'
  func: Type
  arg: Type
}
export const ApplyType = (func: Type, arg: Type): ApplyType => ({
  sub: 'apply',
  func,
  arg,
})
export const ApplyTypeCurried = (...[head, ...tail]: Type[]): Type => (
  notEmpty(tail)
    ? pipe(
      unsnoc(tail),
      ([tailInit, last]) => ApplyType(ApplyTypeCurried(head, ...tailInit), last)
    )
    : head
)

export type VarType ={
  sub: 'var'
  id: string
}
export const VarType = (id: string): VarType => ({
  sub: 'var',
  id,
})

export type FuncType = {
  sub: 'func'
  param: Type
  ret: Type
}
export const FuncType = (param: Type, ret: Type): FuncType => ({
  sub: 'func',
  param,
  ret,
})

export const FuncTypeCurried = <const As extends Type[]>(...types: As): Type => {
  const [head, ...tail] = types
  return (tail.length
    ? FuncType(head, FuncTypeCurried(...tail))
    : head
  )
}

export type Type =
  | ConType
  | FuncType
  | VarType
  | ApplyType

export type TypeSub = Type['sub']

export const uncurryApplyType = (type: Type): Type[] => type.sub === 'apply'
  ? [...uncurryApplyType(type.func), type.arg]
  : [type]

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

export namespace Type {
  export const is = (type: Type, subs: TypeSub[]): boolean => subs.includes(type.sub)

  export function coerce<const Ss extends TypeSub[]>(type: Type, subs: Ss): Type & { sub: Ss[number] } {
    assert(type, subs)
    return type
  }

  export function assert<const Ss extends TypeSub[]>(type: Type, subs: Ss): asserts type is Type & { sub: Ss[number] } {
    if (! subs.includes(type.sub)) throw new TypeError(`Expected type of sub ${subs.join(' | ')}, got ${Type.show(type)}.`)
  }

  export const describe = (type: Type): TypeDesc => match<Type, TypeDesc>(type)
    .with({ sub: 'var' }, type => type)
    .with({ sub: 'con' }, type => {
      if (type.id === '') return { sub: 'tuple', args: [] }
      return type
    })
    .with({ sub: 'func' }, type => ({
      sub: 'func',
      args: uncurryFuncType(type).map(describe),
    }))
    .with({ sub: 'apply' }, type => {
      const types = uncurryApplyType(type)
      const [func, ...args] = types
      if (func.sub === 'con' && func.id.includes(','))
        return { sub: 'tuple', args: args.map(describe) }
      return { sub: 'apply', args: types.map(describe) }
    })
    .exhaustive()

  export const needsParen = (self: TypeDesc, parent: TypeDesc | null): boolean => parent !== null && (
    self.sub === 'func' && parent.sub === 'func' ||
    self.sub === 'func' && parent.sub === 'apply' ||
    self.sub === 'apply' && parent.sub === 'apply'
  )

  export const show = describeToShow(
    describe,
    (desc, show) => match<TypeDesc, string>(desc)
      .with({ sub: 'con' }, { sub: 'var' }, type => type.id)
      .with({ sub: 'func' }, ({ args }) => args.map(show).join(' -> '))
      .with({ sub: 'apply' }, ({ args }) => `${args.map(show).join(' ')}`)
      .with({ sub: 'tuple' }, ({ args }) => `(${args.map(show).join(', ')})`)
      .exhaustive(),
    needsParen,
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
  let result: O | null = null
  const matcher = {
    sub(sub: TypeSub, fn: (pair: TypePair) => O) {
      if (pair[0].sub === sub) result = fn(pair)
      return matcher
    },
    exhaustive(): O {
      return result!
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
    `${typeParamSet.size ? `∀ ${[...typeParamSet].join(' ')}. ` : ''}${Type.show(type)}`
}

export type TypeDict = Record<string, Type>
export type TypeSchemeDict = Record<string, TypeScheme>

export interface TypedValue {
  typeScheme: TypeScheme
  value: Value
}
export const TypedValue = <T extends Type>(type: T, value: Value): TypedValue => ({
  typeScheme: generalize(type),
  value,
})

export type TypedValueEnv = Record<string, TypedValue>

export const prettify = (typeScheme: TypeScheme): TypeScheme => {
  const typeParamCount = typeScheme.typeParamSet.size
  const typeParamList = range(0, typeParamCount).map(i =>
    typeParamCount <= 3 ? String.fromCharCode('a'.charCodeAt(0) + i) : `t${i + 1}`
  )
  const subst: TypeSubst = Object.fromEntries([...typeScheme.typeParamSet].map((id, i) => [id, VarType(typeParamList[i])]))
  return {
    typeParamSet: new Set(typeParamList),
    type: TypeSubst.apply(subst)(typeScheme.type),
  }
}