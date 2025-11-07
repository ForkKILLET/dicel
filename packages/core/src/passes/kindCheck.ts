import { Result, Ok, Err } from 'fk-result'
import { match } from 'ts-pattern'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { ClassDefNode, Mod, SigDeclNode } from '@/node/node'
import { Core } from '@/node/stage'
import { Type } from '@/type/type'
import { VarState } from '@/type/utils'
import { Kind, VarKind, KindEnv, KindSubst, FuncKind, TypeKind, FuncKindMulti, ConstrKind as ConstrKind } from '@/type/kind'
import { BindingHostMap, ImportMap } from '@/passes/nameResolve'
import { DataInfo, DataMap } from '@/data'
import { BUILTIN_KIND_ENV } from '@/builtin/typeKind'
import { Dict, Iter } from '@/utils/data'
import { Bound } from '@/utils/decorators'
import { ModStore, PassAction } from '@/pipeline'
import { RecordInfo, RecordMap } from '@/record'

export class KindVarState extends VarState {
  fresh() {
    return VarKind(this.nextId())
  }
}

export namespace DataKindInfer {
  export type Ok = {
    env: KindEnv
    subst: KindSubst
  }

  export type Err = KindCheck.Err

  export type Res = Result<Ok, Err>
}

export namespace KindCheck {
  export type Ok = {
    subst: KindSubst
    env: KindEnv
  }

  export type Err = KindInfer.Err

  export type Res = Result<Ok, Err>
}

export namespace KindInfer {
  export type Ok = {
    kind: Kind
    subst: KindSubst
  }

  export type Err =
    | { type: 'UndefinedCon', id: string }
    | { type: 'UndefinedVar', id: string }
    | Kind.Unify.ErrWrapped

  export type Res = Result<Ok, Err>
}

export class KindInferer {
  static {
    Bound(KindInferer)
  }

  kvs = new KindVarState('k')

  constructor(
    public readonly bindingHostMaps: BindingHostMap,
    public readonly dataMap: DataMap,
    public readonly recordMap: RecordMap,
  ) {}

  infer(type: Type, env: KindEnv): KindInfer.Res {
    return match<Type, KindInfer.Res>(type)
      .with({ ty: 'con' }, ({ id }) => id in env
        ? Ok({ kind: env[id], subst: {} })
        : Err({ type: 'UndefinedCon', id })
      )
      .with({ ty: 'var' }, ({ id }) => id in env
        ? Ok({ kind: env[id], subst: {} })
        : Err({ type: 'UndefinedVar', id })
      )
      .with({ ty: 'apply' }, ({ func, arg }) => this
        .infer(func, env)
        .bind(({ kind: funcKind, subst: funcSubst }) => this
          .infer(arg, KindSubst.applyDict(funcSubst)(env))
          .bind(({ kind: argKind, subst: argSubst }) => {
            const funcKindS = KindSubst.apply(argSubst)(funcKind)
            const retVar = this.kvs.fresh()
            const funcKindA = FuncKind(argKind, retVar)
            return Kind
              .unify(funcKindS, funcKindA)
              .mapErr(Kind.Unify.wrapErr)
              .map(substU => ({
                kind: KindSubst.apply(substU)(retVar),
                subst: KindSubst.compose([substU, argSubst, funcSubst]),
              }))
          })
        )
      )
      .with({ ty: 'func' }, ({ param, ret }) => this
        .infer(param, env)
        .bind(({ kind: paramKind, subst: paramSubst }) => this
          .infer(ret, KindSubst.applyDict(paramSubst)(env))
          .bind(({ kind: retKind, subst: retSubst }) => Kind
            .unify(paramKind, TypeKind())
            .bind(paramSubstU => Kind
              .unify(retKind, TypeKind())
              .map(retSubstU => ({
                kind: TypeKind(),
                subst: KindSubst.compose([retSubstU, paramSubstU, retSubst, paramSubst]),
              }))
            )
            .mapErr(Kind.Unify.wrapErr)
          )
        )
      )
      .with({ ty: 'forall' }, () => {
        throw Error('Inferring kinds of forall types is not supported')
      })
      .exhaustive()
  }

  inferDataLike(data: DataInfo | RecordInfo, env: KindEnv): KindCheck.Res {
    const { id: dataId, params } = data

    const envH: KindEnv = pipe(
      params,
      R.map(param => [param.id, this.kvs.fresh()] as const),
      Dict.of,
    )

    const dataKindA = FuncKindMulti(...params.map(({ id }) => envH[id]), TypeKind())
    return Kind
      .unify(env[dataId], dataKindA)
      .mapErr(Kind.Unify.wrapErr)
      .bind(dataSubst => {
        const envI = {
          ...KindSubst.applyDict(dataSubst)(env),
          ...envH,
        }
        return Result.fold(
          params,
          { env: envI, subst: dataSubst },
          ({ env, subst: substC }, param) => this
            .infer(param, env)
            .bind(({ kind: paramKind, subst: paramSubst }) => Kind
              .unify(paramKind, TypeKind())
              .mapErr(Kind.Unify.wrapErr)
              .map(paramSubstU => ({
                env: KindSubst.applyDict(paramSubstU)(env),
                subst: KindSubst.compose([paramSubstU, paramSubst, substC]),
              }))
            )
        )
      })
  }

  inferDataLikeList(dataList: (DataInfo | RecordInfo)[], env: KindEnv): DataKindInfer.Res {
    const envH: KindEnv = pipe(
      dataList,
      R.map(def => [def.id, this.kvs.fresh()] as const),
      Dict.of,
    )
    const envI = { ...env, ...envH }

    return Result
      .fold(
        dataList,
        { env: envI, subst: KindSubst.empty() },
        ({ env, subst }, data) => this
          .inferDataLike(data, env)
          .map(({ subst: defSubst, env: dataEnv }) => ({
            env: dataEnv,
            subst: KindSubst.compose2(defSubst, subst),
          }))
      )
      .map(({ env, subst }) => pipe(
        dataList,
        R.map(data => Kind.monomorphize(env[data.id]).subst),
        R.concat([subst]),
        KindSubst.compose,
        subst => ({ env: KindSubst.applyDict(subst)(env), subst })
      ))
  }

  checkSigDecl(decl: SigDeclNode, env: KindEnv): KindCheck.Res {
    const annType = decl.sig.typeScheme.type
    const envH: KindEnv = pipe(
      annType,
      Type.collectTypeVars,
      Iter.of,
      Iter.map(({ id }) => [
        id,
        id in env ? env[id] : this.kvs.fresh()
      ] as const),
      Dict.of,
    )
    const envI = { ...env, ...envH }
    return this
      .infer(annType, envI)
      .bind(({ kind, subst }) => Kind
        .unify(kind, TypeKind())
        .mapErr(Kind.Unify.wrapErr)
        .map(substU => {
          const substC = KindSubst.compose2(substU, subst)
          return {
            subst: substC,
            env: KindSubst.applyDict(substC)(envI),
          }
        })
      )
  }

  checkList<T>(list: T[], check: (item: T, env: KindEnv) => KindCheck.Res, env: KindEnv): KindCheck.Res {
    return Result.fold(
      list,
      { env, subst: KindSubst.empty() },
      ({ env, subst }, item) => check(item, env)
        .map(({ env, subst: checkSubst }) => ({
          env,
          subst: KindSubst.compose2(checkSubst, subst),
        }))
    )
  }

  checkClassDef(def: ClassDefNode, env: KindEnv): KindCheck.Res {
    const classId = def.id.id
    const paramVarId = def.param.type.id

    const envI: KindEnv = {
      ...env,
      [paramVarId]: this.kvs.fresh(),
    }

    const bindingHostMap = this.bindingHostMaps.get(def.bindingHost.astId)!

    return this
      .checkList([...bindingHostMap.idSigDeclMap.values()], this.checkSigDecl, envI)
      .map(({ env, subst }) => ({
        env: { ...env, [classId]: FuncKind(KindSubst.apply(subst)(envI[paramVarId]), ConstrKind()) },
        subst,
      }))
  }

  checkMod(mod: Mod<Core>, env: KindEnv) {
    const bindingHostMap = this.bindingHostMaps.get(mod.bindingHost.astId)!
    return this
      .inferDataLikeList([...this.dataMap.values(), ...this.recordMap.values()], env)
      .bind(({ env }) => this
        .checkList([...bindingHostMap.idSigDeclMap.values()], this.checkSigDecl, env)
        .bind(({ env }) => this
          .checkList(mod.classDefs, this.checkClassDef, env)
        )
      )
  }
}

export namespace KindCheckMod {
  export type Ok = {
    kindEnv: KindEnv
    kindEnvIntro: KindEnv
  }

  export type Err = KindCheck.Err

  export type Res = Result<Ok, Err>

  export type Options = {
    dataMap: DataMap
    bindingHostMaps: BindingHostMap
    importMap: ImportMap
    store: ModStore
  }
}

export const kindCheckMod: PassAction<'kindCheck'> = (modId, store) => {
  const {
    semanticsDesugar: { mod },
    nameResolve: { bindingHostMap: bindingHostMaps, exportInfo: { dataMap, recordMap }, importMap }
  } = store.use(modId, ['nameResolve', 'semanticsDesugar'])

  const importKindEnv = KindEnv.empty()

  for (const [modId, symIdMap] of importMap) {
    const { kindCheck: { kindEnvIntro } } = store.use(modId, ['kindCheck'])
    for (const [id] of symIdMap.byType.get('type')) {
      importKindEnv[id] = kindEnvIntro[id]
    }
  }

  const externalKindEnv = { ...BUILTIN_KIND_ENV, ...importKindEnv }

  const inferer = new KindInferer(
    bindingHostMaps,
    dataMap,
    recordMap,
  )

  return inferer
    .checkMod(mod, externalKindEnv)
    .map(({ env }) => ({
      kindEnv: env,
      kindEnvIntro: R.omit(env, R.keys(externalKindEnv)),
    }))
}
