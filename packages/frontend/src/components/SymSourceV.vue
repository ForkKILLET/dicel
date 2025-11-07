<script setup lang="ts">
import { type SymSource, fakeNodeFactory as fnf } from '@dicel/core'

import NodeRef from '@comp/NodeRef.vue'
import NodeV from './NodeV.vue'

defineProps<{
  source: SymSource
  isBrief?: boolean
}>()
</script>

<template>
  <span class="sym-source">
    <template v-if="! source">?</template>
    <template v-else-if="source.type === 'nodes'">
      <span v-for="astId, ix of source.astIds">
        <NodeRef :ast-id="astId" :is-brief="isBrief" />
        <span v-if="ix < source.astIds.length - 1" class="node-spaced-right">,</span>
      </span>
    </template>
    <template v-else-if="source.type === 'builtin'">
      <NodeV :node="fnf.makeVar(source.id)" :is-brief="isBrief" />
    </template>
  </span>
</template>
