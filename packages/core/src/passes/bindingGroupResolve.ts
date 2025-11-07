import { Ok, Result } from 'fk-result'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { Core } from '@/node/stage'
import { BindingHostNode, BindingNode, Mod } from '@/node/node'
import { Set, Map } from '@/utils/data'
import { Graph } from '@/utils/algorithms'
import { AstId } from '@/node/astId'
import { defineNodeWalkCtx } from '@/node/walk'
import { SymId } from '@/sym'

import { BindingMap } from './nameResolve'
import { PassAction } from '@/pipeline'

export type Comp = {
  id: number
  idSet: Set<string>
}

export type BindingGroup = {
  id: number
  symIdSet: Set<SymId>
  bindings: BindingNode<Core>[]
}

export type BindingGroupsMap = Map<AstId, BindingGroup[]>

export const bindingGroupResolve = (
  bindingHost: BindingHostNode<Core>,
  bindingMap: BindingMap,
): BindingGroup[] => {
  const symBindingMap = Map.empty<SymId, BindingNode<Core>>()
  const depGraph: Graph<SymId> = Graph.emptyD()

  const hostSymIdSet = pipe(
    bindingHost.bindings,
    R.map(binding => bindingMap.get(binding.astId)!.symIdSet),
    Set.union,
  )
  for (const binding of bindingHost.bindings) {
    const { symIdSet, refSymIdSet } = bindingMap.get(binding.astId)!

    const refSymIdSetClosed = refSymIdSet
      .intersection(hostSymIdSet)
      .union(symIdSet)

    for (const symId of symIdSet) {
      symBindingMap.set(symId, binding)
      depGraph.set(symId, refSymIdSetClosed)
    }
  }

  const { comps } = Graph.solveSCCs(depGraph)

  return comps
    .reverse()
    .map(({ color, nodes: symIdSet }): BindingGroup => {
      const bindings = pipe(
        [...symIdSet],
        R.map(symId => symBindingMap.get(symId)!),
        R.uniqueBy(R.prop('astId')),
      )
      return {
        id: color,
        bindings,
        symIdSet,
      }
    })
}

export namespace BindingGroupResolveMod {
  export type Ok = {
    bindingGroupsMap: BindingGroupsMap
  }

  export type Err = never

  export type Res = Result<Ok, Err>

  export type Options = {
    bindingMap: BindingMap
  }
}

export const bindingGroupResolveMod: PassAction<'bindingGroupResolve'> = (modId, store) => {
  const {
    nameResolve: { bindingMap },
    semanticsDesugar: { mod },
  } = store.use(modId, ['nameResolve', 'semanticsDesugar'])

  const bindingGroupsMap: BindingGroupsMap = Map.empty()

  const createCtx = defineNodeWalkCtx<Core, {}, {}>(
    () => ({}),
    {
      bindingHost: (node, ctx) => {
        bindingGroupsMap.set(node.astId, bindingGroupResolve(node, bindingMap))
        ctx.walkDefault(node)
      },
    }
  )

  const ctx = createCtx({})
  ctx.walk(mod)

  return Ok({ bindingGroupsMap })
}
