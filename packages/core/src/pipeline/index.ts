import { Result } from 'fk-result'

import { ParseMod, parseMod } from '@/passes/parse'
import { SyntaxDesugarMod, syntaxDesugarMod } from '@/passes/syntaxDesugar'
import { nameResolveMod, NameResolveMod } from '@/passes/nameResolve'
import { ModResolve, modResolveMod } from '@/passes/modResolve'
import { semanticsDesugarMod, SemanticsDesugarMod } from '@/passes/semanticsDesugar'
import { stdModSources } from '@/std'
import { kindCheckMod, KindCheckMod } from '@/passes/kindCheck'
import { bindingGroupResolveMod, BindingGroupResolveMod } from '@/passes/bindingGroupResolve'
import { typeCheckMod, TypeCheckMod } from '@/passes/typeCheck'
import { classDesugarMod, ClassDesugarMod } from '@/passes/classDesugar'
import { Graph } from '@/utils/algorithms'
import { Dict } from '@/utils/data'
import { Bound } from '@/utils/decorators'
import { evaluateMod, EvaluateMod } from '@/passes/evaluate'

export class PipelineError extends Error {
  name = 'PipelineError'
}

export const PASSES = [
  'parse', 'syntaxDesugar', 'modResolve', 'nameResolve',
  'semanticsDesugar', 'kindCheck', 'bindingGroupResolve', 'typeCheck',
  'classDesugar', 'evaluate',
] as const
export type Pass = typeof PASSES[number]
export type PassSeq = readonly Pass[]

export type CheckPassMap<M extends Record<Pass, any>> = M

export type PassOutputMap = CheckPassMap<{
  parse: ParseMod.Ok
  syntaxDesugar: SyntaxDesugarMod.Ok
  nameResolve: NameResolveMod.Ok
  modResolve: ModResolve.Ok
  semanticsDesugar: SemanticsDesugarMod.Ok
  kindCheck: KindCheckMod.Ok
  bindingGroupResolve: BindingGroupResolveMod.Ok
  typeCheck: TypeCheckMod.Ok
  classDesugar: ClassDesugarMod.Ok
  evaluate: EvaluateMod.Ok
}>

export type PassErrMap = CheckPassMap<{
  parse: ParseMod.Err
  syntaxDesugar: SyntaxDesugarMod.Err
  nameResolve: NameResolveMod.Err
  modResolve: ModResolve.Err
  semanticsDesugar: SemanticsDesugarMod.Err
  kindCheck: KindCheckMod.Err
  bindingGroupResolve: BindingGroupResolveMod.Err
  typeCheck: TypeCheckMod.Err
  classDesugar: ClassDesugarMod.Err
  evaluate: EvaluateMod.Err
}>

export type PassStatus = 'ok' | 'err' | 'pending'

export namespace PassState {
  export type Ok<P extends Pass> = { status: 'ok', output: PassOutputMap[P], time: number }
  export type Err<P extends Pass> = { status: 'err', err: PassErrMap[P], time: number }
  export type Pending = { status: 'pending' }

  export const ok = <P extends Pass>(output: PassOutputMap[P], time: number): Ok<P> => ({
    status: 'ok',
    output,
    time,
  })

  export const err = <P extends Pass>(err: PassErrMap[P], time: number): Err<P> => ({
    status: 'err',
    err,
    time,
  })

  export const pending = (): Pending => ({ status: 'pending' })
}

export type PassState<P extends Pass> =
  | PassState.Ok<P>
  | PassState.Err<P>
  | PassState.Pending

export type PassStateMap = {
  source: string
} & {
  [P in Pass]: PassState<P>
}

export type ModStateMap = Dict<PassStateMap>

export type PassAction<P extends Pass> = (modId: string, store: ModStore, graph: ModGraph) => PassActionResult<P>
export type PassActionResult<P extends Pass> = Result<PassOutputMap[P], PassErrMap[P]>
export type PassActionDigest<P extends Pass> = {
  pass: P
  isOk: boolean
}

export type ModOutputs<P extends Pass> = { [Pi in P]?: PassOutputMap[Pi] }
export type ModOutputsChecked<P extends Pass> = { [Pi in P]: PassOutputMap[Pi] }

export class ModStore {
  constructor(
    public readonly passSeq: PassSeq,
    private modStates: ModStateMap = {},
  ) {}

  private log(msg: string, ...args: any[]) {
    console.log(`[ModStore] ${msg}`, ...args)
  }

  private error(msg: string, ...args: any[]) {
    console.error(`[ModStore] ${msg}`, ...args)
  }

  create(modId: string, source: string) {
    this.modStates[modId] = {
      source,
      parse: { status: 'pending' },
      syntaxDesugar: { status: 'pending' },
      modResolve: { status: 'pending' },
      nameResolve: { status: 'pending' },
      semanticsDesugar: { status: 'pending' },
      kindCheck: { status: 'pending' },
      bindingGroupResolve: { status: 'pending' },
      typeCheck: { status: 'pending' },
      classDesugar: { status: 'pending' },
      evaluate: { status: 'pending' },
    }
  }

  load(_modId: string) {
    throw new PipelineError('Loading mod by id is not supported yet.')
  }

  get(modId: string) {
    return this.modStates[modId]
  }

  has(modId: string) {
    return modId in this.modStates
  }

  use<const Ps extends Pass[]>(modId: string, requiredPasses: Ps) {
    const modState = this.modStates[modId]
    if (! modState) throw new PipelineError(`Module not found in pipeline store: <${modId}>`)

    const data: { source: string } & { [P in Pass]?: any } = { source: modState.source }
    for (const pass of requiredPasses) {
      const passState = modState[pass]
      if (passState.status !== 'ok')
        throw new PipelineError(`Required pass not completed successfully: <${pass}> for module <${modId}>`)
      data[pass] = passState.output
    }
    return data as { source: string } & ModOutputsChecked<Ps[number]>
  }

  handle<P extends Pass>(modId: string, pass: P, fn: () => PassActionResult<P>): PassActionDigest<P> {
    try {
      const startTime = Date.now()
      const result = fn()
      const endTime = Date.now()
      const time = endTime - startTime
      this.log(`handle pass <${pass}> for module <${modId}> (${result.isOk ? 'ok' : 'err'}, ${time}ms):`, result.union())
      this.modStates[modId][pass] = result.match(
        output => PassState.ok(output, time),
        err => PassState.err(err, time),
      ) as PassStateMap[P]
      if (! result.isOk) this.clearAfter(modId, pass)
      return {
        isOk: result.isOk,
        pass,
      }
    }
    catch (err) {
      this.error(`handle pass <${pass}> for module <${modId}> (exception):`, err)
      this.clearAfter(modId, pass)
      return {
        isOk: false,
        pass,
      }
    }
  }

  clearAfter(modId: string, pass: Pass) {
    const passIx = this.passSeq.indexOf(pass)
    for (const pass of this.passSeq.slice(passIx + 1)) {
      this.modStates[modId][pass] = { status: 'pending' }
    }
  }
}

export class ModGraph {
  private graph = Graph.emptyD<string>()

  addDep(fromModId: string, toModId: string) {
    this.graph.get(fromModId).add(toModId)
  }

  getDeps(modId: string) {
    return this.graph.get(modId)
  }
}

export class Pipeline {
  static readonly passSeq: PassSeq = PASSES

  static {
    Bound(Pipeline)
  }

  private passActions: { [P in Pass]: PassAction<P> }
  private store: ModStore
  private graph: ModGraph

  constructor(
    modStates: ModStateMap = {},
    public readonly passSeq = Pipeline.passSeq,
  ) {
    this.passActions = {
      parse: parseMod,
      syntaxDesugar: syntaxDesugarMod,
      modResolve: modResolveMod,
      nameResolve: nameResolveMod,
      semanticsDesugar: semanticsDesugarMod,
      kindCheck: kindCheckMod,
      bindingGroupResolve: bindingGroupResolveMod,
      typeCheck: typeCheckMod,
      classDesugar: classDesugarMod,
      evaluate: evaluateMod,
    }
    this.store = new ModStore(passSeq, modStates)
    this.graph = new ModGraph()
  }

  loadStd() {
    this.load('Prelude', stdModSources['Prelude'])
  }

  load(modId: string, source: string) {
    this.store.create(modId, source)
    for (const pass of this.passSeq) {
      const result = this.store.handle(
        modId, pass,
        () => this.passActions[pass](modId, this.store, this.graph)
      )
      if (! result.isOk) break
    }
    return this.store.get(modId)
  }
}
