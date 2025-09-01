import { match } from 'ts-pattern'
import { map, mapValues, pipe, range, values } from 'remeda'
import { Err, Ok, Result } from 'fk-result'
import { Type, DiceType, TypePair, isHomoPair, matchHomoPair, ConType, VarType, FuncType, TypeDict, TypeScheme, TypeSchemeDict, showType, showTypeScheme } from './types'
import { Expr } from './parse'

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

export namespace Unify {
  export type Ok = TypeSubst

  export type ErrDetail =
    | { type: 'Recursion' }
    | { type: 'DiffSub' }
    | { type: 'DiffCon' }

  export type Err = ErrDetail & {
    lhs: Type
    rhs: Type
  }

  export type Res = Result<Ok, Err>
}

export const unify = (lhs: Type, rhs: Type): Unify.Res => {
  if (lhs.sub !== 'var' && rhs.sub === 'var') [lhs, rhs] = [rhs, lhs]
  if (lhs.sub === 'var' && rhs.sub !== 'var') {
    if (occurs(lhs.id, rhs)) return Err({ type: 'Recursion', lhs, rhs })
    return Ok({ [lhs.id]: rhs })
  }

  const pair = TypePair(lhs, rhs)
  if (! isHomoPair(pair)) return Err({ type: 'DiffSub', lhs, rhs })

  return matchHomoPair<Unify.Res>(pair)
    .sub('con', ([lhs, rhs]) => lhs.id === rhs.id
      ? Ok({})
      : Err({ type: 'DiffCon', lhs, rhs })
    )
    .sub('dice', ([lhs, rhs]) =>
      unify(lhs.inner, rhs.inner).map(({ type, subst }) => ({
        type: DiceType(type),
        subst,
      }))
    )
    .sub('func', ([lhs, rhs]) =>
      unify(lhs.param, rhs.param)
        .bind(argSubst =>
          unify(TypeSubst.apply(argSubst)(lhs.ret), TypeSubst.apply(argSubst)(rhs.ret))
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
    type: Type
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

export const infer = (expr: Expr, env: TypeSchemeDict = {}) => {
  const typeVarState = new TypeVarState('t')

  const _infer = (expr: Expr, env: TypeSchemeDict): Infer.Res => match<Expr, Infer.Res>(expr)
    .with({ type: 'num' }, () => Ok({
      type: ConType('Num'),
      subst: {}
    }))
    .with({ type: 'var' }, { type: 'varOp' }, ({ id }) =>
      id in env
        ? Ok({
          type: typeVarState.instantiate(env[id]),
          subst: {}
        })
        : Err({ type: 'UndefinedVar', id })
    )
    .with({ type: 'roll' }, () => Ok({
      type: DiceType(ConType('Num')),
      subst: {}
    }))
    .with({ type: 'lambda' }, ({ param, body }) => {
      const paramVar = typeVarState.fresh()
      const envI = { ...env, [param.id]: TypeScheme.pure(paramVar) }
      return _infer(body, envI)
        .map(({ type: bodyType, subst: bodySubst }) => {
          const paramType = TypeSubst.apply(bodySubst)(paramVar)
          return {
            type: FuncType(paramType, bodyType),
            subst: bodySubst,
          }
        })
    })
    .with({ type: 'apply' }, ({ func, arg }) =>
      _infer(func, env)
        .bind(({ type: funcType, subst: funcSubst }) =>
          _infer(arg, TypeSubst.applySchemeDict(funcSubst)(env))
            .bind(({ type: argType, subst: argSubst }) => {
              const funcTypeS = TypeSubst.apply(argSubst)(funcType)
              const retVar = typeVarState.fresh()
              const funcTypeH = FuncType(argType, retVar)
              return unify(funcTypeS, funcTypeH)
                .mapErr(Infer.Err.fromUnify)
                .map((funcSubstU): Infer.Ok => ({
                  type: TypeSubst.apply(funcSubstU)(retVar),
                  subst: TypeSubst.compose([funcSubstU, argSubst, funcSubst]),
                }))
            })
        )
    )
    .with({ type: 'let' }, ({ binding: { lhs, rhs }, body }) => {
      const valVar = typeVarState.fresh()
      const envH = { ...env, [lhs.id]: TypeScheme.pure(valVar) }
      return _infer(rhs, envH)
        .bind(({ type: valType, subst: valSubst }) =>
          unify(valType, valVar)
            .mapErr(Infer.Err.fromUnify)
            .bind(valSubstU => {
              const valTypeS = TypeSubst.apply(valSubstU)(valVar)
              const valSubstC = TypeSubst.compose([valSubstU, valSubst])
              console.log('infer let', showType(valType))
              const envS = TypeSubst.applySchemeDict(valSubstC)(env)
              const existingVars = pipe(
                envS,
                values(),
                map(typeScheme => collectTypeVars(typeScheme.type)),
                unionSet,
              )
              const envI = { ...envS, [lhs.id]: generalize(valTypeS, existingVars) }
              return _infer(body, envI)
            })
        )
    })
    .with({ type: 'cond' }, ({ cond, yes, no }) =>
      _infer(cond, env)
        .bind(({ type: condType, subst: condSubst }) => {
          return unify(condType, ConType('Bool'))
            .mapErr(Infer.Err.fromUnify)
            .bind((condSubstU) => {
              const condSubstC = TypeSubst.compose([condSubstU, condSubst])
              const envS = TypeSubst.applySchemeDict(condSubstC)(env)
              return Result
                .all([_infer(yes, envS), _infer(no, envS)])
                .bind(([{ type: yesType, subst: yesSubst }, { type: noType, subst: noSubst }]) =>
                  unify(yesType, noType)
                    .mapErr(Infer.Err.fromUnify)
                    .map((branchSubst): Infer.Ok => ({
                      type: TypeSubst.apply(branchSubst)(yesType),
                      subst: TypeSubst.compose([branchSubst, noSubst, yesSubst, condSubstC])
                    }))
                )
            })
        })
    )
    .with({ type: 'ann' }, ({ expr, ann: { val: annType } }) =>
      _infer(expr, env)
        .bind(({ type: exprType, subst: exprSubst }) =>
          unify(exprType, annType)
            .map((substU): Infer.Ok => ({
              type: TypeSubst.apply(substU)(annType),
              subst: TypeSubst.compose([substU, exprSubst]),
            }))
            .mapErr(Infer.Err.fromUnify)
        )
    )
    .otherwise(() => Err({ type: 'Unreachable' }))

  return _infer(expr, env)
    .map(({ type, subst }) => TypeSubst.apply(subst)(type))
}

