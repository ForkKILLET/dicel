<script setup lang="ts">
import type { NodeLoc } from '@util/nodeSelection'
import NodeLink from './NodeLink.vue'
import { computed } from 'vue'

const props = defineProps<{
  loc: NodeLoc | null
}>()

const path = computed(() => {
  const { loc } = props
  if (! loc) return null
  return [...loc.path ?? [], loc.node]
})
</script>

<template>
  <span class="link">
    <template v-if="! path">&lt;null&gt;</template>
    <template v-else>
      <template v-for="node, ix of path">
        <NodeLink :node="node" :show-ty="true" />
        <span v-if="ix < path.length - 1" class="node-sym node-spaced">/</span>
      </template>
    </template>
  </span>
</template>

