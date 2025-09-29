<script setup lang="ts">
import type { Node, DRange, DId } from '@dicel/core'

defineProps<{
  node: Node<DRange & DId> | null
}>()
</script>

<template>
  <span class="node-label">
    <template v-if="node">
      &lt;{{ node.type }}#{{ node.astId }}@{{ node.range.start }}:{{ node.range.end }}&gt;
    </template>
    <template v-else>&lt;null&gt;</template>
  </span>
</template>

<style scoped>
.node-label {
  color: lightblue;
}
</style>