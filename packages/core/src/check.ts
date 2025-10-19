import { Err, Ok, Result } from 'fk-result'
import { builtinKindEnv, builtinTypeEnv } from './builtin'
import { generalize, TypeInferer, TypeInfer, KindInfer, KindInferer, TypeInferState } from './infer'
import { TypeScheme, TypeEnv, KindEnv } from './type'
import { entries, map, mergeAll, pipe, values } from 'remeda'
import { Dict } from './utils'
import { Data } from './data'
import { ExprDes, ModDes, ModRes } from './node'
import { CompiledMod } from './mod'
import { isUpper } from './lex'
import { Class, InstanceDict } from './class'

export namespace Check {
  export type Ok = {
    typeScheme: TypeScheme
  }

  export type Err = TypeInfer.Err

  export type Res = Result<Ok, Err>
}

export namespace CheckMod {
  export type Ok = {
    typeEnv: TypeEnv
    state: TypeInferState
  }

  export type Err =
    | TypeInfer.Err
    | { type: 'UnknownImport', modId: string, id: string }

  export type Res = Result<Ok, Err>

  export type Options = {
    compiledMods: Dict<CompiledMod>
  }
}

export const check = (expr: ExprDes): Check.Res => new TypeInferer(InstanceDict.empty())
  .infer(expr, builtinTypeEnv)
  .map(({ type }) => ({ typeScheme: generalize(type) }))

export const checkMod = (
  mod: ModDes,
  kindEnv: KindEnv,
  { compiledMods = {} }: Partial<CheckMod.Options> = {},
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

  const dataTypeEnv = pipe(
    values(mod.dataDict),
    map(Data.getEnv),
    mergeAll,
  )

  const classTypeEnv = pipe(
    values(mod.classDefDict),
    map(Class.getEnv),
    mergeAll,
  )

  const baseTypeEnv = { ...importTypeEnv, ...builtinTypeEnv, ...dataTypeEnv, ...classTypeEnv }

  return new TypeInferer(InstanceDict.of(mod.instanceDefs))
    .inferBindingHost(mod.bindingHost, baseTypeEnv)
    .map(({ env, state }) => ({ typeEnv: env, state }))
}

export namespace CheckKindMod {
  export type Ok = {
    kindEnv: KindEnv
  }

  export type Err =
    | KindInfer.Err
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

  return new KindInferer()
    .checkMod(mod, baseKindEnv)
    .map(({ env }) => ({ kindEnv: env }))
}
