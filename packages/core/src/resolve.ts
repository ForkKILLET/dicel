import { Ok, Result } from 'fk-result'
import {
  AnnExpr, ApplyMultiExpr, CondExpr, InfixExpr, ListExpr, ModRes, Mod, NodeRaw, NodeRawType, NumExpr,
  ParenExpr, PatternRaw, PatternRes, RollExpr, SectionLExpr, TupleExprAuto, TypeNode, UnitExpr,
  VarExpr, LetResExpr, BindingRes, CaseBranchRes, CaseResExpr, LambdaMultiResExpr, LambdaCaseResExpr,
  BindingDefRes, SectionRExpr, EquationRes, EquationDefRes, EquationDefGroupRes, BindingHostRes,
  FixityDecl, Decl,
} from './nodes'
import { Dict, fromEntriesStrict, Set } from './utils'
import { flatMap, groupByProp, keys, map, mapValues, pipe, prop, unique } from 'remeda'
import { match } from 'ts-pattern'
import { InferKind } from './infer'
import { checkKindMod } from './check'
import { CompiledMod } from './mods'
import { KindEnv } from './types'

export type ResolveMap = {
  unit: UnitExpr
  num: NumExpr
  var: VarExpr
  pattern: PatternRes
  typeNode: TypeNode
  decl: never
  fixityDecl: never
  dataDecl: never
  import: never
  mod: ModRes
  bindingHost: BindingHostRes
  case: CaseResExpr
  ann: AnnExpr<{}, 'res'>
  cond: CondExpr<{}, 'res'>
  let: LetResExpr
  binding: BindingRes
  equation: EquationRes
  caseBranch: CaseBranchRes
  bindingDef: BindingDefRes
  equationDef: EquationDefRes
  roll: RollExpr<{}, 'res'>
  infix: InfixExpr<{}, 'res'>
  sectionL: SectionLExpr<{}, 'res'>
  sectionR: SectionRExpr<{}, 'res'>
  applyMulti: ApplyMultiExpr<{}, 'res'>
  lambdaMulti: LambdaMultiResExpr
  lambdaCase: LambdaCaseResExpr
  list: ListExpr<{}, 'res'>
  tuple: TupleExprAuto<{}, 'res'>
  paren: ParenExpr<{}, 'res'>
}
export const assertResolveMapCorrect: [NodeRawType, keyof ResolveMap] =
  {} as [keyof ResolveMap, NodeRawType]

export type ResolveInput = {
  compiledMods: Dict<CompiledMod>
}

export type ResolveEnv = ResolveInput & {
  resolve: <K extends NodeRawType>(node: Extract<NodeRaw, { type: K }>) => ResolveMap[K]
  panic: (err: Resolve.Err) => never
  unwrapConflictDef: <T>(result: Result<T, string>) => T
  unwrapDuplicate: <T>(sub: Extract<Resolve.Err, { type: 'Duplicate' }>['sub']) => (result: Result<T, string>) => T
}

export type ResolveImpls = {
  [K in NodeRawType]: (env: ResolveEnv, node: Extract<NodeRaw, { type: K }>) => ResolveMap[K]
}

export const resolveImpls: ResolveImpls = {
  unit: (_env, expr) => expr,
  num: (_env, expr) => expr,
  var: (_env, expr) => expr,
  pattern: (_env, pattern) => pattern,
  typeNode: (_env, node) => node,
  dataDecl: (env) => env.panic({ type: 'Unreachable', nodeType: 'dataDecl' }),
  decl: (env) => env.panic({ type: 'Unreachable', nodeType: 'decl' }),
  fixityDecl: (env) => env.panic({ type: 'Unreachable', nodeType: 'fixityDecl' }),
  import: (env) => env.panic({ type: 'Unreachable', nodeType: 'import' }),
  case: (env, expr) => ({
    type: 'caseRes',
    subject: env.resolve(expr.subject),
    branches: expr.branches.map(env.resolve),
  }),
  ann: (env, expr) => ({
    ...expr,
    expr: env.resolve(expr.expr),
  }),
  cond: (env, expr) => ({
    ...expr,
    cond: env.resolve(expr.cond),
    yes: env.resolve(expr.yes),
    no: env.resolve(expr.no),
  }),
  bindingHost: (env, host) => {
    const declDict: Dict<Decl> = pipe(
      host.decls,
      flatMap(decl => decl.vars.map(({ id }) => [id, decl] as const)),
      fromEntriesStrict,
      env.unwrapDuplicate('decl')
    )
    const fixityDict: Dict<FixityDecl> = pipe(
      host.fixityDecls,
      flatMap(decl => decl.vars.map(({ id }) => [id, decl] as const)),
      fromEntriesStrict,
      env.unwrapDuplicate('fixityDecl')
    )

    const bindingDefs = host.bindingDefs.map(env.resolve)
    const bindingDefIdSet = pipe(
      host.bindingDefs,
      map(def => def.binding.lhs),
      collectPatternListVarsStrict,
      env.unwrapConflictDef,
    )

    const equationDefGroupDict = Dict.empty<EquationDefGroupRes>()
    for (const def of host.equationDefs) {
      const { var: { id }, params: { length: arity } } = def.equation

      if (bindingDefIdSet.has(id)) env.panic({ type: 'ConflictDef', id })

      const group = equationDefGroupDict[id]
      const getResolved = () => env.resolve(def)
      if (group) {
        if (group.arity !== arity) env.panic({ type: 'DiffEquationArity', id })
        group.equationDefs.push(getResolved())
      }
      else {
        equationDefGroupDict[id] = {
          type: 'equationDefGroupRes',
          id,
          arity,
          equationDefs: [getResolved()],
        }
      }
    }

    const equationDefIdSet = Set.of(keys(equationDefGroupDict))
    const idSet = Set.union([bindingDefIdSet, equationDefIdSet])

    for (const id in declDict) {
      if (! idSet.has(id)) env.panic({ type: 'MissingDef', id })
    }

    return {
      type: 'bindingHostRes',
      declDict,
      fixityDict,
      bindingDefs,
      bindingDefIdSet,
      equationDefGroupDict,
      equationDefIdSet,
      idSet,
      bindingGroups: [],
    }
  },
  let: (env, expr) => ({
    type: 'letRes',
    bindingHost: env.resolve(expr.bindingHost),
    body: env.resolve(expr.body),
  }),
  binding: (env, binding) => ({
    type: 'bindingRes',
    lhs: env.resolve(binding.lhs),
    rhs: env.resolve(binding.rhs),
    idSet: pipe(binding.lhs, collectPatternVarsStrict, env.unwrapConflictDef)
  }),
  equation: (env, equation) => ({
    type: 'equationRes',
    var: equation.var,
    params: equation.params,
    rhs: env.resolve(equation.rhs),
    idSet: pipe(
      equation.params,
      collectPatternListVarsStrict,
      env.unwrapConflictDef,
    ),
  }),
  caseBranch: (env, branch) => ({
    type: 'caseBranchRes',
    pattern: branch.pattern,
    body: env.resolve(branch.body),
    idSet: pipe(branch.pattern, collectPatternVarsStrict, env.unwrapConflictDef)
  }),
  bindingDef: (env, def) => ({
    type: 'bindingDefRes',
    binding: env.resolve(def.binding),
  }),
  equationDef: (env, def) => ({
    type: 'equationDefRes',
    equation: env.resolve(def.equation),
  }),
  roll: (env, expr) => ({
    ...expr,
    times: expr.times ? env.resolve(expr.times) : null,
    sides: env.resolve(expr.sides),
  }),
  infix: (env, expr) => ({
    ...expr,
    args: expr.args.map(env.resolve),
  }),
  sectionL: (env, expr) => ({
    ...expr,
    arg: env.resolve(expr.arg),
  }),
  sectionR: (env, expr) => ({
    ...expr,
    arg: env.resolve(expr.arg),
  }),
  applyMulti: (env, expr) => ({
    ...expr,
    func: env.resolve(expr.func),
    args: expr.args.map(env.resolve),
  }),
  lambdaMulti: (env, expr) => ({
    type: 'lambdaMultiRes',
    params: expr.params,
    body: env.resolve(expr.body),
    idSets: pipe(
      expr.params,
      map(param => pipe(
        param,
        collectPatternVarsStrict,
        env.unwrapConflictDef,
      )),
      idSets => pipe(
        idSets,
        Set.disjointUnion,
        env.unwrapConflictDef,
        () => idSets,
      )
    ),
  }),
  lambdaCase: (env, expr) => ({
    type: 'lambdaCaseRes',
    branches: expr.branches.map(env.resolve),
  }),
  list: (env, expr) => ({
    ...expr,
    elems: expr.elems.map(env.resolve),
  }),
  tuple: (env, expr) => ({
    ...expr,
    elems: expr.elems.map(env.resolve),
  }),
  paren: (env, expr) => ({
    ...expr,
    expr: env.resolve(expr.expr),
  }),
  mod: (env, { ...mod }) => {
    const importModIdSet = pipe(
      mod.imports,
      map(prop('modId')),
      unique(),
      Set.of,
    )

    if (! importModIdSet.has('Prelude') && 'Prelude' in env.compiledMods) {
      mod.imports = [{ type: 'import', modId: 'Prelude', ids: null }, ...mod.imports]
      importModIdSet.add('Prelude')
    }

    for (const { modId } of mod.imports) {
      if (! (modId in env.compiledMods)) env.panic({ type: 'UnknownMod', modId })
    }

    const importDict = pipe(
      mod.imports,
      groupByProp('modId'),
      mapValues(imports => ({
        idSet: imports.some(({ ids }) => ids === null)
          ? null
          : Set.of(flatMap(imports, ({ ids }) => ids!))
      })),
    )

    const dataConIdSet = pipe(
      mod.dataDecls,
      flatMap(decl => decl.data.cons.map(({ id }) => id)),
      Set.strictOf,
      env.unwrapConflictDef,
    )

    const dataDict = pipe(
      mod.dataDecls,
      map(def => [def.id, def.data] as const),
      fromEntriesStrict,
      env.unwrapDuplicate('dataDecl'),
    )

    const bindingHost = env.resolve(mod.bindingHost)
    const idSet = Set.union([dataConIdSet, bindingHost.idSet])

    const modRes: ModRes = {
      ...mod,
      type: 'modRes',
      importDict,
      importModIdSet,
      dataConIdSet,
      dataDict,
      idSet,
      bindingHost,
    }

    return modRes
  }
}

export const collectPatternListVarsStrict = (patterns: PatternRaw[]): Result<Set<string>, string> => Result
  .all(patterns.map(collectPatternVarsStrict))
  .bind(Set.disjointUnion)

export const collectPatternVarsStrict = (pattern: PatternRaw): Result<Set<string>, string> =>
  match<PatternRaw, Result<Set<string>, string>>(pattern)
    .with({ sub: 'wildcard' }, { sub: 'num' }, { sub: 'unit' }, () => Ok(Set.empty()))
    .with({ sub: 'tuple' }, { sub: 'list' }, ({ elems }) => collectPatternListVarsStrict(elems))
    .with({ sub: 'var' }, ({ var: { id } }) => Ok(Set.of([id])))
    .with({ sub: 'con' }, ({ args }) => collectPatternListVarsStrict(args))
    .exhaustive()

export namespace Resolve {
  export type Ok<K extends NodeRawType> = ResolveMap[K]

  export type Err =
    | { type: 'Duplicate', sub: 'decl' | 'fixityDecl' | 'dataDecl' | 'import', id: string }
    | { type: 'ConflictDef', id: string }
    | { type: 'DiffEquationArity', id: string }
    | { type: 'MissingDef', id: string }
    | { type: 'UnknownMod', modId: string }
    | { type: 'UnknownImport', modId: string, id: string }
    | InferKind.Err
    | { type: 'Unreachable', nodeType: NodeRawType }

  export type Res<K extends NodeRawType = NodeRawType> = Result<Ok<K>, Err>
}

export const resolve = <K extends NodeRawType>(input: ResolveInput, node: Extract<NodeRaw, { type: K }>): Resolve.Res<K> => {
  const env: ResolveEnv = {
    ...input,
    resolve: <K extends NodeRawType>(node: Extract<NodeRaw, { type: K }>): ResolveMap[K] =>
      resolveImpls[node.type](env, node),
    panic: (err: Resolve.Err) => { throw err },
    unwrapConflictDef: <T>(result: Result<T, string>) => result
      .mapErr((id): Resolve.Err => ({ type: 'ConflictDef', id }))
      .unwrapBy(env.panic),
    unwrapDuplicate: <T>(sub: Extract<Resolve.Err, { type: 'Duplicate' }>['sub']) => (result: Result<T, string>) => result
      .mapErr((id): Resolve.Err => ({ type: 'Duplicate', sub, id }))
      .unwrapBy(env.panic),
  }
  return Result.wrap<ResolveMap[K], Resolve.Err>(() => env.resolve(node))
}

export namespace ResolveMod {
  export type Ok = {
    modRes: ResolveMap['mod']
    kindEnv: KindEnv
  }
  export type Err = Resolve.Err
  export type Res = Result<Ok, Err>

  export type Options = {
    compiledMods?: Dict<CompiledMod>
  }
}

export const resolveMod = (mod: Mod, { compiledMods = {} }: ResolveMod.Options = {}): ResolveMod.Res => {
  return resolve({ compiledMods }, mod)
    .bind(modRes =>
      checkKindMod(modRes, { compiledMods })
        .map(({ kindEnv }) => ({
          modRes,
          kindEnv,
        }))
    )
}
