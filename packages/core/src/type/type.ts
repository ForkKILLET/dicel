import { match } from 'ts-pattern'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { DefaultMap, Dict, EqSet, Set } from '@/utils/data'
import { isSymComma } from '@/lex'
import { describeToShow } from '@/show'
import { TypeInferState, TypeInfer, Unify } from '@/passes/typeCheck'
import { SymId } from '@/sym'
import { id, unsnoc } from '@/utils/compose'
import { Endo, Show } from '@/utils/types'

import { TypeSourced } from './source'
import { TyPair } from '@/utils/match'
import { Ok, Err } from 'fk-result'
import { AstId } from '@/node/astId'

export type ConType = {
  ty: 'con'
  id: string
}
export const ConType = (id: string): ConType => ({
  ty: 'con',
  id,
})

export type ApplyType = {
  ty: 'apply'
  func: Type
  arg: Type
}
export const ApplyType = (func: Type, arg: Type): ApplyType => ({
  ty: 'apply',
  func,
  arg,
})
export const ApplyTypeMulti = (...[head, ...tail]: Type[]): ApplyType => tail.length
  ? pipe(
    unsnoc(tail),
    ([tailInit, last]) => ApplyType(ApplyTypeMulti(head, ...tailInit), last)
  )
  : head as ApplyType

export type VarType = {
  ty: 'var'
  id: string
} & (
  | { rigid: false }
  | { rigid: true, customId: string }
)

export const VarType = (id: string): VarType => ({
  ty: 'var',
  id,
  rigid: false,
})
export const RigidVarType = (id: string, customId = id): VarType => ({
  ty: 'var',
  id,
  rigid: true,
  customId,
})

export const VarTypeSet = EqSet<string, VarType>(varType => varType.id)
export type VarTypeSet = EqSet<string, VarType>

export type FuncType = {
  ty: 'func'
  param: Type
  ret: Type
}
export const FuncType = (param: Type, ret: Type): FuncType => ({
  ty: 'func',
  param,
  ret,
})

export const FuncTypeMulti = (...types: Type[]): Type => {
  const [head, ...tail] = types
  return (tail.length
    ? FuncType(head, FuncTypeMulti(...tail))
    : head
  )
}

export type ForallType = {
  ty: 'forall'
  boundVarSet: VarTypeSet
  constrs: Constrs
  type: Type
}
export const ForallType = (boundVarSet: VarTypeSet, constrs: Constrs, type: Type): ForallType => ({
  ty: 'forall',
  boundVarSet,
  constrs,
  type,
})

export type ForallTypeLike = {
  boundVarSet: VarTypeSet
  constrs: Constrs
  type: Type
}
export namespace ForallTypeLike {
  export const show: Show<ForallTypeLike> = ({ boundVarSet, constrs, type }) =>
    (boundVarSet.size ? `∀${[...boundVarSet].map(R.prop('id')).join(' ')}. ` : '') +
    (constrs.length ? `${Constrs.show(constrs)} => ` : '') +
    Type.show(type)
}

export type Type =
  | ConType
  | FuncType
  | VarType
  | ApplyType
  | ForallType

export type TypeTy = Type['ty']

export const extractApplyType = (type: Type): Type[] => type.ty === 'apply'
  ? [...extractApplyType(type.func), type.arg]
  : [type]

export const extractFuncType = (type: FuncType): Type[] => type.ret.ty === 'func'
  ? [type.param, ...extractFuncType(type.ret)]
  : [type.param, type.ret]

export namespace Type {
  export const is = <const Ts extends TypeTy[]>(type: Type, tys: Ts): type is Type & { ty: Ts[number] } =>
    tys.includes(type.ty)

  export function coerce<const Ts extends TypeTy[]>(type: Type, tys: Ts): Type & { ty: Ts[number] } {
    assert(type, tys)
    return type
  }

  export function assert<const Ts extends TypeTy[]>(type: Type, tys: Ts): asserts type is Type & { ty: Ts[number] } {
    if (! tys.includes(type.ty)) throw new TypeError(`Expected type of ty ${tys.join(' | ')}, got ${show(type)}.`)
  }

  export const rigidify = <N extends Type>(type: N): N => match<Type, Type>(type)
    .with({ ty: 'var' }, var_ => RigidVarType(var_.id))
    .with({ ty: 'con' }, id)
    .with({ ty: 'func' }, type => FuncType(rigidify(type.param), rigidify(type.ret)))
    .with({ ty: 'apply' }, type => ApplyType(rigidify(type.func), rigidify(type.arg)))
    .with({ ty: 'forall' }, type => ForallType(type.boundVarSet, type.constrs, rigidify(type.type)))
    .exhaustive() as N

  export const collectTypeVars = (type: Type): VarTypeSet => match<Type, VarTypeSet>(type)
    .with({ ty: 'var' }, VarTypeSet.solo)
    .with({ ty: 'con' }, VarTypeSet.empty)
    .with({ ty: 'func' }, ({ param, ret }) =>
      VarTypeSet.union([collectTypeVars(param), collectTypeVars(ret)])
    )
    .with({ ty: 'apply' }, ({ func, arg }) =>
      VarTypeSet.union([collectTypeVars(func), collectTypeVars(arg)])
    )
    .with({ ty: 'forall' }, ({ boundVarSet, type }) =>
      collectTypeVars(type).difference(boundVarSet)
    )
    .exhaustive()

  export const generalize = (type: Type, constrs: Constrs = [], envFreeVarSet: ReadonlySetLike<VarType> = Set.empty()): TypeScheme => {
    const boundVarSet = collectTypeVars(type).difference(envFreeVarSet)
    return {
      boundVarSet,
      constrs: constrs.filter(constr => constr.arg.ty === 'var' && boundVarSet.has(constr.arg)),
      type,
    }
  }

  export type Desc =
    | { ty: 'dummy', inner: Desc }
    | ConType
    | VarType
    | { ty: 'apply', args: Desc[] }
    | { ty: 'tuple', args: Desc[] }
    | { ty: 'list', arg: Desc }
    | { ty: 'func', args: Desc[] }
    | { ty: 'forall', boundVarSet: VarTypeSet, constrs: Constrs, type: Desc }

  export type DescTy = Desc['ty']

  export const describe = (type: Type): Desc => match<Type, Desc>(type)
    .with({ ty: 'var' }, type => type)
    .with({ ty: 'con' }, type => {
      if (type.id === '') return { ty: 'tuple', args: [] }
      return type
    })
    .with({ ty: 'func' }, type => ({
      ty: 'func',
      args: extractFuncType(type).map(describe),
    }))
    .with({ ty: 'apply' }, type => {
      const types = extractApplyType(type)
      const [func, ...args] = types
      if (func.ty === 'con' && func.id.includes(','))
        return { ty: 'tuple', args: args.map(describe) }
      if (func.ty === 'con' && func.id === '[]')
        return { ty: 'list', arg: describe(args[0]) }
      return { ty: 'apply', args: types.map(describe) }
    })
    .with({ ty: 'forall' }, type => ({
      ty: 'forall',
      boundVarSet: type.boundVarSet,
      constrs: type.constrs,
      type: describe(type.type),
    }))
    .exhaustive()

  export const checkParen = (self: Desc, parent: Desc | null): boolean => parent !== null && (
    self.ty === 'func' && parent.ty === 'func' ||
    self.ty === 'func' && parent.ty === 'apply' ||
    self.ty === 'apply' && parent.ty !== 'func' ||
    self.ty === 'con' && isSymComma(self.id)
  )

  export const show: Show<Type> = describeToShow(
    describe,
    (desc, show) => match<Desc, string>(desc)
      .with({ ty: 'dummy' }, ({ inner }) => show(inner))
      .with({ ty: 'con' }, type => type.id)
      .with({ ty: 'var' }, type => `${type.rigid ? '^' : ''}${type.id}`)
      .with({ ty: 'func' }, ({ args }) => args.map(show).join(' -> '))
      .with({ ty: 'apply' }, ({ args }) => `${args.map(show).join(' ')}`)
      .with({ ty: 'tuple' }, ({ args }) => `(${args.map(show).join(', ')})`)
      .with({ ty: 'list' }, ({ arg }) => `[${show(arg)}]`)
      .with({ ty: 'forall' }, ({ boundVarSet, type: inner }) => `∀${[...boundVarSet].map(R.prop('id')).join(' ')}. ${show(inner)}`)
      .exhaustive(),
    checkParen,
  )

  export const occurs = (typeVar: string, type: Type): boolean => match(type)
    .with({ ty: 'con' }, () => false)
    .with({ ty: 'func' }, ({ param: param, ret }) =>
      occurs(typeVar, param) || occurs(typeVar, ret)
    )
    .with({ ty: 'var' }, ({ id }) => id === typeVar)
    .with({ ty: 'apply' }, ({ func, arg }) =>
      occurs(typeVar, func) || occurs(typeVar, arg)
    )
    .with({ ty: 'forall' }, ({ boundVarSet, type }) =>
      boundVarSet.has(VarType(typeVar)) ? false : occurs(typeVar, type)
    )
    .exhaustive()

  export const equal = (lhs: Type, rhs: Type): boolean =>
    match(TyPair.diff([lhs, rhs]))
      .with({ type: 'diff' }, () => false)
      .with({ ty: 'con' }, { ty: 'var' }, ({ pair: [lhs, rhs] }) => lhs.id === rhs.id)
      .with({ ty: 'func' }, ({ pair: [lhs, rhs] }) => equal(lhs.param, rhs.param) && equal(lhs.ret, rhs.ret))
      .with({ ty: 'apply' }, ({ pair: [lhs, rhs] }) => equal(lhs.func, rhs.func) && equal(lhs.arg, rhs.arg))
      .with({ ty: 'forall' }, ({ pair: [lhs, rhs] }) =>
        lhs.boundVarSet.size === rhs.boundVarSet.size &&
        equal(lhs.type, rhs.type)
      )
      .exhaustive()

  export const unify = (lhs: TypeSourced, rhs: TypeSourced): Unify.Res =>
    match(TyPair.compare([lhs, rhs], 'var'))
      .with({ type: 'both' }, ({ pair: [lhs, rhs] }) =>
        lhs.id === rhs.id
          ? Ok({})
          : lhs.rigid && rhs.rigid
            ? Err({ type: 'RigidVar', lhs, rhs, var: lhs.customId })
            : Ok(lhs.rigid ? { [rhs.id]: lhs } : { [lhs.id]: rhs })
      )
      .with({ type: 'one' }, ({ pair: [lhs, rhs] }) => {
        if (occurs(lhs.id, rhs)) return Err({ type: 'Recursion', lhs, rhs })
        if (lhs.rigid) return Err({ type: 'RigidVar', lhs, rhs, var: lhs.customId })
        return Ok({ [lhs.id]: rhs })
      })
      .with({ type: 'none' }, ({ pair }) => match(TyPair.diff(pair))
        .with({ type: 'diff' }, () => Err({ type: 'DiffShape', lhs, rhs }))
        .with({ ty: 'con' }, ({ pair: [lhs, rhs] }) =>
          lhs.id === rhs.id
            ? Ok({})
            : Err({ type: 'DiffCon', lhs, rhs })
        )
        .with({ ty: 'func' }, ({ pair: [lhs, rhs] }) =>
          unify(TypeSourced.elimFuncParam(lhs), TypeSourced.elimFuncParam(rhs))
            .bind(argSubst =>
              unify(
                TypeSubst.applySourced(argSubst)(TypeSourced.elimFuncRet(lhs)),
                TypeSubst.applySourced(argSubst)(TypeSourced.elimFuncRet(rhs)),
              )
                .map(retSubst => TypeSubst.compose([retSubst, argSubst]))
            )
        )
        .with({ ty: 'apply' }, ({ pair: [lhs, rhs] }) =>
          unify(TypeSourced.elimApplyFunc(lhs), TypeSourced.elimApplyFunc(rhs))
            .bind(funcSubst =>
              unify(
                TypeSubst.applySourced(funcSubst)(TypeSourced.elimApplyArg(lhs)),
                TypeSubst.applySourced(funcSubst)(TypeSourced.elimApplyArg(rhs)),
              )
                .map(argSubst => TypeSubst.compose([argSubst, funcSubst]))
            )
        )
        .with({ ty: 'forall' }, () => {
          throw Error('Cannot unify forall types.')
        })
        .exhaustive()
      )
      .exhaustive()


  export const isGround = (type: Type): boolean =>
    collectTypeVars(type).size === 0
}

export type Constr = {
  classId: string
  arg: Type
}
export namespace Constr {
  export const show: Show<Constr> = ({ classId, arg }) =>
    Type.show(ApplyType(ConType(classId), arg))

  export const entail1 = (constr: Constr, constrNew: Constr): boolean => {
    if (constr.classId !== constrNew.classId) return false
    return Type.equal(constr.arg, constrNew.arg)
  }

  export const entail = (constrs: Constrs, constrNew: Constr): boolean =>
    constrs.some(constr => entail1(constr, constrNew))
}

export type Constrs = Constr[]
export namespace Constrs {
  export const empty = (): Constrs => []

  export const show: Show<Constrs> = (constrs: Constrs) => {
    const inner = constrs.map(Constr.show).join(', ')
    return constrs.length === 1 ? inner : `(${inner})`
  }
}

export type TypeConstrs = {
  type: Type
  constrs: ConstrSourced[]
}
export namespace TypeConstrs {
  export const show: Show<TypeConstrs> = ({ type, constrs }) =>
    `${Type.show(type)} | ${Constrs.show(constrs)}`
}

export type ConstrSourced = Constr & {
  sources: AstId[]
}
export namespace ConstrSourced {
  export const of = (sources: AstId[]) => (constr: Constr): ConstrSourced => ({
    ...constr,
    sources,
  })

  export const unionSources = (sources1: AstId[], sources2: AstId[]): AstId[] => {
    return R.unique([...sources1, ...sources2])
  }

  export const union1 = (constrs: ConstrSourced[], constrNew: ConstrSourced): ConstrSourced[] => {
    const sufficient = constrs.find(constr => Constr.entail1(constr, constrNew))
    if (! sufficient) return constrs.concat([constrNew])
    sufficient.sources = unionSources(sufficient.sources, constrNew.sources)
    return constrs
  }

  export const union = (constrs: ConstrSourced[], constrsNew: ConstrSourced[]): ConstrSourced[] =>
    constrsNew.reduce(union1, constrs)
}


export type Evidence =
  | { type: 'instance', symId: SymId, instanceId: string }
  | { type: 'param', ix: number, argType: Type }
export type EvidenceMap = DefaultMap<AstId, Evidence[]>
export type BindingEvidenceInfo = {
  evidenceMap: EvidenceMap
  paramCount: number
}
export type BindingEvidenceMap = Map<AstId, BindingEvidenceInfo>

export namespace Evidence {
  export const instance = (instanceId: string, symId: SymId): Evidence => ({
    type: 'instance',
    instanceId,
    symId,
  })

  export const param = (ix: number, argType: Type): Evidence => ({
    type: 'param',
    ix,
    argType,
  })
}

export type TypeScheme = {
  boundVarSet: VarTypeSet
  constrs: Constrs
  type: Type
}
export namespace TypeScheme {
  export const pure = (type: Type): TypeScheme => ({
    boundVarSet: VarTypeSet.empty(),
    constrs: [],
    type,
  })

  export const free = (varType: VarType): Endo<TypeScheme> => typeScheme => ({
    ...typeScheme,
    boundVarSet: typeScheme.boundVarSet.clone().delete(varType),
  })

  export const mapType = (transform: (typeScheme: TypeScheme) => Type): Endo<TypeScheme> => typeScheme => ({
    ...typeScheme,
    type: transform(typeScheme),
  })

  export const unionConstrs = (constrs: Constrs): Endo<TypeScheme> => typeScheme => ({
    ...typeScheme,
    constrs: [...typeScheme.constrs, ...constrs],
  })

  export const show: Show<TypeScheme> = ForallTypeLike.show

  export const prettify: Endo<TypeScheme> = typeScheme => {
    const typeParamCount = typeScheme.boundVarSet.size
    const typeParams = [...typeScheme.boundVarSet]
    const prettyIds = typeParamCount <= 3
      ? [...'abc']
      : R.range(0, typeParamCount).map(ix => `t${ix + 1}`)

    const allRigid = typeParams.every(param => param.rigid)

    if (allRigid) return typeScheme

    const subst = TypeSubst.empty()
    const boundVarSet = VarTypeSet.empty()

    typeParams.forEach((param, ix) => {
      const newParam = RigidVarType(param.id, prettyIds[ix])
      subst[param.id] = newParam
      boundVarSet.add(newParam)
    })

    return {
      boundVarSet,
      constrs: typeScheme.constrs.map(TypeSubst.applyConstr(subst)),
      type: TypeSubst.apply(subst)(typeScheme.type),
    }
  }

  export const collectTypeVars = (scheme: TypeScheme): VarTypeSet =>
    Type.collectTypeVars(scheme.type).difference(scheme.boundVarSet)
}

export type TypeDict = Dict<Type>
export namespace TypeDict {
  export const empty = (): TypeDict => ({})
}

export type TypeMonoEnv = Record<SymId, Type>
export namespace TypeMonoEnv {
  export const empty = (): TypeMonoEnv => ({})
}

export type TypeEnv = Record<SymId, TypeScheme>
export namespace TypeEnv {
  export const empty = (): TypeEnv => ({})
}

export type TypeSubst = TypeDict
export namespace TypeSubst {
  export const empty = (): TypeSubst => ({})

  export const applyBound = (subst: TypeSubst, boundVarSet: VarTypeSet): Endo<Type> => {
    const _apply = (type: Type): Type => match(type)
      .with({ ty: 'con' }, () => type)
      .with({ ty: 'var' }, var_ => boundVarSet.has(var_) ? type : subst[var_.id] ?? type)
      .with({ ty: 'func' }, type => FuncType(_apply(type.param), _apply(type.ret)))
      .with({ ty: 'apply' }, type => ApplyType(
        _apply(type.func),
        _apply(type.arg))
      )
      .with({ ty: 'forall' }, type => ForallType(
        type.boundVarSet,
        type.constrs,
        applyBound(subst, VarTypeSet.union([boundVarSet, type.boundVarSet]))(type.type)
      ))
      .exhaustive()
    return _apply
  }

  export const apply = (subst: TypeSubst): Endo<Type> =>
    applyBound(subst, VarTypeSet.empty())

  export const applySourced = (subst: TypeSubst): Endo<TypeSourced> =>
    TypeSourced.mapType(apply(subst))

  export const applyScheme = (subst: TypeSubst): Endo<TypeScheme> =>
    ({ boundVarSet, type, constrs }) => ({
      type: applyBound(subst, boundVarSet)(type),
      boundVarSet,
      constrs: applyConstrs(subst)(constrs),
    })

  export const applyDict = (subst: TypeSubst): Endo<TypeDict> =>
    R.mapValues<TypeDict, Type>(apply(subst))

  export const applyEnv = (subst: TypeSubst): Endo<TypeEnv> =>
    R.mapValues<TypeEnv, TypeScheme>(applyScheme(subst))

  export const applyConstr = (subst: TypeSubst): Endo<Constr> =>
    ({ classId, arg: type }) => ({
      classId,
      arg: apply(subst)(type)
    })

  export const applyConstrs = (subst: TypeSubst): Endo<Constrs> =>
    constrs => constrs.map(applyConstr(subst))

  export const applyConstrSourced = (subst: TypeSubst): Endo<ConstrSourced> =>
    ({ classId, arg: type, sources }) => ({
      classId,
      arg: apply(subst)(type),
      sources,
    })

  export const applyInferState = (subst: TypeSubst): Endo<TypeInferState> =>
    state => ({
      subst: compose2(subst, state.subst),
      constrs: state.constrs.map(applyConstrSourced(subst)),
    })

  export const applyInfer = (subst: TypeSubst): Endo<TypeInfer> =>
    infer => ({
      type: applySourced(subst)(infer.type),
      ...applyInferState(subst)(infer),
    })

  export const compose2 = (substOuter: TypeSubst, substInner: TypeSubst) => ({
    ...substOuter,
    ...applyDict(substOuter)(substInner),
  })

  export const compose = (substs: TypeSubst[]) => substs.reduceRight(
    (substComposed, subst) => compose2(subst, substComposed),
    empty(),
  )
}
