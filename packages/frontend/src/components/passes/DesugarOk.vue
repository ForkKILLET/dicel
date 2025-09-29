<script setup lang="ts">
import type { Pipeline } from '@dicel/core'

import NodeV from '../NodeV.vue'

defineProps<{
  result: Pipeline.DesugarOutput
}>()
</script>

<template>
  <div class="desugar ok section">
    <div class="badge">desugar</div>
    Internal AST: <NodeV :node="result.modInt" />
  </div>
</template>