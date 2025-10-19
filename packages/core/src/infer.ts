import { match } from 'ts-pattern'
import { concat, fromEntries, keys, map, mapValues, mergeAll, omit, pick, pipe, prop, reduce, unique, values } from 'remeda'
import { Err, Ok, Result } from 'fk-result'
import { Type, ConType, VarType, FuncType, TypeScheme, ApplyType, FuncTypeMulti, RigidVarType, Kind, KindEnv, TypeEnv, TypeSubst, VarKind, FuncKind, KindSubst, TypeKind, FuncKindMulti, VarTypeSet, Constr } from './type'
import { BindingHostDes, BindingRes, ClassDef, ClassDefRes, DataDecl, Decl, ExprDes, LetResExpr, ModDes, ModRes, Node, PatternDes } from './node'
import { Map, the, Set, Graph, Dict, memberOf, Iter, Endo } from './utils'
import { SubbedPair } from './utils/match'
import { Instance, InstanceDict } from './class'

export type TypedBinding = {
  binding: BindingRes<{}, 'des'>
  type: TypeSourced
}

export type TypeSource =
  | { type: 'actual', expr: ExprDes }
  | { type: 'actual.Func', funcNode: ExprDes | PatternDes }
  | { type: 'actual.Pattern', pattern: PatternDes }
  | { type: 'infer.Func.ret', funcNode: ExprDes | PatternDes }
  | { type: 'infer.Binding.var', varId: string, bindingNode: Node }
  | { type: 'infer.Binding.val', valExpr: ExprDes, bindingNode: Node }
  | { type: 'infer.Case', caseExpr: ExprDes }
  | { type: 'infer.Lambda.param', lambdaExpr: ExprDes }
  | { type: 'expect.Cond', condExpr: ExprDes }
  | { type: 'constr', constr: Constr }
  | { type: 'instance', instance: Instance }
  | { type: 'ann.Ann', annExpr: ExprDes }
  | { type: 'ann.Decl', declNode: Decl, varId: string }
  | { type: 'elim.Func.param', from: TypeSourced }
  | { type: 'elim.Func.ret', from: TypeSourced }
  | { type: 'elim.Apply.func', from: TypeSourced }
  | { type: 'elim.Apply.arg', from: TypeSourced }

export type TypeSourced<T extends Type = Type> = T & { source: TypeSource }
export namespace TypeSourced {
  export const actual = <T extends Type>(type: T, expr: ExprDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual', expr },
  })

  export const actualFunc = <T extends Type>(type: T, funcNode: ExprDes | PatternDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.Func', funcNode },
  })

  export const actualPattern = <T extends Type>(type: T, pattern: PatternDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.Pattern', pattern },
  })

  export const inferFuncRet = <T extends Type>(type: T, funcNode: ExprDes | PatternDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Func.ret', funcNode },
  })

  export const inferBindingVar = <T extends Type>(type: T, varId: string, bindingNode: Node): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Binding.var', varId, bindingNode },
  })

  export const inferBindingVal = <T extends Type>(type: T, valExpr: ExprDes, bindingNode: Node): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Binding.val', valExpr, bindingNode },
  })

  export const inferCase = <T extends Type>(type: T, caseExpr: ExprDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Case', caseExpr },
  })

  export const inferLambdaParam = <T extends Type>(type: T, lambdaExpr: ExprDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Lambda.param', lambdaExpr },
  })

  export const expectCond = <T extends Type>(type: T, condExpr: ExprDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'expect.Cond', condExpr },
  })

  export const constr = <T extends Type>(type: T, constr: Constr): TypeSourced<T> => ({
    ...type,
    source: { type: 'constr', constr },
  })

  export const instance = <T extends Type>(type: T, instance: Instance): TypeSourced<T> => ({
    ...type,
    source: { type: 'instance', instance },
  })

  export const annAnn = <T extends Type>(type: T, annExpr: ExprDes): TypeSourced<T> => ({
    ...type,
    source: { type: 'ann.Ann', annExpr },
  })

  export const annDecl = <T extends Type>(type: T, declNode: Decl, varId: string): TypeSourced<T> => ({
    ...type,
    source: { type: 'ann.Decl', declNode, varId },
  })

  export const elimFuncParam = (from: TypeSourced<FuncType>): TypeSourced => ({
    ...from.param,
    source: { type: 'elim.Func.param', from },
  })

  export const elimFuncRet = (from: TypeSourced<FuncType>): TypeSourced => ({
    ...from.ret,
    source: { type: 'elim.Func.ret', from },
  })

  export const elimApplyFunc = (from: TypeSourced<ApplyType>): TypeSourced => ({
    ...from.func,
    source: { type: 'elim.Apply.func', from },
  })

  export const elimApplyArg = (from: TypeSourced<ApplyType>): TypeSourced => ({
    ...from.arg,
    source: { type: 'elim.Apply.arg', from },
  })

  export const mapType = <T extends Type, U extends Type>(transform: (type: T) => U) => (typeSourced: TypeSourced<T>): TypeSourced<U> => ({
    ...transform(typeSourced),
    source: typeSourced.source,
  })
}

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

  export type ErrWrapped = { type: 'UnifyErr', err: Unify.Err }

  export const wrapErr = (err: Err): ErrWrapped => ({ type: 'UnifyErr', err })

  export type Res = Result<Ok, Err>
}

export const occurs = (typeVar: string, type: Type): boolean => match(type)
  .with({ sub: 'con' }, () => false)
  .with({ sub: 'func' }, ({ param: param, ret }) =>
    occurs(typeVar, param) || occurs(typeVar, ret)
  )
  .with({ sub: 'var' }, ({ id }) => id === typeVar)
  .with({ sub: 'apply' }, ({ func, arg }) =>
    occurs(typeVar, func) || occurs(typeVar, arg)
  )
  .exhaustive()

export const unifyType = (lhs: TypeSourced, rhs: TypeSourced): Unify.Res => {
  const pair: SubbedPair<TypeSourced> = [lhs, rhs]

  return match(SubbedPair.compare(pair, 'var'))
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
    .with({ type: 'none' }, ({ pair }) => match(SubbedPair.diff(pair))
      .with({ type: 'diff' }, () => Err({ type: 'DiffShape', lhs, rhs }))
      .with({ sub: 'con' }, ({ pair: [lhs, rhs] }) =>
        lhs.id === rhs.id
          ? Ok({})
          : Err({ type: 'DiffCon', lhs, rhs })
      )
      .with({ sub: 'func' }, ({ pair: [lhs, rhs] }) =>
        unifyType(TypeSourced.elimFuncParam(lhs), TypeSourced.elimFuncParam(rhs))
          .bind(argSubst =>
            unifyType(
              TypeSubst.applySourced(argSubst)(TypeSourced.elimFuncRet(lhs)),
              TypeSubst.applySourced(argSubst)(TypeSourced.elimFuncRet(rhs)),
            )
              .map(retSubst => TypeSubst.compose([retSubst, argSubst]))
          )
      )
      .with({ sub: 'apply' }, ({ pair: [lhs, rhs] }) =>
        unifyType(TypeSourced.elimApplyFunc(lhs), TypeSourced.elimApplyFunc(rhs))
          .bind(funcSubst =>
            unifyType(
              TypeSubst.applySourced(funcSubst)(TypeSourced.elimApplyArg(lhs)),
              TypeSubst.applySourced(funcSubst)(TypeSourced.elimApplyArg(rhs)),
            )
              .map(argSubst => TypeSubst.compose([argSubst, funcSubst]))
          )
      )
      .exhaustive()
    )
    .exhaustive()
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

  instantiate(scheme: TypeScheme, keepRigid = false): { type: Type, constrs: Constr[] } {
    const subst: TypeSubst = pipe(
      scheme.boundVarSet,
      Array.from<VarType>,
      map(({ id, rigid }) => [id, keepRigid && rigid ? this.freshRigid(id) : this.fresh()] as const),
      Dict.of,
    )
    return {
      type: TypeSubst.apply(subst)(scheme.type),
      constrs: scheme.constrs.map(TypeSubst.applyConstr(subst)),
    }
  }
}

export const collectTypeTypeVars = (type: Type): VarTypeSet => match<Type, VarTypeSet>(type)
  .with({ sub: 'var' }, VarTypeSet.solo)
  .with({ sub: 'con' }, VarTypeSet.empty)
  .with({ sub: 'func' }, ({ param, ret }) =>
    VarTypeSet.union([collectTypeTypeVars(param), collectTypeTypeVars(ret)])
  )
  .with({ sub: 'apply' }, ({ func, arg }) =>
    VarTypeSet.union([collectTypeTypeVars(func), collectTypeTypeVars(arg)])
  )
  .exhaustive()

export const isGroundType = (type: Type): boolean =>
  collectTypeTypeVars(type).size === 0

export const collectTypeSchemeTypeVars = (scheme: TypeScheme): VarTypeSet =>
  collectTypeTypeVars(scheme.type).difference(scheme.boundVarSet)

export const collectBindingHostVars = (bindingHost: BindingHostDes): Set<string> =>
  Set.union(bindingHost.bindings.map(binding => collectExprVars(binding.rhs)))

export const collectExprVars = (expr: ExprDes): Set<string> => match<ExprDes, Set<string>>(expr)
  .with({ type: 'ann' }, ({ expr }) => collectExprVars(expr))
  .with({ type: 'apply' }, ({ func, arg }) =>
    Set.union([collectExprVars(func), collectExprVars(arg)])
  )
  .with({ type: 'caseRes' }, ({ subject, branches }) =>
    Set.union([collectExprVars(subject), ...branches.map(({ body }) => collectExprVars(body))])
  )
  .with({ type: 'cond' }, ({ cond, yes, no }) =>
    Set.union([collectExprVars(cond), collectExprVars(yes), collectExprVars(no)])
  )
  .with({ type: 'lambdaRes' }, ({ body, idSet }) =>
    collectExprVars(body).difference(idSet)
  )
  .with({ type: 'letDes' }, ({ bindingHost, body }) =>
    Set.union([collectExprVars(body), collectBindingHostVars(bindingHost)]).difference(bindingHost.idSet)
  )
  .with({ type: 'var' }, ({ id }) => Set.of([id]))
  .otherwise(() => Set.empty())

export const generalize = (type: Type, constrs: Constr[] = [], envFreeVarSet: ReadonlySetLike<VarType> = Set.empty()): TypeScheme => {
  const boundVarSet = collectTypeTypeVars(type).difference(envFreeVarSet)
  return {
    boundVarSet,
    constrs: constrs.filter(constr => constr.arg.sub === 'var' && boundVarSet.has(constr.arg)),
    type,
  }
}

export type TypeInferState = {
  subst: TypeSubst
  constrs: Constr[]
}

export namespace TypeInferState {
  export const empty = (): TypeInferState => ({
    subst: TypeSubst.empty(),
    constrs: [],
  })

  export const concatConstrs = (constrs: Constr[]): Endo<TypeInferState> =>
    state => ({
      subst: state.subst,
      constrs: state.constrs.concat(constrs),
    })

  export const compose2 = (stateOuter: TypeInferState, stateInner: TypeInferState): TypeInferState => ({
    subst: TypeSubst.compose2(stateOuter.subst, stateInner.subst),
    constrs: stateInner.constrs
      .map(TypeSubst.applyConstr(stateOuter.subst))
      .concat(stateOuter.constrs)
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

  export type Err =
    | Unify.ErrWrapped
    | PatternInfer.ErrWrapped
    | ConstrsSolve.ErrWrapped
    | { type: 'UndefinedVar', id: string }
    | { type: 'Unreachable' }
    | { type: 'ConflictDefs', id: string }
    | { type: 'DuplicateDecls', id: string }

  export type Res = Result<Ok, Err>

  export const pure = (type: TypeSourced): TypeInfer => ({
    type,
    subst: TypeSubst.empty(),
    constrs: [],
  })

  export const mapType = (transform: (infer: TypeInfer) => TypeSourced) => (typeInfer: TypeInfer): TypeInfer => ({
    ...typeInfer,
    type: transform(typeInfer),
  })
}

export namespace PatternInfer {
  export type Ok = {
    env: TypeEnv
    type: TypeSourced
  }

  export type OkUnsourced = {
    env: TypeEnv
    type: Type
  }

  export type Err =
    | Unify.ErrWrapped
    | { type: 'WrongConArgCount' }

  export type ErrWrapped =
    | Unify.ErrWrapped
    | { type: 'PatternErr', err: Err }

  export const wrapErr = (err: Err): ErrWrapped => err.type === 'UnifyErr'
    ? err
    : { type: 'PatternErr', err }

  export type Res = Result<Ok, Err>

  export type ResUnsourced = Result<OkUnsourced, Err>
}

export namespace BindingInfer {
  export type Ok = {
    state: TypeInferState
    env: TypeEnv
  }

  export type Err = TypeInfer.Err

  export type Res = Result<Ok, Err>
}

export namespace BindingGroup {
  export type Comp = {
    id: number
    idSet: Set<string>
  }

  export type Group = {
    id: number
    typedBindings: TypedBinding[]
    idSet: string[]
  }

  export type Ok = {
    comps: Comp[]
    groups: Group[]
  }
}

export namespace ConstrsSolve {
  export type Ok = TypeInferState

  export type Err =
    | { type: 'NoInstance', constr: Constr }
    | { type: 'AmbiguousInstance', constr: Constr, instances: Instance[] }

  export type ErrWrapped = { type: 'ConstrsSolveErr', err: Err }

  export const wrapErr = (err: Err): ErrWrapped => ({ type: 'ConstrsSolveErr', err })

  export type Res = Result<Ok, Err>
}

export const resolveBindingGroups = (
  typedBindings: TypedBinding[],
  envH: TypeEnv,
): BindingGroup.Group[] => {
  const idSet = Set.of(keys(envH))
  const bindingMap = Map.empty<string, TypedBinding>()
  const depGraph: Graph<string> = Map.empty()

  for (const typedBinding of typedBindings) {
    const { binding } = typedBinding
    for (const varId of binding.idSet) {
      bindingMap.set(varId, typedBinding)
      depGraph.set(varId, collectExprVars(binding.rhs).intersection(idSet))
    }
  }

  const { comps } = Graph.solveSCCs(depGraph)

  return comps
    .reverse()
    .map(({ color, nodes }): BindingGroup.Group => {
      const idSet = [...nodes]
      const typedBindings = pipe(
        idSet,
        map(varId => bindingMap.get(varId)!),
        unique(),
      )
      return {
        id: color,
        typedBindings,
        idSet: idSet,
      }
    })
}

export class TypeInferer {
  tvs = new TypeVarState('t')

  constructor(
    public readonly instanceDict: InstanceDict = {}
  ) {}

  inferPattern(
    pattern: PatternDes,
    env: TypeEnv,
  ): PatternInfer.Res {
    return match<PatternDes, PatternInfer.ResUnsourced>(pattern)
      .with({ sub: 'wildcard' }, () => Ok({
        subst: {},
        env: {},
        type: this.tvs.fresh(),
      }))
      .with({ sub: 'num' }, { sub: 'unit' }, pattern => {
        const patternType = ConType(match(pattern.sub)
          .with('num', () => 'Num')
          .with('unit', () => '')
          .exhaustive()
        )
        return Ok({
          env: {},
          type: patternType,
        })
      })
      .with({ sub: 'var' }, ({ var: { id } }) => {
        const typeVar = this.tvs.fresh()
        return Ok({
          env: { [id]: TypeScheme.pure(typeVar) },
          type: typeVar,
        })
      })
      .with({ sub: 'con' }, ({ con, args: argPatterns }) => {
        const { type } = this.tvs.instantiate(env[con.id])
        const conType = TypeSourced.actual(type, con)
        const patternVar = TypeSourced.inferFuncRet(this.tvs.fresh(), pattern)
        return Result
          .fold(
            argPatterns,
            { envH: TypeEnv.empty(), argTypes: Array.of<Type>() },
            ({ envH, argTypes }, argPattern) => this
              .inferPattern(argPattern, { ...env, ...envH })
              .map(({ env: argEnv, type: argType }) => ({
                envH: { ...envH, ...argEnv },
                argTypes: [...argTypes, argType],
              }))
          )
          .bind(({ envH, argTypes }) => {
            const funcType = FuncTypeMulti(...argTypes, patternVar)
            return unifyType(conType, TypeSourced.actualFunc(funcType, pattern))
              .mapErr(Unify.wrapErr)
              .map(subst => ({
                env: TypeSubst.applySchemeDict(subst)(envH),
                type: TypeSubst.applySourced(subst)(patternVar),
              }))
          })
      })
      .exhaustive()
      .map(({ type, env }) => ({
        env,
        type: TypeSourced.actualPattern(type, pattern)
      }))
  }

  inferBindingHost(
    bindingsHost: BindingHostDes,
    env: TypeEnv,
  ): BindingInfer.Res {
    return Result
      .fold(
        bindingsHost.bindings,
        { envH: TypeEnv.empty(), typedBindings: Array.of<TypedBinding>() },
        ({ envH, typedBindings }, binding) => this
          .inferPattern(binding.lhs, { ...env, ...envH })
          .mapErr(PatternInfer.wrapErr)
          .map(({ env: envHi, type: patternType }) => ({
            envH: { ...envH, ...envHi },
            typedBindings: typedBindings.concat({
              binding,
              type: patternType,
            }),
          }))
      )
      .bind(({ envH, typedBindings }) => {
        const groups = bindingsHost.bindingGroups = resolveBindingGroups(typedBindings, envH)
        return Result
          .fold(
            groups,
            { stateC: TypeInferState.empty(), envC: { ...env, ...envH } },
            ({ stateC, envC }, group) => this
              .inferBindingGroup(group, bindingsHost.declDict, envC)
              .map(({ state, env }) => ({
                stateC: TypeInferState.compose2(state, stateC),
                envC: { ...envC, ...env },
              }))
          )
          .map(({ stateC, envC }): BindingInfer.Ok => ({
            state: stateC,
            env: envC,
          }))
      })
  }

  solveConstrs(
    state: TypeInferState,
  ): ConstrsSolve.Res {
    console.log('Solving constrs:', state.constrs.map(Constr.show))
    return Result.fold(
      state.constrs,
      { subst: state.subst, constrs: [] },
      (state, constr): ConstrsSolve.Res => {
        const instances = this.instanceDict[constr.classId] ?? []
        const constrArgType = TypeSourced.constr(Type.rigidify(constr.arg), constr)
        const instancesMatched = instances
          .map(instance => {
            const instanceArgType = TypeSourced.instance(instance.arg, instance)
            return { instance, unify: unifyType(constrArgType, instanceArgType) }
          })
          .filter(({ unify }) => unify.isOk)
        if (instancesMatched.length === 0) {
          if (isGroundType(constrArgType)) return Err({ type: 'NoInstance', constr })
          return Ok(TypeInferState.concatConstrs([constr])(state))
        }
        if (instancesMatched.length > 1) {
          return Err({ type: 'AmbiguousInstance', constr, instances: instancesMatched.map(prop('instance')) })
        }
        const [{ unify }] = instancesMatched
        return Ok({
          subst: TypeSubst.compose2(unify.unwrap(), state.subst),
          constrs: state.constrs,
        })
      }
    )
  }

  inferBindingGroup(
    { typedBindings, idSet }: BindingGroup.Group,
    declDict: Dict<Decl>,
    env: TypeEnv,
  ): BindingInfer.Res {
    return Result
      .fold(
        typedBindings,
        { env, state: TypeInferState.empty() },
        ({ env, state }, { binding, type: patternType }) => this
          .infer(binding.rhs, env)
          .bind(({ type: valType, ...valState }): BindingInfer.Res =>
            unifyType(valType, TypeSubst.applySourced(valState.subst)(patternType))
              .bind(substU => {
                const valStateU = TypeSubst.applyInferState(substU)(valState)
                return Result
                  .fold(
                    [...binding.idSet].filter(memberOf(declDict)),
                    {
                      state: TypeInferState.compose2(valStateU, state),
                      env: TypeSubst.applySchemeDict(valStateU.subst)(env),
                    },
                    ({ state, env }, id) => {
                      const bindingVar = TypeSourced.inferBindingVar(env[id].type, id, binding)
                      const { type, constrs } = this.tvs.instantiate(declDict[id].ann.typeScheme, true)
                      const annType = TypeSourced.annDecl(type, declDict[id], id)
                      return unifyType(bindingVar, annType)
                        .map(substU => ({
                          state: TypeSubst.applyInferState(substU)(TypeInferState.concatConstrs(constrs)(state)),
                          env: TypeSubst.applySchemeDict(substU)(env),
                        }))
                    }
                  )
              })
              .mapErr(Unify.wrapErr)
              .bind(({ state, env }) => this
                .solveConstrs(state)
                .mapErr(ConstrsSolve.wrapErr)
                .map((state) => {
                  const envFreeVarSet = pipe(
                    env,
                    omit(idSet),
                    values(),
                    map(collectTypeSchemeTypeVars),
                    VarTypeSet.union,
                  )
                  const envG = pipe(
                    env,
                    pick([...binding.idSet]),
                    mapValues(({ type }) => generalize(type, state.constrs, envFreeVarSet))
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

  infer(expr: ExprDes, env = TypeEnv.empty()): TypeInfer.Res {
    return match<ExprDes, TypeInfer.Res>(expr)
      .with({ type: 'num' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ConType('Num'), expr),
      )))
      .with({ type: 'unit' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ConType(''), expr),
      )))
      .with({ type: 'var' }, ({ id }) => {
        if (! (id in env)) return Err({ type: 'UndefinedVar', id })
        const { type, constrs } = this.tvs.instantiate(env[id])
        return Ok({
          type: TypeSourced.actual(type, expr),
          subst: {},
          constrs,
        })
      })
      .with({ type: 'char' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ConType('Char'), expr),
      )))
      .with({ type: 'str' }, () => Ok(TypeInfer.pure(
        TypeSourced.actual(ApplyType(ConType('[]'), ConType('Char')), expr),
      )))
      .with({ type: 'lambdaRes' }, ({ param, body }) => this
        .inferPattern(param, env)
        .mapErr(PatternInfer.wrapErr)
        .bind(({ env: envH, type: paramType }) => this
          .infer(body, { ...env, ...envH })
          .map(({ type: bodyType, subst: bodySubst, constrs }) => ({
            type: TypeSourced.actual(FuncType(TypeSubst.apply(bodySubst)(paramType), bodyType), expr),
            subst: bodySubst,
            constrs,
          }))
        )
      )
      .with({ type: 'apply' }, ({ func, arg }) => this
        .infer(func, env)
        .bind(({ type: funcType, ...funcState }) => this
          .infer(arg, TypeSubst.applySchemeDict(funcState.subst)(env))
          .bind(({ type: argType, ...argState }) => {
            const funcTypeS = TypeSubst.applySourced(argState.subst)(funcType)
            const retVar = TypeSourced.inferFuncRet(this.tvs.fresh(), func)
            const funcTypeA = TypeSourced.actualFunc(FuncType(argType, retVar), expr)
            const stateC = TypeInferState.compose2(argState, funcState)
            return unifyType(funcTypeS, funcTypeA)
              .mapErr(Unify.wrapErr)
              .map(substU => TypeSubst.applyInfer(substU)({
                ...stateC,
                type: retVar,
              }))
          })
        )
      )
      .with({ type: 'letDes' }, ({ bindingHost, body }) => this
        .inferBindingHost(bindingHost, env)
        .bind(({ env: envI, state: bindingState }) => this
          .infer(body, { ...env, ...envI })
          .map(({ type: bodyType, ...bodyState }) => ({
            type: bodyType,
            ...TypeInferState.compose2(bodyState, bindingState),
          })
        )
      ))
      .with({ type: 'caseRes' }, ({ subject, branches }) => this
        .infer(subject, env)
        .bind(({ type: subjectType, ...subjectState }) => {
          const envS = TypeSubst.applySchemeDict(subjectState.subst)(env)
          const caseVar = the<TypeSourced>(TypeSourced.inferCase(this.tvs.fresh(), expr))

          return Result.fold(
            branches,
            { type: caseVar, ...subjectState },
            ({ type: caseType, ...caseState }, branch) => this
              .inferPattern(branch.pattern, envS)
              .mapErr(PatternInfer.wrapErr)
              .bind(({ env: envH, type: patternType }) =>
                unifyType(TypeSubst.applySourced(caseState.subst)(subjectType), patternType)
                  .mapErr(Unify.wrapErr)
                  .bind(substU => {
                    const caseStateU = TypeSubst.applyInferState(substU)(caseState)
                    return this
                      .infer(branch.body, TypeSubst.applySchemeDict(caseStateU.subst)({ ...envS, ...envH }))
                      .bind(({ type: branchType, ...branchState }) => {
                        const stateC = TypeInferState.compose2(branchState, caseStateU)
                        return unifyType(TypeSubst.applySourced(stateC.subst)(caseType), branchType)
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
      .with({ type: 'cond' }, ({ cond, yes, no }) =>
        this.infer(cond, env)
          .bind(({ type: condType, ...condState }) =>
            unifyType(condType, TypeSourced.expectCond(ConType('Bool'), expr))
              .mapErr(Unify.wrapErr)
              .bind(substU => {
                const condStateU = TypeSubst.applyInferState(substU)(condState)
                const envS = TypeSubst.applySchemeDict(condStateU.subst)(env)
                return this.infer(yes, envS)
                  .bind(({ type: yesType, ...yesState }) => this
                    .infer(no, TypeSubst.applySchemeDict(yesState.subst)(envS))
                    .bind(({ type: noType, ...noState }) =>
                      unifyType(yesType, noType)
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
      .with({ type: 'ann' }, ({ expr, ann }) => this
        .infer(expr, env)
        .bind(({ type: exprType, ...exprState }) => {
          const { type, constrs } = this.tvs.instantiate(ann.typeScheme, true)
          const annType = TypeSourced.annAnn(type, expr)
          return unifyType(exprType, annType)
            .mapErr(Unify.wrapErr)
            .map(substU => TypeSubst.applyInfer(substU)({
              type: annType,
              ...TypeInferState.concatConstrs(constrs)(exprState),
            }))
        })
      )
      .exhaustive()
  }
}

export namespace UnifyKind {
  export type Ok = KindSubst

  export type Err =
    | { type: 'Recursion', lhs: Kind, rhs: Kind }
    | { type: 'DiffShape', lhs: Kind, rhs: Kind }

  export type ErrWrapped = { type: 'UnifyKindErr', err: UnifyKind.Err }

  export const wrapErr = (err: Err): ErrWrapped => ({ type: 'UnifyKindErr', err })

  export type Res = Result<Ok, Err>
}

export const occursKind = (kindVar: string, kind: Kind): boolean => match(kind)
  .with({ sub: 'type' }, { sub: 'constraint' }, () => false)
  .with({ sub: 'var' }, ({ id }) => id === kindVar)
  .with({ sub: 'func' }, ({ param, ret }) =>
    occursKind(kindVar, param) || occursKind(kindVar, ret)
  )
  .exhaustive()

export const unifyKind = (lhs: Kind, rhs: Kind): UnifyKind.Res => {
  const pair: SubbedPair<Kind> = [lhs, rhs]

  return match(SubbedPair.compare(pair, 'var'))
    .with({ type: 'both' }, ({ pair: [lhs, rhs] }) =>
      lhs.id === rhs.id
        ? Ok({})
        : Ok({ [rhs.id]: lhs })
    )
    .with({ type: 'one' }, ({ pair: [lhs, rhs] }) => {
      if (occursKind(lhs.id, rhs)) return Err({ type: 'Recursion', lhs, rhs })
      return Ok({ [lhs.id]: rhs })
    })
    .with({ type: 'none' }, ({ pair }) => match(SubbedPair.diff(pair))
      .with({ type: 'diff' }, () => Err({ type: 'DiffShape', lhs, rhs }))
      .with({ sub: 'type' }, { sub: 'constraint' }, () => Ok({}))
      .with({ sub: 'func' }, ({ pair: [lhs, rhs] }) =>
        unifyKind(lhs.param, rhs.param)
          .bind(paramSubst =>
            unifyKind(
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

export const monomorphizeKind = (kind: Kind): { kind: Kind, subst: KindSubst } => {
  const subst = pipe(
    kind,
    collectKindKindVars,
    Set.toArray,
    map(id => ({ [id]: TypeKind() })),
    mergeAll,
  )
  return {
    kind: KindSubst.apply(subst)(kind),
    subst,
  }
}

export const collectKindKindVars = (kind: Kind): Set<string> => match<Kind, Set<string>>(kind)
  .with({ sub: 'var' }, ({ id }) => Set.of([id]))
  .with({ sub: 'type' }, { sub: 'constraint' }, () => Set.empty())
  .with({ sub: 'func' }, ({ param, ret }) =>
    Set.union([collectKindKindVars(param), collectKindKindVars(ret)])
  )
  .exhaustive()

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
    | UnifyKind.ErrWrapped

  export type Res = Result<Ok, Err>
}

export class KindInferer {
  kvs = new KindVarState('k')

  infer(type: Type, env = KindEnv.empty()): KindInfer.Res {
    return match<Type, KindInfer.Res>(type)
      .with({ sub: 'con' }, ({ id }) => id in env
        ? Ok({ kind: env[id], subst: {} })
        : Err({ type: 'UndefinedCon', id })
      )
      .with({ sub: 'var' }, ({ id }) => id in env
        ? Ok({ kind: env[id], subst: {} })
        : Err({ type: 'UndefinedVar', id })
      )
      .with({ sub: 'apply' }, ({ func, arg }) => this
        .infer(func, env)
        .bind(({ kind: funcKind, subst: funcSubst }) => this
          .infer(arg, KindSubst.applyDict(funcSubst)(env))
          .bind(({ kind: argKind, subst: argSubst }) => {
            const funcKindS = KindSubst.apply(argSubst)(funcKind)
            const retVar = this.kvs.fresh()
            const funcKindA = FuncKind(argKind, retVar)
            return unifyKind(funcKindS, funcKindA)
              .mapErr(UnifyKind.wrapErr)
              .map(substU => ({
                kind: KindSubst.apply(substU)(retVar),
                subst: KindSubst.compose([substU, argSubst, funcSubst]),
              }))
          })
        )
      )
      .with({ sub: 'func' }, ({ param, ret }) => this
        .infer(param, env)
        .bind(({ kind: paramKind, subst: paramSubst }) => this
          .infer(ret, KindSubst.applyDict(paramSubst)(env))
          .bind(({ kind: retKind, subst: retSubst }) =>
            unifyKind(paramKind, TypeKind())
              .bind(paramSubstU =>
                unifyKind(retKind, TypeKind())
                  .map(retSubstU => ({
                    kind: TypeKind(),
                    subst: KindSubst.compose([retSubstU, paramSubstU, retSubst, paramSubst]),
                  }))
              )
              .mapErr(UnifyKind.wrapErr)
          )
        )
      )
      .exhaustive()
  }

  inferDataDecl(decl: DataDecl, env: KindEnv): KindCheck.Res {
    const { data } = decl

    const envH: KindEnv = pipe(
      data.typeParams,
      map(param => [param.id, this.kvs.fresh()] as const),
      Dict.of,
    )

    const dataKindA = FuncKindMulti(...data.typeParams.map(param => envH[param.id]), TypeKind())
    return unifyKind(env[data.id], dataKindA)
      .mapErr(UnifyKind.wrapErr)
      .bind(dataSubst => {
        const envI = {
          ...KindSubst.applyDict(dataSubst)(env),
          ...envH,
        }
        const paramTypes = data.cons.flatMap(con => con.params)
        return Result.fold(
          paramTypes,
          { env: envI, subst: dataSubst },
          ({ env: envC, subst: substC }, paramType) => this
            .infer(paramType, envC)
            .bind(({ kind: paramKind, subst: paramSubst }) =>
              unifyKind(paramKind, TypeKind())
                .mapErr(UnifyKind.wrapErr)
                .map(paramSubstU => ({
                  env: KindSubst.applyDict(paramSubstU)(envC),
                  subst: KindSubst.compose([paramSubstU, paramSubst, substC]),
                }))
            )
        )
      })
  }

  inferDataDecls(decls: DataDecl[], env: KindEnv): DataKindInfer.Res {
    const envH: KindEnv = pipe(
      decls,
      map(data => [data.id, this.kvs.fresh()] as const),
      fromEntries(),
    )
    const envI = { ...env, ...envH }

    return Result
      .fold(
        decls,
        { env: envI, subst: KindSubst.empty() },
        ({ env, subst }, decl) => this
          .inferDataDecl(decl, env)
          .map(({ subst: declSubst, env: declEnv }) => ({
            env: declEnv,
            subst: KindSubst.compose2(declSubst, subst),
          }))
      )
      .map(({ env, subst }) => pipe(
        decls,
        map(decl => monomorphizeKind(env[decl.id]).subst),
        concat([subst]),
        KindSubst.compose,
        subst => ({ env: KindSubst.applyDict(subst)(env), subst })
      ))
  }

  checkDecl(decl: Decl, env: KindEnv): KindCheck.Res {
    const annType = decl.ann.typeScheme.type
    const envH: KindEnv = pipe(
      annType,
      collectTypeTypeVars,
      Iter.from,
      Iter.map(param => [param.id, this.kvs.fresh()] as const),
      Dict.of,
    )
    const envI = { ...env, ...envH }
    return this
      .infer(annType, envI)
      .bind(({ kind, subst }) =>
        unifyKind(kind, TypeKind())
          .mapErr(UnifyKind.wrapErr)
          .map(substU => ({
            subst: KindSubst.compose2(substU, subst),
            env: KindSubst.applyDict(substU)(envI),
          }))
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

  checkClassDef(def: ClassDefRes, env: KindEnv): KindCheck.Res {
    const envI: KindEnv = {
      ...env,
      [def.param.id]: this.kvs.fresh(),
    }

    return this.checkList(values(def.bindingHost.declDict), this.checkDecl.bind(this), envI)
  }

  checkMod(mod: ModRes, env: KindEnv) {
    return this
      .inferDataDecls(mod.dataDecls, env)
      .bind(({ env }) => this
        .checkList(values(mod.bindingHost.declDict), this.checkDecl.bind(this), env)
        .bind(({ env }) => this
          .checkList(values(mod.classDefDict), this.checkClassDef.bind(this), env)
        )
      )
  }
}
