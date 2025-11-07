import { Ok, Result } from 'fk-result'

import { DataPat, Expr, LambdaExpr, Mod, EquationApplyFlattenHeadNode, DataApplyConNode, RecordBindingFieldNode, RecordPatFieldNode, RecordUpdateMatchingFieldNode } from '@/node/node'
import { NodeFactory, NodeMaker } from '@/node/utils'
import { Surface0, Surface1 } from '@/node/stage'
import { CheckNodeTransformerOutputMap, NodeTransformCtx, NodeTransformerMap, defineNodeTransformCtx } from '@/node/transform'
import { PassAction } from '@/pipeline'

type SyntaxDesugarCtxImpl = {}

type SyntaxDesugarCtxData = {
  nf: NodeFactory
}

type SyntaxDesugarCtx = NodeTransformCtx<
  Surface0, Surface1, SyntaxDesugarCtxData, SyntaxDesugarCtxImpl, SyntaxDesugarOutputMap
>

type SyntaxDesugarOutputMap = CheckNodeTransformerOutputMap<Surface0, Surface1, {
  applyMulti: Expr<Surface1>
  roll: Expr<Surface1>
  paren: Expr<Surface1>
  tuple: Expr<Surface1>
  list: Expr<Surface1>
  unitPat: DataPat<Surface1>
  tuplePat: DataPat<Surface1>
  listPat: DataPat<Surface1>
  recordPatPunningField: RecordPatFieldNode<Surface1>
  lambdaCase: LambdaExpr<Surface1>
  equationApplyHead: EquationApplyFlattenHeadNode<Surface1>
  equationInfixHead: EquationApplyFlattenHeadNode<Surface1>
  dataInfixCon: DataApplyConNode
  recordPunningField: RecordBindingFieldNode<Surface1>
  recordUpdatePipeField: RecordUpdateMatchingFieldNode<Surface1>
  recordUpdatePunningMatchingField: RecordUpdateMatchingFieldNode<Surface1>
}>

type SyntaxDesugarTransformerMap = NodeTransformerMap<
  Surface0, Surface1, SyntaxDesugarCtx, SyntaxDesugarOutputMap
>

const syntaxDesugarTransformers: SyntaxDesugarTransformerMap = {
  applyMulti: (node, ctx) => ctx.nf.makeApplyMulti(
    [node.func, ...node.args].map(ctx.transform),
  ),

  roll: (node, ctx) => ctx.nf.makeApplyMulti([
    ctx.nf.makeVar('roll'),
    node.times ? ctx.transform(node.times) : ctx.nf.make({ ty: 'num', val: 1 }),
    ctx.transform(node.sides),
  ]),

  paren: (node, ctx) => ctx.transform(node.expr),

  tuple: (node, ctx) => ctx.nf.makeAutoTuple<Surface1>(node.elems.map(ctx.transform)),

  list: (node, ctx) => node.elems
    .map(ctx.transform)
    .reduceRight<Expr<Surface1>>(
      (tail, head) => ctx.nf.makeApplyMulti([
        ctx.nf.makeVar(':'),
        head,
        tail,
      ]),
      ctx.nf.makeVar('[]'),
    ),

  unitPat: (_, ctx) => ctx.nf.make({
    ty: 'dataPat',
    con: ctx.nf.makeVarRef(''),
    args: [],
  }),

  tuplePat: (node, ctx) => ctx.nf.make({
    ty: 'dataPat',
    con: ctx.nf.makeVarRef(ctx.nf.makeTupleIdN(node.elems.length)),
    args: node.elems.map(ctx.transform),
  }),

  listPat: (node, ctx) => node.elems
    .map(ctx.transform)
    .reduceRight<DataPat<Surface1>>(
      (tail, head) => ctx.nf.make({
        ty: 'dataPat',
        con: ctx.nf.makeVarRef(':'),
        args: [head, tail],
      }),
      ctx.nf.make({
        ty: 'dataPat',
        con: ctx.nf.makeVarRef('[]'),
        args: []
      }),
    ),

  recordPatPunningField: (node, ctx) => ctx.nf.make({
    ty: 'recordPatRebindingField',
    key: ctx.transform(node.key),
    pat: ctx.nf.makeVarPat(node.key.id),
  }),

  lambdaCase: (node, ctx) => ctx.nf.make({
    ty: 'lambda',
    param: ctx.nf.makeVarPat('!scrutinee'),
    body: ctx.nf.make({
      ty: 'case',
      scrutinee: ctx.nf.makeVar('!scrutinee'),
      branches: node.branches.map(ctx.transform),
    }),
  }),

  equationApplyHead: (node, ctx) => {
    const func = ctx.transform(node.func)
    const params = node.params.map(ctx.transform)
    if (func.ty === 'varRef') return ctx.nf.make({
      ty: 'equationApplyFlattenHead',
      func,
      params,
    })
    return ctx.nf.make({
      ty: 'equationApplyFlattenHead',
      func: func.func,
      params: [...func.params, ...params],
    })
  },

  equationInfixHead: (node, ctx) => ctx.nf.make({
    ty: 'equationApplyFlattenHead',
    func: ctx.transform(node.op),
    params: [node.lhs, node.rhs].map(ctx.transform),
  }),

  dataInfixCon: (node, ctx) => ctx.nf.make({
    ty: 'dataApplyCon',
    func: ctx.transform(node.op),
    params: [node.lhs, node.rhs].map(ctx.transform),
  }),

  recordPunningField: (node, ctx) => ctx.nf.make({
    ty: 'recordBindingField',
    key: ctx.transform(node.key),
    val: ctx.nf.makeVar(node.key.id),
  }),

  recordUpdatePunningMatchingField: (node, ctx) => ctx.nf.make({
    ty: 'recordUpdateMatchingField',
    key: ctx.transform(node.key),
    pat: ctx.nf.makeVarPat(node.key.id),
    body: ctx.transform(node.body),
  }),

  recordUpdatePipeField: (node, ctx) => ctx.nf.make({
    ty: 'recordUpdateMatchingField',
    key: ctx.transform(node.key),
    pat: ctx.nf.makeVarPat(node.key.id),
    body: ctx.nf.makeApplyMulti([
      ctx.transform(node.func),
      ctx.nf.makeVar(node.key.id),
    ]),
  }),
}

export namespace SyntaxDesugarMod {
  export type Ok = {
    mod: Mod<Surface1>
  }

  export type Err = never

  export type Res = Result<Ok, Err>
}

export const syntaxDesugarMod: PassAction<'syntaxDesugar'> = (modId, store) => {
  const { parse: { mod, ais, nodeMap } } = store.use(modId, ['parse'])

  const createCtx = defineNodeTransformCtx<Surface0, Surface1, SyntaxDesugarCtxData, SyntaxDesugarCtxImpl, SyntaxDesugarOutputMap>(
    () => ({}),
    syntaxDesugarTransformers
  )
  const ctx = createCtx({
    nf: new NodeFactory(NodeMaker.of(ais, nodeMap)),
  })
  return Ok({
    mod: ctx.transform(mod)
  })
}
