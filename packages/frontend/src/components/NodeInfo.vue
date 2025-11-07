<script setup lang="ts">
import { type Node } from '@dicel/core'

import { computed, inject } from 'vue'
import SymRef from '@comp/SymRef.vue'
import { kModOutputs } from '@util/inject'
import { withRef } from '@util/index'
import TypeSchemeV from './TypeSchemeV.vue'

const props = defineProps<{
  node: Node
}>()

const outputs = inject(kModOutputs)!

const symId = computed(() => outputs.value.nameResolve?.astSymMap.get(props.node.astId) ?? null)

const symType = computed(() => withRef(symId, symId => {
  if (! symId) return null
  return outputs.value.typeCheck?.typeEnv[symId] ?? null
}))
</script>

<template>
  <div class="node-info">
    <div v-if="symId">Symbol: <SymRef :sym-id="symId" :show-sym-id="true" :show-source="true" /></div>
    <div v-if="symType">Symbol type: <TypeSchemeV :type-scheme="symType" /></div>
  </div>
</template>
