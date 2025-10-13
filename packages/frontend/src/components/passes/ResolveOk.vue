<script setup lang="ts">
import { ConType, type Pipeline } from '@dicel/core'

import { ref } from 'vue'
import KindV from '../KindV.vue'
import TypeV from '../TypeV.vue'

defineProps<{
  result: Pipeline.ResolveOutput
}>()

const showAll = ref(false)
</script>

<template>
  <div class="resolve ok section">
    <div class="badge">resolve</div>
    Kinds: <button @click="showAll = ! showAll">{{ showAll ? 'all' : 'user' }}</button>
    <template v-for="kind, id in result.kindEnv" :key="id">
      <div v-if="showAll || id in result.modRes.dataDict">
        <TypeV :type="ConType(id)" :has-parent="true" />
        <span class="node-sym node-spaced">::</span>
        <KindV :kind="kind" />
      </div>
    </template>
  </div>
</template>

