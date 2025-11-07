<script setup lang="ts">
import type { PassStateMap } from '@dicel/core'

import PassSection from '@comp/PassSection.vue'
import NodeV from '@comp/NodeV.vue'
import SwitchButton from '@comp/SwitchButton.vue'
import { refStorage } from '@util/stoage'
import { inject } from 'vue'
import { kNodeSelection } from '@util/inject'
import SectionHeader from '@comp/SectionHeader.vue'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const selection = inject(kNodeSelection)!

const folded = refStorage(`folded.${props.modId}.parse.ast`, false)
</script>

<template>
  <PassSection pass="parse" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output }">
      <SectionHeader title="AST">
        <SwitchButton :reversed="true" v-model="folded" />
      </SectionHeader>

      <NodeV
        v-if="! folded"
        :node="output.mod"
        @mouseleave="selection.hoveringLoc = null"
      />
    </template>

    <template #err="{ err }">
      <template v-if="err === null">
        Unknown Error
      </template>
      <template v-else>
        {{ err.type }}
      </template>
    </template>"
  </PassSection>
</template>

<style scoped>
.selection-info {
  margin-bottom: 1em;
}
</style>
