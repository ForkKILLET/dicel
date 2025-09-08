import { Result } from 'fk-result'
import { generalize, Infer, infer, prettify } from './algorithmW'
import { Expr } from './parse'
import { builtinEnv } from './builtin'
import { TypeScheme } from './types'

export namespace Check {
  export type Ok = {
    typeScheme: TypeScheme
  }

  export type Err = Infer.Err

  export type Res = Result<Ok, Err>
}

export const check = (expr: Expr): Check.Res => infer(expr, builtinEnv)
  .map(({ type }) => ({
    typeScheme: prettify(generalize(type)),
  }))