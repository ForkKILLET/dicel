import { Map } from '@/utils/data'

import { Node, NodeOfTy, NodeTy } from '@/node/node'
import { Surface0 } from '@/node/stage'
import { defineNodeWalkCtx } from '@/node/walk'

export type AstId = number

export class AstIdState {
  private nextId: AstId = 1

  next() {
    return this.nextId ++
  }
}

export namespace AssignId {
  export type Ok<K extends NodeTy<Surface0>> = {
    node: NodeOfTy<Surface0, K>
    ais: AstIdState
    nodeMap: Map<AstId, Node>
  }
}

export type NodeMap<N extends Node = Node> = Map<AstId, N>

export const assignId = <K extends NodeTy<Surface0>>(node: NodeOfTy<Surface0, K>): AssignId.Ok<K> => {
  const ais = new AstIdState
  const nodeMap: NodeMap = Map.empty()
  const createCtx = defineNodeWalkCtx<Surface0, {}, {}>(
    () => ({}),
    {},
    (node) => {
      node.astId = ais.next()
      nodeMap.set(node.astId, node)
    }
  )
  createCtx({}).walk(node)
  return {
    node,
    ais,
    nodeMap,
  }
}
