import { Result } from 'fk-result'
import { CheckMod } from '../check'
import { Desugar } from '../desugar'
import { ValueEnv, EvaluateError } from '../execute'
import { Mod, ModRes, ModDes } from '../node'
import { Parse } from '../parse'
import { Resolve } from '../resolve'
import { map, mergeAll, pipe } from 'remeda'
import { TypeEnv } from '../type'

export type Stage =
  | 'parse'
  | 'resolveDep'
  | 'resolve'
  | 'desugar'
  | 'check'
  | 'execute'

export type StageMeta = {
  stage: Stage
  inputStages: Stage[]
  output: object
  err: object | null
}

export type DefineStageMetas<Ms extends Record<Stage, StageMeta>> = Ms

export type StageInputBase = {
  source: string
}
export type StageInput<S extends Stage> = StageMetas[S]['inputStages']
export type StageOutput<S extends Stage> = StageMetas[S]['output']
export type StageOutputs<Ss extends Stage[]> =
  Ss extends [infer S extends Stage, ...infer Sr extends Stage[]]
    ? StageOutput<S> & StageOutputs<Sr>
    : {}
export type StageErr<S extends Stage> = StageMetas[S]['err']

export type StageMetas = DefineStageMetas<{
  parse: {
    stage: 'parse'
    inputStages: []
    output: { mod: Mod }
    err: Parse.Err
  }
  resolveDep: {
    stage: 'resolveDep'
    inputStages: ['parse']
    output: {}
    err: never
  }
  resolve: {
    stage: 'resolve'
    inputStages: ['parse']
    output: { modRes: ModRes }
    err: Resolve.Err
  }
  desugar: {
    stage: 'desugar'
    inputStages: ['resolve']
    output: { modDes: ModDes }
    err: Desugar.Err
  }
  check: {
    stage: 'check'
    inputStages: ['desugar']
    output: { typeEnv: TypeEnv }
    err: CheckMod.Err
  }
  execute: {
    stage: 'execute'
    inputStages: ['desugar', 'check']
    output: { valueEnv: ValueEnv }
    err: EvaluateError | Error
  }
}>

export type StageInputStages = {
  [S in Stage]: StageMetas[S]['inputStages']
}
export const stageInputStages: StageInputStages = {
  parse: [],
  resolveDep: ['parse'],
  resolve: ['parse'],
  desugar: ['resolve'],
  check: ['desugar'],
  execute: ['desugar', 'check'],
}

export type StageImpl<S extends Stage> = {
  stage: S
  run: (pipelineData: PipelineData) => Result<null, StageErr<S>>
}

export type StageImpls = {
  [S in Stage]: StageImpl<S>
}

export const implModStage = <S extends Stage>(
  stage: S,
  run: (
    input: StageInputBase & StageOutputs<StageInput<S>>
  ) => Result<StageOutput<S>, StageErr<S>>,
): StageImpl<S> => {
  return {
    stage,
    run: ({ modTopo, cache, modDAG }) => {
      for (const modId of modTopo) {
        const artifact = cache[modId]
        const input = pipe(
          stageInputStages[stage],
          map(stage => ({ [stage]: artifact[stage]!.unwrap() })),
          mergeAll,
        ) as StageInputBase & StageOutputs<StageInput<S>>
        const result = run(input)
        if (result.isErr) return result
        artifact[stage] = result.val as ModArtifacts[S]
      }
      return Result.ok(null)
    }
  }
}

export type ModId = string

export type ModArtifacts = {
  input: StageInputBase
} & {
  [S in Stage]?: Result<StageOutput<S>, StageErr<S>>
}

export type PipelineData = {
  modDAG: Record<ModId, ModId[]>
  modTopo: ModId[]
  cache: Record<ModId, ModArtifacts>
}

export class Pipeline<S extends Stage> {
  protected stageDAG: Record<S, S[]>
  protected modDAG: Record<ModId, ModId[]> = {}
  protected data: PipelineData = {
    modDAG: {},
    modTopo: [],
    cache: {},
  }

  constructor(
    public readonly stages: S[],
  ) {
    this.stageDAG = {} as Record<S, S[]>
    for (const stage of stages) {
      const inputStages = stageInputStages[stage]
      this.stageDAG[stage] = inputStages as S[]
    }
  }

  addMod(id: ModId, input: StageInputBase) {
    this.data.cache[id] = { input }
  }
}
