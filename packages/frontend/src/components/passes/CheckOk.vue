<script setup lang="ts">
import { type Pipeline } from '@dicel/core'
import TypeSchemeV from '../TypeScheme.vue'
import NodeV from '../NodeV.vue'

defineProps<{
  result: Pipeline.CheckOutput
}>()
</script>

<template>
  <div class="check ok section">
    <div class="badge">check</div>
      Types:
    <div v-for="typeScheme, id in result.typeEnv" :key="id">
      <NodeV :node="{ type: 'var', id }" /> :: <TypeSchemeV :type-scheme="typeScheme" />
    </div>
  </div>
</template>