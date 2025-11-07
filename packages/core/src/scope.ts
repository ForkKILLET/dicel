import { Result, Err, Ok } from 'fk-result'

import { BUILTIN_ID_LIST } from '@/builtin/termType'
import { AstId } from '@/node/astId'
import { Map } from '@/utils/data'
import { SymId, SymIdState, SymInfoMap, SymSource, IdSymMap, SymIdHead, SymIdHeadOptional } from './sym'

// TODO: unify with `Sym`
export type ScopeSym<SH extends SymIdHeadOptional = {}> = SH & {
  source: SymSource
  unscopable: boolean
}

export class Scope {
  private symMap: Map<string, ScopeSym<SymIdHead>> = Map.empty()

  constructor(
    public readonly astId: AstId,
    public readonly parent: Scope | null
  ) {}

  static builtin(symInfoMap: SymInfoMap): Scope {
    const scope = new Scope(0, null)
    BUILTIN_ID_LIST.forEach(id => {
      const symId: SymId = `Builtin:${id}`
      const source: SymSource = { type: 'builtin', id }
      scope.symMap.set(id, { symId, source, unscopable: false })
      symInfoMap.set(symId, { type: 'binding', id, source })
    })
    return scope
  }

  static global(astId: AstId, symInfoMap: SymInfoMap): Scope {
    return new Scope(astId, Scope.builtin(symInfoMap))
  }

  derive(astId: number): Scope {
    return new Scope(astId, this)
  }

  register(id: string, sym: ScopeSym, sis: SymIdState): Result<SymId, ScopeSym<SymIdHead>> {
    if (this.symMap.has(id)) return Err(this.symMap.get(id)!)
    const symId = sis.next()
    this.symMap.set(id, { ...sym, symId })
    return Ok(symId)
  }

  keys() {
    return this.symMap.keys()
  }

  values() {
    return this.symMap.values()
  }

  entries() {
    return this.symMap.entries()
  }

  get size() {
    return this.symMap.size
  }

  get(id: string): ScopeSym<SymIdHead> | null {
    return this.symMap.get(id) ?? null
  }

  has(id: string): boolean {
    return this.symMap.has(id)
  }

  lookup(id: string): ScopeSym<SymIdHead> | null {
    const sym = this.symMap.get(id)
    if (sym && ! sym.unscopable) return sym
    if (this.parent) return this.parent.lookup(id)
    return null
  }
}
export type ScopeMap = Map<AstId, Scope>

