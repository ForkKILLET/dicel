<script setup lang="ts">
import { prettify, type Pipeline } from '@dicel/core'
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
    <template v-for="typeScheme, id in result.typeEnv" :key="id">
      <div v-if="result.modRes.defIdSet.has(id) || result.modRes.dataConIdSet.has(id)">
        <NodeV :node="{ type: 'var', id }" /> <span class="node-sym">::</span> <TypeSchemeV :type-scheme="prettify(typeScheme)" />
      </div>
    </template>
  </div>
</template>
