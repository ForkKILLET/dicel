<script setup lang="ts">
import type { Constr } from '@dicel/core'
import ConstrV from './ConstrV.vue'

defineProps<{
  constrs: Constr[]
}>()
</script>

<template>
  <span class="constrs node" :class="{ 'node-paren': constrs.length !== 1 }">
    <span
      v-for="constr, ix of constrs"
      :key="ix"
    >
      <ConstrV :constr="constr" />
      <span v-if="ix < constrs.length - 1" class="node-spaced-right">,</span>
    </span>
  </span>
</template>
