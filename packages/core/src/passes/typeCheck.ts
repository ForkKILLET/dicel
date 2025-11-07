import { match } from 'ts-pattern'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'
import { Err, Ok, Result } from 'fk-result'

import { Core } from '@/node/stage'
import { BindingHostNode, BindingNode, Expr, Pat, InstanceDefNode } from '@/node/node'
import { AstId } from '@/node/astId'

import {
  Type, ConType, VarType, FuncType, TypeScheme, ApplyType, FuncTypeMulti, RigidVarType, TypeEnv, TypeSubst,
  VarTypeSet, Constr, ApplyTypeMulti, ConstrSourced, Evidence,
  BindingEvidenceMap,
  TypeMonoEnv,
  Constrs,
  TypeConstrs,
  BindingEvidenceInfo,
  EvidenceMap,
} from '@/type/type'
import { TypeSourced } from '@/type/source'

import { ClassInfo, ClassMap, InstanceInfo, ClassInstanceMap } from '@/class'
import { SymInfoMap, SymSource } from '@/sym'
import { DataInfo, DataMap } from '@/data'
import { RecordMap } from '@/record'
import { BUILTIN_TYPE_ENV } from '@/builtin/termType'

import { ModStore, PassAction } from '@/pipeline'
import { BindingHostMap, BindingMap, ImportMap, SymSigDeclMap } from '@/passes/nameResolve'
import { BindingGroup, BindingGroupsMap } from '@/passes/bindingGroupResolve'

import { logWith, the, unzip } from '@/utils/compose'
import { Bound } from '@/utils/decorators'
import { Endo } from '@/utils/types'
import { Map, Dict, Iter, DefaultMap } from '@/utils/data'

export type TypedBinding = {
  binding: BindingNode<Core>
  type: TypeSourced
}

export type AstTypeMap = Map<AstId, Type>

export namespace Unify {
  export type Ok = TypeSubst

  export type ErrDetail =
    | { type: 'Recursion' }
    | { type: 'DiffShape' }
    | { type: 'DiffCon' }
    | { type: 'RigidVar', var: string }

  export type Err = ErrDetail & {
    lhs: TypeSourced
    rhs: TypeSourced
  }

  export type ErrWrapped = { type: 'Wrapped', via: 'UnifyErr', err: Unify.Err }

  export const wrapErr = (err: Err): ErrWrapped => ({ type: 'Wrapped', via: 'UnifyErr', err })

  export type Res = Result<Ok, Err>
}

export class VarState {
  constructor(public readonly prefix: string) {}

  protected counter = 0

  protected nextId() {
    return `${this.prefix}${this.counter ++}`
  }
}

export class TypeVarState extends VarState {
  fresh() {
    return VarType(this.nextId())
  }

  freshRigid(customId: string) {
    return RigidVarType(this.nextId(), customId)
  }

  instantiate(scheme: TypeScheme, sources: AstId[], keepRigid = false): TypeConstrs {
    const subst: TypeSubst = pipe(
      scheme.boundVarSet,
      Array.from<VarType>,
      R.map(({ id, rigid }) => [id, keepRigid && rigid ? this.freshRigid(id) : this.fresh()] as const),
      Dict.of,
    )
    return {
      type: TypeSubst.apply(subst)(scheme.type),
      constrs: scheme.constrs.map(constr => pipe(
        constr,
        ConstrSourced.of(sources),
        TypeSubst.applyConstrSourced(subst)
      )),
    }
  }
}

export type TypeInferState = {
  subst: TypeSubst
  constrs: ConstrSourced[]
}

export namespace TypeInferState {
  export const empty = (): TypeInferState => ({
    subst: TypeSubst.empty(),
    constrs: [],
  })

  export const unionConstrs = (constrs: ConstrSourced[]): Endo<TypeInferState> =>
    state => ({
      subst: state.subst,
      constrs: ConstrSourced.union(state.constrs, constrs),
    })

  export const compose2 = (stateOuter: TypeInferState, stateInner: TypeInferState): TypeInferState => ({
    subst: TypeSubst.compose2(stateOuter.subst, stateInner.subst),
    constrs: ConstrSourced.union(
      stateInner.constrs.map(TypeSubst.applyConstrSourced(stateOuter.subst)),
      stateOuter.constrs
    )
  })

  export const compose = (states: TypeInferState[]) => states.reduceRight(
    (stateComposed, state) => compose2(state, stateComposed),
    empty(),
  )
}

export type TypeSubstConstrEnv = TypeInferState & {
  env: TypeEnv
}

export namespace TypeSubstConstrEnv {
  export const empty = (): TypeSubstConstrEnv => ({
    ...TypeInferState.empty(),
    env: TypeEnv.empty(),
  })

  export const ofEnv = (env: TypeEnv): TypeSubstConstrEnv => ({
    ...TypeInferState.empty(),
    env,
  })
}

export type TypeInfer = TypeInferState & {
  type: TypeSourced
}

export namespace TypeInfer {
  export type Ok = TypeInfer

  export type Err = BindingInfer.Err

  export type Res = Result<Ok, Err>

  export const pure = (type: TypeSourced): TypeInfer => ({
    type,
    subst: TypeSubst.empty(),
    constrs: [],
  })
}

export namespace PatInfer {
  export type Ok = {
    env: TypeEnv
    type: TypeSourced
  }

  export type OkUnsourced = {
    env: TypeEnv
    type: Type
  }

  export type ErrUnique =
    | { type: 'WrongConArgCount' }

  export type Err =
    | ErrUnique
    | Unify.ErrWrapped

  export type ErrWrapped =
    | Unify.ErrWrapped
    | { type: 'Wrapped', via: 'PatErr', err: ErrUnique }

  export const wrapErr = (err: Err): ErrWrapped => err.type === 'Wrapped'
    ? err
    : { type: 'Wrapped', via: 'PatErr', err }

  export type Res = Result<Ok, Err>

  export type ResUnsourced = Result<OkUnsourced, Err>
}

export namespace BindingInfer {
  export type Ok = {
    state: TypeInferState
    env: TypeEnv
  }

  export type Err =
    | Unify.ErrWrapped
    | PatInfer.ErrWrapped
    | ConstrsSolve.ErrWrapped

  export type Res = Result<Ok, Err>
}

export namespace InstanceInfer {
  export type Ok = BindingInfer.Ok

  export type ErrUnique =
    | {
      type: 'ExtraConstrs'
      knownConstrs: Constrs
      extraConstrs: Constrs
      class: AstId
      decl: AstId
      def: AstId
    }

  export type Err =
    | BindingInfer.Err
    | ErrUnique

  export type ErrWrapped =
    | BindingInfer.Err
    | { type: 'Wrapped', via: 'InstanceErr', err: ErrUnique }

  export const wrapErr = (err: Err): ErrWrapped => err.type === 'Wrapped'
    ? err
    : { type: 'Wrapped', via: 'InstanceErr', err }

  export type Res = Result<Ok, Err>
}

export namespace ConstrsSolve {
  export type Ok = {
    state: TypeInferState
  }

  export type Err =
    | { type: 'NoInstance', constr: Constr }
    | { type: 'AmbiguousInstance', constr: Constr, instances: InstanceInfo[] }

  export type ErrWrapped = { type: 'Wrapped', via: 'ConstrsSolveErr', err: Err }

  export const wrapErr = (err: Err): ErrWrapped =>
    ({ type: 'Wrapped', via: 'ConstrsSolveErr', err })

  export type Res = Result<Ok, Err>
}

export class TypeInferer {
  static {
    Bound(TypeInferer)
  }

  tvs = new TypeVarState('t')

  bindingEvidenceMap: BindingEvidenceMap = Map.empty()

  astTypeMap: AstTypeMap = Map.empty()

  constructor(
    public readonly bindingMap: BindingMap,
    public readonly bindingHostMap: BindingHostMap,
    public readonly bindingGroupsMap: BindingGroupsMap,
    public readonly symInfoMap: SymInfoMap,
    public readonly classMap: ClassMap,
    public readonly classInstanceMap: ClassInstanceMap,
    public readonly recordMap: RecordMap,
  ) {}

  inferPat(
    pat: Pat<Core>,
    env: TypeEnv,
    envPreset = TypeMonoEnv.empty(),
  ): PatInfer.Res {
    return match<Pat<Core>, PatInfer.ResUnsourced>(pat)
      .with({ ty: 'wildcardPat' }, () => Ok({
        subst: {},
        env: {},
        type: this.tvs.fresh(),
      }))
      .with({ ty: 'numPat' }, () => Ok({
        env: {},
        type: ConType('Num'),
      }))
      .with({ ty: 'varPat' }, ({ symId }) => {
        const type = symId in envPreset
          ? envPreset[symId]
          : this.tvs.fresh()
        return Ok({
          env: { [symId]: TypeScheme.pure(type) },
          type,
        })
      })
      .with({ ty: 'dataPat' }, ({ args: argPatterns, con: { symId }, astId }) => {
        const { type } = this.tvs.instantiate(env[symId], [])
        const conType = TypeSourced.actualPat(type, astId)
        const patternVar = TypeSourced.inferFuncRet(this.tvs.fresh(), astId)
        return Result
          .fold(
            argPatterns,
            { env, argTypes: Array.of<Type>() },
            ({ env, argTypes }, argPattern) => this
              .inferPat(argPattern, env, envPreset)
              .map(({ env: argEnv, type: argType }) => ({
                env: { ...env, ...argEnv },
                argTypes: [...argTypes, argType],
              }))
          )
          .bind(({ env, argTypes }) => Type
            .unify(conType, TypeSourced.actualFunc(FuncTypeMulti(...argTypes, patternVar), astId))
            .mapErr(Unify.wrapErr)
            .map(subst => ({
              env: TypeSubst.applyEnv(subst)(env),
              type: TypeSubst.applySourced(subst)(patternVar),
            }))
          )
      })
      .with({ ty: 'recordPat' }, ({ con, fields, astId }) => {
        const recordId = con.id.id
        const { fieldDict, params, astId: defAstId } = this.recordMap.get(recordId)!
        const substI = pipe(
          params,
          R.map(({ id }) => [id, this.tvs.fresh()] as const),
          Dict.of,
        )
        const paramTypes = R.values(substI)
        return Result
          .fold(
            fields,
            { env, state: TypeInferState.empty() },
            ({ env, state }, { key: { id, astId }, pat }) => this
              .inferPat(pat, env, envPreset)
              .bind(({ type: fieldType, env: fieldEnv }) => Type
                .unify(fieldType, TypeSourced.expectRecordField(
                  TypeSubst.apply(substI)(fieldDict[id].type), astId, defAstId)
                )
                .mapErr(Unify.wrapErr)
                .map(subst => ({
                  state: TypeSubst.applyInferState(subst)(state),
                  env: { ...env, ...fieldEnv },
                }))
              )
          )
          .map(({ env, state }) => ({
            type: TypeSourced.actualPat(
              ApplyTypeMulti(ConType(recordId), ...paramTypes.map(TypeSubst.apply(state.subst))),
              astId,
            ),
            env: TypeSubst.applyEnv(state.subst)(env),
          }))
      })
      .exhaustive()
      .map(({ type, env }) => ({
        env,
        type: TypeSourced.isSourced(type)
          ? type
          : TypeSourced.actualPat(type, pat.astId)
      }))
  }

  inferInstance(
    instance: InstanceInfo,
    instanceDef: InstanceDefNode<Core>,
    env: TypeEnv,
  ): InstanceInfer.Res {
    const { bindingHost } = instanceDef
    const { scope } = this.bindingHostMap.get(bindingHost.astId)!

    const classInfo = this.classMap.get(instance.classId)!
    const substI = { [classInfo.param.id]: instance.arg }
    const classConstrs = TypeSubst.applyConstrs(substI)(classInfo.constrs)

    const { envPreset, constrsPreset } = pipe(
      [...scope.entries()],
      R.map(([id, sym]) => {
        const member = classInfo.members.get(id)!
        const { type: declType, constrs: declConstrs } = pipe(
          member.sigType,
          TypeScheme.free(classInfo.param),
          TypeSubst.applyScheme(substI),
          typeScheme => this.tvs.instantiate(typeScheme, []),
        )
        return [
          [sym.symId, TypeSourced.expectClassMember(declType, member.astId)],
          [sym.symId, declConstrs],
        ] as const
      }),
      unzip,
      ([typeEntries, constrsEntries]) => ({
        envPreset: Dict.of(typeEntries),
        constrsPreset: Dict.of(constrsEntries),
      })
    )

    return this
      .inferBindingHost(bindingHost, env, envPreset)
      .bind(({ env, state }) => Result.fold(
        [...scope.entries()],
        { env, state },
        ({ env, state }, [id, sym]): InstanceInfer.Res => {
          const member = classInfo.members.get(id)!
          const declConstrs = constrsPreset[sym.symId]

          const [defAstId] = SymSource.asNodes(sym.source)
          const defConstrs = env[sym.symId].constrs

          const knownConstrs = TypeSubst.applyConstrs(state.subst)([...classConstrs, ...declConstrs])
          const extraConstrs = defConstrs
            .filter(defConstr => ! Constr.entail(knownConstrs, defConstr))

          if (extraConstrs.length) return Err({
            type: 'ExtraConstrs',
            knownConstrs,
            extraConstrs,
            class: classInfo.astId,
            decl: member.astId,
            def: defAstId,
          })

          return Ok({ env, state })
        }
      ))
  }

  inferBindingHost(
    bindingsHost: BindingHostNode<Core>,
    env: TypeEnv,
    envPreset = TypeMonoEnv.empty(),
  ) {
    return Result
      .fold(
        bindingsHost.bindings,
        { env, bindingTypeMap: Map.empty<AstId, TypeSourced>() },
        ({ env, bindingTypeMap }, binding) => this
          .inferPat(binding.pat, env, envPreset)
          .mapErr(PatInfer.wrapErr)
          .map(({ env: envBinding, type: patType }) => ({
            env: { ...env, ...envBinding },
            bindingTypeMap: bindingTypeMap.set(binding.astId, patType),
          }))
      )
      .bind(({ env, bindingTypeMap }) => this
        .inferBindingHostBody(bindingsHost, env, bindingTypeMap)
      )
  }

  inferBindingHostBody(
    bindingsHost: BindingHostNode<Core>,
    env: TypeEnv,
    bindingTypeMap: Map<AstId, TypeSourced>,
  ): BindingInfer.Res {
    const { symSigDeclMap } = this.bindingHostMap.get(bindingsHost.astId)!
    const bindingGroups = this.bindingGroupsMap.get(bindingsHost.astId)!

    return Result
      .fold(
        bindingGroups,
        { state: TypeInferState.empty(), env },
        ({ state, env }, group) => this
          .inferBindingGroup(group, bindingTypeMap, symSigDeclMap, env)
          .map(({ state: stateGroup, env: envGroup }) => ({
            state: TypeInferState.compose2(stateGroup, state),
            env: { ...env, ...envGroup },
          }))
      )
      .map(({ state, env }) => ({ state, env }))
  }

  solveConstrs(
    state: TypeInferState,
    binding: BindingNode<Core>,
  ): ConstrsSolve.Res {
    const evidenceMap: EvidenceMap = DefaultMap.empty(() => [])
    const bindingEvidence: BindingEvidenceInfo = { paramCount: 0, evidenceMap }
    this.bindingEvidenceMap.set(binding.astId, bindingEvidence)
    const setEvidence = (constr: ConstrSourced, evidence: Evidence) => {
      for (const astId of constr.sources) evidenceMap.get(astId).push(evidence)
    }

    return Result
      .fold(
        state.constrs,
        { state: { subst: state.subst, constrs: [] } },
        ({ state }, constr): Result<{ state: TypeInferState }, ConstrsSolve.Err> => {
          const instances = this.classInstanceMap.get(constr.classId)
          const constrArgType = TypeSourced.constr(Type.rigidify(constr.arg), constr)
          const instancesMatched = instances
            .map(instance => {
              const instanceArgType = TypeSourced.instance(instance.arg, instance)
              return { instance, unify: Type.unify(constrArgType, instanceArgType) }
            })
            .filter(({ unify }) => unify.isOk)
            .map(({ instance, unify }) => ({ instance, subst: unify.unwrap() }))

          if (instancesMatched.length === 0) {
            if (Type.isGround(constrArgType)) return Err({ type: 'NoInstance', constr })
            setEvidence(constr, Evidence.param(bindingEvidence.paramCount ++, constrArgType))
            return Ok({
              state: TypeInferState.unionConstrs([constr])(state),
            })
          }
          if (instancesMatched.length > 1) {
            return Err({ type: 'AmbiguousInstance', constr, instances: instancesMatched.map(R.prop('instance')) })
          }

          const [{ instance, subst }] = instancesMatched

          setEvidence(TypeSubst.applyConstrSourced(subst)(constr), Evidence.instance(instance.instanceId, instance.symId))
          return Ok({
            state: {
              subst: TypeSubst.compose2(subst, state.subst),
              constrs: state.constrs,
            },
          })
        }
      )
  }

  inferBindingGroup(
    { bindings, symIdSet }: BindingGroup,
    bindingTypeMap: Map<AstId, TypeSourced>,
    symSigDeclMap: SymSigDeclMap,
    env: TypeEnv,
  ): BindingInfer.Res {
    return Result.fold(
      bindings,
      { env, state: TypeInferState.empty() },
      ({ env, state }, binding) => this
        .infer(binding.body, env)
        .bind(({ type: valType, ...valState }): BindingInfer.Res => Type
          .unify(valType, TypeSubst.applySourced(valState.subst)(bindingTypeMap.get(binding.astId)!))
          .bind(substU => {
            const valStateU = TypeSubst.applyInferState(substU)(valState)
            const { symIdSet } = this.bindingMap.get(binding.astId)!
            return Result.fold(
              [...symIdSet].filter(Map.keyOf(symSigDeclMap)),
              {
                state: TypeInferState.compose2(valStateU, state),
                env: TypeSubst.applyEnv(valStateU.subst)(env),
              },
              ({ state, env }, symId) => {
                const [bindingVarAstId] = SymSource.asNodes(this.symInfoMap.get(symId)!.source)
                const bindingVar = TypeSourced.inferBindingVar(env[symId].type, bindingVarAstId, binding.astId)
                const { type, constrs } = this.tvs.instantiate(symSigDeclMap.get(symId)!.sig.typeScheme, [], true)
                const annType = TypeSourced.annDecl(type, symSigDeclMap.get(symId)!.astId, symId)
                return Type
                  .unify(bindingVar, annType)
                  .map(substU => ({
                    state: TypeSubst.applyInferState(substU)(TypeInferState.unionConstrs(constrs)(state)),
                    env: TypeSubst.applyEnv(substU)(env),
                  }))
              }
            )
          })
          .mapErr(Unify.wrapErr)
          .bind(({ state, env }) => this
            .solveConstrs(state, binding)
            .mapErr(ConstrsSolve.wrapErr)
            .map(({ state }) => {
              const envFreeVarSet = pipe(
                env,
                Dict.omitBySet(symIdSet),
                R.values(),
                R.map(TypeScheme.collectTypeVars),
                VarTypeSet.union,
              )
              const envG = pipe(
                env,
                Dict.pickBySet(symIdSet),
                R.mapValues(({ type }) => Type.generalize(type, state.constrs, envFreeVarSet))
              )
              return {
                state,
                env: { ...env, ...envG },
              }
            })
          )
        )
    )
  }

  infer(expr: Expr<Core>, env: TypeEnv): TypeInfer.Res {
    return match<Expr<Core>, TypeInfer.Res>(expr)
      .with({ ty: 'num' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ConType('Num'), expr.astId),
      )))
      .with({ ty: 'unit' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ConType(''), expr.astId),
      )))
      .with({ ty: 'var' }, ({ symId, astId }) => {
        const { type, constrs } = this.tvs.instantiate(env[symId], [astId])
        return Ok({
          type: TypeSourced.actual(type, expr.astId),
          subst: {},
          constrs,
        })
      })
      .with({ ty: 'char' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ConType('Char'), expr.astId),
      )))
      .with({ ty: 'str' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ApplyType(ConType('[]'), ConType('Char')), expr.astId),
      )))
      .with({ ty: 'lambda' }, ({ param, body }) => this
        .inferPat(param, env)
        .mapErr(PatInfer.wrapErr)
        .bind(({ env: envH, type: paramType }) => this
          .infer(body, { ...env, ...envH })
          .map(({ type: bodyType, subst: bodySubst, constrs }) => ({
            type: TypeSourced.actual(FuncType(TypeSubst.apply(bodySubst)(paramType), bodyType), expr.astId),
            subst: bodySubst,
            constrs,
          }))
        )
      )
      .with({ ty: 'apply' }, ({ func, arg }) => this
        .infer(func, env)
        .bind(({ type: funcType, ...funcState }) => this
          .infer(arg, TypeSubst.applyEnv(funcState.subst)(env))
          .bind(({ type: argType, ...argState }) => {
            const funcTypeS = TypeSubst.applySourced(argState.subst)(funcType)
            const retVar = TypeSourced.inferFuncRet(this.tvs.fresh(), func.astId)
            const funcTypeA = TypeSourced.actualFunc(FuncType(argType, retVar), expr.astId)
            const stateC = TypeInferState.compose2(argState, funcState)
            return Type
              .unify(funcTypeS, funcTypeA)
              .mapErr(Unify.wrapErr)
              .map(substU => TypeSubst.applyInfer(substU)({
                ...stateC,
                type: retVar,
              }))
          })
        )
      )
      .with({ ty: 'let' }, ({ bindingHost, body }) => this
        .inferBindingHost(bindingHost, env)
        .bind(({ env: envI, state: bindingState }) => this
          .infer(body, { ...env, ...envI })
          .map(({ type: bodyType, ...bodyState }) => ({
            type: bodyType,
            ...TypeInferState.compose2(bodyState, bindingState),
          })
        )
      ))
      .with({ ty: 'case' }, ({ scrutinee, branches }) => this
        .infer(scrutinee, env)
        .bind(({ type: subjectType, ...subjectState }) => {
          const envS = TypeSubst.applyEnv(subjectState.subst)(env)
          const caseVar = the<TypeSourced>(TypeSourced.inferCase(this.tvs.fresh(), expr.astId))

          return Result.fold(
            branches,
            { type: caseVar, ...subjectState },
            ({ type: caseType, ...caseState }, branch) => this
              .inferPat(branch.pat, envS)
              .mapErr(PatInfer.wrapErr)
              .bind(({ env: envH, type: patternType }) => Type
                .unify(TypeSubst.applySourced(caseState.subst)(subjectType), patternType)
                .mapErr(Unify.wrapErr)
                .bind(substU => {
                  const caseStateU = TypeSubst.applyInferState(substU)(caseState)
                  return this
                    .infer(branch.body, TypeSubst.applyEnv(caseStateU.subst)({ ...envS, ...envH }))
                    .bind(({ type: branchType, ...branchState }) => {
                      const stateC = TypeInferState.compose2(branchState, caseStateU)
                      return Type
                        .unify(TypeSubst.applySourced(stateC.subst)(caseType), branchType)
                        .mapErr(Unify.wrapErr)
                        .map(branchSubstU => TypeSubst.applyInfer(branchSubstU)({
                          type: caseType,
                          ...stateC,
                        }))
                    })
                })
              )
          )
        })
      )
      .with({ ty: 'cond' }, ({ cond, yes, no }) =>
        this.infer(cond, env)
          .bind(({ type: condType, ...condState }) => Type
            .unify(condType, TypeSourced.expectCond(ConType('Bool'), expr.astId))
            .mapErr(Unify.wrapErr)
            .bind(substU => {
              const condStateU = TypeSubst.applyInferState(substU)(condState)
              const envS = TypeSubst.applyEnv(condStateU.subst)(env)
              return this.infer(yes, envS)
                .bind(({ type: yesType, ...yesState }) => this
                  .infer(no, TypeSubst.applyEnv(yesState.subst)(envS))
                  .bind(({ type: noType, ...noState }) => Type
                    .unify(yesType, noType)
                    .mapErr(Unify.wrapErr)
                    .map(substU => TypeSubst.applyInfer(substU)({
                      type: noType,
                      ...TypeInferState.compose([noState, yesState, condStateU]),
                    }))
                  )
                )
            })
          )
      )
      .with({ ty: 'ann' }, ({ expr, ann, astId }) => this
        .infer(expr, env)
        .bind(({ type: exprType, ...exprState }) => {
          const { type, constrs } = this.tvs.instantiate(ann.typeScheme, [], true)
          const annType = TypeSourced.annAnn(type, expr.astId)
          return Type
            .unify(exprType, annType)
            .mapErr(Unify.wrapErr)
            .map(substU => TypeSubst.applyInfer(substU)({
              type: annType,
              ...TypeInferState.unionConstrs(constrs)(exprState),
            }))
        })
      )
      .with({ ty: 'record' }, ({ con, fields, astId }) => {
        const recordId = con.id.id
        const { fieldDict: fieldDictDef, params, astId: defAstId } = this.recordMap.get(recordId)!
        const substI = pipe(
          params,
          R.map(({ id }) => [id, this.tvs.fresh()] as const),
          Dict.of,
        )
        const paramTypes = R.values(substI)
        const typedFields = pipe(
          fields,
          R.map(({ key: { id, astId }, val }) => ({
            id,
            val,
            type: TypeSourced.expectRecordField(TypeSubst.apply(substI)(fieldDictDef[id].type), astId, defAstId),
          })),
        )
        return Result
          .fold(
            typedFields,
            TypeInferState.empty(),
            (state, { type, val }) => this
              .infer(val, env)
              .bind(({ type: valType, ...valState }) => Type
                .unify(TypeSubst.applySourced(valState.subst)(type), valType)
                .mapErr(Unify.wrapErr)
                .map(substU => TypeSubst.applyInferState(substU)(TypeInferState.compose2(valState, state)))
              )
          )
          .map(state => ({
            ...state,
            type: TypeSourced.actualRecord(
              ApplyTypeMulti(ConType(recordId), ...paramTypes.map(TypeSubst.apply(state.subst))),
              astId,
            ),
          }))
      })
      .exhaustive()
      .tap(({ type }) => {
        this.astTypeMap.set(expr.astId, type)
      })
  }
}

export namespace TypeCheckMod {
  export type Ok = {
    typeEnv: TypeEnv
    typeEnvIntro: TypeEnv
    typeInferState: TypeInferState
    bindingEvidenceMap: BindingEvidenceMap
    astTypeMap: AstTypeMap
  }

  export type Err =
    | TypeInfer.Err
    | InstanceInfer.ErrWrapped

  export type Res = Result<Ok, Err>

  export type Options = {
    instanceDict: ClassInstanceMap
    bindingMap: BindingMap
    bindingHostMap: BindingHostMap
    bindingGroupsMap: BindingGroupsMap
    symInfoMap: SymInfoMap
    dataMap: DataMap
    importMap: ImportMap
    store: ModStore
  }
}

export const typeCheckMod: PassAction<'typeCheck'> = (modId, store) => {
  const {
    nameResolve: {
      bindingMap, bindingHostMap, instanceMap,
      exportInfo: { dataMap, recordMap, classMap, classInstanceMap },
      importMap, symInfoMap,
    },
    bindingGroupResolve: { bindingGroupsMap },
    semanticsDesugar: { mod },
  } = store.use(modId, ['bindingGroupResolve', 'semanticsDesugar', 'nameResolve'])

  const importTypeEnv = TypeEnv.empty()

  for (const [modId, symIdMap] of importMap) {
    const { typeCheck: { typeEnvIntro } } = store.use(modId, ['typeCheck'])
    for (const sym of symIdMap.byType.get('binding').values()) {
      importTypeEnv[sym.symId] = typeEnvIntro[sym.originSymId!]
    }
  }

  const dataTypeEnv = pipe(
    dataMap.values(),
    Iter.toArray,
    R.flatMap(DataInfo.getTypedIds),
    R.map(({ symId, type }) => [symId, type] as const),
    Dict.of,
  )

  const classTypeEnv = pipe(
    classMap.values(),
    Iter.toArray,
    R.flatMap(ClassInfo.getTypedIds),
    R.map(({ symId, type }) => [symId, type] as const),
    Dict.of,
  )

  const externalTypeEnv = { ...BUILTIN_TYPE_ENV, ...importTypeEnv }
  const baseTypeEnv = { ...externalTypeEnv, ...dataTypeEnv, ...classTypeEnv }

  const inferer = new TypeInferer(
    bindingMap,
    bindingHostMap,
    bindingGroupsMap,
    symInfoMap,
    classMap,
    classInstanceMap,
    recordMap,
  )

  return Result
    .fold(
      mod.instanceDefs,
      { env: baseTypeEnv },
      ({ env }, def) => inferer
        .inferInstance(instanceMap.get(def.astId)!, def, env)
        .mapErr(InstanceInfer.wrapErr)
    )
    .bind(({ env }) => inferer.inferBindingHost(mod.bindingHost, env))
    .map(({ env, state }): TypeCheckMod.Ok => ({
      typeEnv: env,
      typeEnvIntro: pipe(
        env,
        R.omit(R.keys(externalTypeEnv)),
      ),
      ...R.pick(inferer, ['bindingEvidenceMap', 'astTypeMap']),
      typeInferState: state,
    }))
}
