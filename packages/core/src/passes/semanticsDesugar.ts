import { Result } from 'fk-result'
import { Range } from 'parsecond'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { BindingHostNode, BindingNode, CaseExpr, Expr, IdNode, LambdaExpr, Mod, Node, NodeOfTy, NodeTy, Pat, RecordBindingFieldNode, RecordExpr, RecordPat, RecordPatRebindingFieldNode, SectionLExpr, SectionRExpr, VarExpr, VarRefNode } from '@/node/node'
import { Core, SurfaceR } from '@/node/stage'
import { CheckNodeTransformerOutputMap, defineNodeTransformCtx, NodeTransformCtx, NodeTransformerMap } from '@/node/transform'
import { NodeFactory, NodeMaker } from '@/node/utils'
import { BUILTIN_FIXITY_MAP, Fixity, FixityMap } from '@/fixity'
import { Dict, Map, Set } from '@/utils/data'
import { minBy } from '@/utils/compose'

import { BindingHostMap, BindingMap } from './nameResolve'
import { SymIdState } from '@/sym'
import { Scope, ScopeMap } from '@/scope'
import { PassAction } from '@/pipeline'
import { RecordMap } from '@/record'
import { AstId } from '@/node/astId'

interface SortRecordLike {
  (record: RecordExpr<SurfaceR>): RecordExpr<Core>
  (recordPat: RecordPat<SurfaceR>): RecordPat<Core>
}

type SemanticsDesugarCtxImpl = {
  throw: (err: SemanticsDesugarMod.Err) => never
  enterNodeScope: (node: Node) => SemanticsDesugarCtx
  getFixity: (op: string) => Fixity
  sortRecordLike: SortRecordLike
}

type SemanticsDesugarCtxData = {
  nf: NodeFactory
  fixityMap: FixityMap
  recordMap: RecordMap
  bindingMap: BindingMap
  bindingHostMap: BindingHostMap
  sis: SymIdState
  scope: Scope
  scopeMap: ScopeMap
}

type SemanticsDesugarCtx = NodeTransformCtx<
  SurfaceR, Core, SemanticsDesugarCtxData, SemanticsDesugarCtxImpl, SemanticsDesugarOutputMap
>

type InfixLikeTy = 'infix' | 'infixPat'
type InfixLikeArg<K extends InfixLikeTy> = {
  infix: Expr<Core>
  infixPat: Pat<Core>
}[K]
type InfixLikeOp<K extends 'infix' | 'infixPat'> = {
  infix: VarExpr<SurfaceR>
  infixPat: VarRefNode<SurfaceR>
}[K]

const desugarInfixLike = <K extends 'infix' | 'infixPat'>(
  node: NodeOfTy<SurfaceR, K>,
  ctx: SemanticsDesugarCtx,
  makeApply: (lhs: InfixLikeArg<K>, op: InfixLikeOp<K>, rhs: InfixLikeArg<K>) => InfixLikeArg<K>,
) => {
  type Arg = InfixLikeArg<K>
  type Op = InfixLikeOp<K>

  const ops = node.ops.slice() as Op[]
  const args = node.args.slice()

  const nodeStack: Arg[] = []
  const opStack: Op[] = []
  nodeStack.push(ctx.transform(args.shift()!) as Arg)

  const reduce = () => {
    const op = opStack.pop()!
    const rhs = nodeStack.pop()!
    const lhs = nodeStack.pop()!
    nodeStack.push(makeApply(lhs, op, rhs))
  }

  while (ops.length) {
    const op = ops.shift()!

    while (opStack.length) {
      const top = opStack.at(-1)!
      const topFixity = ctx.getFixity(top.id.id)
      const opFixity = ctx.getFixity(op.id.id)

      let shouldReduce = false
      if (topFixity.prec > opFixity.prec) shouldReduce = true
      else {
        if (topFixity.prec === opFixity.prec) {
          if (topFixity.assoc !== opFixity.assoc || topFixity.assoc === 'none') ctx.throw({
            type: 'Fixity',
            lOp: top.astId, rOp: op.astId,
            lFixity: topFixity, rFixity: opFixity,
          })
          if (topFixity.assoc === 'left') shouldReduce = true
        }
      }

      if (shouldReduce) reduce()
      else break
    }

    opStack.push(op)

    const arg = ctx.transform(args.shift()!) as Arg
    nodeStack.push(arg)
  }

  while (opStack.length) reduce()

  return nodeStack[0]
}

type SemanticsDesugarOutputMap = CheckNodeTransformerOutputMap<SurfaceR, Core, {
  infix: Expr<Core>
  sectionL: Expr<Core>
  sectionR: LambdaExpr<Core>
  lambdaMulti: LambdaExpr<Core>
  infixPat: Pat<Core>
  equation: never
  equationApplyFlattenHead: never
  bindingHost: BindingHostNode<Core>
  record: RecordExpr<Core>
  recordPat: RecordPat<Core>
  recordUpdate: LambdaExpr<Core>
}>

type SemanticsDesugarTransformerMap = NodeTransformerMap<
  SurfaceR, Core, SemanticsDesugarCtx, SemanticsDesugarOutputMap
>

const semanticsDesugarTransformers: SemanticsDesugarTransformerMap = {
  infix: (node, ctx) => {
    return desugarInfixLike(node, ctx, (lhs, op, rhs) => ctx.nf.makeApplyMulti([
      op,
      lhs,
      rhs,
    ]))
  },

  sectionL: (expr, ctx) => {
    if (expr.arg.ty === 'infix') {
      const lowestFixity = pipe(
        expr.arg.ops,
        R.map(op => ctx.getFixity(op.id.id)),
        minBy(fixity => fixity.prec)
      )
      const sectionFixity = ctx.getFixity(expr.op.id.id)

      if (
        sectionFixity.prec > lowestFixity.prec ||
        sectionFixity.prec === lowestFixity.prec && sectionFixity.assoc !== 'left'
      ) ctx.throw({ type: 'Section', section: expr.astId })
    }

    return ctx.nf.makeApplyMulti([
      expr.op,
      expr.arg,
    ].map(ctx.transform))
  },

  sectionR: (expr, ctx) => {
    if (expr.arg.ty === 'infix') {
      const lowestFixity = pipe(
        expr.arg.ops,
        R.map(op => ctx.getFixity(op.id.id)),
        minBy(fixity => fixity.prec)
      )
      const sectionFixity = ctx.getFixity(expr.op.id.id)

      if (
        sectionFixity.prec > lowestFixity.prec ||
        sectionFixity.prec === lowestFixity.prec && sectionFixity.assoc !== 'right'
      ) ctx.throw({ type: 'Section', section: expr.astId })
    }

    const symId = ctx.sis.next()
    const lambda = ctx.nf.make({
      ty: 'lambda',
      param: ctx.nf.makeVarPat('!lhs', symId),
      body: ctx.nf.makeApplyMulti([
        ctx.transform(expr.op),
        ctx.nf.makeVar('!lhs', symId),
        ctx.transform(expr.arg),
      ]),
    })
    return lambda
  },

  infixPat: (pat, ctx) => {
    return desugarInfixLike(pat, ctx, (lhs, op, rhs) => ctx.nf.make({
      ty: 'dataPat',
      con: op,
      args: [lhs, rhs],
    }))
  },

  lambdaMulti: (node, ctx) => {
    ctx = ctx.enterNodeScope(node)

    const params = node.params.map(ctx.transform)
    const body = ctx.transform(node.body)

    return params.reduceRight(
      (bodyAcc, param) => ctx.nf.make({
        ty: 'lambda',
        param,
        body: bodyAcc,
      }),
      body,
    ) as LambdaExpr<Core>
  },

  equation: (_node, ctx) => {
    throw ctx.throw({ type: 'Unreachable', ty: 'equation' })
  },

  equationApplyFlattenHead: (_node, ctx) => {
    throw ctx.throw({ type: 'Unreachable', ty: 'equationApplyFlattenHead' })
  },

  recordUpdate: (node, ctx) => {
    const { fieldDict: fieldDictDef } = ctx.recordMap.get(node.con.id.id)!
    const fieldDict = pipe(
      node.fields,
      R.map(field => [field.key.id, ctx.transform(field)] as const),
      Dict.of,
    )

    const patFields: RecordPatRebindingFieldNode<Core>[] = []
    const fields: RecordBindingFieldNode<Core>[] = []
    for (const keyId in fieldDictDef) {
      if (keyId in fieldDict) {
        const field = fieldDict[keyId]
        patFields.push(ctx.nf.make({
          ty: 'recordPatRebindingField',
          key: field.key,
          pat: field.pat,
        }))
        fields.push(ctx.nf.make({
          ty: 'recordBindingField',
          key: field.key,
          val: field.body,
        }))
      }
      else {
        const key = ctx.nf.makeId(keyId)
        const symId = ctx.sis.next()
        patFields.push(ctx.nf.make({
          ty: 'recordPatRebindingField',
          key,
          pat: ctx.nf.makeVarPat(keyId, symId),
        }))
        fields.push(ctx.nf.make({
          ty: 'recordBindingField',
          key,
          val: ctx.nf.makeVar(keyId, symId),
        }))
      }
    }

    return ctx.nf.make({
      ty: 'lambda',
      param: ctx.nf.make({
        ty: 'recordPat',
        con: node.con,
        fields: patFields,
      }),
      body: ctx.nf.make({
        ty: 'record',
        con: node.con,
        fields,
      }),
    })
  },

  bindingHost: (node, ctx) => {
    ctx = ctx.enterNodeScope(node)

    const { fixityMap, equationGroupDict } = ctx.bindingHostMap.get(node.astId)!
    ctx = ctx.fork({
      fixityMap: Map.union([ctx.fixityMap, fixityMap]),
    })

    const equationBindings = pipe(
      R.values(equationGroupDict),
      R.map((group): BindingNode<Core> => {
        const argIds = R.range(0, group.arity).map(ix => `!arg${ix}`)
        const symIds = R.range(0, group.arity).map(ctx.sis.next)
        const argVars = R.zip(argIds, symIds).map(([id, symId]) => ctx.nf.makeVar(id, symId))
        const paramVarPats = R.zip(argIds, symIds).map(([id, symId]) => ctx.nf.makeVarPat(id, symId))
        const case_: CaseExpr<Core> = ctx.nf.make({
          ty: 'case',
          scrutinee: ctx.nf.makeAutoTuple(argVars, true),
          branches: group.equations.map((equation) => pipe(
            ctx.enterNodeScope(equation),
            ctx => ctx.nf.make({
              ty: 'caseBranch',
              pat: ctx.nf.makeAutoTuplePat(equation.head.params.map(ctx.transform), true),
              body: ctx.transform(equation.body),
            })
          )),
        })
        const lambda: LambdaExpr<Core> = ctx.nf.makeLambdaMulti(
          paramVarPats,
          case_,
        )
        const [first] = group.equations
        const binding: BindingNode<Core> = {
          ty: 'binding',
          astId: first.astId,
          range: Range.empty(),
          pat: ctx.nf.makeVarPat(group.id, group.symId),
          body: lambda,
        }
        ctx.bindingMap.set(binding.astId, {
          symIdSet: Set.solo(group.symId),
          refSymIdSet: pipe(
            group.equations,
            R.map(({ astId }) => ctx.bindingMap.get(astId)!.refSymIdSet),
            Set.union,
          )
        })

        return binding
      })
    )

    const bindings = pipe(
      node.bindings,
      R.filter(bi => bi.ty === 'binding'),
      R.map(ctx.transform),
      R.concat(equationBindings),
    )

    return {
      ...node,
      bindings,
    }
  },

  recordPat: (node, ctx) => {
    return ctx.sortRecordLike(node)
  },

  record: (node, ctx) => {
    return ctx.sortRecordLike(node)
  },
}

export namespace SemanticsDesugarMod {
  export type Ok = { mod: Mod<Core> }

  export type Err =
    | { type: 'Unreachable', ty: NodeTy<SurfaceR> }
    | { type: 'Fixity', lOp: AstId, rOp: AstId, lFixity: Fixity, rFixity: Fixity }
    | { type: 'Section', section: AstId }

  export type Res = Result<Ok, Err>
}

export const semanticsDesugarMod: PassAction<'semanticsDesugar'> = (modId, store) => {
  const {
    parse: { ais, nodeMap },
    nameResolve: { sis, mod, bindingHostMap, bindingMap, exportInfo: { recordMap }, globalScope, scopeMap }
  } = store.use(modId, ['parse', 'nameResolve'])

  const createCtx = defineNodeTransformCtx<
    SurfaceR, Core, SemanticsDesugarCtxData, SemanticsDesugarCtxImpl, SemanticsDesugarOutputMap
  >(
    ctx => ({
      throw: err => { throw err },

      enterNodeScope: node => ctx.fork({ scope: ctx.scopeMap.get(node.astId)! }),

      getFixity: op => ctx.fixityMap.get(op) ?? Fixity.def(),

      sortRecordLike: (node => {
        const recordInfo = ctx.recordMap.get(node.con.id.id)!
        const fieldsDict = pipe(
          node.fields,
          R.map(field => [field.key.id, ctx.transform(field)] as const),
          Dict.of,
        )
        const fieldsSorted = pipe(
          recordInfo.fieldDict,
          Dict.keys,
          R.map(key => fieldsDict[key])
        )
        return {
          ...node,
          fields: fieldsSorted,
        }
      }) as SortRecordLike,
    }),
    semanticsDesugarTransformers
  )
  const ctx = createCtx({
    sis,
    nf: new NodeFactory(NodeMaker.of(ais, nodeMap)),
    fixityMap: BUILTIN_FIXITY_MAP,
    bindingMap,
    bindingHostMap,
    scope: globalScope,
    scopeMap,
    recordMap
  })

  return Result.wrap<SemanticsDesugarMod.Ok, SemanticsDesugarMod.Err>(() => ({
    mod: ctx.transform(mod),
  }))
}
