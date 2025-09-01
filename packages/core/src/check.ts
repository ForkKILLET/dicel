import { Result } from 'fk-result'
import { generalize, Infer, infer, prettify } from './algorithmW'
import { Expr } from './parse'
import { builtinEnv } from './builtin'
import { TypeScheme } from './types'

export const check = (expr: Expr): Result<TypeScheme, Infer.Err> =>
  infer(expr, builtinEnv).map(type => prettify(generalize(type)))