import { match } from 'ts-pattern'
import { fromEntries, keys, map, mapValues, mergeAll, omit, pick, pipe, reduce, unique, values } from 'remeda'
import { Err, Ok, Result } from 'fk-result'
import { Type, ConType, VarType, FuncType, TypeScheme, ApplyType, FuncTypeCurried, RigidVarType, Kind, KindEnv, TypeEnv, TypeSubst, VarKind, FuncKind, KindSubst, TypeKind, FuncKindCurried, VarTypeSet } from './types'
import { BindingHostDes, BindingRes, DataDecl, Decl, ExprDes, LetResExpr, ModDes, Node, PatternDes } from './nodes'
import { Map, the, Set, Graph, Dict, memberOf, Iter } from './utils'
import { SubbedPair } from './utils/match'

export type TypedBinding = {
  binding: BindingRes<{}, 'des'>
  env: TypeEnv
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

  export const map = <T extends Type, U extends Type>(typeSourced: TypeSourced<T>, transform: (type: T) => U): TypeSourced<U> => ({
    ...transform(typeSourced),
    source: typeSourced.source,
  })

  export const appliedBy = (subst: TypeSubst) => (typeSourced: TypeSourced) : TypeSourced => map(typeSourced, TypeSubst.apply(subst))
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

export const unify = (lhs: TypeSourced, rhs: TypeSourced): Unify.Res => {
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
        unify(TypeSourced.elimFuncParam(lhs), TypeSourced.elimFuncParam(rhs))
          .bind(argSubst =>
            unify(
              TypeSourced.appliedBy(argSubst)(TypeSourced.elimFuncRet(lhs)),
              TypeSourced.appliedBy(argSubst)(TypeSourced.elimFuncRet(rhs)),
            )
              .map(retSubst => TypeSubst.compose([retSubst, argSubst]))
          )
      )
      .with({ sub: 'apply' }, ({ pair: [lhs, rhs] }) =>
        unify(TypeSourced.elimApplyFunc(lhs), TypeSourced.elimApplyFunc(rhs))
          .bind(funcSubst =>
            unify(
              TypeSourced.appliedBy(funcSubst)(TypeSourced.elimApplyArg(lhs)),
              TypeSourced.appliedBy(funcSubst)(TypeSourced.elimApplyArg(rhs)),
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
    return `${this.prefix}${this.counter++}`
  }
}

export class TypeVarState extends VarState {
  fresh() {
    return VarType(this.nextId())
  }

  freshRigid(customId: string) {
    return RigidVarType(this.nextId(), customId)
  }

  instantiate(scheme: TypeScheme): Type {
    const subst: TypeSubst = pipe(
      scheme.typeParamSet,
      Array.from<VarType>,
      map(({ id }) => [id, this.fresh()] as const),
      fromEntries(),
    )
    return TypeSubst.apply(subst)(scheme.type)
  }

  skolemize(type: Type): Type {
    const subst = pipe(
      collectTypeTypeVars(type),
      Array.from<VarType>,
      map(({ id }) => [id, this.freshRigid(id)] as const),
      fromEntries(),
    )
    return TypeSubst.apply(subst)(type)
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

export const collectTypeSchemeTypeVars = (scheme: TypeScheme): VarTypeSet =>
  collectTypeTypeVars(scheme.type).difference(scheme.typeParamSet)

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

export const generalize = (type: Type, boundTypeVars: ReadonlySetLike<VarType> = Set.empty()): TypeScheme => ({
  typeParamSet: collectTypeTypeVars(type).difference(boundTypeVars),
  type,
})

export namespace InferType {
  export type Ok = {
    type: TypeSourced
    subst: TypeSubst
  }

  export type Err =
    | Unify.ErrWrapped
    | InferPattern.ErrWrapped
    | { type: 'UndefinedVar', id: string }
    | { type: 'Unreachable' }
    | { type: 'ConflictDefs', id: string }
    | { type: 'DuplicateDecls', id: string }

  export type Res = Result<Ok, Err>
}

export namespace InferPattern {
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

export namespace InferBinding {
  export type Ok = {
    varIds: Set<string>
    env: TypeEnv
    subst: TypeSubst
  }

  export type Err = InferType.Err

  export type Res = Result<Ok, Err>
}

export namespace BindingGroup {
  export type Comp = {
    id: number
    varIds: Set<string>
  }


  export type Group = {
    id: number
    typedBindings: TypedBinding[]
    varIds: string[]
  }

  export type Ok = {
    comps: Comp[]
    groups: Group[]
  }
}

export const resolveBindingGroups = (
  typedBindings: TypedBinding[],
  envH: TypeEnv,
): BindingGroup.Group[] => {
  const varIds = Set.of(keys(envH))
  const bindingMap = Map.empty<string, TypedBinding>()
  const depGraph: Graph<string> = Map.empty()

  for (const typedBinding of typedBindings) {
    const { binding, env } = typedBinding
    for (const varId of keys(env)) {
      bindingMap.set(varId, typedBinding)
      depGraph.set(varId, collectExprVars(binding.rhs).intersection(varIds))
    }
  }

  const { comps } = Graph.solveSCCs(depGraph)

  return comps
    .reverse()
    .map(({ color, nodes }): BindingGroup.Group => {
      const varIds = [...nodes]
      const typedBindings = pipe(
        varIds,
        map(varId => bindingMap.get(varId)!),
        unique(),
      )
      return {
        id: color,
        typedBindings,
        varIds,
      }
    })
}

export class TypeInferer {
  tvs = new TypeVarState('t')

  inferPattern(
    pattern: PatternDes,
    env: TypeEnv,
  ): InferPattern.Res {
    return match<PatternDes, InferPattern.ResUnsourced>(pattern)
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
        const conType = TypeSourced.actual(this.tvs.instantiate(env[con.id]), con)
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
            const funcType = FuncTypeCurried(...argTypes, patternVar)
            return unify(conType, TypeSourced.actualFunc(funcType, pattern))
              .mapErr(Unify.wrapErr)
              .map(subst => ({
                env: TypeSubst.applySchemeDict(subst)(envH),
                type: TypeSourced.appliedBy(subst)(patternVar),
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
  ): InferBinding.Res {
    return Result
      .fold(
        bindingsHost.bindings,
        { envH: TypeEnv.empty(), typedBindings: Array.of<TypedBinding>() },
        ({ envH, typedBindings }, binding) => this
          .inferPattern(binding.lhs, { ...env, ...envH })
          .mapErr(InferPattern.wrapErr)
          .map(({ env: envHi, type: patternType }) => ({
            envH: { ...envH, ...envHi },
            typedBindings: typedBindings.concat({
              binding,
              env: envHi,
              type: patternType,
            }),
          }))
      )
      .bind(({ envH, typedBindings }) => {
        const groups = bindingsHost.bindingGroups = resolveBindingGroups(typedBindings, envH)
        return Result
          .fold(
            groups,
            { substC: TypeSubst.empty(), envS: { ...env, ...envH } },
            ({ substC, envS }, group) => this
              .inferBindingGroup(group, bindingsHost.declDict, envS)
              .map(({ subst, env: envSi }) => ({
                substC: TypeSubst.compose([subst, substC]),
                envS: { ...envS, ...envSi },
              }))
          )
          .map(({ substC, envS }) => ({
            subst: substC,
            env: envS,
            varIds: Set.of(keys(envH)),
          }))
      })
  }

  inferBindingGroup(
    { typedBindings, varIds: varIds }: BindingGroup.Group,
    declDict: Dict<Decl>,
    env: TypeEnv,
  ) {
    return Result
      .fold(
        typedBindings,
        { substC: TypeSubst.empty(), envS: env },
        ({ substC, envS }, { binding, env: envHi, type: patternType }) => this
          .infer(binding.rhs, envS)
          .bind(({ type: valType, subst: valSubst }) =>
            unify(valType, TypeSourced.appliedBy(valSubst)(patternType))
              .bind(substU => {
                const valSubstC = TypeSubst.compose([substU, valSubst])
                return Result
                  .fold(
                    keys(envHi).filter(memberOf(declDict)),
                    {
                      substC: TypeSubst.compose([valSubstC, substC]),
                      envC: TypeSubst.applySchemeDict(valSubstC)(envS),
                    },
                    ({ substC, envC }, id) => {
                      const bindingVar = TypeSourced.inferBindingVar(envC[id].type, id, binding)
                      const annType = TypeSourced.annDecl(
                        this.tvs.skolemize(declDict[id].ann.val),
                        declDict[id],
                        id,
                      )
                      return unify(bindingVar, annType)
                        .map(substU => ({
                          substC: TypeSubst.compose([substU, substC]),
                          envC: TypeSubst.applySchemeDict(substU)(envC),
                        }))
                    }
                  )
              })
              .mapErr(Unify.wrapErr)
              .map(({ substC, envC }) => {
                const boundTypeVars = pipe(
                  envC,
                  omit(varIds),
                  values(),
                  map(collectTypeSchemeTypeVars),
                  VarTypeSet.union,
                )
                const envGi = pipe(
                  envC,
                  pick(keys(envHi)),
                  mapValues(({ type }) => generalize(type, boundTypeVars))
                )
                return {
                  substC,
                  envS: { ...envC, ...envGi },
                }
              })
          )
      )
      .map(({ substC, envS }) => ({ subst: substC, env: envS }))
  }

  infer(expr: ExprDes, env = TypeEnv.empty()): InferType.Res {
    return match<ExprDes, InferType.Res>(expr)
      .with({ type: 'num' }, () => Ok({
        type: TypeSourced.actual(ConType('Num'), expr),
        subst: {},
      }))
      .with({ type: 'unit' }, () => Ok({
        type: TypeSourced.actual(ConType('()'), expr),
        subst: {},
      }))
      .with({ type: 'var' }, ({ id }) =>
        id in env
          ? Ok({
            type: TypeSourced.actual(this.tvs.instantiate(env[id]), expr),
            subst: {},
          })
          : Err({ type: 'UndefinedVar', id })
      )
      .with({ type: 'char' }, () => Ok({
        type: TypeSourced.actual(ConType('Char'), expr),
        subst: {},
      }))
      .with({ type: 'str' }, () => Ok({
        type: TypeSourced.actual(ApplyType(ConType('[]'), ConType('Char')), expr),
        subst: {},
      }))
      .with({ type: 'lambdaRes' }, ({ param, body }) => this
        .inferPattern(param, env)
        .mapErr(InferPattern.wrapErr)
        .bind(({ env: envH, type: paramType }) => this
          .infer(body, { ...env, ...envH })
          .map<InferType.Ok>(({ type: bodyType, subst: bodySubst }) => ({
            type: TypeSourced.actual(FuncType(TypeSubst.apply(bodySubst)(paramType), bodyType), expr),
            subst: bodySubst,
          }))
        )
      )
      .with({ type: 'apply' }, ({ func, arg }) => this
        .infer(func, env)
        .bind(({ type: funcType, subst: funcSubst }) => this
          .infer(arg, TypeSubst.applySchemeDict(funcSubst)(env))
          .bind(({ type: argType, subst: argSubst }) => {
            const funcTypeS = TypeSourced.appliedBy(argSubst)(funcType)
            const retVar = TypeSourced.inferFuncRet(this.tvs.fresh(), func)
            const funcTypeA = TypeSourced.actualFunc(FuncType(argType, retVar), expr)
            return unify(funcTypeS, funcTypeA)
              .mapErr(Unify.wrapErr)
              .map<InferType.Ok>(funcSubstU => ({
                type: TypeSourced.appliedBy(funcSubstU)(retVar),
                subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
              }))
          })
        )
      )
      .with({ type: 'letDes' }, ({ bindingHost, body }) => this
        .inferBindingHost(bindingHost, env)
        .bind(({ env: envI, subst: bindingSubst }) => this
          .infer(body, { ...env, ...envI })
          .map(({ type: bodyType, subst: bodySubst }) => ({
            type: bodyType,
            subst: TypeSubst.compose([bodySubst, bindingSubst]),
          })
        )
      ))
      .with({ type: 'caseRes' }, ({ subject, branches }) => this
        .infer(subject, env)
        .bind(({ type: subjectType, subst: subjectSubst }) => {
          const envS = TypeSubst.applySchemeDict(subjectSubst)(env)
          const branchVar = TypeSourced.inferCase(this.tvs.fresh(), expr)
          return Result.fold(
            branches,
            the<{ subst: TypeSubst, type: TypeSourced }>({ subst: subjectSubst, type: branchVar }),
            ({ type: caseType, subst: caseSubst }, branch) => this
              .inferPattern(branch.pattern, envS)
              .mapErr(InferPattern.wrapErr)
              .bind(({ env: envH, type: patternType }) =>
                unify(TypeSourced.appliedBy(caseSubst)(subjectType), patternType)
                  .mapErr(Unify.wrapErr)
                  .bind(subjectSubstU => {
                    const caseSubstC = TypeSubst.compose([subjectSubstU, caseSubst])
                    return this
                      .infer(branch.body, TypeSubst.applySchemeDict(caseSubstC)({ ...envS, ...envH }))
                      .bind(({ type: branchType, subst: branchSubst }) => {
                        const branchSubstC = TypeSubst.compose([branchSubst, caseSubstC])
                        return unify(TypeSourced.appliedBy(branchSubstC)(caseType), branchType)
                          .mapErr(Unify.wrapErr)
                          .map(branchSubstU => ({
                            type: TypeSourced.appliedBy(branchSubstU)(branchType),
                            subst: TypeSubst.compose([branchSubstU, branchSubstC]),
                          }))
                      })
                  })
              )
          )
        })
      )
      .with({ type: 'cond' }, ({ cond, yes, no }) =>
        this.infer(cond, env)
          .bind(({ type: condType, subst: condSubst }) =>
            unify(condType, TypeSourced.expectCond(ConType('Bool'), expr))
              .mapErr(Unify.wrapErr)
              .bind(condSubstU => {
                const condSubstC = TypeSubst.compose([condSubstU, condSubst])
                const envS = TypeSubst.applySchemeDict(condSubstC)(env)
                return this.infer(yes, envS)
                  .bind(({ type: yesType, subst: yesSubst }) => this
                    .infer(no, TypeSubst.applySchemeDict(yesSubst)(envS))
                    .bind(({ type: noType, subst: noSubst }) =>
                      unify(yesType, noType)
                        .mapErr(Unify.wrapErr)
                        .map<InferType.Ok>(branchSubst => ({
                          type: TypeSourced.appliedBy(branchSubst)(noType),
                          subst: TypeSubst.compose([branchSubst, noSubst, yesSubst, condSubstC]),
                        }))
                    )
                  )
              })
          )
      )
      .with({ type: 'ann' }, ({ expr, ann: { val: annType } }) => this
        .infer(expr, env)
        .bind(({ type: exprType, subst: exprSubst }) => {
          const annTypeA = TypeSourced.annAnn(this.tvs.skolemize(annType), expr)
          return unify(exprType, annTypeA)
            .mapErr(Unify.wrapErr)
            .map<InferType.Ok>(substU => ({
              type: TypeSourced.appliedBy(substU)(annTypeA),
              subst: TypeSubst.compose([substU, exprSubst]),
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
  .with({ sub: 'type' }, () => false)
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
      .with({ sub: 'type' }, () => Ok({}))
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
  .with({ sub: 'type' }, () => Set.empty())
  .with({ sub: 'func' }, ({ param, ret }) =>
    Set.union([collectKindKindVars(param), collectKindKindVars(ret)])
  )
  .exhaustive()

export class KindVarState extends VarState {
  fresh() {
    return VarKind(this.nextId())
  }
}

export namespace InferDataKind {
  export type Ok = {
    env: KindEnv
    subst: KindSubst
  }

  export type Err = InferDeclKind.Err

  export type Res = Result<Ok, Err>
}

export namespace InferDeclKind {
  export type Ok = {
    subst: KindSubst
  }

  export type Err = InferKind.Err

  export type Res = Result<Ok, Err>
}

export namespace InferKind {
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

  infer(type: Type, env = KindEnv.empty()): InferKind.Res {
    return match<Type, InferKind.Res>(type)
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

  inferMono(type: Type, env = KindEnv.empty()): InferKind.Res {
    return this
      .infer(type, env)
      .map(({ kind, subst }) => {
        const { kind: monoKind, subst: monoSubst } = monomorphizeKind(kind)
        return {
          kind: monoKind,
          subst: KindSubst.compose([monoSubst, subst]),
        }
      })
  }

  inferDataDecl(decl: DataDecl, env: KindEnv): InferDeclKind.Res {
    const { data } = decl

    const envH: KindEnv = pipe(
      data.typeParams,
      map(param => [param.id, this.kvs.fresh()] as const),
      Dict.fromEntries,
    )

    const dataKindA = FuncKindCurried(...data.typeParams.map(param => envH[param.id]), TypeKind())
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

  inferDataDecls(decls: DataDecl[], env = KindEnv.empty()): InferDataKind.Res {
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
          .map(({ subst: declSubst }) => ({
            env: KindSubst.applyDict(declSubst)(env),
            subst: KindSubst.compose([declSubst, subst]),
          }))
      )
      .map(({ env, subst }) => pipe(
        decls,
        map(decl => monomorphizeKind(env[decl.id])),
        reduce((subst, { subst: monoSubst }) => KindSubst.compose([monoSubst, subst]), subst),
        subst => ({ env: KindSubst.applyDict(subst)(env), subst })
      ))
  }

  inferDecl(decl: Decl, env = KindEnv.empty()): InferDeclKind.Res {
    const annType = decl.ann.val
    const envH: KindEnv = pipe(
      annType,
      collectTypeTypeVars,
      Iter.from,
      Iter.map(param => [param.id, this.kvs.fresh()] as const),
      Dict.fromEntries,
    )
    return this
      .infer(annType, { ...env, ...envH })
      .bind(({ kind, subst }) =>
        unifyKind(kind, TypeKind())
          .mapErr(UnifyKind.wrapErr)
          .map(substU => ({
            subst: KindSubst.compose([substU, subst]),
          }))
      )
  }

  inferDecls(decl: Decl[], env = KindEnv.empty()): InferDeclKind.Res {
    return Result
      .fold(
        decl,
        { env, subst: KindSubst.empty() },
        ({ env: envC, subst: substC }, decl) => this
          .inferDecl(decl, envC)
          .map(({ subst: declSubst }) => ({
            env: KindSubst.applyDict(declSubst)(envC),
            subst: KindSubst.compose([declSubst, substC]),
          }))
      )
  }
}
