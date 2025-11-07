import { Ok, Result } from 'fk-result'
import { match } from 'ts-pattern'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { AstId } from '@/node/astId'
import { SurfaceR } from '@/node/stage'
import { SigDeclNode, EquationNode, Pat, Node, VarExpr, VarRefNode, IdNode, RecordExpr, RecordPat, Mod, BindingNode } from '@/node/node'
import { NodeWalkCtx, NodeWalkerMap, defineNodeWalkCtx } from '@/node/walk'
import { ModStore, PassAction } from '@/pipeline'
import { Fixity, FixityMap } from '@/fixity'
import { DataInfo, DataCon, DataMap } from '@/data'
import { IdSourceMap, SymId, SymIdState, SymSource, SymInfoMap, SymIdHead, IdSymMap, SymTable, SymSlot, SymIdHeadOptional, IdSymNodeMap, SymNode, AstSymMap } from '@/sym'
import { DefaultMap, Dict, Iter, Map, Set } from '@/utils/data'
import { ScopeMap, Scope } from '@/scope'
import { ClassInfo, ClassMember, ClassMap, ClassInstanceMap, InstanceInfo, InstanceMap } from '@/class'
import { RecordInfo, RecordMap } from '@/record'
import { Type } from '@/type/type'

export type NameResolveCtxBase = {
  bindingMap: BindingMap
  bindingHostMap: BindingHostMap
  instanceMap: InstanceMap
  scopeMap: ScopeMap
  symInfoMap: SymInfoMap
  astSymMap: AstSymMap
}

export type NameResolveCtxState = {
  sis: SymIdState
  store: ModStore

  mode: NameResolveMode
  unscopable: boolean
  scope: Scope
  bindingInfo: BindingInfo | null
  classMap: ClassMap
  recordMap: RecordMap
}

export type NameResolveCtxData = NameResolveCtxBase & NameResolveCtxState

export type NameResolveCtxImpl = {
  throw: (err: NameResolveMod.Err) => never
  unwrap: <T>(result: Result<T, NameResolveMod.Err>) => T
  unwrapConflictId: <T>(ty: ConflictableTy) => (result: Result<T, ConflictErr>) => T

  withScope: (scope: Scope) => NameResolveCtx
  withSubScope: (node: Node<SurfaceR>) => NameResolveCtx
  withMode: (state: NameResolveMode) => NameResolveCtx

  register: (id: string, source: SymSource) => SymId
  registerMap: (idSourceMap: IdSourceMap) => IdSymMap
  registerIdSymNodeMapCollectRes: (ty: ConflictableTy) => (idSymNodeMap: IdSymNodeMapCollect.Res) => IdSymNodeMap

  resolve: (node: VarExpr | VarRefNode) => SymId
  resolveRecordLike: (node: RecordExpr<SurfaceR> | RecordPat<SurfaceR>) => void
}

export type NameResolveCtx = NodeWalkCtx<SurfaceR, NameResolveCtxData, NameResolveCtxImpl>

export type ConflictableTy =
  | 'sigDecl' | 'fixityDecl' | 'dataDef' | 'classDef'
  | 'binding/across' | 'binding/param' | 'binding/bindingPat' | 'binding/dataCon'
  | 'moduleQualified' | 'moduleOpen'

export type ConflictErr = readonly [string, SymSource, SymSource]

export namespace ConflictErr {
  export const ofNode = ([id, node1, node2]: readonly [string, Node, Node]): ConflictErr => [
    id,
    SymSource.node(node1.astId),
    SymSource.node(node2.astId),
  ]
}

export namespace NameResolveMod {
  export type Ok = NameResolveCtxBase & {
    sis: SymIdState
    exportInfo: ExportInfo
    importMap: Map<string, SymTable>
    globalScope: Scope
    mod: Mod<SurfaceR>
  }

  export type Err =
    | { type: 'ConflictingId', ty: ConflictableTy, id: string, source1: SymSource, source2: SymSource }
    | { type: 'DiffEquationArity', id: string }
    | { type: 'UndefinedId', id: string, astId: AstId }
    | { type: 'UndefinedClass', classId: string, astId: AstId }
    | { type: 'RecordMissingField', recordId: string, fields: string[], astId: AstId }
    | { type: 'RecordExtraField', recordId: string, fields: string[], astId: AstId }
    | { type: 'RecordDuplicateField', recordId: string, field: string, astId: AstId }
    | { type: 'MissingDef', id: string, sigDeclAstId: AstId }
    | { type: 'InstanceMissingDef', id: string, sigDeclAstId: AstId, instanceAstId: AstId }
    | { type: 'InstanceExtraDef', id: string, source: SymSource, instanceAstId: AstId }
    | { type: 'MissingMain' }
    | { type: 'UnknownImport', id: string, modId: string }
    | SymTable.Err

  export type Options = {
    isMain?: boolean
    store: ModStore
  }

  export type Res = Result<Ok, Err>
}

export type ExportInfo = {
  symTable: SymTable
  fixityMap: FixityMap
  dataMap: DataMap
  recordMap: RecordMap
  classMap: ClassMap
  classInstanceMap: ClassInstanceMap
}

export type ImportMap = Map<string, SymTable>

export type EquationGroup<SH extends SymIdHeadOptional = {}> = SH & {
  id: string
  arity: number
  equations: EquationNode<SurfaceR>[]
  bindingInfo: BindingInfo
}

export type IdSigDeclMap = Map<string, SigDeclNode & { id: IdNode }>
export type SymSigDeclMap = Map<SymId, SigDeclNode>

export type BindingHostInfo = {
  scope: Scope
  idSigDeclMap: IdSigDeclMap
  symSigDeclMap: SymSigDeclMap
  fixityMap: Map<string, Fixity>
  equationGroupDict: Dict<EquationGroup<SymIdHead>>
}
export type BindingHostMap = Map<AstId, BindingHostInfo>

export type BindingInfo = {
  symIdSet: Set<SymId>
  refSymIdSet: Set<SymId>
}
export type BindingMap = Map<AstId, BindingInfo>

export type NameResolveMode = 'collect' | 'resolve' | 'lift' | 'resolve-only'

export namespace IdSymNodeMapCollect {
  export type Ok = IdSymNodeMap
  export type Err = readonly [string, SymNode, SymNode]
  export type Res = Result<Ok, Err>
}

export namespace IdSourceMapCollect {
  export type Ok = IdSourceMap
  export namespace Ok {
    export const ofIdNodeMap = IdSourceMap.ofIdNodeMap
  }

  export type Err = ConflictErr
  export namespace Err {
    export const ofIdNodeMap = ConflictErr.ofNode
  }

  export type Res = Result<Ok, Err>

  export const ofIdNodeMap = (result: IdSymNodeMapCollect.Res): IdSourceMapCollect.Res => result
    .map(Ok.ofIdNodeMap)
    .mapErr(Err.ofIdNodeMap)
}

export const collectPatListIdNodeMap = (pats: Pat<SurfaceR>[]): IdSymNodeMapCollect.Res => Result
  .all(pats.map(collectPatIdNodeMap))
  .bind(idMaps => Map.disjointUnion(idMaps))

export const collectPatIdNodeMap = (pat: Pat<SurfaceR>): IdSymNodeMapCollect.Res =>
  match<Pat<SurfaceR>, IdSymNodeMapCollect.Res>(pat)
    .with({ ty: 'wildcardPat' }, { ty: 'numPat' }, () => Ok(Map.empty()))
    .with({ ty: 'varPat' }, (varPat) => Ok(Map.solo(varPat.id.id, varPat)))
    .with({ ty: 'dataPat' }, { ty: 'infixPat' }, ({ args }) => collectPatListIdNodeMap(args))
    .with({ ty: 'recordPat' }, ({ fields }) => collectPatListIdNodeMap(fields.map(R.prop('pat'))))
    .exhaustive()

export const nameResolveWalkerMap: NodeWalkerMap<SurfaceR, NameResolveCtx> = {
  var: (node, ctx) => {
    node.symId = ctx.resolve(node)
  },

  varRef: (node, ctx) => {
    node.symId = ctx.resolve(node)
  },

  recordPat: (node, ctx) => {
    ctx.resolveRecordLike(node)
    node.fields.forEach(ctx.walk)
  },

  record: (node, ctx) => {
    ctx.resolveRecordLike(node)
    node.fields.forEach(ctx.walk)
  },

  lambda: (node, ctx) => {
    ctx = ctx.withSubScope(node)
    pipe(
      collectPatIdNodeMap(node.param),
      ctx.registerIdSymNodeMapCollectRes('binding/param'),
    )
    ctx.walkDefault(node)
  },

  lambdaMulti: (node, ctx) => {
    ctx = ctx.withSubScope(node)
    pipe(
      collectPatListIdNodeMap(node.params),
      ctx.registerIdSymNodeMapCollectRes('binding/param'),
    )
    ctx.walkDefault(node)
  },

  equation: (node, ctx) => {
    if (ctx.mode === 'collect') return

    ctx = ctx.withSubScope(node)
    pipe(
      collectPatListIdNodeMap(node.head.params),
      ctx.registerIdSymNodeMapCollectRes('binding/param'),
    )

    ctx.walkDefault(node)
  },

  binding: (node, ctx) => {
    if (ctx.mode === 'collect') {
      const idSymNodeMap = pipe(
        collectPatIdNodeMap(node.pat),
        ctx.registerIdSymNodeMapCollectRes('binding/param'),
      )
      const symIdSet = pipe(
        idSymNodeMap,
        Map.values,
        Iter.of,
        Iter.map(node => node.symId),
        Set.of,
      )
      ctx.bindingMap.set(node.astId, {
        symIdSet,
        refSymIdSet: Set.empty(),
      })
      return
    }

    const bindingInfo = ctx.bindingMap.get(node.astId)!
    ctx.fork({ bindingInfo }).walkDefault(node)
  },

  instanceDef: (node, ctx) => {
    if (ctx.mode === 'lift') return
    ctx = ctx.withMode('resolve')

    const classId = node.classId.id
    const classInfo = ctx.classMap.get(classId)
    if (! classInfo)
      throw ctx.throw({ type: 'UndefinedClass', classId, astId: node.classId.astId })

    ctx.fork({ unscopable: true }).walkDefault(node)

    const scope = ctx.scopeMap.get(node.bindingHost.astId)!
    for (const [id, { astId }] of classInfo.members) {
      const sym = scope.get(id)
      if (! sym)
        throw ctx.throw({ type: 'InstanceMissingDef', id, sigDeclAstId: astId, instanceAstId: node.astId })
    }
    for (const [id, { source }] of scope.entries()) {
      if (! classInfo.members.has(id)) {
        throw ctx.throw({ type: 'InstanceExtraDef', id, source, instanceAstId: node.astId })
      }
    }
  },

  bindingHost: (node, ctx) => {
    // Mode state transition paths:
    // 1. (lift) -> collect -> [re-enter] -> (resolve-only) -> resolve
    // 2. (resolve) -> [fork scope] -> collect -> resolve

    if (ctx.mode === 'resolve') ctx = ctx.withSubScope(node)

    const {
      equation: equations = Array.of<EquationNode<SurfaceR>>(),
      binding: bindings = Array.of<BindingNode<SurfaceR>>(),
    } = pipe(node.bindings, R.groupByProp('ty'))

    if (ctx.mode !== 'resolve-only') {
      // First collect all bindings in the host.
      ctx.withMode('collect').walkDefault(node)

      const equationGroupDictPre: Dict<EquationGroup> = pipe(
        equations,
        R.groupBy(equation => equation.head.func.id.id),
        R.mapValues((equations, id): EquationGroup => {
          const aritySet = Set.of(equations.map(eq => eq.head.params.length))
          if (aritySet.size > 1) ctx.throw({ type: 'DiffEquationArity', id })
          const [arity] = aritySet
          return {
            id,
            arity,
            equations,
            bindingInfo: { symIdSet: Set.empty(), refSymIdSet: Set.empty() },
          }
        })
      )

      const equationGroupDict: Dict<EquationGroup<SymIdHead>> = pipe(
        R.values(equationGroupDictPre),
        R.map(group => [
          group.id,
          SymSource.nodes(group.equations.map(equation => equation.head.func.astId))
        ] as const),
        Map.of,
        ctx.registerMap,
        Iter.of,
        Iter.map(([id, symId]) => [id, { ...equationGroupDictPre[id], symId }] as const),
        Dict.of,
      )

      // Analyze declarations.
      const fixityMap: Map<string, Fixity> = pipe(
        node.fixityDecls,
        R.flatMap(decl => decl.ids.map(({ id }) => [id, decl] as const)),
        Map.strictOf,
        Result.mapErr(ConflictErr.ofNode),
        ctx.unwrapConflictId('fixityDecl'),
        Map.map(R.prop('fixity')),
      )

      const idSigDeclMap: IdSigDeclMap = pipe(
        node.sigDecls,
        R.flatMap(decl => decl.ids.map(id => [id.id, { ...decl, id }] as const)),
        Map.strictOf,
        Result.mapErr(ConflictErr.ofNode),
        ctx.unwrapConflictId('sigDecl'),
      )

      const symSigDeclMap: SymSigDeclMap = Map.empty()
      if (node.role === 'normal') {
        // Ensure signatures have corresponding definitions.
        for (const [id, decl] of idSigDeclMap) {
          const sym = ctx.scope.get(id)
          if (! sym) throw ctx.throw({ type: 'MissingDef', id, sigDeclAstId: decl.astId })
          symSigDeclMap.set(sym.symId, decl)
        }
      }
      else if (node.role === 'class') {
        for (const [id, decl] of idSigDeclMap) {
          ctx.register(id, SymSource.node(decl.id.astId))
        }
      }

      ctx.bindingHostMap.set(node.astId, {
        scope: ctx.scope,
        idSigDeclMap,
        symSigDeclMap,
        fixityMap,
        equationGroupDict,
      })
    }

    if (ctx.mode === 'lift') return

    // Resolve the host.
    ctx = ctx.fork({ unscopable: false }).withMode('resolve')

    pipe(
      ctx.bindingHostMap.get(node.astId)!.equationGroupDict,
      R.forEachObj(({ bindingInfo, symId, equations }) => {
        bindingInfo.symIdSet.add(symId)
        equations.forEach(equation => {
          ctx.bindingMap.set(equation.astId, bindingInfo)
          ctx.fork({ bindingInfo }).walk(equation)
        })
      })
    )

    bindings.forEach(ctx.walk)
  },

  let: (node, ctx) => {
    ctx.walk(node.bindingHost)

    const hostScope = ctx.scopeMap.get(node.bindingHost.astId)!
    ctx.withScope(hostScope).walk(node.body)
  },

  recordUpdate: (node, ctx) => {
    ctx = ctx.withSubScope(node)

    pipe(
      collectPatListIdNodeMap(node.fields.map(R.prop('pat'))),
      ctx.registerIdSymNodeMapCollectRes('binding/param')
    )
    node.fields.forEach(field => ctx.walk(field.body))
  },
}

export const nameResolveMod: PassAction<'nameResolve'> = (modId, store) => {
  const mod = store.use(modId, ['syntaxDesugar']).syntaxDesugar.mod as unknown as Mod<SurfaceR>

  const createCtx = defineNodeWalkCtx<SurfaceR, NameResolveCtxData, NameResolveCtxImpl>(
    ctx => ({
      throw: err => { throw err },

      unwrap: Result.unwrapBy(err => ctx.throw(err)),

      unwrapConflictId: ty => Result.unwrapBy(([id, source1, source2]) =>
        ctx.throw({ type: 'ConflictingId', ty, id, source1, source2 })
      ),

      withScope: scope => ctx.fork({ scope }),

      withSubScope: node => {
        const subCtx = ctx.withScope(ctx.scope.derive(node.astId))
        ctx.scopeMap.set(node.astId, subCtx.scope)
        return subCtx
      },

      withMode: state => ctx.fork({ mode: state }),

      register: (id, source) => pipe(
        ctx.scope.register(id, { source, unscopable: ctx.unscopable }, ctx.sis),
        Result.tap(symId => {
          symInfoMap.set(symId, { type: 'binding', id, source })
          if (source.type === 'nodes')
            source.astIds.forEach(astId => astSymMap.set(astId, symId))
        }),
        Result.mapErr(binding => [id, binding.source, source] as const),
        ctx.unwrapConflictId('binding/across'),
      ),

      registerMap: idSourceMap => pipe(
        idSourceMap,
        Map.map((source, id) => ctx.register(id, source)),
      ),

      registerIdSymNodeMapCollectRes: ty => idNodeMap => pipe(
        idNodeMap,
        Result.mapErr(IdSourceMapCollect.Err.ofIdNodeMap),
        ctx.unwrapConflictId(ty),
        Map.forEach((node, id) => {
          node.symId = ctx.register(id, SymSource.node(node.astId))
        }),
      ),

      resolve: (node) => {
        const { id: { id }, astId } = node
        const binding = ctx.scope.lookup(id)
        if (! binding) throw ctx.throw({ type: 'UndefinedId', id, astId })

        const { symId } = binding
        ctx.bindingInfo!.refSymIdSet.add(symId)
        astSymMap.set(astId, symId)
        return symId
      },

      resolveRecordLike: (node) => {
        const { con, fields, astId, ty } = node
        const recordId = con.id.id
        const recordInfo = ctx.recordMap.get(recordId)
        if (! recordInfo) throw ctx.throw({ type: 'UndefinedId', id: recordId, astId })

        node.con.symId = recordInfo.symId

        const fieldSetDef = Set.of(R.keys(recordInfo.fieldDict))
        const fieldSet = pipe(
          fields,
          R.map(field => field.key.id),
          Set.strictOf,
          Result.unwrapBy(id => ctx.throw({ type: 'RecordDuplicateField', recordId, field: id, astId }))
        )
        const fieldSetExtra = fieldSet.difference(fieldSetDef)
        if (fieldSetExtra.size)
          throw ctx.throw({ type: 'RecordExtraField', recordId, fields: [...fieldSetExtra], astId })

        if (ty === 'record') {
          const fieldSetMissing = fieldSetDef.difference(fieldSet)
          if (fieldSetMissing.size)
            throw ctx.throw({ type: 'RecordMissingField', recordId, fields: [...fieldSetMissing], astId })
        }
      }
    }),
    nameResolveWalkerMap,
  )

  const sis = new SymIdState(modId)
  const dataMap: DataMap = Map.empty()
  const recordMap: RecordMap = Map.empty()
  const classMap: ClassMap = Map.empty()
  const instanceMap: InstanceMap = Map.empty()
  const classInstanceMap: ClassInstanceMap = DefaultMap.empty(() => [])
  const symInfoMap: SymInfoMap = Map.empty()
  const astSymMap: AstSymMap = Map.empty()
  const symTable = new SymTable(sis, symInfoMap)
  const globalScope = Scope.global(mod.astId, symInfoMap)

  const ctx = createCtx({
    mode: 'resolve',
    unscopable: false,
    sis,
    store,
    scope: globalScope,
    bindingHostMap: Map.empty(),
    scopeMap: Map.empty(),
    bindingInfo: null,
    bindingMap: Map.empty(),
    instanceMap,
    symInfoMap,
    astSymMap,
    classMap,
    recordMap,
  })

  return Result.wrap<NameResolveMod.Ok, NameResolveMod.Err>(() => {
    // Resolve imports
    const modOpenIdMap = Map.empty<string, SymSource>()
    const modQidMap = Map.empty<string, SymSource>()

    const importMap: ImportMap = Map.empty()

    for (const im of mod.imports) {
      const { id: modId, astId } = im.modId
      const { nameResolve: { exportInfo } } = ctx.store.use(modId, ['nameResolve'])

      if (im.isOpen) {
        pipe(
          [modId, SymSource.node(astId)],
          Map.addToStrict(modOpenIdMap),
          ctx.unwrapConflictId('moduleOpen'),
        )
      }
      else {
        const { id: qid, astId } = im.qid ?? im.modId
        pipe(
          [qid, SymSource.node(astId)],
          Map.addToStrict(modQidMap),
          ctx.unwrapConflictId('moduleQualified'),
        )
      }

      const symTable = new SymTable(sis, symInfoMap)
      importMap.set(modId, symTable)

      const importSymSlot = (symSlot: SymSlot, id: string, source: SymSource) => {
        for (const [type, sym] of R.entries(symSlot)) {
          if (! sym) continue
          const symId = type === 'binding' ? ctx.register(id, source) : sis.next()
          symTable.register({
            ...sym,
            symId,
            originSymId: sym.symId,
          })
        }
      }

      if (im.items) {
        for (const item of im.items) {
          const { id } = item.id
          const symSlot = exportInfo.symTable.get(id)
          if (! symSlot) throw ctx.throw({ type: 'UnknownImport', modId, id })
          if (im.isOpen) {
            importSymSlot(symSlot, id, SymSource.node(item.astId))
          }
        }
      }
      else if (im.isOpen) {
        for (const [id, symSlot] of exportInfo.symTable) {
          importSymSlot(symSlot, id, SymSource.node(astId))
        }
      }
    }

    // Resolve data definitions.
    for (const def of mod.dataDefs) {
      const dataId = def.id.id
      const cons = pipe(
        def.cons,
        R.map(con => [con.func.id, SymSource.node(con.astId)] as const),
        Map.strictOf,
        ctx.unwrapConflictId('binding/dataCon'),
        ctx.registerMap,
        ist => def.cons.map((con): DataCon<SymIdHead> => {
          const conId = con.func.id
          return {
            id: conId,
            symId: ist.get(conId)!,
            params: con.params.map(R.prop('type')),
          }
        }),
      )
      const symId = pipe(
        symTable.register({
          type: 'type',
          ty: 'data',
          id: dataId,
          source: SymSource.node(def.astId)
        }),
        ctx.unwrap,
      )
      const data: DataInfo<SymIdHead> = {
        id: dataId,
        symId,
        params: def.params.map(R.prop('type')),
        cons,
      }
      dataMap.set(dataId, data)
    }

    // Resolve record definitions.
    for (const def of mod.recordDefs) {
      const recordId = def.id.id
      const symId = pipe(
        symTable.register({
          type: 'type',
          ty: 'record',
          id: recordId,
          source: SymSource.node(def.astId)
        }),
        ctx.unwrap,
      )
      const record: RecordInfo<SymIdHead> = {
        id: recordId,
        symId,
        astId: def.astId,
        params: def.params.map(R.prop('type')),
        fieldDict: pipe(
          def.fields,
          R.map(({ key: { id }, type: { type } }) => [id, { id, type }] as const),
          Dict.of,
        )
      }
      recordMap.set(recordId, record)
    }

    // Lift class and binding host names to mod scope.
    ctx.withMode('lift').walkDefault(mod)

    // Resolve class definitions.
    for (const def of mod.classDefs) {
      const classHostInfo = ctx.bindingHostMap.get(def.bindingHost.astId)!
      const members: Map<string, ClassMember<SymIdHead>> = pipe(
        classHostInfo.idSigDeclMap,
        Map.map((decl, id) => ({
          id,
          astId: decl.astId,
          sigType: decl.sig.typeScheme,
          symId: globalScope.get(id)!.symId,
        }))
      )
      const { id: { id }, astId, param: { type: param } } = def
      const symId = pipe(
        symTable.register({
          type: 'type',
          ty: 'class',
          id,
          source: SymSource.node(def.astId)
        }),
        ctx.unwrap,
      )
      const classInfo: ClassInfo<SymIdHead> = {
        id,
        astId,
        constrs: [],
        symId,
        param,
        members,
      }
      classMap.set(classInfo.id, classInfo)
    }

    // Resolve instance definitions.
    for (const def of mod.instanceDefs) {
      const { classId: { id: classId }, arg: { type: arg }, astId } = def
      const instanceId = `!dict.${classId}.${Type.show(arg)}`
      const symId = pipe(
        symTable.register({
          type: 'instance',
          id: instanceId,
          source: SymSource.node(astId),
        }),
        ctx.unwrap,
      )
      const instance: InstanceInfo<SymIdHead> = { instanceId, classId, arg, symId }
      instanceMap.set(astId, instance)
      classInstanceMap.get(classId).push(instance)
    }

    // Resolve the module body
    ctx.withMode('resolve-only').walkDefault(mod)

    ctx.scopeMap.set(mod.astId, ctx.scope)

    const { fixityMap } = ctx.bindingHostMap.get(mod.bindingHost.astId)!

    // Check for 'main'
    if (modId === 'Main' && ! globalScope.has('main')) ctx.throw({ type: 'MissingMain' })

    // Register exported binding symbols
    pipe(
      globalScope.entries(),
      Iter.forEach(([id, { source, symId }]) => symTable.register({
        type: 'binding',
        id,
        source,
        symId,
      })),
    )

    // Construct export info
    const exportInfo: ExportInfo = {
      symTable,
      fixityMap,
      dataMap,
      classMap,
      classInstanceMap,
      recordMap,
    }

    return {
      sis,
      exportInfo,
      importMap,
      globalScope,
      mod,
      ...R.pick(ctx, [
        'bindingMap',
        'bindingHostMap',
        'scopeMap',
        'symInfoMap',
        'astSymMap',
        'instanceMap',
      ]),
    }
  })
}
