import { entries, map, mapValues, pipe } from 'remeda'
import { Fixity } from './lex'
import { parseMod } from './parse'
import { Mod } from './nodes'
import { desugarMod } from './desugar'
import { resolveMod } from './resolve'
import { KindEnv, TypeEnv } from './types'
import { Check, checkMod } from './check'
import { executeMod, ValueEnv } from './execute'
import { Dict, Graph, Map, Set } from './utils'
import stdDicel from './std/Std.dicel?raw'

export type ResolvedMod = {
  kindEnv: KindEnv
}

export type CheckedMod = ResolvedMod & {
  fixityDict: Dict<Fixity>
  typeEnv: TypeEnv
}

export type ExecutedMod = CheckedMod & {
  valueEnv: ValueEnv
}

export type CompiledMod = ExecutedMod // TODO: separate compile/execute

export const builtinMods: Record<string, CompiledMod> = pipe(
  { Std: stdDicel },
  mapValues((src): CompiledMod => {
    const mod = parseMod(src).unwrap()
    const { modRes, kindEnv } = resolveMod(mod, { compiledMods: {} }).unwrap()
    const { fixityDict } = modRes
    const modDes = desugarMod(modRes, { compiledMods: {} }).unwrap()
    const { typeEnv } = checkMod(modDes, kindEnv, { compiledMods: {} }).unwrap()
    const valueEnv = executeMod(modDes).unwrap()
    return { typeEnv, valueEnv, fixityDict, kindEnv }
  })
)

export const resolveImports = (mod: Mod) => {
  return pipe(
    mod.imports,
    map(import_ => import_.modId),
    Set.of,
  )
}

export const resolveDep = (modDict: Dict<Mod>) => {
  const depGraph: Graph<string> = Map.empty()

  for (const [modId, mod] of entries(modDict)) {
    depGraph.set(modId, resolveImports(mod))
  }

  const { comps } = Graph.solveSCCs(depGraph)

  return comps
    .reverse()
    .map(({ color, nodes }) => {
      return {
        id: color,
        modIds: [...nodes],
      }
    })
}


