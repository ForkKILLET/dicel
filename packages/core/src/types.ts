import { match } from 'ts-pattern'
import { mapValues, pipe, range } from 'remeda'
import { describeToShow, Dict, unsnoc, EqSet } from './utils'
import { generalize } from './infer'
import { Value } from './values'
import { isSymbolOrComma } from './lex'

export type ConType = {
  sub: 'con'
  id: string
}
export const ConType = (id: string): ConType => ({
  sub: 'con',
  id,
})

export type ApplyType = {
  sub: 'apply'
  func: Type
  arg: Type
}
export const ApplyType = (func: Type, arg: Type): ApplyType => ({
  sub: 'apply',
  func,
  arg,
})
export const ApplyTypeCurried = (...[head, ...tail]: Type[]): Type => tail.length
  ? pipe(
    unsnoc(tail),
    ([tailInit, last]) => ApplyType(ApplyTypeCurried(head, ...tailInit), last)
  )
  : head

export type VarType = {
  sub: 'var'
  id: string
} & (
  | { rigid: false }
  | { rigid: true, customId: string }
)

export const VarType = (id: string): VarType => ({
  sub: 'var',
  id,
  rigid: false,
})
export const RigidVarType = (id: string, customId = id): VarType => ({
  sub: 'var',
  id,
  rigid: true,
  customId,
})

export const VarTypeSet = EqSet<string, VarType>(varType => varType.id)
export type VarTypeSet = EqSet<string, VarType>

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

export const FuncTypeCurried = (...types: Type[]): Type => {
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
  | { sub: 'dummy', inner: TypeDesc }
  | ConType
  | VarType
  | { sub: 'apply', args: TypeDesc[] }
  | { sub: 'tuple', args: TypeDesc[] }
  | { sub: 'list', arg: TypeDesc }
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
      if (func.sub === 'con' && func.id === '[]')
        return { sub: 'list', arg: describe(args[0]) }
      return { sub: 'apply', args: types.map(describe) }
    })
    .exhaustive()

  export const needsParen = (self: TypeDesc, parent: TypeDesc | null): boolean => parent !== null && (
    self.sub === 'func' && parent.sub === 'func' ||
    self.sub === 'func' && parent.sub === 'apply' ||
    self.sub === 'apply' && parent.sub !== 'func' ||
    self.sub === 'con' && isSymbolOrComma(self.id)
  )

  export const show = describeToShow(
    describe,
    (desc, show) => match<TypeDesc, string>(desc)
      .with({ sub: 'dummy' }, ({ inner }) => show(inner))
      .with({ sub: 'con' }, type => type.id)
      .with({ sub: 'var' }, type => `${type.rigid ? '^' : ''}${type.id}`)
      .with({ sub: 'func' }, ({ args }) => args.map(show).join(' -> '))
      .with({ sub: 'apply' }, ({ args }) => `${args.map(show).join(' ')}`)
      .with({ sub: 'tuple' }, ({ args }) => `(${args.map(show).join(', ')})`)
      .with({ sub: 'list' }, ({ arg }) => `[${show(arg)}]`)
      .exhaustive(),
    needsParen,
  )
}

export type TypeScheme = {
  typeParamSet: VarTypeSet
  type: Type
}
export namespace TypeScheme {
  export const pure = (type: Type): TypeScheme => ({
    typeParamSet: VarTypeSet.empty(),
    type,
  })
  export const mapType = (transform: (typeScheme: TypeScheme) => Type) =>
    (typeScheme: TypeScheme) => pipe(typeScheme, ({ typeParamSet }): TypeScheme => ({
      typeParamSet,
      type: transform(typeScheme),
    }))

  export const show = ({ type, typeParamSet }: TypeScheme): string =>
    `${typeParamSet.size ? `∀ ${[...typeParamSet].join(' ')}. ` : ''}${Type.show(type)}`

  export const prettify = (typeScheme: TypeScheme): TypeScheme => {
    const typeParamCount = typeScheme.typeParamSet.size
    const typeParams = [...typeScheme.typeParamSet]
    const prettyIds = typeParamCount <= 3
      ? [...'abc']
      : range(0, typeParamCount).map(i => `t${i + 1}`)

    const allRigid = typeParams.every(param => param.rigid)

    if (allRigid) return typeScheme

    const subst = TypeSubst.empty()
    const typeParamSet = VarTypeSet.empty()

    typeParams.forEach((param, i) => {
      const newParam = RigidVarType(param.id, prettyIds[i])
      subst[param.id] = newParam
      typeParamSet.add(newParam)
    })

    return {
      typeParamSet,
      type: TypeSubst.apply(subst)(typeScheme.type),
    }
  }
}

export type TypeDict = Dict<Type>
export type TypeSchemeDict = Dict<TypeScheme>


export type TypeSubst = TypeDict
export namespace TypeSubst {
  export const empty = (): TypeSubst => ({})

  const _applyScheme = (subst: TypeSubst) => (typeParamSet: VarTypeSet) => {
    const _apply = (type: Type): Type => match(type)
      .with({ sub: 'con' }, () => type)
      .with({ sub: 'var' }, var_ => typeParamSet.has(var_) ? type : subst[var_.id] ?? type)
      .with({ sub: 'func' }, type => FuncType(_apply(type.param), _apply(type.ret)))
      .with({ sub: 'apply' }, type => ApplyType(
        _apply(type.func),
        _apply(type.arg))
      )
      .exhaustive()
    return _apply
  }

  export const apply = (subst: TypeSubst) => _applyScheme(subst)(VarTypeSet.empty())

  export const applyScheme = (subst: TypeSubst) =>
    TypeScheme.mapType(({ typeParamSet, type }: TypeScheme) => _applyScheme(subst)(typeParamSet)(type))

  export const applyDict = (subst: TypeSubst) =>
    mapValues<TypeDict, Type>(apply(subst))

  export const applySchemeDict = (subst: TypeSubst) =>
    mapValues<TypeSchemeDict, TypeScheme>(applyScheme(subst))

  export const compose = (substs: TypeSubst[]) => substs.reduceRight(
    (composed, subst) => {
      const applied = applyDict(subst)(composed)
      return { ...subst, ...applied }
    },
    {}
  )
}

export type TypeEnv = TypeSchemeDict
export namespace TypeEnv {
  export const empty = (): TypeEnv => ({})
}

export type KindEnv = Dict<Kind>
export namespace KindEnv {
  export const empty = (): KindEnv => ({})
}

export interface TypedValue {
  typeScheme: TypeScheme
  value: Value
}
export const TypedValue = <T extends Type>(type: T, value: Value): TypedValue => ({
  typeScheme: generalize(type),
  value,
})

export type TypedValueEnv = Dict<TypedValue>

export const rigidifyType = (type: Type): Type => match(type)
  .with({ sub: 'var' }, var_ => RigidVarType(var_.id))
  .with({ sub: 'con' }, () => type)
  .with({ sub: 'func' }, type => FuncType(rigidifyType(type.param), rigidifyType(type.ret)))
  .with({ sub: 'apply' }, type => ApplyType(rigidifyType(type.func), rigidifyType(type.arg)))
  .exhaustive()

export type TypeKind = {
  sub: 'type'
}
export const TypeKind = (): TypeKind => ({
  sub: 'type'
})

export type FuncKind = {
  sub: 'func'
  param: Kind
  ret: Kind
}
export const FuncKind = (param: Kind, ret: Kind): FuncKind => ({
  sub: 'func',
  param,
  ret,
})
export const FuncKindCurried = (...types: Kind[]): Kind => {
  const [head, ...tail] = types
  return (tail.length
    ? FuncKind(head, FuncKindCurried(...tail))
    : head
  )
}
export const FuncNKind = (n: number): Kind => FuncKindCurried(...range(0, n).map(() => TypeKind()))

export type VarKind = {
  sub: 'var'
  id: string
}
export const VarKind = (id: string): VarKind => ({
  sub: 'var',
  id,
})

export type Kind =
  | TypeKind
  | FuncKind
  | VarKind

export namespace Kind {
  export const show = (kind: Kind): string => match<Kind, string>(kind)
    .with({ sub: 'type' }, () => 'Type')
    .with({ sub: 'func' }, ({ param, ret }) =>
      `${param.sub === 'func' ? `(${show(param)})` : show(param)} -> ${show(ret)}`
    )
    .with({ sub: 'var' }, ({ id }) => id)
    .exhaustive()

  export const needsParen = (self: Kind, parent: Kind | null): boolean => parent !== null && (
    self.sub === 'func' && parent.sub === 'func' && parent.param === self
  )
}

export type KindDict = Dict<Kind>
export type KindSubst = KindDict

export namespace KindSubst {
  export const empty = (): KindSubst => ({})

  export const apply = (subst: KindSubst) => (kind: Kind): Kind => match(kind)
    .with({ sub: 'type' }, () => kind)
    .with({ sub: 'var' }, ({ id }) => subst[id] ?? kind)
    .with({ sub: 'func' }, kind => FuncKind(apply(subst)(kind.param), apply(subst)(kind.ret)))
    .exhaustive()

  export const applyDict = (subst: KindSubst) =>
    mapValues<KindDict, Kind>(apply(subst))

  export const compose = (substs: KindSubst[]) => substs.reduceRight(
    (composed, subst) => {
      const applied = applyDict(subst)(composed)
      return { ...subst, ...applied }
    },
    {}
  )
}
