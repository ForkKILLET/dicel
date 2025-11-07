<script setup lang="ts">
import type { PassStateMap } from '@dicel/core'

import PassSection from '@comp/PassSection.vue'
import NodeV from '@comp/NodeV.vue'
import SwitchButton from '@comp/SwitchButton.vue'
import { refStorage } from '@util/stoage'
import SectionHeader from '@comp/SectionHeader.vue'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const folded = refStorage(`folded.${props.modId}.syntaxDesugar`, false)
</script>

<template>
  <PassSection pass="syntaxDesugar" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output }">
      <SectionHeader title="Syntax-desugared AST">
        <SwitchButton :reversed="true" v-model="folded" />
      </SectionHeader>

      <NodeV v-if="! folded" :node="output.mod" />
    </template>
  </PassSection>
</template>
