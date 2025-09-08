<script setup lang="ts">
import type { NodeEx } from '@dicel/core'
import NodeV from './Node.vue'

defineProps<{
  node: NodeEx | null
}>()
</script>

<template>
  <template v-if="node">
    <span class="node-label">
      &lt;{{ node.type }}#{{ node.astId }}@{{ node.range.start }}:{{ node.range.end }}&gt;
    </span>
    <NodeV :node="node" />
  </template>
  <span v-else class="node-label">&lt;null&gt;</span>
</template>

<style scoped>
.node-label {
  color: lightblue;
}
</style>