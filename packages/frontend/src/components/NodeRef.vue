<script setup lang="ts">
import type { AstId } from '@dicel/core'
import { computed, inject } from 'vue'
import NodeV from './NodeV.vue'
import { kModOutputs } from '@util/inject'
import NodeLink from './NodeLink.vue'

const props = withDefaults(defineProps<{
  astId: AstId
  isBrief?: boolean
  flavor?: 'link' | 'brief'
}>(), {
  flavor: 'brief'
})

const outputs = inject(kModOutputs)!

const node = computed(() => outputs.value.parse!.nodeMap.get(props.astId)!)
</script>

<template>
  <NodeLink v-if="flavor === 'link'" :node="node" />
  <NodeV v-else-if="flavor === 'brief'" :node="node" :is-brief="isBrief" />
</template>
