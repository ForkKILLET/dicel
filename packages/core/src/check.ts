import { Err, Ok, Result } from 'fk-result'
import { builtinEnv } from './builtin'
import { generalize, Infer, TypeEnv } from './infer'
import { prettify, TypeScheme, TypeSchemeDict } from './types'
import { map, mapValues, mergeAll, pipe } from 'remeda'
import { filterKeys } from './utils'
import { Data } from './data'
import { ExprInt, Mod } from './nodes'
import { CompiledMod } from './std'

export namespace Check {
  export type Ok = {
    typeScheme: TypeScheme
  }

  export type Err = Infer.Err

  export type Res = Result<Ok, Err>
}

export namespace CheckMod {
  export type Ok = {
    typeEnv: TypeSchemeDict
  }

  export type Err =
    | Infer.Err
    | { type: 'NoMain' }
    | { type: 'UnknownMod', modName: string }
    | { type: 'UnknownImport', modName: string, id: string }

  export type Res = Result<Ok, Err>

  export type Options = {
    isMain: boolean
    compiledMods: Record<string, CompiledMod>
  }
}

export const check = (expr: ExprInt): Check.Res => new Infer()
  .infer(expr, builtinEnv)
  .map(({ type }) => ({ typeScheme: prettify(generalize(type)) }))

export const checkMod = (
  mod: Mod<{}, 'int'>,
  { isMain = false, compiledMods = {} }: Partial<CheckMod.Options> = {},
): CheckMod.Res => {
  const importEnv: TypeEnv = {}
  for (const { modName, ids } of mod.imports) {
    if (! (modName in compiledMods)) return Err({ type: 'UnknownMod', modName })
    const { typeEnv } = compiledMods[modName]
    for (const id of ids) {
      if (! (id in typeEnv)) return Err({ type: 'UnknownImport', modName, id })
      importEnv[id] = typeEnv[id]
    }
  }

  const bindings = mod.defs.map(def => def.binding)

  const dataEnv = pipe(
    mod.dataDefs,
    map(({ id, data }) => Data.getEnv(id, data)),
    mergeAll,
  )

  return new Infer()
    .inferBindings(bindings, mod.decls, { ...importEnv, ...builtinEnv, ...dataEnv }, mod)
    .bind(({ env, varIds }) =>
      ! isMain || varIds.has('main')
        ? Ok({
          typeEnv: pipe(
            env,
            filterKeys(key => varIds.has(key)),
            mapValues(prettify),
          )
        })
        : Err({ type: 'NoMain' })
    )
}
