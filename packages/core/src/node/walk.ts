import { Ctx, defineCtx } from '@/utils/ctx'
import { Node, NodeFieldType, NodeMetaMap, NodeOfTy, NodeTy } from './node'
import { NodeStage } from './stage'

export type NodeWalker<S extends NodeStage, C, K extends NodeTy<S>> =
  (node: NodeOfTy<S, K>, ctx: C) => void

export type NodeWalkerMap<S extends NodeStage, C> = {
  [K in NodeTy<S>]?: NodeWalker<S, C, K>
}

export type NodeSharedWalker<S extends NodeStage> =
  (node: Node<S>) => void

export type NodeWalkerEmbeded<S extends NodeStage> =
  <K extends NodeTy<S>>(node: NodeOfTy<S, K>) => void

export type NodeWalkCtxImpl<S extends NodeStage> = {
  walk: NodeWalkerEmbeded<S>
  walkDefault: NodeWalkerEmbeded<S>
}

export type NodeWalkCtx<S extends NodeStage, Data extends object, Impl extends object>
  = Ctx<Data, Impl & NodeWalkCtxImpl<S>>

export function defineNodeWalkCtx<S extends NodeStage, Data extends object, Impl extends object>(
  impl: (ctx: NodeWalkCtx<S, Data, Impl>) => Impl,
  walkers: NodeWalkerMap<S, NodeWalkCtx<S, Data, Impl>>,
  sharedWalker?: NodeSharedWalker<S>,
) {
  return defineCtx<Data, Impl & NodeWalkCtxImpl<S>>(ctx => ({
    ...impl(ctx),
    walk: (node) => walkNode(node, ctx, walkers, sharedWalker, false),
    walkDefault: (node) => walkNode(node, ctx, walkers, sharedWalker, true),
  }))
}

export function walkNode<S extends NodeStage, Data extends object, Impl extends object, K extends NodeTy<S>>(
  node: NodeOfTy<S, K>,
  ctx: NodeWalkCtx<S, Data, Impl>,
  walkers: NodeWalkerMap<S, NodeWalkCtx<S, Data, Impl>>,
  sharedWalker: NodeSharedWalker<S> | undefined,
  isDefault: boolean,
) {
  const { ty } = node

  sharedWalker?.(node)

  if (! isDefault) {
    const walker = ty in walkers ? walkers[ty] : null
    if (walker) return walker(node, ctx)
  }

  const meta = NodeMetaMap[ty]
  for (const [prop, type] of Object.entries(meta) as [keyof NodeOfTy<S, K>, NodeFieldType][]) {
    const val = node[prop]
    if (type === 'node')
      ctx.walk(val as NodeOfTy<S>)
    else if (type === 'node?')
      val && ctx.walk(val as NodeOfTy<S>)
    else if (type === 'node[]')
      (val as NodeOfTy<S>[]).forEach(ctx.walk)
    else if (type === 'node[]?')
      val && (val as NodeOfTy<S>[]).forEach(ctx.walk)
  }
}
