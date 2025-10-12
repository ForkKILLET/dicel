<script setup lang="ts">
import { VarType, type Pipeline } from '@dicel/core'
import KindV from '../KindV.vue'
import TypeV from '../TypeV.vue'

defineProps<{
  result: Pipeline.ResolveOutput
}>()
</script>

<template>
  <div class="resolve ok section">
    <div class="badge">resolve</div>
    Kinds:
    <template v-for="kind, id in result.kindEnv" :key="id">
      <div v-if="id in result.modRes.dataDict">
        <TypeV :type="VarType(id)" /> <span class="node-sym">::</span> <KindV :kind="kind" />
      </div>
    </template>
  </div>
</template>

