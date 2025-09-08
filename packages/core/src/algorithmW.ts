import { match } from 'ts-pattern'
import { map, mapValues, pipe, range, values } from 'remeda'
import { Err, Ok, Result } from 'fk-result'
import { Type, TypePair, isHomoPair, matchHomoPair, ConType, VarType, FuncType, TypeDict, TypeScheme, TypeSchemeDict, showType, showTypeScheme, ApplyType } from './types'
import { Expr } from './parse'

export type TypeSubst = TypeDict
export namespace TypeSubst {
  const _applyScheme = (subst: TypeSubst) => (typeParams: Set<string>) => {
    const _apply = (type: Type): Type => match(type)
      .with({ sub: 'con' }, () => type)
      .with({ sub: 'var' }, ({ id }) => typeParams.has(id) ? type : subst[id] ?? type)
      .with({ sub: 'func' }, type => FuncType(_apply(type.param), _apply(type.ret)))
      .with({ sub: 'apply' }, type => ApplyType(_apply(type.func), _apply(type.arg)))
      .exhaustive()
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
  .with({ sub: 'var' }, ({ id }) => id === typeVar)
  .with({ sub: 'apply' }, ({ func, arg }) =>
    occurs(typeVar, func) || occurs(typeVar, arg)
  )
  .exhaustive()

export type TypeSource =
  | { type: 'actual', expr: Expr }
  | { type: 'actual.Func', expr: Expr }
  | { type: 'infer.Func.ret', funcExpr: Expr }
  | { type: 'infer.Let.val', valExpr: Expr, letExpr: Expr }
  | { type: 'expect.Cond', condExpr: Expr }
  | { type: 'elim.Func.param', from: TypeSourced }
  | { type: 'elim.Func.ret', from: TypeSourced }
  | { type: 'elim.Apply.func', from: TypeSourced }
  | { type: 'elim.Apply.arg', from: TypeSourced }

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
    .sub('var', ([lhs, rhs]) => 
      Ok(lhs.id === rhs.id ? {} : { [lhs.id]: rhs })
    )
    .sub('apply', ([lhs, rhs]) =>
      unify(TypeSourced.elimApplyFunc(lhs), TypeSourced.elimApplyFunc(rhs))
        .bind(funcSubst =>
          unify(
            TypeSourced.applied(TypeSourced.elimApplyArg(lhs), funcSubst),
            TypeSourced.applied(TypeSourced.elimApplyArg(rhs), funcSubst),
          )
            .map(argSubst => TypeSubst.compose([argSubst, funcSubst]))
        )
    )
    .exhaustive()
}

match

export namespace Infer {
  export type Ok = {
    type: TypeSourced
    subst: TypeSubst
  }

  export type Err =
    | { type: 'UnifyErr', err: Unify.Err }
    | { type: 'UndefinedVar', id: string }
    | { type: 'Unreachable' }
  export namespace Err {
    export const fromUnify = (error: Unify.Err): Err => ({ type: 'UnifyErr', err: error })
  }
  
  export type Res = Result<Ok, Err>
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
  .with({ sub: 'apply' }, ({ func, arg }) =>
    unionSet([collectTypeVars(func), collectTypeVars(arg)])
  )
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
    }))
    .with({ type: 'unit' }, () => Ok({
      type: TypeSourced.infer(ConType('()'), expr),
      subst: {},
    }))
    .with({ type: 'var' }, { type: 'varOp' }, ({ id }) =>
      id in env
        ? Ok({
          type: TypeSourced.infer(typeVarState.instantiate(env[id]), expr),
          subst: {},
        })
        : Err({ type: 'UndefinedVar', id })
    )
    .with({ type: 'lambda' }, ({ param, body }) => {
      const paramVar = typeVarState.fresh()
      const envI = { ...env, [param.id]: TypeScheme.pure(paramVar) }
      return _infer(body, envI)
        .map<Infer.Ok>(({ type: bodyType, subst: bodySubst }) => {
          const paramType = TypeSubst.apply(bodySubst)(paramVar)
          return {
            type: TypeSourced.infer(FuncType(paramType, bodyType), expr),
            subst: bodySubst,
          }
        })
    })
    .with({ type: 'apply' }, ({ func, arg }) =>
      _infer(func, env)
        .bind(({ type: funcType, subst: funcSubst }) =>
          _infer(arg, TypeSubst.applySchemeDict(funcSubst)(env))
            .bind(({ type: argType, subst: argSubst }) => {
              const funcTypeS = TypeSourced.applied(funcType, argSubst)
              const retVar = TypeSourced.inferFuncRet(typeVarState.fresh(), func)
              const funcTypeA = TypeSourced.actual(FuncType(argType, retVar), expr)
              return unify(funcTypeS, funcTypeA)
                .mapErr(Infer.Err.fromUnify)
                .map<Infer.Ok>(funcSubstU => ({
                  type: TypeSourced.applied(retVar, funcSubstU),
                  subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
                }))
            })
        )
    )
    .with({ type: 'let' }, ({ binding, body }) => {
      const { lhs, rhs } = binding
      const valVar = TypeSourced.inferLetVal(typeVarState.fresh(), rhs, expr)
      const envH = { ...env, [lhs.id]: TypeScheme.pure(valVar) }
      return _infer(rhs, envH)
        .bind(({ type: valType, subst: valSubst }) =>
          unify(valType, TypeSourced.applied(valVar, valSubst))
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
              return _infer(body, envI).map(({ type: bodyType, subst: bodySubst }) => ({
                type: bodyType,
                subst: TypeSubst.compose([bodySubst, valSubstC]),
              }))
            })
        )
    })
    .with({ type: 'cond' }, ({ cond, yes, no }) =>
      _infer(cond, env)
        .bind(({ type: condType, subst: condSubst }) =>
          unify(condType, TypeSourced.expectCond(ConType('Bool'), expr))
            .mapErr(Infer.Err.fromUnify)
            .bind(condSubstU => {
              const condSubstC = TypeSubst.compose([condSubstU, condSubst])
              const envS = TypeSubst.applySchemeDict(condSubstC)(env)
              return _infer(yes, envS)
                .bind(({ type: yesType, subst: yesSubst }) =>
                  _infer(no, TypeSubst.applySchemeDict(yesSubst)(envS))
                    .bind(({ type: noType, subst: noSubst }) =>
                      unify(yesType, noType)
                        .mapErr(Infer.Err.fromUnify)
                        .map<Infer.Ok>(branchSubst => ({
                          type: TypeSourced.applied(noType, branchSubst),
                          subst: TypeSubst.compose([branchSubst, noSubst, yesSubst, condSubstC]),
                        }))
                    )
                )
            })
        )
    )
    .with({ type: 'ann' }, ({ expr, ann: { val: annType } }) =>
      _infer(expr, env)
        .bind(({ type: exprType, subst: exprSubst }) => {
          const annTypeA = TypeSourced.actual(annType, expr)
          return unify(exprType, annTypeA)
            .mapErr(Infer.Err.fromUnify)
            .map<Infer.Ok>(substU => ({
              type: TypeSourced.applied(annTypeA, substU),
              subst: TypeSubst.compose([substU, exprSubst]),
            }))
        })
    )
    .otherwise(() => Err({ type: 'Unreachable' }))

  return _infer(expr, env)
}

