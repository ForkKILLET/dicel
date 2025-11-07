<script setup lang="ts">
import { fakeNodeFactory as fnf, type PassStateMap } from '@dicel/core'

import { inject } from 'vue'
import PassSection from '@comp/PassSection.vue'
import NodeLink from '@comp/NodeLink.vue'
import SwitchButton from '@comp/SwitchButton.vue'
import NodeV from '@comp/NodeV.vue'
import SymSourceV from '@comp/SymSourceV.vue'
import SymTableV from '@comp/SymTableV.vue'
import NodeRef from '@comp/NodeRef.vue'
import SectionHeader from '@comp/SectionHeader.vue'
import SymRef from '@comp/SymRef.vue'
import { refStorage } from '@util/stoage'
import { kModOutputs } from '@util/inject'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const foldedExports = refStorage(`folded.${props.modId}.nameResolve.exports`, false)
const foldedImports = refStorage(`folded.${props.modId}.nameResolve.imports`, false)
const foldedScopes = refStorage(`folded.${props.modId}.nameResolve.scopes`, false)
const foldedBindingMap = refStorage(`folded.${props.modId}.nameResolve.bindings`, true)

const showSymId = refStorage(`showSymId.${props.modId}.nameResolve.bindings`, false)

const outputs = inject(kModOutputs)!
</script>

<template>
  <PassSection pass="nameResolve" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output: { scopeMap, exportInfo, bindingMap, importMap } }">
      <SectionHeader title="Exported symbols">
        <SwitchButton :reversed="true" v-model="foldedExports" />
      </SectionHeader>

      <div v-if="! foldedExports">
        <SymTableV :sym-table="exportInfo.symTable" />
      </div>

      <SectionHeader title="Imported symbols">
        <SwitchButton :reversed="true" v-model="foldedImports" />
      </SectionHeader>

      <div v-if="! foldedImports">
        <div v-for="[modId, symTable] of importMap" :key="modId">
          <span class="node-con">{{ modId }}</span>
          <span class="node-sym node-spaced">=&gt;</span>
          <SymTableV :sym-table="symTable" class="node-indent" />
        </div>
      </div>

      <SectionHeader title="Scopes">
        <SwitchButton :reversed="true" v-model="foldedScopes" />
      </SectionHeader>

      <div v-if="! foldedScopes">
        <div v-for="[astId, scope] of scopeMap">
          <NodeLink :node="outputs.parse!.nodeMap.get(astId)!" />
          <span class="node-sym node-spaced">=&gt;</span>
          <span>{</span>
          <span v-for="[id], ix of scope.entries()">
            <NodeV :node="fnf.makeVar(id)" />
            <span v-if="ix < scope.size - 1" class="node-spaced-right">,</span>
          </span>
          <span>}</span>
        </div>
      </div>

      <SectionHeader title="Bindings">
        <SwitchButton :reversed="true" v-model="foldedBindingMap" />
        <SwitchButton v-model="showSymId">symbol</SwitchButton>
      </SectionHeader>

      <div v-if="! foldedBindingMap">
        <div v-for="[astId, bindingInfo] of bindingMap">
          <NodeLink :node="outputs.parse!.nodeMap.get(astId)!" />
          <span class="node-sym node-spaced">=&gt;</span>
          <span>{</span>
          <span v-for="refSymId, ix of bindingInfo.refSymIdSet" :class="showSymId ? 'node-block' : null">
            <SymRef :sym-id="refSymId" :show-sym-id="showSymId" :show-source="true" />
            <span v-if="ix < bindingInfo.refSymIdSet.size - 1" class="node-spaced-right">,</span>
          </span>
          <span>}</span>
        </div>
      </div>
    </template>

    <template #err="{ err }">
      <template v-if="err.type === 'ConflictingId'">
        <template v-if="err.ty === 'binding/across'">
          Conflicting definitions for <NodeV :node="fnf.makeVar(err.id)" />:
        </template>
        <template v-else-if="err.ty === 'binding/param'">
          Conflicting definitions for <NodeV :node="fnf.makeVar(err.id)" /> in parameters:
        </template>
        <template v-else-if="err.ty === 'binding/bindingPat'">
          Conflicting definitions for <NodeV :node="fnf.makeVar(err.id)" /> in some binding pattern:
        </template>
        <template v-else-if="err.ty === 'binding/dataCon'">
          Conflicting definitions for <NodeV :node="fnf.makeVar(err.id)" /> in data constructors:
        </template>
        <template v-else-if="err.ty === 'classDef'">
          Multiple class definitions for <NodeV :node="fnf.makeVar(err.id)" />:
        </template>
        <template v-else-if="err.ty === 'dataDef'">
          Multiple data definitions for <NodeV :node="fnf.makeVar(err.id)" />:
        </template>
        <template v-else-if="err.ty === 'fixityDecl'">
          Multiple fixity declarations for <NodeV :node="fnf.makeVar(err.id)" />:
        </template>
        <template v-else-if="err.ty === 'sigDecl'">
          Multiple signature declarations for <NodeV :node="fnf.makeVar(err.id)" />:
        </template>
        <template v-else-if="err.ty === 'moduleQualified'">
          Conflicting qualified imports for <NodeV :node="fnf.makeVar(err.id)" />:
        </template>
        <template v-else-if="err.ty === 'moduleOpen'">
          Multiple open imports for <NodeV :node="fnf.makeVar(err.id)" />:
        </template>
        <SymSourceV :source="err.source1" />
        &lt;-&gt; <SymSourceV :source="err.source2" />
      </template>
      <template v-else-if="err.type === 'ConflictingSym'">
        Conflicting export for sym <NodeV :node="fnf.makeVar(err.id)" />.
      </template>
      <template v-else-if="err.type === 'UndefinedId'">
        Missing definition for <NodeRef :ast-id="err.astId" />.
      </template>
      <template v-else-if="err.type === 'RecordMissingField'">
        Record literal <NodeRef :ast-id="err.astId" /> is missing fields:
        <template v-for="field, ix of err.fields">
          <NodeV :node="fnf.makeVar(field)" />
          <span v-if="ix < err.fields.length - 1" class="node-spaced-right">,</span>
        </template>
      </template>
      <template v-else-if="err.type === 'RecordExtraField'">
        Record literal <NodeRef :ast-id="err.astId" /> has extra fields:
        <template v-for="field, ix of err.fields">
          <NodeV :node="fnf.makeVar(field)" />
          <span v-if="ix < err.fields.length - 1" class="node-spaced-right">,</span>
        </template>
      </template>
      <template v-else-if="err.type === 'RecordDuplicateField'">
        Record literal <NodeRef :ast-id="err.astId" /> has duplicate field <NodeV :node="fnf.makeVar(err.field)" />.
      </template>
      <template v-else-if="err.type === 'MissingMain'">
        Missing entry variable <NodeV :node="fnf.makeVar('main')" />.
      </template>
      <template v-else-if="err.type === 'MissingDef'">
        Missing definition for signature <NodeRef :ast-id="err.sigDeclAstId" />.
      </template>
      <template v-else-if="err.type === 'InstanceMissingDef'">
        Missing definition for class member <NodeRef :ast-id="err.sigDeclAstId" />
        in <NodeRef :ast-id="err.instanceAstId" :is-brief="true" />.
      </template>
      <template v-else-if="err.type === 'InstanceExtraDef'">
        Extra definition <SymSourceV :source="err.source" />
        in <NodeRef :ast-id="err.instanceAstId" :is-brief="true" />.
      </template>
      <template v-else-if="err.type === 'UnknownImport'">
        Module <NodeV :node="fnf.makeVar(err.modId)" /> does not export <NodeV :node="fnf.makeVar(err.id)" />.
      </template>
      <template v-else-if="err.type === 'DiffEquationArity'">
        Equations of <NodeV :node="fnf.makeVar(err.id)" /> have different arities.
      </template>
    </template>
  </PassSection>
</template>
