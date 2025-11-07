<script setup lang="ts">
import SwitchButton from '@comp/SwitchButton.vue'
import NodeV from '@comp/NodeV.vue'
import PassSection from '@comp/PassSection.vue'
import SectionHeader from '@comp/SectionHeader.vue'
import type { PassStateMap } from '@dicel/core'
import { refStorage } from '@util/stoage'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const folded = refStorage(`folded.${props.modId}.classDesugar`, false)
</script>

<template>
  <PassSection pass="classDesugar" :mod-id="modId" :state-map="stateMap">
    <template #ok="{ output: { mod } }">
      <SectionHeader title="Class-desugared AST">
        <SwitchButton :reversed="true" v-model="folded" />
      </SectionHeader>

      <NodeV v-if="! folded" :node="mod" />
    </template>
  </PassSection>
</template>
