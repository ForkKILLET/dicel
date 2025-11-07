<script setup lang="ts">
import { fakeNodeFactory as fnf, type SymInfo } from '@dicel/core'
import SymSourceV from '@comp/SymSourceV.vue'
import NodeV from './NodeV.vue'

defineProps<{
  info: SymInfo
  showSource?: boolean
}>()
</script>

<template>
  <span class="sym-info">
    <SymSourceV v-if="showSource" :source="info.source" />
    <NodeV v-else :node="fnf.makeVar(info.id)" />
  </span>
</template>
