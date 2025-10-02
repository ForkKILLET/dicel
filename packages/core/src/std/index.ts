import { mapValues, pipe } from 'remeda'
import { parseMod } from '../parse'
import { desugarMod } from '../desugar'
import { checkMod } from '../check'
import { executeMod, ValueEnv } from '../execute'
import { TypeEnv } from '../infer'
import stdDicel from './Std.dicel?raw'

export type CompiledMod = {
  typeEnv: TypeEnv
  valueEnv: ValueEnv
}

export const builtinMods: Record<string, CompiledMod> = pipe(
  { Std: stdDicel },
  mapValues((src) => {
    const mod = parseMod(src).unwrap()
    const modInt = desugarMod(mod).unwrap()
    const { typeEnv } = checkMod(modInt, { compiledMods: {} }).unwrap()
    const valueEnv = executeMod(modInt).unwrap()
    return { typeEnv, valueEnv }
  })
)