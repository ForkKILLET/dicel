<script setup lang="ts">
import type { Pipeline } from '@dicel/core'

import type { Selection } from '../../utils/selectable'

import NodeV from '../NodeV.vue'
import NodeLabelled from '../NodeLabel.vue'
import { ref } from 'vue'

defineProps<{
  result: Pipeline.ParseOutput
  selection: Selection
}>()

const folding = ref(false)
</script>

<template>
  <div class="ok section">
    <div class="badge">parse</div>
    <div class="section-head">
      AST:
      <button @click="folding = ! folding">{{ folding ? '+' : '-' }}</button>
      <div>
        Selected node:
        <NodeLabelled :node="selection.node" />
      </div>
      <div>
        Fixed node:
        <NodeLabelled :node="selection.fixedNode" />
      </div>
    </div>
    <NodeV
      v-if="! folding"
      :node="result.mod"
      :selection="selection"
      @mouseleave="selection.node = null"
    />
  </div>
</template>
