<script setup lang="ts">
import { Fixity, type PassStateMap } from '@dicel/core'

import PassSection from '@comp/PassSection.vue'
import NodeV from '@comp/NodeV.vue'
import SwitchButton from '@comp/SwitchButton.vue'
import { refStorage } from '@util/stoage'
import NodeRef from '@comp/NodeRef.vue'
import SectionHeader from '@comp/SectionHeader.vue'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const folded = refStorage(`folded.${props.modId}.semanticsDesugar`, false)
</script>

<template>
  <PassSection pass="semanticsDesugar" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output }">
      <SectionHeader title="Semantics-desugared AST">
        <SwitchButton :reversed="true" v-model="folded" />
      </SectionHeader>

      <NodeV v-if="! folded" :node="output.mod" />
    </template>

    <template #err="{ err }">
      <template v-if="err.type === 'Fixity'">
        Operators of ambiguous fixity in the same infix expression: <NodeRef :ast-id="err.lOp" /> ({{ Fixity.show(err.lFixity) }}) &lt;-&gt; <NodeRef :ast-id="err.rOp" /> ({{ Fixity.show(err.rFixity) }})
      </template>
      <template v-else-if="err.type === 'Section'">
        Section of ambiguous fixity: <NodeRef :ast-id="err.section" />
      </template>
    </template>
  </PassSection>
</template>

