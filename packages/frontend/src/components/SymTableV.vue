<script setup lang="ts">
import * as R from 'remeda'

import { type SymTable, fakeNodeFactory as fnf } from '@dicel/core'
import NodeV from '@comp/NodeV.vue'

defineProps<{
  symTable: SymTable
}>()
</script>


<template>
  <div class="sym-table">
    <div v-for="[id, symSlot] of symTable" :key="id">
      <span class="node-spaced-right">({{ R.keys(symSlot).join(', ') }})</span>
      <NodeV :node="fnf.makeVar(id)" />
    </div>
  </div>
</template>
