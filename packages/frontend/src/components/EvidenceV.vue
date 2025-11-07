<script setup lang="ts">
import type { Evidence } from '@dicel/core'
import SymRef from '@comp/SymRef.vue'
import TypeV from '@comp/TypeV.vue'

defineProps<{
  evidence: Evidence
}>()
</script>

<template>
  <span class="evidence">
    <template v-if="evidence.type === 'instance'">
      <SymRef :sym-id="evidence.symId" :is-brief="true" :show-source="true" />
    </template>
    <template v-else>
      <span class="link node-spaced-right">param @{{ evidence.ix }}</span>
      <TypeV :type="evidence.argType" />
    </template>
  </span>
</template>
