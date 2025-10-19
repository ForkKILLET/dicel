import { Result } from 'fk-result'
import { match } from 'ts-pattern'
import {
  NumExpr, UnitExpr, VarExpr, CondExpr, ApplyExpr, ExprDes, LambdaResExpr, TypeNode,
  AnnExpr, PatternDes, Node, SectionLExpr, SectionRExpr, NodeResType, ModRes,
  NodeRes, BindingRes, BindingDefRes, CaseBranchRes, CaseResExpr, PatternRes,
  ModDes, EquationRes, EquationDefRes, ApplyExprMulti, TupleExprAuto, TuplePatternAuto,
  LambdaExprMulti, BindingHostDes, LetDesExpr, CharExpr, StrExpr,
  ClassDefDes,
  InstanceDefDes,
} from './node'
import { extractMaybeInfixOp } from './parse'
import { Dict, Set, id } from './utils'
import { Fixity, builtinFixityDict } from './lex'
import { CompiledMod } from './mod'
import { map, mapValues, mergeAll, pipe, range, values } from 'remeda'

export type DesugarMap = {
  unit: UnitExpr
  num: NumExpr
  var: VarExpr
  char: CharExpr
  str: StrExpr
  letRes: LetDesExpr
  caseRes: CaseResExpr<{}, 'des'>
  cond: CondExpr<{}, 'des'>
  roll: ApplyExpr<{}, 'des'>
  applyMulti: ExprDes
  bindingRes: BindingRes<{}, 'des'>
  equationRes: EquationRes<{}, 'des'>
  caseBranchRes: CaseBranchRes<{}, 'des'>
  lambdaMultiRes: LambdaResExpr<{}, 'des'>
  typeNode: TypeNode
  ann: AnnExpr<{}, 'des'>
  infix: ExprDes
  sectionL: ExprDes
  sectionR: ExprDes
  lambdaCaseRes: LambdaResExpr<{}, 'des'>
  tuple: ExprDes
  list: ExprDes
  paren: ExprDes
  pattern: PatternDes
  bindingHostRes: BindingHostDes
  bindingDefRes: BindingDefRes<{}, 'des'>
  equationDefRes: EquationDefRes<{}, 'des'>
  equationDefGroupRes: BindingDefRes<{}, 'des'>
  classDefRes: ClassDefDes
  instanceDefRes: InstanceDefDes
  modRes: ModDes
}
export const assertDesugarMapCorrect: [NodeResType, keyof DesugarMap] =
  {} as [keyof DesugarMap, NodeResType]

export type DesugarState = {
  fixityDict: Record<string, Fixity>
}

export type DesugarEnv = {
  state: DesugarState
  desugar: <K extends NodeResType>(node: Extract<NodeRes, { type: K }>) => DesugarMap[K]
  panic: (err: Desugar.Err) => never
  getFixity: (op: string) => Fixity
  fork: () => DesugarEnv
}

export const DesugarEnv = (state: DesugarState): DesugarEnv => {
  const env: DesugarEnv = {
    state,
    desugar: <K extends NodeResType>(node: Extract<NodeRes, { type: K }>): DesugarMap[K] =>
      desugarImpls[node.type](env, node),
    panic: (err: Desugar.Err) => { throw err },
    getFixity: (op: string) => env.state.fixityDict[op] ?? Fixity.def(),
    fork: () => DesugarEnv({ ...env.state })
  }
  return env
}

export type DesugarImpls = {
  [K in NodeResType]: (env: DesugarEnv, node: Extract<NodeRes, { type: K }>) => DesugarMap[K]
}

export const desugarImpls: DesugarImpls = {
  num: (_env, expr) => expr,
  unit: (_env, expr) => expr,
  var: (_env, expr) => expr,
  char: (_env, expr) => expr,
  str: (_env, expr) => expr,
  letRes: (env, expr) => {
    const envLet = env.fork()
    const bindingHost = envLet.desugar(expr.bindingHost)
    return {
      type: 'letDes',
      bindingHost,
      body: envLet.desugar(expr.body),
    }
  },
  caseRes: (env, expr) => ({
    ...expr,
    subject: env.desugar(expr.subject),
    branches: expr.branches.map(env.desugar),
  }),
  cond: (env, expr) => ({
    ...expr,
    cond: env.desugar(expr.cond),
    yes: env.desugar(expr.yes),
    no: env.desugar(expr.no),
  }),
  roll: (env, expr) => ApplyExprMulti(
    { type: 'var', id: 'roll' },
    [expr.times ?? { type: 'num', val: 1 }, expr.sides].map(env.desugar),
  ),
  applyMulti: (env, expr) => ApplyExprMulti(
    env.desugar(expr.func),
    expr.args.map(env.desugar)
  ),
  bindingRes: (env, expr) => ({
    ...expr,
    lhs: env.desugar(expr.lhs),
    rhs: env.desugar(expr.rhs),
  }),
  equationRes: (env, expr) => ({
    ...expr,
    var: expr.var,
    params: expr.params.map(env.desugar),
    rhs: env.desugar(expr.rhs),
  }),
  caseBranchRes: (env, expr) => ({
    ...expr,
    pattern: env.desugar(expr.pattern),
    body: env.desugar(expr.body),
  }),
  lambdaMultiRes: (env, expr) => LambdaExprMulti(
    expr.params.map(env.desugar),
    expr.idSets,
    env.desugar(expr.body),
  ),
  typeNode: (_env, expr) => expr,
  ann: (env, expr) => ({
    ...expr,
    expr: env.desugar(expr.expr),
  }),
  infix: (env, expr) => {
    const getFixity = (op: string): Fixity => env.getFixity(op)

    const ops = expr.ops.map(op => op.id)
    const args = expr.args.slice()

    const exprStack: ExprDes[] = []
    const opStack: string[] = []
    exprStack.push(env.desugar(args.shift()!))

    const reduce = () => {
      const top = opStack.pop()!
      const right = exprStack.pop()!
      const left = exprStack.pop()!
      exprStack.push(ApplyExprMulti(
        { type: 'var', id: top, isInfix: true },
        [left, right],
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

      const arg = env.desugar(args.shift()!)
      exprStack.push(arg)
    }

    while (opStack.length) reduce()

    return exprStack[0]
  },
  sectionL: (env, expr) => {
    const arg = env.desugar(expr.arg)
    if (expr.arg.type === 'infix') {
      const argOp = extractMaybeInfixOp(arg)
      if (argOp) {
        const sectionFixity = env.getFixity(expr.op.id)
        const argFixity = env.getFixity(argOp)
        if (
          sectionFixity.prec > argFixity.prec ||
          sectionFixity.prec === argFixity.prec && sectionFixity.assoc !== 'left'
        ) env.panic({ type: 'section', expr })
      }
    }
    return {
      type: 'apply',
      func: { type: 'var', id: expr.op.id },
      arg,
    }
  },
  sectionR: (env, expr) => {
    const arg = env.desugar(expr.arg)
    if (expr.arg.type === 'infix') {
      const argOp = extractMaybeInfixOp(arg)
      if (argOp) {
        const sectionFixity = env.getFixity(expr.op.id)
        const argFixity = env.getFixity(argOp)
        if (
          sectionFixity.prec > argFixity.prec ||
          sectionFixity.prec === argFixity.prec && sectionFixity.assoc !== 'right'
        ) env.panic({ type: 'section', expr })
      }
    }

    return {
      type: 'lambdaRes',
      param: {
        type: 'pattern',
        sub: 'var',
        var: { type: 'var', id: '!lhs' },
      },
      body: ApplyExprMulti(
        expr.op,
        [{ type: 'var', id: '!lhs' }, arg]
      ),
      idSet: Set.of(['!lhs']),
    }
  },
  lambdaCaseRes: (env, expr) => ({
    type: 'lambdaRes',
    param: {
      type: 'pattern',
      sub: 'var',
      var: { type: 'var', id: '!subject' },
    },
    body: {
      type: 'caseRes',
      subject: { type: 'var', id: '!subject' },
      branches: expr.branches.map(env.desugar),
    },
    idSet: Set.of(['!subject']),
  }),
  list: (env, { elems }) => elems.reduceRight<ExprDes>(
    (tail, head) => ApplyExprMulti({ type: 'var', id: '#' }, [env.desugar(head), tail]),
    { type: 'var', id: '[]' }
  ),
  tuple: (env, { elems }) => ApplyExprMulti(
    { type: 'var', id: `${','.repeat(elems.length - 1)}` },
    elems.map(env.desugar),
  ),
  paren: (env, { expr }) => env.desugar(expr),
  pattern: (env, pattern) => match<PatternRes, PatternDes>(pattern)
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
    .with({ sub: 'list' }, pattern => env.desugar(pattern.elems.reduceRight<PatternRes>(
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
  bindingDefRes: (env, def) => ({
    ...def,
    binding: env.desugar(def.binding)
  }),
  equationDefRes: (env, def) => ({
    ...def,
    equation: env.desugar(def.equation)
  }),
  equationDefGroupRes: (env, group) => {
    const defs = group.equationDefs.map(env.desugar)
    const argIds = range(0, group.arity).map(i => `!arg${i}`)
    const argVars: VarExpr[] = argIds.map(id => ({ type: 'var', id }))
    const case_: CaseResExpr<{}, 'des'> = {
      type: 'caseRes',
      subject: TupleExprAuto(argVars),
      branches: defs.map(({ equation }): CaseBranchRes<{}, 'des'> => ({
        type: 'caseBranchRes',
        idSet: equation.idSet,
        pattern: TuplePatternAuto(equation.params),
        body: equation.rhs,
      })),
    }
    const lambda = LambdaExprMulti(
      argVars.map(var_ => ({ type: 'pattern', sub: 'var', var: var_ })),
      argIds.map(Set.solo),
      case_,
    )
    const binding: BindingRes<{}, 'des'> = {
      type: 'bindingRes',
      idSet: Set.solo(group.id),
      lhs: { type: 'pattern', sub: 'var', var: { type: 'var', id: group.id } },
      rhs: lambda,
    }
    return {
      type: 'bindingDefRes',
      id: group.id,
      binding,
    }
  },
  bindingHostRes: (env, host) => {
    env.state.fixityDict = { ...env.state.fixityDict, ...host.fixityDict }
    return {
      ...host,
      type: 'bindingHostDes',
      bindings: [
        ...values(host.equationDefGroupDict).map(env.desugar),
        ...host.bindingDefs.map(env.desugar),
      ].map(def => def.binding),
    }
  },
  classDefRes: (env, def) => ({
    ...def,
    type: 'classDefDes',
    bindingHost: env.desugar(def.bindingHost),
  }),
  instanceDefRes: (env, def) => ({
    ...def,
    type: 'instanceDefDes',
    bindingHost: env.desugar(def.bindingHost),
  }),
  modRes: (env, mod) => ({
    ...mod,
    type: 'modDes',
    classDefDict: mapValues(mod.classDefDict, env.desugar),
    instanceDefs: mod.instanceDefs.map(env.desugar),
    bindingHost: env.desugar(mod.bindingHost),
  })
}

export namespace Desugar {
  export type Ok<K extends NodeResType> = DesugarMap[K]

  export type Err =
    | { type: 'fixity', lOp: string, rOp: string, lFixity: Fixity, rFixity: Fixity }
    | { type: 'section', expr: SectionLExpr<{}, 'res'> | SectionRExpr<{}, 'res'> }
    | { type: 'conflict', id: string, node: Node }
    | { type: 'duplicate', id: string, node: Node }

  export type Res<K extends NodeResType> = Result<Ok<K>, Err>
}

export const desugar = <K extends NodeResType>(input: DesugarState, node: Extract<NodeRes, { type: K }>): Desugar.Res<K> => {
  const env = DesugarEnv(input)
  return Result.wrap<Desugar.Ok<K>, Desugar.Err>(() => env.desugar(node))
}

export const desugarMod = (mod: ModRes, { compiledMods }: { compiledMods: Dict<CompiledMod> }): Desugar.Res<'modRes'> => {
  const compiledFixityDict = pipe(
    values(compiledMods),
    map(mod => mod.fixityDict),
    mergeAll,
  )
  return desugar(
    { fixityDict: { ...builtinFixityDict, ...compiledFixityDict, ...mod.bindingHost.fixityDict } },
    mod
  )
}
