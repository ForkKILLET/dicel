import { Err, Ok, Result } from 'fk-result'
import { builtinKindEnv, builtinTypeEnv } from './builtin'
import { generalize, TypeInferer, InferType, InferKind, KindInferer } from './infer'
import { TypeScheme, TypeEnv, KindEnv, KindSubst } from './types'
import { entries, map, mergeAll, pipe } from 'remeda'
import { Dict } from './utils'
import { Data } from './data'
import { ExprDes, Import, Mod, ModDes, ModRes } from './nodes'
import { CompiledMod } from './mods'
import { isUpper } from './lex'

export namespace Check {
  export type Ok = {
    typeScheme: TypeScheme
  }

  export type Err = InferType.Err

  export type Res = Result<Ok, Err>
}

export namespace CheckMod {
  export type Ok = {
    typeEnv: TypeEnv
  }

  export type Err =
    | InferType.Err
    | { type: 'NoMain' }
    | { type: 'UnknownImport', modId: string, id: string }

  export type Res = Result<Ok, Err>

  export type Options = {
    isMain: boolean
    prettifyTypes: boolean
    compiledMods: Dict<CompiledMod>
  }
}

export const check = (expr: ExprDes): Check.Res => new TypeInferer()
  .infer(expr, builtinTypeEnv)
  .map(({ type }) => ({ typeScheme: generalize(type) }))

export const checkMod = (
  mod: ModDes,
  kindEnv: KindEnv,
  { isMain = false, compiledMods = {} }: Partial<CheckMod.Options> = {},
): CheckMod.Res => {
  const importTypeEnv = TypeEnv.empty()
  for (const [modId, { idSet }] of entries(mod.importDict)) {
    const { typeEnv } = compiledMods[modId]
    if (idSet) {
      for (const id of idSet) {
        if (id in typeEnv) importTypeEnv[id] = typeEnv[id]
        else if (! (id in kindEnv)) return Err({ type: 'UnknownImport', modId, id })
      }
    }
    else {
      Object.assign(importTypeEnv, typeEnv)
    }
  }

  const bindings = mod.defs.map(def => def.binding)

  const dataTypeEnv = pipe(
    entries(mod.dataDict),
    map(([id, data]) => Data.getEnv(id, data)),
    mergeAll,
  )

  const baseTypeEnv = { ...importTypeEnv, ...builtinTypeEnv, ...dataTypeEnv }

  return new TypeInferer()
    .inferBindings(bindings, mod.declDict, baseTypeEnv, mod)
    .bind(({ env, varIds }): CheckMod.Res =>
      ! isMain || varIds.has('main')
        ? Ok({ typeEnv: env })
        : Err({ type: 'NoMain' })
    )
}

export namespace CheckKindMod {
  export type Ok = {
    kindEnv: KindEnv
  }

  export type Err =
    | InferKind.Err
    | { type: 'UnknownImport', modId: string, id: string }

  export type Res = Result<Ok, Err>

  export type Options = {
    compiledMods: Dict<CompiledMod>
  }
}

export const checkKindMod = (
  mod: ModRes,
  { compiledMods = {} }: CheckKindMod.Options
): CheckKindMod.Res => {
  const importKindEnv = KindEnv.empty()
  for (const [modId, { idSet }] of entries(mod.importDict)) {
    const { kindEnv, typeEnv } = compiledMods[modId]
    if (idSet) {
      for (const id of idSet) {
        if (! isUpper(id[0])) continue
        if (id in kindEnv) importKindEnv[id] = kindEnv[id]
        else if (! (id in typeEnv)) return Err({ type: 'UnknownImport', modId, id })
      }
    }
    else {
      Object.assign(importKindEnv, kindEnv)
    }
  }

  const baseKindEnv = { ...builtinKindEnv, ...importKindEnv }

  const kindInferer = new KindInferer()

  return kindInferer
    .inferDataDecls(mod.dataDecls, baseKindEnv)
    .bind(({ env: envData }) => kindInferer
      .inferDecls(mod.decls, envData)
      .map(({ subst: substDecl }) => ({
        kindEnv: KindSubst.applyDict(substDecl)(envData)
      }))
    )
}
