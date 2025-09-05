import { match } from 'ts-pattern'
import { map, mapValues, pipe, range, values } from 'remeda'
import { Err, Ok, Result } from 'fk-result'
import { Type, DiceType, TypePair, isHomoPair, matchHomoPair, ConType, VarType, FuncType, TypeDict, TypeScheme, TypeSchemeDict, showType, showTypeScheme } from './types'
import { Expr, LetExpr } from './parse'

const logTypes = (dict: TypeDict) => console.log(mapValues(dict, showType))

export type TypeSubst = TypeDict
export namespace TypeSubst {
  const _applyScheme = (subst: TypeSubst) => (typeParams: Set<string>) => {
    const _apply = (type: Type): Type => match(type)
      .with({ sub: 'var' }, ({ id }) => typeParams.has(id) ? type : subst[id] ?? type)
      .with({ sub: 'func' }, type => FuncType(_apply(type.param), _apply(type.ret)))
      .with({ sub: 'dice' }, ({ inner }) => DiceType(_apply(inner)))
      .otherwise(() => type)
    return _apply
  }

  export const apply = (subst: TypeSubst) => _applyScheme(subst)(new Set)

  export const applyScheme = (subst: TypeSubst) =>
    TypeScheme.map(({ typeParams, type }: TypeScheme) => _applyScheme(subst)(typeParams)(type))

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

export const occurs = (typeVar: string, type: Type): boolean => match(type)
  .with({ sub: 'con' }, () => false)
  .with({ sub: 'func' }, ({ param: param, ret }) =>
    occurs(typeVar, param) || occurs(typeVar, ret)
  )
  .with({ sub: 'dice' }, ({ inner }) => occurs(typeVar, inner))
  .with({ sub: 'var' }, ({ id }) => id === typeVar)
  .exhaustive()

export type TypeSource =
  | { type: 'actual', expr: Expr }
  | { type: 'actual.Func', expr: Expr }
  | { type: 'infer.Func.ret', funcExpr: Expr }
  | { type: 'infer.Let.val', valExpr: Expr, letExpr: Expr }
  | { type: 'expect.Cond', condExpr: Expr }
  | { type: 'elim.Dice.inner', from: TypeSourced }
  | { type: 'con.Dice', from: TypeSourced }
  | { type: 'elim.Func.param', from: TypeSourced }
  | { type: 'elim.Func.ret', from: TypeSourced }

export type TypeSourced<T extends Type = Type> = T & { source: TypeSource }
export namespace TypeSourced {
  export const infer = <T extends Type>(type: T, expr: Expr): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual', expr },
  })

  export const actual = <T extends Type>(type: T, expr: Expr): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.Func', expr },
  })

  export const inferFuncRet = <T extends Type>(type: T, funcExpr: Expr): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Func.ret', funcExpr },
  })

  export const inferLetVal = <T extends Type>(type: T, valExpr: Expr, letExpr: Expr): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.Let.val', valExpr, letExpr },
  })

  export const expectCond = <T extends Type>(type: T, condExpr: Expr): TypeSourced<T> => ({
    ...type,
    source: { type: 'expect.Cond', condExpr },
  })

  export const elimDiceInner = (from: TypeSourced<DiceType>): TypeSourced => ({
    ...from.inner,
    source: { type: 'elim.Dice.inner', from },
  })

  export const elimFuncParam = (from: TypeSourced<FuncType>): TypeSourced => ({
    ...from.param,
    source: { type: 'elim.Func.param', from },
  })

  export const elimFuncRet = (from: TypeSourced<FuncType>): TypeSourced => ({
    ...from.ret,
    source: { type: 'elim.Func.ret', from },
  })

  export const conDice = (from: TypeSourced): TypeSourced<DiceType> => ({
    ...DiceType(from),
    source: { type: 'con.Dice', from },
  })

  export const map = <T extends Type, U extends Type>(typeSourced: TypeSourced<T>, transform: (type: T) => U): TypeSourced<U> => ({
    ...transform(typeSourced),
    source: typeSourced.source,
  })

  export const applied = (typeSourced: TypeSourced, subst: TypeSubst): TypeSourced => map(typeSourced, TypeSubst.apply(subst))
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
    .sub('dice', ([lhs, rhs]) => unify(TypeSourced.elimDiceInner(lhs), TypeSourced.elimDiceInner(rhs)))
    .sub('func', ([lhs, rhs]) =>
      unify(TypeSourced.elimFuncParam(lhs), TypeSourced.elimFuncParam(rhs))
        .bind(argSubst =>
          unify(
            TypeSourced.applied(TypeSourced.elimFuncRet(lhs), argSubst),
            TypeSourced.applied(TypeSourced.elimFuncRet(rhs), argSubst),
          )
            .map(retSubst => TypeSubst.compose([retSubst, argSubst]))
        )
    )
    .sub('var', ([lhs, rhs]) => Result
      .ok(lhs.id === rhs.id ? {} : { [lhs.id]: rhs })
    )
    .exhaustive()
}

export namespace Infer {
  export type Ok = {
    type: TypeSourced
    subst: TypeSubst
    expr: Expr
  }

  export type Err =
    | { type: 'UnifyErr', err: Unify.Err }
    | { type: 'UndefinedVar', id: string }
    | { type: 'Unreachable' }
  export namespace Err {
    export const fromUnify = (error: Unify.Err): Err => ({ type: 'UnifyErr', err: error })
  }
  
  export type Res = Result<Ok, Err>

  export const transformExpr = (transform: (expr: Expr) => Expr) =>
    ({ type, subst, expr }: Ok): Ok => ({ type, subst, expr: transform(expr) })
}

export class TypeVarState {
  constructor(public readonly prefix: string) {}

  private counter = 0

  fresh() {
    return VarType(`${this.prefix}${this.counter++}`)
  }

  instantiate(scheme: TypeScheme): Type {
    const subst = TypeSubst.compose([...scheme.typeParams].map(id => ({ [id]: this.fresh() })))
    return TypeSubst.apply(subst)(scheme.type)
  }
}

const unionSet = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.union(b), new Set)

export const collectTypeVars = (type: Type): Set<string> => match(type)
  .with({ sub: 'var' }, ({ id }) => new Set([id]))
  .with({ sub: 'con' }, () => new Set<string>)
  .with({ sub: 'func' }, ({ param, ret }) =>
    unionSet([collectTypeVars(param), collectTypeVars(ret)])
  )
  .with({ sub: 'dice' }, ({ inner }) => collectTypeVars(inner))
  .exhaustive()

export const generalize = (type: Type, existingVars = new Set<string>): TypeScheme => ({
  typeParams: collectTypeVars(type).difference(existingVars),
  type,
})

export const prettify = (typeScheme: TypeScheme): TypeScheme => {
  const typeParamCount = typeScheme.typeParams.size
  const typeParamList = range(0, typeParamCount).map(i =>
    typeParamCount <= 3 ? String.fromCharCode('a'.charCodeAt(0) + i) : `t${i + 1}`
  )
  const subst: TypeSubst = Object.fromEntries([...typeScheme.typeParams].map((id, i) => [id, VarType(typeParamList[i])]))
  return {
    typeParams: new Set(typeParamList),
    type: TypeSubst.apply(subst)(typeScheme.type),
  }
}

export const infer = (expr: Expr, env: TypeSchemeDict = {}): Infer.Res => {
  const typeVarState = new TypeVarState('t')

  const _infer = (expr: Expr, env: TypeSchemeDict): Infer.Res => match<Expr, Infer.Res>(expr)
    .with({ type: 'num' }, () => Ok({
      type: TypeSourced.infer(ConType('Num'), expr),
      subst: {},
      expr,
    }))
    .with({ type: 'var' }, { type: 'varOp' }, ({ id }) =>
      id in env
        ? Ok({
          type: TypeSourced.infer(typeVarState.instantiate(env[id]), expr),
          subst: {},
          expr,
        })
        : Err({ type: 'UndefinedVar', id })
    )
    .with({ type: 'roll' }, () => Ok({
      type: TypeSourced.infer(DiceType(ConType('Num')), expr),
      subst: {},
      expr,
    }))
    .with({ type: 'lambda' }, ({ param, body }) => {
      const paramVar = typeVarState.fresh()
      const envI = { ...env, [param.id]: TypeScheme.pure(paramVar) }
      return _infer(body, envI)
        .map<Infer.Ok>(({ type: bodyType, subst: bodySubst, expr: bodyExpr }) => {
          const paramType = TypeSubst.apply(bodySubst)(paramVar)
          return {
            type: TypeSourced.infer(FuncType(paramType, bodyType), expr),
            subst: bodySubst,
            expr: { ...expr, body: bodyExpr },
          }
        })
    })
    .with({ type: 'apply' }, ({ func, arg }) =>
      _infer(func, env)
        .bind(({ type: funcType, subst: funcSubst, expr: funcExpr }) =>
          _infer(arg, TypeSubst.applySchemeDict(funcSubst)(env))
            .bind(({ type: argType, subst: argSubst, expr: argExpr }) => {
              const funcTypeS = TypeSourced.applied(funcType, argSubst)
              const retVar = TypeSourced.inferFuncRet(typeVarState.fresh(), funcExpr)
              const funcTypeH = TypeSourced.actual(FuncType(argType, retVar), expr)

              // [x] (Normal)       ab :: a -> b $ a :: a := (ab a) :: b
              // [x] (Dice rule 1)  ab :: a -> b $ da :: Dice a := (map ab da) :: Dice b
              // [x] (Dice rule 2)  d_ab :: Dice (a -> b) $ a :: a := (map (\f -> f a) d_ab) :: Dice b
              // [x] (Dice rule 3)  d_ab :: Dice (a -> b) $ da :: Dice a := (bind (\f -> map f da) d_ab) :: Dice b
              // [x] (Dice rule 4)  adb :: a -> Dice b $ da :: Dice a := (bind adb da) :: Dice b
              // [x] (Dice rule 5)  dab :: Dice a -> b $ a 

              return unify(funcTypeS, funcTypeH)
                .map<Infer.Ok>(funcSubstU => ({
                  type: TypeSourced.applied(funcTypeS, funcSubstU),
                  subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
                  expr: { ...expr, func: funcExpr, arg: argExpr },
                }))
                .bindErr(err => match<TypeSourced, Result<Infer.Ok, unknown>>(funcTypeS)
                  .with({ sub: 'func' }, funcTypeS => {
                    const funcTypeSD = TypeSourced.actual(FuncType(DiceType(funcTypeS.param), DiceType(funcTypeS.ret)), expr)
                    return unify(funcTypeSD, funcTypeH)
                      .map<Infer.Ok>(funcSubstU => ({
                        type: TypeSourced.applied(retVar, funcSubstU),
                        subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
                        expr: {
                          type: 'apply',
                          func: {
                            type: 'apply',
                            func: { type: 'var', id: 'map' },
                            arg: funcExpr,
                          },
                          arg: argExpr,
                        },
                      }))
                      .bindErr(err => {
                        const funcTypeHD = TypeSourced.actual(FuncType(DiceType(argType), retVar), expr)
                        return unify(funcTypeS, funcTypeHD)
                          .mapErr(() => err)
                          .map<Infer.Ok>(funcSubstU => ({
                            type: TypeSourced.applied(retVar, funcSubstU),
                            subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
                            expr: {
                              type: 'apply',
                              func: funcExpr,
                              arg: {
                                type: 'apply',
                                func: { type: 'var', id: 'pure' },
                                arg: argExpr,
                              },
                            }
                          }))
                      })
                  })
                  .with({ sub: 'dice' }, diceTypeS =>
                    match<Type, Result<Infer.Ok, unknown>>(diceTypeS.inner)
                      .with({ sub: 'func' }, funcTypeS => {
                        const funcTypeSD = TypeSourced.actual(FuncType(funcTypeS.param, DiceType(funcTypeS.ret)), expr)
                        return unify(funcTypeSD, funcTypeH)
                          .map<Infer.Ok>(funcSubstU => ({
                            type: TypeSourced.applied(retVar, funcSubstU),
                            subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
                            expr: {
                              type: 'apply',
                              func: {
                                type: 'apply',
                                func: { type: 'var', id: 'map' },
                                arg: {
                                  type: 'lambda',
                                  param: { type: 'var', id: '#f' },
                                  body: {
                                    type: 'apply',
                                    func: { type: 'var', id: '#f' },
                                    arg: argExpr,
                                  }
                                }
                              },
                              arg: funcExpr,
                            },
                          }))
                          .bindErr(() => {
                            const funcTypeSD = TypeSourced.actual(FuncType(DiceType(funcTypeS.param), DiceType(funcTypeS.ret)), expr)
                            return unify(funcTypeSD, funcTypeH)
                              .map<Infer.Ok>(funcSubstU => ({
                                type: TypeSourced.applied(retVar, funcSubstU),
                                subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
                                expr: {
                                  type: 'apply',
                                  func: {
                                    type: 'apply',
                                    func: { type: 'var', id: 'bind' },
                                    arg: {
                                      type: 'lambda',
                                      param: { type: 'var', id: '#f' },
                                      body: {
                                        type: 'apply',
                                        func: {
                                          type: 'apply',
                                          func: { type: 'var', id: 'map' },
                                          arg: { type: 'var', id: '#f' },
                                        },
                                        arg: argExpr,
                                      },
                                    },
                                  },
                                  arg: funcExpr,
                                }
                              }))
                          })
                      })
                      .otherwise(() => Err(null))
                  )
                  .otherwise(() => Err(null))
                  .mapErr(() => Infer.Err.fromUnify(err))
                )
            })
        )
    )
    .with({ type: 'let' }, ({ binding, body }) => {
      const { lhs, rhs } = binding
      const valVar = TypeSourced.inferLetVal(typeVarState.fresh(), rhs, expr)
      const envH = { ...env, [lhs.id]: TypeScheme.pure(valVar) }
      return _infer(rhs, envH)
        .bind(({ type: valType, subst: valSubst, expr: valExpr }) =>
          unify(valType, valVar)
            .mapErr(Infer.Err.fromUnify)
            .bind(valSubstU => {
              const valSubstC = TypeSubst.compose([valSubstU, valSubst])
              const valTypeS = TypeSubst.apply(valSubstC)(valVar)
              const envS = TypeSubst.applySchemeDict(valSubstC)(env)
              const existingVars = pipe(
                envS,
                values(),
                map(typeScheme => collectTypeVars(typeScheme.type)),
                unionSet,
              )
              const envI = { ...envS, [lhs.id]: generalize(valTypeS, existingVars) }
              return _infer(body, envI).map(({ type: bodyType, subst: bodySubst, expr: bodyExpr }) => ({
                expr: {
                  ...expr,
                  body: bodyExpr,
                  binding: { ...binding, rhs: valExpr },
                },
                type: bodyType,
                subst: TypeSubst.compose([bodySubst, valSubstC]),
              }))
            })
        )
    })
    .with({ type: 'cond' }, ({ cond, yes, no }) =>
      _infer(cond, env)
        .bind(({ type: condType, subst: condSubst, expr: condExpr }) => {
          type CondTransform = (type: TypeSourced, exprs: { yesExpr: Expr, noExpr: Expr }) => {
            type: TypeSourced
            expr: Expr
          }
          type CondST = { subst: TypeSubst, transform: CondTransform }
          return unify(condType, TypeSourced.expectCond(ConType('Bool'), expr))
            .match(
              subst => Ok<CondST>({
                subst,
                transform: (type, { yesExpr, noExpr }) => ({
                  type,
                  expr: {
                    ...expr,
                    yes: yesExpr,
                    no: noExpr,
                  },
                }),
              }),
              err => unify(condType, TypeSourced.expectCond(DiceType(ConType('Bool')), expr))
                .match(
                  subst => Ok<CondST>({
                    subst,
                    transform: (type, { yesExpr, noExpr }) => {
                      const toCollpase = type.sub === 'dice'
                      return {
                        type: toCollpase ? type : TypeSourced.conDice(type),
                        expr: {
                          type: 'apply',
                          func: {
                            type: 'apply',
                            func: { type: 'var', id: toCollpase ? 'bind' : 'map' },
                            arg: {
                              type: 'lambda',
                              param: { type: 'var', id: '#c' },
                              body: {
                                type: 'cond',
                                cond: { type: 'var', id: '#c' },
                                yes: yesExpr,
                                no: noExpr,
                              }
                            },
                          },
                          arg: condExpr,
                        }
                      }
                    },
                  }),
                  () => Err(err)
                )
            )
            .mapErr(Infer.Err.fromUnify)
            .bind(({ subst: condSubstU, transform: condTransform }) => {
              const condSubstC = TypeSubst.compose([condSubstU, condSubst])
              const envS = TypeSubst.applySchemeDict(condSubstC)(env)
              type BranchTransform = (
                types: { yesType: TypeSourced, noType: TypeSourced },
                exprs: { yesExpr: Expr, noExpr: Expr },
              ) => {
                type: TypeSourced
                yesExpr: Expr
                noExpr: Expr
              }
              type BranchST = { subst: TypeSubst, transform: BranchTransform }
              return _infer(yes, envS)
                .bind(({ type: yesType, subst: yesSubst, expr: yesExpr }) =>
                  _infer(no, TypeSubst.applySchemeDict(yesSubst)(envS))
                    .bind(({ type: noType, subst: noSubst, expr: noExpr }) =>
                      unify(yesType, noType)
                        .match(
                          subst => Ok<BranchST>({
                            subst,
                            transform: ({ yesType }, { yesExpr, noExpr }) => ({
                              type: yesType,
                              yesExpr,
                              noExpr,
                            })
                          }),
                          err => unify(yesType, TypeSourced.expectCond(DiceType(noType), expr))
                            .match(
                              subst => Ok<BranchST>({
                                subst,
                                transform: ({ yesType }, { yesExpr, noExpr }) => ({
                                  type: yesType,
                                  yesExpr,
                                  noExpr: {
                                    type: 'apply',
                                    func: { type: 'var', id: 'pure' },
                                    arg: noExpr,
                                  },
                                })
                              }),
                              () => unify(TypeSourced.expectCond(DiceType(yesType), expr), noType)
                                .match(
                                  subst => Ok<BranchST>({
                                    subst,
                                    transform: ({ noType }, { yesExpr, noExpr }) => ({
                                      type: noType,
                                      yesExpr: {
                                        type: 'apply',
                                        func: { type: 'var', id: 'pure' },
                                        arg: yesExpr,
                                      },
                                      noExpr,
                                    })
                                  }),
                                  () => Err(err)
                                )
                            )
                        )
                        .map<Infer.Ok>(({ subst: branchSubst, transform: branchTransform }) => {
                          const { type: branchTypeT, yesExpr: yesExprT, noExpr: noExprT } = branchTransform(
                            { yesType, noType }, { yesExpr, noExpr }
                          )
                          const branchTypeS = TypeSourced.applied(branchTypeT, branchSubst)
                          return {
                            ...condTransform(branchTypeS, { yesExpr: yesExprT, noExpr: noExprT }),
                            subst: TypeSubst.compose([branchSubst, noSubst, yesSubst, condSubstC]),
                          }
                        })
                        .mapErr(Infer.Err.fromUnify)
                    )
                )
            })
        })
    )
    .with({ type: 'ann' }, ({ expr, ann: { val: annType } }) =>
      _infer(expr, env)
        .bind(({ type: exprType, subst: exprSubst }) => {
          const annTypeA = TypeSourced.actual(annType, expr)
          return unify(exprType, annTypeA)
            .map<Infer.Ok>(substU => ({
              type: TypeSourced.applied(annTypeA, substU),
              subst: TypeSubst.compose([substU, exprSubst]),
              expr,
            }))
            .mapErr(Infer.Err.fromUnify)
        })
    )
    .otherwise(() => Err({ type: 'Unreachable' }))

  return _infer(expr, env)
}

