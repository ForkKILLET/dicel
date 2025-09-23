import { Ok, Result } from 'fk-result'
import { ParseErr } from 'parsecond'
import { CheckMod, checkMod } from './check'
import { builtinFixityTable, parseMod } from './parse'
import { EvaluateError, executeMod, ValueEnv } from './execute'
import { TypeEnv } from './infer'
import { Value } from './values'
import { Mod } from './nodes'
import { Desugar, desugar } from './desugar'
import { Counter } from './utils'

export type Pass =
  | 'Parse'
  | 'Desugar'
  | 'Check'
  | 'Execute'
  | 'Finish'

export namespace Pass {
  export const Seq = [
    'Parse',
    'Desugar',
    'Check',
    'Execute',
    'Finish',
  ]

  export type Seq = [
    'Parse',
    'Desugar',
    'Check',
    'Execute',
    'Finish',
  ]

  export type Past<P extends Pass> =
    P extends 'Parse' ? 'Desugar' | 'Check' | 'Execute' | 'Finish' :
    P extends 'Desugar' ? 'Check' | 'Execute' | 'Finish' :
    P extends 'Check' ? 'Execute' | 'Finish' :
    P extends 'Execute' ? 'Finish' :
    never

  export namespace Val {
    export type Input = { source: string }
    export type Parse = Input & { mod: Mod }
    export type Desugar = Parse & { modInt: Mod<{}, 'int'> }
    export type Check = Desugar & { typeEnv: TypeEnv }
    export type Execute = Check & { runtimeEnv: ValueEnv, mainValue: Value, mainValueStr: string }
    export type Finish = Execute & { pass: 'Finish' }

    export type Map = {
      ['Parse']: Parse
      ['Desugar']: Desugar
      ['Check']: Check
      ['Execute']: Execute
      ['Finish']: Finish
    }

    type _Seq<Ps extends readonly Pass[]> =
      Ps extends readonly [infer P extends Pass, ...infer Pt extends Pass[]]
        ? [Val.Map[P], ..._Seq<Pt>]
        : []

    export type Seq = _Seq<Pass.Seq>

    export type InputMap = {
      ['Parse']: Input
      ['Desugar']: Parse
      ['Check']: Desugar
      ['Execute']: Check
      ['Finish']: Execute
    }

    export type InputSeq = [Input, ...Seq]
  }

  export namespace Err {
    export type Parse = ParseErr | null
    export type Desugar = Desugar.Err
    export type Check = CheckMod.Err
    export type Execute = EvaluateError
    export type Finish = never

    export type Map = {
      ['Parse']: Parse
      ['Desugar']: Desugar
      ['Check']: Check
      ['Execute']: Execute
      ['Finish']: Finish
    }

    export type Union = Map[Pass]
  }

  export type ResMap = {
    [P in Pass]: Result<Pass.Val.Map[P], Pass.Val.InputMap[P] & { pass: P, err: Pass.Err.Map[P] }>
  }

  type _Union<Ps extends readonly Pass[]> =
    Ps extends readonly [infer P extends Pass, ...infer Pt extends Pass[]]
      ? Pass.Val.InputMap[P] & { pass: P, err: Pass.Err.Map[P] } | _Union<Pt>
      : Pass.Val.Finish

  export type Union = _Union<Pass.Seq>
}

export namespace Pipeline {
  type _At<P extends Pass, A> = Record<P, {
    pass: P,
    action: (env: A) => Result<Pass.Val.Map[P], Pass.Err.Map[P]>
  }>

  type _Map<Ps extends readonly Pass[], A> =
    Ps extends readonly [infer P extends Pass, ...infer Pt extends Pass[]]
      ? _At<P, A> & _Map<Pt, Pass.Val.Map[P]>
      : {}

  export type PipelineEnv = {
    source: string
    mod: Mod
    modInt: Mod<{}, 'int'>
    typeEnv: TypeEnv
    runtimeEnv: ValueEnv
    mainValue: Value
  }

  export type Map = _Map<Pass.Seq, Pass.Val.Input>

  export const Map: Map = {
    Parse: {
      pass: 'Parse',
      action: (env) => parseMod(env.source)
        .map(mod => ({ ...env, mod })),
    },
    Desugar:   {
      pass: 'Desugar',
      action: (env) => desugar({ fixityTable: builtinFixityTable }, env.mod)
        .map(modInt => ({ ...env, modInt }))
    },
    Check: {
      pass: 'Check',
      action: (env) => checkMod(env.modInt, { isMain: true })
        .map(({ typeEnv }) => ({ ...env, typeEnv }))
    },
    Execute: {
      pass: 'Execute',
      action: (env) => executeMod(env.modInt)
        .map(runtimeEnv => {
          const mainValue = runtimeEnv['main'].value
          const mainValueStr = Value.show(mainValue)
          return {
            ...env, runtimeEnv, mainValue, mainValueStr
          }
        })
    },
    Finish: {
      pass: 'Finish',
      action: (env) => Ok({ ...env, pass: 'Finish' }),
    },
  }
}
export type Pipeline = Pipeline.Map[Pass]

export class Runner {
  constructor(private cache = RunnerCache.empty()) {}

  static past = <P extends Pass>(res: Pass.Union, pass: P): res is Extract<Pass.Union, { pass: Pass.Past<P> }> =>
    res.pass > pass

  run(source: string) {
    const result: Pass.Union = Result.fold(
      Pass.Seq,
      { source },
    )

    const f = 
      <P extends Pass>(env: Pass.Val.InputMap[P], { pass, action }: Pipeline.Map[P]) => action(env)
        .mapErr(err => ({ pass, err, ...env }))

    const { cache } = this

    if (Runner.past(result, 'Check')) {
      cache.totalRuns ++
      const label = result.pass === 'Execute' ? 'Error' : result.mainValueStr
      if (! (label in cache.counter)) cache.totalLabels ++
      const count = Counter.inc(cache.counter, label)
      if (count > cache.maxCount) cache.maxCount = count
    }

    cache.result = result

    return result
  }
}

export type RunnerCache = {
  result: Pass.Union | null
  counter: Counter
  totalRuns: number
  totalLabels: number
  maxCount: number
}
export namespace RunnerCache {
  export const empty = (): RunnerCache => ({
    result: null,
    counter: Counter.empty(),
    totalRuns: 0,
    totalLabels: 0,
    maxCount: 0,
  })
}
