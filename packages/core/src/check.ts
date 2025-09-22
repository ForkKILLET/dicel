import { Err, Ok, Result } from 'fk-result'
import { builtinEnv } from './builtin'
import { generalize, Infer } from './infer'
import { prettify, TypeScheme, TypeSchemeDict } from './types'
import { map, mapValues, mergeAll, pipe } from 'remeda'
import { filterKeys } from './utils'
import { Data } from './data'
import { ExprInt, Mod } from './nodes'


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
  mod: Mod<{}, 'int'>,
  { isMain = false }: Partial<CheckMod.Options> = {},
): CheckMod.Res => {
  const bindings = mod.defs.map(def => def.binding)

  const dataEnv = pipe(
    mod.dataDefs,
    map(({ id, data }) => Data.getEnv(id, data)),
    mergeAll,
  )

  return new Infer()
    .inferBindings(bindings, { ...builtinEnv, ...dataEnv }, mod)
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
