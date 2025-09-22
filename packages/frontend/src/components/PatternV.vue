<script setup lang="ts">
import { Pattern } from '@dicel/core'

import { computed, useTemplateRef } from 'vue'
import NodeV from './NodeV.vue'

import { useSelectable, Selection } from '../utils/selectable'

const props = withDefaults(defineProps<{
  node: Pattern
  selection?: Selection
  parent?: Pattern | null
}>(), {
  selection: Selection,
  parent: null
})

const root = useTemplateRef('root')
const { classes } = useSelectable(root, props)

const withParen = computed(() => Pattern.needsParen(props.node, props.parent))
</script>

<template>
  <span ref="root" class="node pattern" :class="classes">
    <template v-if="withParen">(</template>
    <span v-if="node.sub === 'var'">
      <NodeV :node="node.var" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.sub === 'num'">
      <span class="node-lit">{{ node.val }}</span>
    </span>
    <span v-else-if="node.sub === 'unit'">
      <span class="node-con">()</span>
    </span>
    <span v-else-if="node.sub === 'con'">
      <NodeV :node="node.con" :selection="selection" :parent="node" />
      <template v-for="arg of node.args">
        <span class="node-spaced-right"></span>
        <PatternV :node="arg" :selection="selection" :parent="node" />
      </template>
    </span>
    <span v-else-if="node.sub === 'wildcard'">
      <span class="node-sym">_</span>
    </span>
    <span v-else-if="node.sub === 'list'">
      [<template v-for="elem, i of node.elems">
        <PatternV :node="elem" :selection="selection" :parent="node" />
        <span v-if="i < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>]
    </span>
    <span v-else-if="node.sub === 'tuple'">
      (<template v-for="elem, i of node.elems">
        <PatternV :node="elem" :selection="selection" :parent="node" />
        <span v-if="i < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>)
    </span>
    <template v-if="withParen">)</template>
  </span>
</template>