import { Err, Ok, Result } from 'fk-result'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { Set } from '@/utils/data'
import { ModGraph, ModStore, PassAction } from '@/pipeline'

export namespace ModResolve {
  export type Ok = {
    depModIdSet: Set<string>
  }

  export type Err =
    | { type: 'UnknownDepMod', modId: string }

  export type Res = Result<Ok, Err>

  export type Options = {
    modId: string
    store: ModStore
    graph: ModGraph
  }
}

export const modResolveMod: PassAction<'modResolve'> = (modId, store, graph) => {
  const { syntaxDesugar: { mod } } = store.use(modId, ['syntaxDesugar'])

  const depModIdSet = pipe(
    mod.imports,
    R.map(import_ => import_.modId.id),
    Set.of,
  )

  for (const depModId of depModIdSet) {
    if (! store.has(depModId)) {
      try {
        store.load(depModId)
      }
      catch {
        return Err({ type: 'UnknownDepMod', modId: depModId } )
      }
    }
    graph.addDep(modId, depModId)
  }

  return Ok({ depModIdSet })
}
