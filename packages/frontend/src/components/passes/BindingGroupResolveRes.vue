<script setup lang="ts">
import SwitchButton from '@comp/SwitchButton.vue'
import NodeLink from '@comp/NodeLink.vue'
import PassSection from '@comp/PassSection.vue'
import SectionHeader from '@comp/SectionHeader.vue'
import type { PassStateMap } from '@dicel/core'
import { kModOutputs } from '@util/inject'
import { refStorage } from '@util/stoage'
import { inject } from 'vue'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const folded = refStorage(`folded.${props.modId}.bindingGroupResolve`, false)

const outputs = inject(kModOutputs)!
</script>

<template>
  <PassSection pass="bindingGroupResolve" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output: { bindingGroupsMap } }">
      <SectionHeader title="Binding groups">
        <SwitchButton :reversed="true" v-model="folded" />
      </SectionHeader>

      <div v-if="! folded">
        <div v-for="[astId, bindingGroup] of bindingGroupsMap">
          <NodeLink :node="outputs.parse!.nodeMap.get(astId)!" />
          <span class="node-sym node-spaced">=&gt;</span>
          <span>[</span>
          <div v-for="{ bindings } of bindingGroup" class="node-block">
            {<span v-for="binding, ix of bindings">
              <NodeLink :node="outputs.parse!.nodeMap.get(binding.astId)!" />
              <span v-if="ix !== bindings.length - 1" class="node-spaced-right">,</span>
            </span>}
          </div>
          <span>]</span>
        </div>
      </div>
    </template>
  </PassSection>
</template>
