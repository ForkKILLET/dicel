<script setup lang="ts">
import type { Pipeline } from '@dicel/core'

import type { Selection } from '../../utils/selectable'

import NodeV from '../NodeV.vue'
import NodeLabelled from '../NodeLabel.vue'

defineProps<{
  result: Pipeline.ParseOutput
  selection: Selection
}>()
</script>

<template>
  <div class="parse ok section">
    <div class="badge">parse</div>
    AST: <NodeV
      :node="result.mod"
      :selection="selection"
      @mouseleave="selection.node = null"
    />
    <div>
      Selected node:
      <NodeLabelled :node="selection.node" />
    </div>
    <div>
      Fixed node:
      <NodeLabelled :node="selection.fixedNode" />
    </div>
  </div>
</template>