import { match } from 'ts-pattern'
import * as R from 'remeda'
import { pipe, replicate } from '@/utils/compose'
import { Ok, Err, Result } from 'fk-result'

import { Endo, Show } from '@/utils/types'
import { Dict, Set } from '@/utils/data'
import { TyPair } from '@/utils/match'

export type TypeKind = {
  ty: 'type'
}
export const TypeKind = (): TypeKind => ({
  ty: 'type'
})

export type ConstrKind = {
  ty: 'constr'
}
export const ConstrKind = (): ConstrKind => ({
  ty: 'constr'
})

export type FuncKind = {
  ty: 'func'
  param: Kind
  ret: Kind
}
export const FuncKind = (param: Kind, ret: Kind): FuncKind => ({
  ty: 'func',
  param,
  ret,
})
export const FuncKindMulti = (...types: Kind[]): Kind => {
  const [head, ...tail] = types
  return (tail.length
    ? FuncKind(head, FuncKindMulti(...tail))
    : head
  )
}
export const FuncNKind = (n: number): Kind => FuncKindMulti(...replicate(n, TypeKind))

export type VarKind = {
  ty: 'var'
  id: string
}
export const VarKind = (id: string): VarKind => ({
  ty: 'var',
  id,
})

export type Kind =
  | TypeKind
  | ConstrKind
  | FuncKind
  | VarKind

export namespace Kind {
  export const show: Show<Kind> = kind => match<Kind, string>(kind)
    .with({ ty: 'type' }, () => '*')
    .with({ ty: 'constr' }, () => 'constr')
    .with({ ty: 'func' }, ({ param, ret }) =>
      `${param.ty === 'func' ? `(${show(param)})` : show(param)} -> ${show(ret)}`
    )
    .with({ ty: 'var' }, ({ id }) => id)
    .exhaustive()

  export const checkParen = (self: Kind, parent: Kind | null): boolean => parent !== null && (
    self.ty === 'func' && parent.ty === 'func' && parent.param === self
  )

  export const collectKindVars = (kind: Kind): Set<string> => match<Kind, Set<string>>(kind)
    .with({ ty: 'var' }, ({ id }) => Set.of([id]))
    .with({ ty: 'type' }, { ty: 'constr' }, () => Set.empty())
    .with({ ty: 'func' }, ({ param, ret }) =>
      Set.union([collectKindVars(param), collectKindVars(ret)])
    )
    .exhaustive()

  export const occurs = (kindVar: string, kind: Kind): boolean => match(kind)
    .with({ ty: 'type' }, { ty: 'constr' }, () => false)
    .with({ ty: 'var' }, ({ id }) => id === kindVar)
    .with({ ty: 'func' }, ({ param, ret }) =>
      occurs(kindVar, param) || occurs(kindVar, ret)
    )
    .exhaustive()

  export const monomorphize = (kind: Kind): { kind: Kind, subst: KindSubst } => {
    const subst = pipe(
      kind,
      collectKindVars,
      Set.toArray,
      R.map(id => ({ [id]: TypeKind() })),
      R.mergeAll,
    )
    return {
      kind: KindSubst.apply(subst)(kind),
      subst,
    }
  }

  export namespace Unify {
    export type Ok = KindSubst

    export type Err =
      | { type: 'Recursion', lhs: Kind, rhs: Kind }
      | { type: 'DiffShape', lhs: Kind, rhs: Kind }

    export type ErrWrapped = { type: 'UnifyKindErr', err: Unify.Err }

    export const wrapErr = (err: Err): ErrWrapped => ({ type: 'UnifyKindErr', err })

    export type Res = Result<Ok, Err>
  }

  export const unify = (lhs: Kind, rhs: Kind): Unify.Res => {
    const pair: TyPair<Kind> = [lhs, rhs]

    return match(TyPair.compare(pair, 'var'))
      .with({ type: 'both' }, ({ pair: [lhs, rhs] }) =>
        lhs.id === rhs.id
          ? Ok({})
          : Ok({ [rhs.id]: lhs })
      )
      .with({ type: 'one' }, ({ pair: [lhs, rhs] }) => {
        if (Kind.occurs(lhs.id, rhs)) return Err({ type: 'Recursion', lhs, rhs })
        return Ok({ [lhs.id]: rhs })
      })
      .with({ type: 'none' }, ({ pair }) => match(TyPair.diff(pair))
        .with({ type: 'diff' }, () => Err({ type: 'DiffShape', lhs, rhs }))
        .with({ ty: 'type' }, { ty: 'constr' }, () => Ok({}))
        .with({ ty: 'func' }, ({ pair: [lhs, rhs] }) =>
          unify(lhs.param, rhs.param)
            .bind(paramSubst =>
              unify(
                KindSubst.apply(paramSubst)(lhs.ret),
                KindSubst.apply(paramSubst)(rhs.ret),
              )
                .map(retSubst => KindSubst.compose([retSubst, paramSubst]))
            )
        )
        .exhaustive()
      )
      .exhaustive()
  }
}

export type KindDict = Dict<Kind>

export type KindEnv = KindDict
export namespace KindEnv {
  export const empty = (): KindEnv => ({})
}

export type KindSubst = KindDict
export namespace KindSubst {
  export const empty = (): KindSubst => ({})

  export const apply = (subst: KindSubst): Endo<Kind> =>
    (kind) => match(kind)
      .with({ ty: 'type' }, () => kind)
      .with({ ty: 'constr' }, () => kind)
      .with({ ty: 'var' }, ({ id }) => subst[id] ?? kind)
      .with({ ty: 'func' }, kind => FuncKind(apply(subst)(kind.param), apply(subst)(kind.ret)))
      .exhaustive()

  export const applyDict = (subst: KindSubst): Endo<KindDict> =>
    R.mapValues(apply(subst))

  export const compose2 = (substOuter: KindSubst, substInner: KindSubst) => ({
    ...substOuter,
    ...applyDict(substOuter)(substInner),
  })

  export const compose = (substs: KindSubst[]) => substs.reduceRight(
    (substComposed, subst) => compose2(subst, substComposed),
    empty(),
  )
}
