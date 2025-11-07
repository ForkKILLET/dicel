<script setup lang="ts">
import { type SymId, fakeNodeFactory as fnf } from '@dicel/core'

import { computed, inject } from 'vue'
import { kModOutputs } from '@util/inject'
import SymSourceV from '@comp/SymSourceV.vue'
import NodeV from './NodeV.vue'

const props = defineProps<{
  symId: SymId
  isBrief?: boolean
  showSymId?: boolean
  showSource?: boolean
}>()

const outputs = inject(kModOutputs)!

const sym = computed(() => outputs.value.nameResolve!.symInfoMap.get(props.symId)!)
</script>

<template>
  <span class="sym-ref">
    <span v-if="showSymId" class="link node-spaced-right">{{ symId }}</span>
    <SymSourceV v-if="showSource" :source="sym.source" :is-brief="isBrief" />
    <NodeV v-else :node="fnf.makeVar(sym.id)" />
  </span>
</template>
