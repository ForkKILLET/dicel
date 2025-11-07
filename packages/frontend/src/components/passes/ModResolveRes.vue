<script setup lang="ts">
import NodeV from '@comp/NodeV.vue'
import PassSection from '@comp/PassSection.vue'
import SectionHeader from '@comp/SectionHeader.vue'
import { type PassStateMap, fakeNodeFactory as fnf } from '@dicel/core'

defineProps<{
  modId: string
  stateMap: PassStateMap
}>()
</script>

<template>
  <PassSection pass="modResolve" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output: { depModIdSet } }">
      <SectionHeader title="Dependencies" />

      {<template v-for="depModId, ix of depModIdSet">
        <span class="node-con">{{ depModId }}</span>
        <span v-if="ix < depModIdSet.size - 1" class="node-spaced-right">,</span>
      </template>}
    </template>

    <template #err="{ err }">
      <template v-if="err.type === 'UnknownDepMod'">
        Unknown module <NodeV :node="fnf.makeVar(err.modId)" />.
      </template>
    </template>
  </PassSection>
</template>
