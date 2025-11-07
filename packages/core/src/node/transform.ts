import { Ctx, defineCtx } from '@/utils/ctx'
import { NodeTy, Node, NodeOfTy, NodeMetaMap, NodeFieldType } from './node'
import { NodeStage } from './stage'

export type NodeTransformOutputMap<SIn extends NodeStage, SOut extends NodeStage> = {
  [K in NodeTy<SIn>]?: Node<SOut>
} & {
  [K in Exclude<NodeTy<SIn>, NodeTy<SOut>>]: Node<SOut>
}

export type CheckNodeTransformerOutputMap<
  SIn extends NodeStage,
  SOut extends NodeStage,
  OM extends NodeTransformOutputMap<SIn, SOut>
> = OM

export type NodeTransformerEmbeded<SIn extends NodeStage, SOut extends NodeStage, OM extends NodeTransformOutputMap<SIn, SOut>> =
  <K extends NodeTy<SIn>>(node: NodeOfTy<SIn, K>) => NodeTransformerOutput<SIn, SOut, OM, K>

export type NodeTransformCtxImpl<SIn extends NodeStage, SOut extends NodeStage, OM extends NodeTransformOutputMap<SIn, SOut>> = {
  transform: NodeTransformerEmbeded<SIn, SOut, OM>
  transformDefault: NodeTransformerEmbeded<SIn, SOut, OM>
}

export type NodeTransformCtx<
  SIn extends NodeStage,
  SOut extends NodeStage,
  Data extends object,
  Impl extends object,
  OM extends NodeTransformOutputMap<SIn, SOut>
> = Ctx<Data, Impl & NodeTransformCtxImpl<SIn, SOut, OM>>

export type NodeTransformerMap<
  SIn extends NodeStage,
  SOut extends NodeStage,
  C,
  OM extends NodeTransformOutputMap<SIn, SOut>
> = {
  [K in keyof OM & NodeTy<SIn>]: NodeTransformerOfTy<SIn, SOut, C, OM, K>
}

export type NodeTransformerOutput<
  SIn extends NodeStage,
  SOut extends NodeStage,
  OM extends NodeTransformOutputMap<SIn, SOut>,
  K extends NodeTy<SIn>
> = K extends keyof OM
  ? OM[K]
  : NodeOfTy<SOut, K>

export type NodeTransformerOfTy<
  SIn extends NodeStage,
  SOut extends NodeStage,
  C,
  OM extends NodeTransformOutputMap<SIn, SOut>,
  K extends NodeTy<SIn>
> = (node: NodeOfTy<SIn, K>, ctx: C) => NodeTransformerOutput<SIn, SOut, OM, K>

export function defineNodeTransformCtx<
  SIn extends NodeStage,
  SOut extends NodeStage,
  Data extends object,
  Impl extends object,
  OM extends NodeTransformOutputMap<SIn, SOut>,
>(
  impl: (ctx: NodeTransformCtx<SIn, SOut, Data, Impl, OM>) => Impl,
  transformers: NodeTransformerMap<SIn, SOut, NodeTransformCtx<SIn, SOut, Data, Impl, OM>, OM>,
) {
  return defineCtx<Data, Impl & NodeTransformCtxImpl<SIn, SOut, OM>>(ctx => ({
    ...impl(ctx),
    transform: node => transformNode(node, ctx, transformers, false),
    transformDefault: node => transformNode(node, ctx, transformers, true),
  }))
}

function transformNode<
  SIn extends NodeStage,
  SOut extends NodeStage,
  Data extends object,
  Impl extends object,
  OM extends NodeTransformOutputMap<SIn, SOut>,
  K extends NodeTy<SIn>
>(
  node: NodeOfTy<SIn, K>,
  ctx: NodeTransformCtx<SIn, SOut, Data, Impl, OM>,
  transformers: NodeTransformerMap<SIn, SOut, NodeTransformCtx<SIn, SOut, Data, Impl, OM>, OM>,
  isDefault: boolean
): NodeTransformerOutput<SIn, SOut, OM, K> {
  const { ty } = node

  if (! isDefault) {
    const transformer = ty in transformers ? transformers[ty] : null
    if (transformer) return transformer(node, ctx)
  }

  const meta = NodeMetaMap[ty]
  const output = { ...node }
  for (const [prop, type] of Object.entries(meta) as [keyof NodeOfTy<SIn, K>, NodeFieldType][]) {
    const val = node[prop]
    if (type === 'node')
      output[prop] = ctx.transform(val as NodeOfTy<SIn>)
    else if (type === 'node?')
      output[prop] = val ? ctx.transform(val as NodeOfTy<SIn>) : null
    else if (type === 'node[]')
      output[prop] = (val as NodeOfTy<SIn>[]).map(ctx.transform)
    else if (type === 'node[]?')
      output[prop] = val ? (val as NodeOfTy<SIn>[]).map(ctx.transform) : null
  }
  return output as NodeTransformerOutput<SIn, SOut, OM, K>
}
