import { Ok, Result } from 'fk-result'
import {
  AnnExpr, ApplyMultiExpr, CondExpr, InfixExpr, ListExpr, ModRes, Mod, NodeRaw,
  NodeRawType, NumExpr, ParenExpr, PatternRaw, PatternRes, RollExpr, SectionLExpr,
  TupleExpr, TypeNode, UnitExpr, VarExpr, LetResExpr, BindingRes, CaseBranchRes,
  CaseResExpr, LambdaMultiResExpr, LambdaCaseResExpr, DefRes,
  SectionRExpr,
} from './nodes'
import { Dict, fromEntriesStrict, Set } from './utils'
import { flatMap, groupBy, groupByProp, map, mapValues, pick, pipe, prop, unique, values } from 'remeda'
import { match } from 'ts-pattern'
import { InferKind } from './infer'
import { checkKindMod } from './check'
import { CompiledMod } from './mods'
import { KindEnv } from './types'
import { group } from 'console'

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
  case: CaseResExpr
  ann: AnnExpr<{}, 'res'>
  cond: CondExpr<{}, 'res'>
  let: LetResExpr
  binding: BindingRes
  caseBranch: CaseBranchRes
  def: DefRes
  roll: RollExpr<{}, 'res'>
  infix: InfixExpr<{}, 'res'>
  sectionL: SectionLExpr<{}, 'res'>
  sectionR: SectionRExpr<{}, 'res'>
  applyMulti: ApplyMultiExpr<{}, 'res'>
  lambdaMulti: LambdaMultiResExpr
  lambdaCase: LambdaCaseResExpr
  list: ListExpr<{}, 'res'>
  tuple: TupleExpr<{}, 'res'>
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
  let: (env, expr) => pipe(
    expr.bindings,
    map(env.resolve),
    bindings => pipe(
      bindings,
      map(binding => binding.idSet),
      Set.disjointUnion,
      env.unwrapConflictDef,
      (idSet): LetResExpr => ({
        type: 'letRes',
        bindings,
        idSet,
        body: env.resolve(expr.body),
      })
    )
  ),
  binding: (env, binding) => ({
    type: 'bindingRes',
    lhs: env.resolve(binding.lhs),
    rhs: env.resolve(binding.rhs),
    idSet: pipe(binding.lhs, collectPatternVarsStrict, env.unwrapConflictDef)
  }),
  caseBranch: (env, branch) => ({
    type: 'caseBranchRes',
    pattern: branch.pattern,
    body: env.resolve(branch.body),
    idSet: pipe(branch.pattern, collectPatternVarsStrict, env.unwrapConflictDef)
  }),
  def: (env, def) => ({
    type: 'defRes',
    binding: env.resolve(def.binding),
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

    const declDict = pipe(
      mod.decls,
      flatMap(decl => decl.vars.map(({ id }) => [id, decl] as const)),
      fromEntriesStrict,
      env.unwrapDuplicate('decl')
    )
    const fixityDict = pipe(
      mod.fixityDecls,
      flatMap(decl => decl.vars.map(({ id }) => [id, pick(decl, ['assoc', 'prec'])] as const)),
      fromEntriesStrict,
      env.unwrapDuplicate('fixityDecl')
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

    const defs = mod.defs.map(env.resolve)
    const defIdSet = pipe(
      mod.defs,
      map(def => def.binding.lhs),
      collectPatternListVarsStrict,
      env.unwrapConflictDef,
    )

    for (const id in declDict) {
      if (! defIdSet.has(id)) env.panic({ type: 'MissingDef', id })
    }

    const modRes: ModRes = {
      ...mod,
      type: 'modRes',
      defs,
      defIdSet,
      dataConIdSet,
      importDict,
      importModIdSet,
      declDict,
      fixityDict,
      dataDict,
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
