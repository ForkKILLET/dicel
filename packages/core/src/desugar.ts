import { Result } from 'fk-result'
import { match } from 'ts-pattern'
import {
  NumExpr, UnitExpr, VarExpr, LetExpr, CaseExpr, CondExpr, ApplyExpr, ExprInt, Binding, CaseBranch,
  LambdaExpr, TypeNode, AnnExpr, PatternInt, Def, DataDef, Mod, NodeType, NodeInt, Node, Expr, Pattern,
  DRange,
  Decl,
  FixityDecl
} from './nodes'
import { Fixity, ApplyExprCurried, LambdaExprCurried, builtinFixityTable } from './parse'
import { id } from './utils'
import { flatMap, fromEntries, pipe } from 'remeda'

export type DesugarMap = {
  num: NumExpr<{}>
  unit: UnitExpr<{}>
  var: VarExpr<{}>
  let: LetExpr<{}, 'int'>
  case: CaseExpr<{}, 'int'>
  cond: CondExpr<{}, 'int'>
  roll: ApplyExpr<{}, 'int'>
  apply: ApplyExpr<{}, 'int'>
  applyMulti: ExprInt
  binding: Binding<{}, 'int'>
  caseBranch: CaseBranch<{}, 'int'>
  lambda: LambdaExpr<{}, 'int'>
  lambdaMulti: LambdaExpr<{}, 'int'>
  typeNode: TypeNode<{}>
  ann: AnnExpr<{}, 'int'>
  binOp: ExprInt
  lambdaCase: LambdaExpr<{}, 'int'>
  tuple: ExprInt
  list: ExprInt
  pattern: PatternInt
  def: Def<{}, 'int'>
  decl: Decl<{}>
  fixityDecl: FixityDecl<{}>
  dataDef: DataDef<{}>
  mod: Mod<{}, 'int'>
}
export const assertDesugarMapComplete: Record<NodeType, NodeInt> = {} as DesugarMap

export type DesugarInput = {
  fixityTable: Record<string, Fixity>
}

export type DesugarEnv = DesugarInput & {
  desugar: <K extends NodeType>(node: Extract<Node, { type: K }>) => DesugarMap[K]
  panic: (err: Desugar.Err) => never
}

export type DesugarImpls = {
  [K in NodeType]: (env: DesugarEnv, node: Node & { type: K }) => DesugarMap[K]
}

export const DesugarImpls: DesugarImpls = {
  num: (_env, expr): NumExpr<{}> => expr,
  unit: (_env, expr): UnitExpr<{}> => expr,
  var: (_env, expr): VarExpr<{}> => expr,
  let: (env, expr): LetExpr<{}, 'int'> => ({
    ...expr,
    bindings: expr.bindings.map(env.desugar),
    body: env.desugar(expr.body),
  }),
  case: (env, expr): CaseExpr<{}, 'int'> => ({
    ...expr,
    subject: env.desugar(expr.subject),
    branches: expr.branches.map(env.desugar),
  }),
  cond: (env, expr): CondExpr<{}, 'int'> => ({
    ...expr,
    cond: env.desugar(expr.cond),
    yes: env.desugar(expr.yes),
    no: env.desugar(expr.no),
  }),
  roll: (env, expr): ApplyExpr<{}, 'int'> => env.desugar(ApplyExprCurried(
    { type: 'var', id: 'roll' },
    [expr.times ?? { type: 'num', val: 1 }, expr.sides]
  )),
  apply: (env, expr): ApplyExpr<{}, 'int'> => ({
    ...expr,
    func: env.desugar(expr.func),
    arg: env.desugar(expr.arg),
  }),
  applyMulti: (env, expr): ExprInt => env.desugar(
    ApplyExprCurried(expr.func, expr.args)
  ),
  binding: (env, expr): Binding<{}, 'int'> => ({
    ...expr,
    lhs: env.desugar(expr.lhs),
    rhs: env.desugar(expr.rhs),
  }),
  caseBranch: (env, expr): CaseBranch<{}, 'int'> => ({
    ...expr,
    pattern: env.desugar(expr.pattern),
    body: env.desugar(expr.body),
  }),
  lambda: (env, expr): LambdaExpr<{}, 'int'> => ({
    ...expr,
    param: env.desugar(expr.param),
    body: env.desugar(expr.body),
  }),
  lambdaMulti: (env, expr): LambdaExpr<{}, 'int'> => env.desugar(LambdaExprCurried(
    expr.params, expr.body
  )),
  typeNode: (_env, expr): TypeNode<{}> => expr,
  ann: (env, expr): AnnExpr<{}, 'int'> => ({
    ...expr,
    expr: env.desugar(expr.expr),
  }),
  binOp: (env, expr): ExprInt => {
    const getFixity = (op: string): Fixity => env.fixityTable[op] ?? Fixity.def()

    const ops = expr.ops.map(op => op.id)
    const args = expr.args.slice()

    const exprStack: Expr[] = []
    const opStack: string[] = []
    exprStack.push(args.shift()!)

    const reduce = () => {
      const top = opStack.pop()!
      const right = exprStack.pop()!
      const left = exprStack.pop()!
      exprStack.push(ApplyExprCurried(
        { type: 'var', id: top },
        [left, right]
      ))
    }

    while (ops.length) {
      const op = ops.shift()!

      while (opStack.length) {
        const top = opStack.at(-1)!
        const topFixity = getFixity(top)
        const opFixity = getFixity(op)

        let shouldReduce = false
        if (topFixity.prec > opFixity.prec) shouldReduce = true
        else {
          if (topFixity.prec === opFixity.prec) {
            if (topFixity.assoc !== opFixity.assoc || topFixity.assoc === 'none') env.panic({
              type: 'fixity',
              lOp: top, rOp: op,
              lFixity: topFixity, rFixity: opFixity,
            })
            if (topFixity.assoc === 'left') shouldReduce = true
          }
        }

        if (shouldReduce) reduce()
        else break
      }

      opStack.push(op)

      const arg = args.shift()!
      exprStack.push(arg)
    }

    while (opStack.length) reduce()

    return env.desugar(exprStack[0])
  },
  lambdaCase: (env, expr): LambdaExpr<{}, 'int'> => ({
    type: 'lambda',
    param: {
      type: 'pattern',
      sub: 'var',
      var: { type: 'var', id: '!subject' },
    },
    body: {
      type: 'case',
      subject: { type: 'var', id: '!subject' },
      branches: expr.branches.map(env.desugar),
    }
  }),
  list: (env, { elems }): ExprInt => env.desugar(elems.reduceRight<Expr>(
    (tail, head) => ApplyExprCurried({ type: 'var', id: '#' }, [head, tail]),
    { type: 'var', id: '[]' }
  )),
  tuple: (env, { elems }): ExprInt => env.desugar(ApplyExprCurried(
    { type: 'var', id: `${','.repeat(elems.length - 1)}` },
    elems,
  )),
  pattern: (env, pattern): PatternInt => match<Pattern, PatternInt>(pattern)
    .with({ sub: 'con' }, pattern => ({
      ...pattern,
      con: env.desugar(pattern.con),
      args: pattern.args.map(env.desugar),
    }))
    .with({ sub: 'tuple' }, pattern => ({
      type: 'pattern',
      sub: 'con',
      con: { type: 'var', id: `${','.repeat(pattern.elems.length - 1)}` },
      args: pattern.elems.map(env.desugar)
    }))
    .with({ sub: 'list' }, pattern => env.desugar(pattern.elems.reduceRight<Pattern>(
      (last, init) => ({
        type: 'pattern',
        sub: 'con',
        con: { type: 'var', id: '#' },
        args: [init, last],
      }),
      ({
        type: 'pattern',
        sub: 'con',
        con: { type: 'var', id: '[]' },
        args: [],
      })
    )))
    .otherwise(id),
  def: (env, def): Def<{}, 'int'> => ({
    ...def,
    binding: env.desugar(def.binding)
  }),
  decl: (_env, decl): Decl<{}> => decl,
  fixityDecl: (_env, decl): FixityDecl<{}> => decl,
  dataDef: (_env, def): DataDef<{}> => def,
  mod: (env, mod): Mod<{}, 'int'> => ({
    ...mod,
    defs: mod.defs.map(env.desugar),
  }),
}

export namespace Desugar {
  export type Ok<K extends NodeType> = DesugarMap[K]

  export type Err =
    | { type: 'fixity', lOp: string, rOp: string, lFixity: Fixity, rFixity: Fixity }

  export type Res<K extends NodeType> = Result<Ok<K>, Err>
}

export const collectFixities = (mod: Mod): Record<string, Fixity> => pipe(
  mod.fixityDecls,
  flatMap(decl => decl.vars.map(({ id }) => [id, decl] as const)),
  fromEntries(),
)

export const desugar = <K extends NodeType>(input: DesugarInput, node: Extract<Node, { type: K }>): Desugar.Res<K> => {
  const env: DesugarEnv = {
    ...input,
    desugar: <K extends NodeType>(node: Extract<Node, { type: K }>): DesugarMap[K] =>
      DesugarImpls[node.type](env, node),
    panic: (err: Desugar.Err) => { throw err }
  }
  return Result.wrap<Desugar.Ok<K>, Desugar.Err>(() => env.desugar(node))
}

export const desugarMod = (mod: Mod): Desugar.Res<'mod'> => {
  return desugar(
    { fixityTable: { ...builtinFixityTable, ...collectFixities(mod) } },
    mod
  )
}
