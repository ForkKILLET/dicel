<script setup lang="ts">
import type { Node } from '@dicel/core'

import { inject, useTemplateRef } from 'vue'
import { useSelectable } from '@util/nodeSelection'
import { kNodeSelection } from '@util/inject'
import { reactivePick } from '@vueuse/core'

const props = defineProps<{
  node: Node
  showTy?: boolean
}>()

const nodeLinkRef = useTemplateRef('nodeLink')

const selection = inject(kNodeSelection)!
const { classes } = useSelectable(nodeLinkRef, selection, reactivePick(props, 'node'))
</script>

<template>
  <span
    class="node-link"
    :class="classes"
    ref="nodeLink"
  >
    <span>#{{ node.astId }}</span>
    <span v-if="showTy" class="node-spaced-left">&lt;{{ node.ty }}&gt;</span>
  </span>
</template>

<style scoped>
.node-link {
  cursor: pointer;
  color: lightblue;
}

.node-link.hovering {
  background-color: dimgrey;
}

.node-link.selected {
  outline: 1px solid lightblue;
}
</style>
