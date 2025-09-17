import { Err, Ok, Result } from 'fk-result'
import { builtinEnv } from './builtin'
import { prettify, generalize, Infer } from './infer'
import { ExprInt, Mod } from './parse'
import { TypeScheme, TypeSchemeDict } from './types'
import { entries, filter, fromEntries, map, mapValues, pipe } from 'remeda'
import { filterKeys } from './utils'


export namespace Check {
  export type Ok = {
    typeScheme: TypeScheme
  }

  export type Err = Infer.Err

  export type Res = Result<Ok, Err>
}

export namespace CheckMod {
  export type Ok = {
    env: TypeSchemeDict
  }

  export type Err =
    | Infer.Err
    | { type: 'NoMain' }

  export type Res = Result<Ok, Err>

  export type Options = {
    isMain: boolean
  }
}

export const check = (expr: ExprInt): Check.Res => new Infer()
  .infer(expr, builtinEnv)
  .map(({ type }) => ({ typeScheme: prettify(generalize(type)) }))

export const checkMod = (
  mod: Mod<{}, '@exprInt'>,
  { isMain = false }: Partial<CheckMod.Options> = {},
): CheckMod.Res => {
  const bindings = mod.defs.map(def => def.binding)
  return new Infer()
    .inferBindings(bindings, builtinEnv, mod)
    .bind(({ env, vars }) =>
      ! isMain || vars.has('main')
        ? Ok({
          env: pipe(
            env,
            filterKeys(key => vars.has(key)),
            mapValues(prettify),
          )
        })
        : Err({ type: 'NoMain' })
    )
}
