import { Result } from 'fk-result'
import { CheckMod, checkMod } from './check'
import { Parse, parseMod } from './parse'
import { EvaluateError, executeMod, ValueEnv } from './execute'
import { KindEnv, TypeEnv } from './type'
import { Value } from './value'
import { ModRes, Mod, ModDes } from './node'
import { Desugar, desugarMod } from './desugar'
import { Last } from './utils'
import { builtinMods } from './mod'
import { Resolve, ResolveMod, resolveMod } from './resolve'
import { TypeInferState } from './infer'

export namespace Pipeline {
  export type PassSeq = ['parse', 'resolve', 'desugar', 'check', 'execute']
  export const passSeq: PassSeq = ['parse', 'resolve', 'desugar', 'check', 'execute']
  export type Pass = PassSeq[number]

  type _PassSeqGe<Px extends Pass, Ps extends Pass[]> =
    Ps extends [infer P extends Pass, ...infer Pr extends Pass[]]
      ? Px extends P
        ? Ps
        : _PassSeqGe<Px, Pr>
      : []
  export type PassSeqGe<Px extends Pass> = _PassSeqGe<Px, PassSeq>
  export type PassGe<Px extends Pass> = PassSeqGe<Px>[number]

  export const passSeqGe = <Px extends Pass>(pass: Px) =>
    passSeq.slice(passSeq.indexOf(pass)) as PassSeqGe<Px>

  type _PassSeqGt<Px extends Pass, Ps extends readonly Pass[]> =
    Ps extends readonly [infer P extends Pass, ...infer Pr extends Pass[]]
      ? Px extends P
        ? Pr
        : _PassSeqGt<Px, Pr>
      : []
  export type PassSeqGt<Px extends Pass> = _PassSeqGt<Px, PassSeq>
  export type PassGt<Px extends Pass> = PassSeqGt<Px>[number]

  type _PassSeqLe<Px extends Pass, Ps extends readonly Pass[]> =
    Ps extends readonly [infer P extends Pass, ...infer Pr extends readonly Pass[]]
      ? Px extends P
        ? [P]
        : [P, ..._PassSeqLe<Px, Pr>]
      : []
  export type PassSeqLe<Px extends Pass> = _PassSeqLe<Px, PassSeq>
  export type PassLe<Px extends Pass> = PassSeqLe<Px>[number]

  type _PassSeqLt<Px extends Pass, Ps extends readonly Pass[]> =
    Ps extends readonly [infer P extends Pass, ...infer Pr extends Pass[]]
      ? Px extends P
        ? []
        : [P, ..._PassSeqLt<Px, Pr>]
      : []
  export type PassSeqLt<Px extends Pass> = _PassSeqLt<Px, PassSeq>
  export type PassLt<Px extends Pass> = PassSeqLt<Px>[number]

  export type Status = Record<Pass, boolean>

  export type StatusLe<Px extends Pass> = Record<PassLe<Px>, true> & Record<PassGt<Px>, false>
  export type StatusLt<Px extends Pass, S extends boolean = false> = Record<PassLt<Px>, true> & Record<Px, S> & Record<PassGt<Px>, false>

  export type Input = {
    source: string
  }

  export type ParseOutput = Input & {
    mod: Mod
  }
  export type ParseErr = Input & {
    err: Parse.Err
  }

  export type ResolveOutput = ParseOutput & {
    modRes: ModRes
    kindEnv: KindEnv
  }
  export type ResolveErr = ParseOutput & {
    err: ResolveMod.Err
  }

  export type DesugarOutput = ResolveOutput & {
    modDes: ModDes
  }
  export type DesugarErr = ResolveOutput & {
    err: Desugar.Err
  }

  export type CheckOutput = DesugarOutput & {
    typeEnv: TypeEnv
    inferState: TypeInferState
  }
  export type CheckErr = DesugarOutput & {
    err: CheckMod.Err
  }

  export type ExecuteOutput = CheckOutput & {
    valueEnv: ValueEnv
    mainValue: Value
  }
  export type ExecuteErr = CheckOutput & {
    err: EvaluateError | Error
  }

  export type PassInputMap = {
    parse: Input
    resolve: ParseOutput
    desugar: ResolveOutput
    check: DesugarOutput
    execute: CheckOutput
  }
  export type PassOutputMap = {
    parse: ParseOutput
    resolve: ResolveOutput
    desugar: DesugarOutput
    check: CheckOutput
    execute: ExecuteOutput
  }
  export type PassErrMap = {
    parse: ParseErr
    resolve: ResolveErr
    desugar: DesugarErr
    check: CheckErr
    execute: ExecuteErr
  }

  export type PassInputStateMap = {
    [P in Pass]: PassInputMap[P] & StatusLt<P, boolean>
  }
  export type PassOutputStateMap = {
    [P in Pass]: PassOutputMap[P] & StatusLe<P>
  }
  export type PassErrStateMap = {
    [P in Pass]: PassErrMap[P] & StatusLt<P>
  }

  export type Pipeline = {
    [P in Pass]: (state: PassInputStateMap[P]) => Result<PassOutputStateMap[P], PassErrStateMap[P]>
  }

  export type InputState<Ps extends Pass[] = PassSeq> = PassInputStateMap[Ps[0]]
  export type ErrState<Ps extends Pass[] = PassSeq> = PassErrStateMap[Ps[number]]
  export type OutputState<Ps extends Pass[] = PassSeq> = PassOutputStateMap[Last<Ps>]
  export type ResultState<Ps extends Pass[] = PassSeq> = OutputState<Ps> | ErrState<Ps>
  export type State<Ps extends Pass[] = PassSeq> = InputState<Ps> | ResultState<Ps>

  export const pipeline: Pipeline = {
    parse: (state) =>
      parseMod(state.source)
        .map(mod => ({ ...state, parse: true, mod }))
        .mapErr(err => ({ ...state, parse: false, err })),

    resolve: (state) =>
      resolveMod(state.mod, { compiledMods: builtinMods, isMain: true })
        .map(({ modRes, kindEnv }) => ({ ...state, resolve: true, modRes, kindEnv }))
        .mapErr(err => ({ ...state, resolve: false, err })),

    desugar: (state) =>
      desugarMod(state.modRes, { compiledMods: builtinMods })
        .map(modDes => ({ ...state, desugar: true, modDes }))
        .mapErr(err => ({ ...state, desugar: false, err })),

    check: (state) =>
      checkMod(state.modDes, state.kindEnv, { compiledMods: builtinMods })
        .map(({ typeEnv, state: inferState }) => ({ ...state, check: true, typeEnv, inferState }))
        .mapErr(err => ({ ...state, check: false, err })),

    execute: (state) =>
      executeMod(state.modDes, { compiledMods: builtinMods })
        .map(valueEnv => ({
          ...state,
          execute: true,
          valueEnv,
          mainValue: valueEnv['main'].value,
        }))
        .mapErr(err => ({ ...state, execute: false, err })),
  }

  export const inputState = (source: string): InputState => ({
    source,
    parse: false,
    resolve: false,
    desugar: false,
    check: false,
    execute: false,
  })

  export const pipeFrom = <Px extends Pass>(start: Px, inputState: PassInputStateMap[Px]) => Result
    .fold(
      passSeqGe(start),
      inputState as State,
      (
        <P extends Pass>(state: PassInputStateMap[P], pass: P) => pipeline[pass](state)
      ) as (state: State, pass: Pass) => Result<State, ErrState>
    )
    .union() as ResultState<PassSeqGe<Px>>

  export const pipe = (inputState: InputState): ResultState => pipeFrom('parse', inputState)
}

export type RunnerCache = {
  result: Pipeline.ResultState | null
  samples: RunnerCache.Samples
  totalRuns: number
  totalSamples: number
  maxCount: number
}
export namespace RunnerCache {
  export const empty = (): RunnerCache => ({
    result: null,
    samples: {},
    totalRuns: 0,
    totalSamples: 0,
    maxCount: 0,
  })

  export type Sample = {
    value: Value
    count: number
  }

  export type Samples = Record<string, Sample>

  export type State =
    | { type: 'unhit', input: Pipeline.InputState }
    | { type: 'hit', input: Pipeline.OutputState }
    | { type: 'nosrc' }
}

export class Runner {
  constructor(public readonly cache = RunnerCache.empty()) {}

  loadCache(source: string | null): RunnerCache.State {
    const { result } = this.cache
    const hit = result?.execute && (source === null || source === result.source)
    return hit
      ? { type: 'hit', input: result }
      : source
        ? { type: 'unhit', input: Pipeline.inputState(source) }
        : { type: 'nosrc' }
  }

  run(maybeSource: string | null) {
    const cacheState = this.loadCache(maybeSource)
    if (cacheState.type === 'nosrc') return

    const { cache } = this
    if (cacheState.type === 'unhit') Object.assign(cache, RunnerCache.empty())

    const result = cacheState.type === 'hit'
      ? Pipeline.pipeFrom('execute', cacheState.input)
      : Pipeline.pipe(cacheState.input)

    if (result.check) {
      cache.totalRuns ++

      const value: Value = result.execute
        ? result.mainValue
        : { tag: 'err', msg: result.err.message }
      const label = Value.show(value)

      const run = cache.samples[label] ??= { value, count: 0 }
      const count = ++ run.count
      if (count === 1) cache.totalSamples ++
      if (count > cache.maxCount) cache.maxCount = count
    }

    return cache.result = result
  }

  runToMultiple(m: number) {
    const { cache } = this
    if (! cache.result?.check) return

    const n = m - cache.totalRuns % m
    for (let i = 0; i < n; i ++) this.run(null)
  }
}
