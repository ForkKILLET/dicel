import { match } from 'ts-pattern'
import { keys, map, mapValues, mergeAll, omit, pick, pipe, unique, uniqueBy, values, zip } from 'remeda'
import { Err, Ok, Result } from 'fk-result'
import { Type, TypePair, isHomoPair, matchHomoPair, ConType, VarType, FuncType, TypeDict, TypeScheme, TypeSchemeDict, ApplyType, FuncTypeCurried } from './types'
import { Binding, ExprInt, Node, PatternInt } from './nodes'
import { DefaultMap, Map, the, Set, zip3, Graph } from './utils'

export type TypeSubst = TypeDict
export namespace TypeSubst {
  export const empty = (): TypeSubst => ({})

  const _applyScheme = (subst: TypeSubst) => (typeParamSet: Set<string>) => {
    const _apply = (type: Type): Type => match(type)
      .with({ sub: 'con' }, () => type)
      .with({ sub: 'var' }, ({ id }) => typeParamSet.has(id) ? type : subst[id] ?? type)
      .with({ sub: 'func' }, type => FuncType(_apply(type.param), _apply(type.ret)))
      .with({ sub: 'apply' }, type => ApplyType(
        _apply(type.func),
        _apply(type.arg))
      )
      .exhaustive()
    return _apply
  }

  export const apply = (subst: TypeSubst) => _applyScheme(subst)(new Set)

  export const applyScheme = (subst: TypeSubst) =>
    TypeScheme.map(({ typeParamSet, type }: TypeScheme) => _applyScheme(subst)(typeParamSet)(type))

  export const applyDict = (subst: TypeSubst) => (dict: TypeDict): TypeDict =>
    mapValues(dict, apply(subst))

  export const applySchemeDict = (subst: TypeSubst) => (schemeDict: TypeSchemeDict): TypeSchemeDict =>
    mapValues(schemeDict, applyScheme(subst))

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

export type TypedBinding = {
  binding: Binding<{}, 'int'>
  env: TypeEnv
  type: TypeSourced
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

export type TypeSource =
  | { type: 'actual', expr: ExprInt }
  | { type: 'actual.Func', funcNode: ExprInt | PatternInt }
  | { type: 'actual.Pattern', pattern: PatternInt }
  | { type: 'infer.Func.ret', funcNode: ExprInt | PatternInt }
  | { type: 'infer.Binding.val', valExpr: ExprInt, bindingNode: Node }
  | { type: 'infer.Case', caseExpr: ExprInt }
  | { type: 'infer.Lambda.param', lambdaExpr: ExprInt }
  | { type: 'expect.Cond', condExpr: ExprInt }
  | { type: 'elim.Func.param', from: TypeSourced }
  | { type: 'elim.Func.ret', from: TypeSourced }
  | { type: 'elim.Apply.func', from: TypeSourced }
  | { type: 'elim.Apply.arg', from: TypeSourced }

export type TypeSourced<T extends Type = Type> = T & { source: TypeSource }
export namespace TypeSourced {
  export const actual = <T extends Type>(type: T, expr: ExprInt): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual', expr },
  })

  export const actualFunc = <T extends Type>(type: T, funcNode: ExprInt | PatternInt): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.Func', funcNode },
  })

  export const actualPattern = <T extends Type>(type: T, pattern: PatternInt): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.Pattern', pattern },
  })

  export const inferFuncRet = <T extends Type>(type: T, funcNode: ExprInt | PatternInt): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Func.ret', funcNode },
  })

  export const inferBindingVal = <T extends Type>(type: T, valExpr: ExprInt, bindingNode: Node): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Binding.val', valExpr, bindingNode },
  })

  export const inferCase = <T extends Type>(type: T, caseExpr: ExprInt): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Case', caseExpr },
  })

  export const inferLambdaParam = <T extends Type>(type: T, lambdaExpr: ExprInt): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Lambda.param', lambdaExpr },
  })

  export const expectCond = <T extends Type>(type: T, condExpr: ExprInt): TypeSourced<T> => ({
    ...type,
    source: { type: 'expect.Cond', condExpr },
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
    | { type: 'DiffSub' }
    | { type: 'DiffCon' }

  export type Err = ErrDetail & {
    lhs: TypeSourced
    rhs: TypeSourced
  }

  export type ErrWrapped = { type: 'UnifyErr', err: Unify.Err }

  export const wrapErr = (err: Err): ErrWrapped => ({ type: 'UnifyErr', err })

  export type Res = Result<Ok, Err>
}

export const unify = (lhs: TypeSourced, rhs: TypeSourced): Unify.Res => {
  if (lhs.sub !== 'var' && rhs.sub === 'var') [lhs, rhs] = [rhs, lhs]
  if (lhs.sub === 'var' && rhs.sub !== 'var') {
    if (occurs(lhs.id, rhs)) return Err({ type: 'Recursion', lhs, rhs })
    return Ok({ [lhs.id]: rhs })
  }

  const pair = TypePair(lhs, rhs)
  if (! isHomoPair(pair)) return Err({ type: 'DiffSub', lhs, rhs })

  return matchHomoPair<TypeSourced, Unify.Res>(pair)
    .sub('con', ([lhs, rhs]) => lhs.id === rhs.id
      ? Ok({})
      : Err({ type: 'DiffCon', lhs, rhs })
    )
    .sub('func', ([lhs, rhs]) =>
      unify(TypeSourced.elimFuncParam(lhs), TypeSourced.elimFuncParam(rhs))
        .bind(argSubst =>
          unify(
            TypeSourced.appliedBy(argSubst)(TypeSourced.elimFuncRet(lhs)),
            TypeSourced.appliedBy(argSubst)(TypeSourced.elimFuncRet(rhs)),
          )
            .map(retSubst => TypeSubst.compose([retSubst, argSubst]))
        )
    )
    .sub('var', ([lhs, rhs]) => 
      Ok(lhs.id === rhs.id ? {} : { [lhs.id]: rhs })
    )
    .sub('apply', ([lhs, rhs]) =>
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
}

export class TypeVarState {
  constructor(public readonly prefix: string) {}

  private counter = 0

  fresh() {
    return VarType(`${this.prefix}${this.counter++}`)
  }

  instantiate(scheme: TypeScheme): Type {
    const subst = TypeSubst.compose([...scheme.typeParamSet].map(id => ({ [id]: this.fresh() })))
    return TypeSubst.apply(subst)(scheme.type)
  }
}


export const collectTypeTypeVars = (type: Type): Set<string> => match(type)
  .with({ sub: 'var' }, ({ id }) => new Set([id]))
  .with({ sub: 'con' }, () => new Set<string>)
  .with({ sub: 'func' }, ({ param, ret }) =>
    Set.union([collectTypeTypeVars(param), collectTypeTypeVars(ret)])
  )
  .with({ sub: 'apply' }, ({ func, arg }) =>
    Set.union([collectTypeTypeVars(func), collectTypeTypeVars(arg)])
  )
  .exhaustive()

export const collectTypeSchemeTypeVars = (scheme: TypeScheme): Set<string> =>
  collectTypeTypeVars(scheme.type).difference(scheme.typeParamSet)

export const collectPatternVars = (pattern: PatternInt): Set<string> => match<PatternInt, Set<string>>(pattern)
  .with({ sub: 'wildcard' }, { sub: 'num' }, { sub: 'unit' }, () => new Set)
  .with({ sub: 'var' }, ({ var: { id } }) => new Set([id]))
  .with({ sub: 'con' }, ({ args }) => Set.union(args.map(collectPatternVars)))
  .exhaustive()

export const collectExprVars = (expr: ExprInt): Set<string> => match<ExprInt, Set<string>>(expr)
  .with({ type: 'ann' }, ({ expr }) => collectExprVars(expr))
  .with({ type: 'apply' }, ({ func, arg }) =>
    Set.union([collectExprVars(func), collectExprVars(arg)])
  )
  .with({ type: 'case' }, ({ subject, branches }) =>
    Set.union([collectExprVars(subject), ...branches.map(({ body }) => collectExprVars(body))])
  )
  .with({ type: 'cond' }, ({ cond, yes, no }) =>
    Set.union([collectExprVars(cond), collectExprVars(yes), collectExprVars(no)])
  )
  .with({ type: 'lambda' }, ({ param, body }) =>
    collectExprVars(body).difference(collectPatternVars(param))
  )
  .with({ type: 'let' }, ({ bindings, body }) =>
    Set.union([ collectExprVars(body), ...bindings.map(({ rhs }) => collectExprVars(rhs)) ])
      .difference(Set.union(bindings.map(({ lhs }) => collectPatternVars(lhs))))
  )
  .with({ type: 'var' }, ({ id }) => new Set([id]))
  .otherwise(() => new Set)

export const generalize = (type: Type, existingTypeVars = new Set<string>): TypeScheme => ({
  typeParamSet: collectTypeTypeVars(type).difference(existingTypeVars),
  type,
})

export namespace Infer {
  export type Ok = {
    type: TypeSourced
    subst: TypeSubst
  }

  export type Err =
    | Unify.ErrWrapped
    | InferPattern.ErrWrapped
    | { type: 'UndefinedVar', id: string }
    | { type: 'Unreachable' }
  
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
    lVars: Set<string>
    env: TypeEnv
    subst: TypeSubst
  }

  export type Err = Infer.Err
  
  export type Res = Result<Ok, Err>
}

export namespace BindingGroup {
  export type Comp = {
    id: number
    lVars: Set<string>
  }


  export type Group = {
    id: number
    typedBindings: TypedBinding[]
    lVars: string[]
    envH: TypeEnv
  }

  export type Ok = {
    comps: Comp[]
    groups: Group[]
  }
}

export class Infer {
  tvs = new TypeVarState('t')

  inferPattern(
    pattern: PatternInt,
    env: TypeEnv,
  ): InferPattern.Res {
    return match<PatternInt, InferPattern.ResUnsourced>(pattern)
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

  resolveBindingGroups(
    typedBindings: TypedBinding[],
    envH: TypeEnv,
  ) {
    const lVars = Set.of(keys(envH))
    const bindingMap = Map.empty<string, TypedBinding>()
    const depGraph: Graph.Graph<string> = Map.empty()

    for (const typedBinding of typedBindings) {
      const { binding, env } = typedBinding
      for (const lVar of keys(env)) {
        bindingMap.set(lVar, typedBinding)
        depGraph.set(lVar, collectExprVars(binding.rhs).intersection(lVars))
      }
    }

    const { comps } = Graph.solveSCCs(depGraph)

    return comps
      .toReversed()
      .map(({ color, nodes }): BindingGroup.Group => {
        const lVars = [...nodes]
        const typedBindings = pipe(
          lVars,
          map(lVar => bindingMap.get(lVar)!),
          unique(),
        )
        return {
          id: color,
          typedBindings,
          lVars,
          envH: pick(envH, lVars),
        }
      })
  }

  inferBindings(
    bindings: Binding<{}, 'int'>[],
    env: TypeEnv,
    node: Node,
  ): InferBinding.Res {
    void node
    return Result
      .fold(
        bindings,
        { envH: TypeEnv.empty(), typedBindings: Array.of<TypedBinding>() },
        ({ envH, typedBindings }, binding) => this
          .inferPattern(binding.lhs, { ...env, ...envH })
          .mapErr(InferPattern.wrapErr)
          .map(({ env: envHi, type: patternType }) => ({
            envH: { ...envH, ...envHi },
            typedBindings: [...typedBindings, { binding, env: envHi, type: patternType }],
          }))
      )
      .bind(({ envH, typedBindings }) => {
        const groups = this.resolveBindingGroups(typedBindings, envH)
        return Result
          .fold(
            groups,
            { substC: TypeSubst.empty(), envS: envH },
            ({ substC, envS }, group) => this
              .inferBindingGroup(group, { ...env, ...envS })
              .map(({ subst, env: envSi }) => ({
                substC: TypeSubst.compose([subst, substC]),
                envS: { ...envS, ...envSi },
              }))
          )
          .map(({ substC, envS }) => ({
            subst: substC,
            env: envS,
            lVars: Set.of(keys(envH)),
          }))
      })
  }

  inferBindingGroup({ typedBindings, lVars, envH }: BindingGroup.Group, env: TypeEnv) {
    return Result
      .fold(
        [...typedBindings],
        { substC: TypeSubst.empty(), envS: envH },
        ({ substC, envS }, { binding: { rhs }, env: envHi, type: patternType }) => this
          .infer(rhs, { ...env, ...envS })
          .bind(({ type: valType, subst: valSubst }) =>
            unify(valType, TypeSourced.appliedBy(valSubst)(patternType))
              .mapErr(Unify.wrapErr)
              .map(substU => {
                const valSubstC = TypeSubst.compose([substU, valSubst])
                const envSi = TypeSubst.applySchemeDict(valSubstC)(envS)
                const existingTypeVars = pipe(
                  envSi,
                  omit(lVars),
                  values(),
                  map(collectTypeSchemeTypeVars),
                  Set.union,
                )
                const envGi = pipe(
                  envSi,
                  pick(keys(envHi)),
                  mapValues(({ type }) => generalize(type, existingTypeVars))
                )
                return {
                  substC: TypeSubst.compose([valSubstC, substC]),
                  envS: { ...envSi, ...envGi },
                }
              })
          )
      )
      .map(({ substC, envS }) => ({ subst: substC, env: envS }))
  }

  infer(expr: ExprInt, env = TypeEnv.empty()): Infer.Res {
    return match<ExprInt, Infer.Res>(expr)
      .with({ type: 'num' }, () => Ok({
        type: TypeSourced.actual(ConType('Num'), expr),
        subst: {},
      }))
      .with({ type: 'unit' }, () => Ok({
        type: TypeSourced.actual(ConType(''), expr),
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
      .with({ type: 'lambda' }, ({ param, body }) => this
        .inferPattern(param, env)
        .mapErr(InferPattern.wrapErr)
        .bind(({ env: envH, type: paramType }) => this
          .infer(body, { ...env, ...envH })
          .map<Infer.Ok>(({ type: bodyType, subst: bodySubst }) => ({
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
              .map<Infer.Ok>(funcSubstU => ({
                type: TypeSourced.appliedBy(funcSubstU)(retVar),
                subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
              }))
          })
        )
      )
      .with({ type: 'let' }, ({ bindings, body }) => this
        .inferBindings(bindings, env, expr)
        .bind(({ env: envI, subst: bindingSubst }) => this
          .infer(body, { ...env, ...envI })
          .map(({ type: bodyType, subst: bodySubst }) => ({
            type: bodyType,
            subst: TypeSubst.compose([bodySubst, bindingSubst]),
          })
        )
      ))
      .with({ type: 'case' }, ({ subject, branches }) => this
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
                        .map<Infer.Ok>(branchSubst => ({
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
          const annTypeA = TypeSourced.actualFunc(annType, expr)
          return unify(exprType, annTypeA)
            .mapErr(Unify.wrapErr)
            .map<Infer.Ok>(substU => ({
              type: TypeSourced.appliedBy(substU)(annTypeA),
              subst: TypeSubst.compose([substU, exprSubst]),
            }))
        })
      )
      .otherwise(() => Err({ type: 'Unreachable' }))
  }
}
