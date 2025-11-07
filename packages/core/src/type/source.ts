import { AstId } from '@/node/astId'
import { InstanceInfo } from '@/class'

import { Constr, Type, FuncType, ApplyType } from './type'

export type TypeSource =
  | { type: 'actual', expr: AstId }
  | { type: 'actual.func', funcNode: AstId | AstId }
  | { type: 'actual.pat', pat: AstId }
  | { type: 'actual.record', recordExpr: AstId }
  | { type: 'infer.func.ret', funcNode: AstId | AstId }
  | { type: 'infer.binding.var', varPat: AstId, bindingNode: AstId }
  | { type: 'infer.binding.val', valExpr: AstId, bindingNode: AstId }
  | { type: 'infer.case', caseExpr: AstId }
  | { type: 'infer.lambda.param', lambdaExpr: AstId }
  | { type: 'expect.cond', condExpr: AstId }
  | { type: 'expect.record.field', fieldKey: AstId, recordDef: AstId }
  | { type: 'expect.class.member', sigDecl: AstId }
  | { type: 'constr', constr: Constr }
  | { type: 'instance', instance: InstanceInfo }
  | { type: 'ann.ann', annExpr: AstId }
  | { type: 'ann.decl', sigDecl: AstId, varId: string }
  | { type: 'elim.func.param', from: TypeSourced }
  | { type: 'elim.func.ret', from: TypeSourced }
  | { type: 'elim.apply.func', from: TypeSourced }
  | { type: 'elim.apply.arg', from: TypeSourced }

export type TypeSourced<T extends Type = Type> = T & { source: TypeSource }
export namespace TypeSourced {
  export const actual = <T extends Type>(type: T, expr: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual', expr },
  })

  export const actualFunc = <T extends Type>(type: T, funcNode: AstId | AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.func', funcNode },
  })

  export const actualPat = <T extends Type>(type: T, pat: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.pat', pat },
  })

  export const actualRecord = <T extends Type>(type: T, recordExpr: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'actual.record', recordExpr },
  })

  export const inferFuncRet = <T extends Type>(type: T, funcNode: AstId | AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.func.ret', funcNode },
  })

  export const inferBindingVar = <T extends Type>(type: T, varPat: AstId, bindingNode: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.binding.var', varPat, bindingNode },
  })

  export const inferBindingVal = <T extends Type>(type: T, valExpr: AstId, bindingNode: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.binding.val', valExpr, bindingNode },
  })

  export const inferCase = <T extends Type>(type: T, caseExpr: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.case', caseExpr },
  })

  export const inferLambdaParam = <T extends Type>(type: T, lambdaExpr: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'infer.lambda.param', lambdaExpr },
  })

  export const expectCond = <T extends Type>(type: T, condExpr: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'expect.cond', condExpr },
  })

  export const expectRecordField = <T extends Type>(type: T, fieldKey: AstId, recordDef: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'expect.record.field', fieldKey, recordDef },
  })

  export const expectClassMember = <T extends Type>(type: T, sigDecl: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'expect.class.member', sigDecl },
  })

  export const constr = <T extends Type>(type: T, constr: Constr): TypeSourced<T> => ({
    ...type,
    source: { type: 'constr', constr },
  })

  export const instance = <T extends Type>(type: T, instance: InstanceInfo): TypeSourced<T> => ({
    ...type,
    source: { type: 'instance', instance },
  })

  export const annAnn = <T extends Type>(type: T, annExpr: AstId): TypeSourced<T> => ({
    ...type,
    source: { type: 'ann.ann', annExpr },
  })

  export const annDecl = <T extends Type>(type: T, sigDecl: AstId, varId: string): TypeSourced<T> => ({
    ...type,
    source: { type: 'ann.decl', sigDecl, varId },
  })

  export const elimFuncParam = (from: TypeSourced<FuncType>): TypeSourced => ({
    ...from.param,
    source: { type: 'elim.func.param', from },
  })

  export const elimFuncRet = (from: TypeSourced<FuncType>): TypeSourced => ({
    ...from.ret,
    source: { type: 'elim.func.ret', from },
  })

  export const elimApplyFunc = (from: TypeSourced<ApplyType>): TypeSourced => ({
    ...from.func,
    source: { type: 'elim.apply.func', from },
  })

  export const elimApplyArg = (from: TypeSourced<ApplyType>): TypeSourced => ({
    ...from.arg,
    source: { type: 'elim.apply.arg', from },
  })

  export const mapType = <T extends Type, U extends Type>(transform: (type: T) => U) => (typeSourced: TypeSourced<T>): TypeSourced<U> => ({
    ...transform(typeSourced),
    source: typeSourced.source,
  })

  export const isSourced = (type: Type): type is TypeSourced => {
    return 'source' in type
  }
}
