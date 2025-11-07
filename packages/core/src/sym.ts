import { Result, Err, Ok } from 'fk-result'

import { AstId } from '@/node/astId'
import { Bound } from '@/utils/decorators'
import { DefaultMap, Map } from '@/utils/data'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'
import { coerce } from './utils/compose'
import { Core, NodeStage, SurfaceR } from './node/stage'
import { VarPat } from './node/node'

export type SymId = `${string}:${string}`

export class SymIdState {
  static {
    Bound(SymIdState)
  }

  constructor(
    public readonly modId: string,
  ) {}

  private nextId: number = 1

  next(): SymId {
    return `${this.modId}:${this.nextId ++}`
  }
}

export type SymSource =
  | { type: 'nodes', astIds: AstId[] }
  | { type: 'builtin', id: string }

export namespace SymSource {
  export const node = (astId: AstId): SymSource => ({
    type: 'nodes',
    astIds: [astId],
  })

  export const nodes = (astIds: AstId[]): SymSource => ({
    type: 'nodes',
    astIds,
  })

  export const asNodes = (source: SymSource): AstId[] => pipe(
    source,
    coerce(source => source.type === 'nodes'),
    R.prop('astIds')
  )
}

export type SymType = 'binding' | 'type' | 'module' | 'instance'

export type SymTypeInfo =
  | { type: 'binding' }
  | { type: 'type', ty: 'data' | 'record' | 'class' }
  | { type: 'module' }
  | { type: 'instance' }

export type SymInfo = SymTypeInfo & {
  id: string
  source: SymSource
  originSymId?: SymId
}

export type SymIdHead = {
  symId: SymId
}
export type SymIdHeadOptional = SymIdHead | {}

export type SymIdHeadByStage<S extends NodeStage = NodeStage> =
  S extends SurfaceR | Core ? SymIdHead : {}

export type Sym = SymInfo & SymIdHead

export type SymSlot = Partial<Record<SymType, Sym>>

export namespace SymTable {
  export type Err =
    | { type: 'ConflictingSym', id: string, existing: Sym }
}

export class SymTable {
  static {
    Bound(SymTable)
  }

  constructor(
    public readonly sis: SymIdState,
    public readonly symInfoMap: SymInfoMap,
  ) {}

  readonly byId = Map.empty<string, SymSlot>()
  readonly byType = DefaultMap.empty<SymType, Map<string, Sym>>(Map.empty)

  register(info: SymInfo & Partial<SymIdHead>): Result<SymId, SymTable.Err> {
    const { id, type } = info
    const slot = this.byId.get(id) ?? {}
    if (slot[type]) return Err({
      type: 'ConflictingSym',
      id,
      existing: slot[type],
    })

    const symId = info.symId ?? this.sis.next()
    const sym: Sym = { ...info, symId }
    slot[type] = sym
    this.symInfoMap.set(symId, info)
    this.byId.set(id, slot)
    this.byType.get(type).set(id, sym)

    return Ok(symId)
  }

  get(id: string): SymSlot | null {
    return this.byId.get(id) ?? null
  }

  entries() {
    return this.byId.entries()
  }

  [Symbol.iterator]() {
    return this.entries()
  }

  values() {
    return this.byId.values()
  }
}

export type AstSymMap = Map<AstId, SymId>

export type SymInfoMap = Map<SymId, SymInfo>

export type IdSymEntry = readonly [string, SymId]
export type IdSymMap = Map<string, SymId>

export type IdAstMap = Map<string, AstId>

export type SymNode = VarPat<SurfaceR>
export type IdSymNodeMap = Map<string, SymNode>

export type IdSourceMap = Map<string, SymSource>
export namespace IdSourceMap {
  export const ofIdNodeMap: (idNodeMap: IdSymNodeMap) => IdSourceMap = Map.map(node => SymSource.node(node.astId))
}
