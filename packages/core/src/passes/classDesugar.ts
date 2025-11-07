import { Ok } from 'fk-result'
import { BindingHostNode, BindingNode, Expr, Mod, RecordDefNode, VarExpr } from '@/node/node'
import { Core } from '@/node/stage'
import { CheckNodeTransformerOutputMap, defineNodeTransformCtx, NodeTransformCtx, NodeTransformerMap } from '@/node/transform'
import { NodeFactory, NodeMaker } from '@/node/utils'
import { PassAction } from '@/pipeline'
import { ApplyType, BindingEvidenceMap, ConType, EvidenceMap, TypeScheme } from '@/type/type'
import { SymId, SymIdState } from '@/sym'
import { match } from 'ts-pattern'
import { BindingGroup, BindingGroupsMap } from '@/passes/bindingGroupResolve'
import { Iter, Map, Set } from '@/utils/data'
import { mapInplace, pipe, replicate } from '@/utils/compose'
import { NodeMap } from '@/node/astId'
import { BindingHostMap } from './nameResolve'

type ClassDesugarCtxImpl = {}

type ClassDesugarCtxData = {
  bindingEvidenceMap: BindingEvidenceMap
  sis: SymIdState
  nf: NodeFactory
  evidenceState: EvidenceState | null
  bindingGroupsMap: BindingGroupsMap
  bindingRemap: NodeMap<BindingNode<Core>> | null
}

type ClassDesugarCtx = NodeTransformCtx<
  Core, Core, ClassDesugarCtxImpl, ClassDesugarCtxData, ClassDesugarOutputMap
>

type EvidenceState = {
  dictArgs: VarExpr<Core>[]
  evidenceMap: EvidenceMap
}

type ClassDesugarOutputMap = CheckNodeTransformerOutputMap<Core, Core, {
  binding: BindingNode<Core>
  var: Expr<Core>
  bindingHost: BindingHostNode<Core>
}>

type ClassDesugarTransformerMap = NodeTransformerMap<
  Core, Core, ClassDesugarCtx, ClassDesugarOutputMap
>

const classDesugarTransformers: ClassDesugarTransformerMap = {
  bindingHost: (node, ctx) => {
    const bindingRemap: NodeMap<BindingNode<Core>> = Map.empty()
    const bindingHost = ctx.fork({ bindingRemap }).transformDefault(node)

    const bindingGroups = ctx.bindingGroupsMap.get(node.astId)!
    bindingGroups.forEach(bindingGroup => {
      bindingGroup.bindings = bindingGroup.bindings
        .map(binding => bindingRemap.get(binding.astId) ?? binding)
    })

    return bindingHost
  },

  binding: (node, ctx) => {
    const { paramCount, evidenceMap } = ctx.bindingEvidenceMap.get(node.astId)!

    const symIds = replicate(paramCount, ctx.sis.next)
    const dictArgs = symIds.map((symId, ix) => ctx.nf.makeVar(`!dict${ix}`, symId))
    const evidenceState: EvidenceState = { dictArgs, evidenceMap }

    ctx = ctx.fork({ evidenceState })

    const binding = {
      ...node,
      body: ctx.nf.makeLambdaMulti(
        symIds.map((symId, ix) => ctx.nf.makeVarPat(`!dict${ix}`, symId)),
        ctx.transform(node.body),
      )
    }
    ctx.bindingRemap!.set(node.astId, binding)
    return binding
  },

  var: (node, ctx) => {
    const { evidenceMap, dictArgs } = ctx.evidenceState!
    const evidences = evidenceMap.get(node.astId)

    if (evidences.length) console.log(evidences)

    return ctx.nf.makeApplyMulti([
      node,
      ...evidences.map(evidence => match(evidence)
        .with({ type: 'param' }, ({ ix }) => dictArgs[ix])
        .with({ type: 'instance' }, ({ symId, instanceId }) =>
          ctx.nf.makeVar(instanceId, symId)
        )
        .exhaustive()
      )
    ])
  },
}

export namespace ClassDesugarMod {
  export type Ok = {
    mod: Mod<Core>
  }

  export type Err = never
}

export const classDesugarMod: PassAction<'classDesugar'> = (modId, store) => {
  const {
    parse: { ais, nodeMap },
    semanticsDesugar: { mod },
    nameResolve: { sis, exportInfo: { classMap }, instanceMap, bindingHostMap },
    bindingGroupResolve: { bindingGroupsMap },
    typeCheck: { bindingEvidenceMap, typeEnv },
  } = store.use(modId, ['parse', 'semanticsDesugar', 'nameResolve', 'bindingGroupResolve', 'typeCheck'])

  const nf = new NodeFactory(NodeMaker.of(ais, nodeMap))

  const createCtx = defineNodeTransformCtx<
    Core, Core, ClassDesugarCtxData, ClassDesugarCtxImpl, ClassDesugarOutputMap
  >(
    () => ({}),
    classDesugarTransformers,
  )

  const ctx = createCtx({
    nf,
    sis,
    bindingEvidenceMap,
    evidenceState: null,
    bindingRemap: null,
    bindingGroupsMap,
  })

  // Generate class dictionary record definitions
  const classEntries = [...classMap]
  const classRecordDefs: RecordDefNode[] = classEntries.map(([id, { param, members }]) =>
    nf.make({
      ty: 'recordDef',
      id: nf.makeId(`!Dict.${id}`),
      params: [nf.make({
        ty: 'type',
        type: param
      })],
      fields: [...members].map(([memberId, { sigType }]) => nf.make({
        ty: 'recordDefField',
        key: nf.makeId(memberId),
        type: nf.make({
          ty: 'type',
          type: {
            ty: 'forall',
            ...sigType,
            boundVarSet: sigType.boundVarSet.clone().delete(param),
          },
        })
      })),
    })
  )

  // Generate instance dictionary bindings
  const instanceDictBindings: BindingNode<Core>[] = mod.instanceDefs.map(def => {
    const { instanceId, classId, symId: instanceSymId, arg } = instanceMap.get(def.astId)!
    const { members, symId: classSymId } = classMap.get(classId)!
    const { scope } = bindingHostMap.get(def.bindingHost.astId)!

    typeEnv[instanceSymId] = TypeScheme.pure(ApplyType(ConType(`!Dict.${classId}`), arg))

    return nf.make({
      ty: 'binding',
      pat: nf.makeVarPat(instanceId, instanceSymId),
      body: nf.make({
        ty: 'let',
        bindingHost: ctx.transform(def.bindingHost),
        body: nf.make({
          ty: 'record',
          con: nf.makeVarRef(`!Dict.${classId}`, classSymId),
          fields: [...members.keys()].map(memberId => nf.make({
            ty: 'recordBindingField',
            key: nf.makeId(memberId),
            val: nf.makeVar(memberId, scope.get(memberId)!.symId),
          })),
        })
      })
    })
  })

  // Generate class member selector bindings
  const selectorSymIdSet = Set.empty<SymId>()
  const selectorBindings: BindingNode<Core>[] = classEntries.flatMap(([classId, { members, symId: classSymId }]) =>
    [...members].map(([memberId, { symId }]) => {
      const memberSymId = sis.next()
      selectorSymIdSet.add(symId)
      return nf.make({
        ty: 'binding',
        pat: nf.makeVarPat(memberId, symId),
        body: nf.make({
          ty: 'lambda',
          param: nf.make({
            ty: 'recordPat',
            con: nf.makeVarRef(`!Dict.${classId}`, classSymId),
            fields: [
              nf.make({
                ty: 'recordPatRebindingField',
                key: nf.makeId(memberId),
                pat: nf.makeVarPat('!member', memberSymId),
              })
            ]
          }),
          body: nf.makeVar('!member', memberSymId),
        }),
      })
    }
  ))

  // Update global binding groups
  const globalBindingGroups = bindingGroupsMap.get(mod.bindingHost.astId)!
  const instanceDictBindingGroup: BindingGroup = {
    id: -2,
    symIdSet: pipe(
      instanceMap.values(),
      Iter.map(instance => instance.symId),
      Set.of,
    ),
    bindings: instanceDictBindings,
  }
  const selectorBindingGroup: BindingGroup = {
    id: -1,
    symIdSet: selectorSymIdSet,
    bindings: selectorBindings,
  }
  globalBindingGroups.unshift(instanceDictBindingGroup, selectorBindingGroup)

  const globalBindingHostDesugared = ctx.transform(mod.bindingHost)

  const modDesugared: Mod<Core> = {
    ...mod,
    classDefs: [],
    instanceDefs: [],
    recordDefs: [
      ...classRecordDefs,
      ...mod.recordDefs,
    ],
    bindingHost: {
      ...globalBindingHostDesugared,
      bindings: [
        ...instanceDictBindings,
        ...selectorBindings,
        ...globalBindingHostDesugared.bindings,
      ],
    }
  }

  return Ok({
    mod: modDesugared,
  })
}
