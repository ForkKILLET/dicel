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
    Desugared AST: <NodeV :node="result.modDes" />
  </div>
</template>
