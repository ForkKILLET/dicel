<script setup lang="ts">
import type { Pipeline } from '@dicel/core'

import NodeV from '../NodeV.vue'
import { ref } from 'vue'

defineProps<{
  result: Pipeline.DesugarOutput
}>()

const folding = ref(false)
</script>

<template>
  <div class="ok section">
    <div class="badge">desugar</div>
    <div class="section-head">
      Desugared AST: <button @click="folding = ! folding">{{ folding ? '+' : '-' }}</button>
    </div>
    <NodeV v-if="! folding" :node="result.modDes" />
  </div>
</template>
