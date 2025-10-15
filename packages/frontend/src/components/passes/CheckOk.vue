<script setup lang="ts">
import { TypeScheme, type Pipeline } from '@dicel/core'

import { ref } from 'vue'
import TypeSchemeV from '../TypeScheme.vue'
import NodeV from '../NodeV.vue'

defineProps<{
  result: Pipeline.CheckOutput
}>()

const showAll = ref(false)
</script>

<template>
  <div class="check ok section">
    <div class="badge">check</div>
    Types: <button @click="showAll = ! showAll">{{ showAll ? 'all' : 'user' }}</button>
    <template v-for="typeScheme, id in result.typeEnv" :key="id">
      <div v-if="showAll || result.modRes.idSet.has(id)">
        <NodeV :node="{ type: 'var', id }" />
        <span class="node-sym node-spaced">::</span>
        <TypeSchemeV :type-scheme="TypeScheme.prettify(typeScheme)" />
      </div>
    </template>
  </div>
</template>
