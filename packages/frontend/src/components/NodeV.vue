<script setup lang="ts">
import { type ExId, type ExRange, isSymbol, Node } from '@dicel/core'

import { computed, useTemplateRef } from 'vue'
import { Selection, useSelectable } from '../utils/selectable'

import TypeV from './TypeV.vue'
import PatternV from './PatternV.vue'

const props = withDefaults(defineProps<{
  node: Node<ExRange & ExId> | Node
  selection?: Selection
  parent?: Node<ExRange & ExId> | Node | null
}>(), {
  parent: null,
  selection: Selection,
})

const root = useTemplateRef('root')
const { classes } = useSelectable(root, props)

const withParen = computed(() =>  Node.needsParen(props.node, props.parent))
</script>

<template>
  <span
    class="node"
    ref="root"
    :class="classes"
  >
    <span v-if="withParen">(</span>
    <span v-if="node.type === 'num'">
      <span class="node-lit">{{ node.val }}</span>
    </span>
    <span v-else-if="node.type === 'unit'">
      <span class="node-con">()</span>
    </span>
    <span v-else-if="node.type === 'var'">
      <span :class="isSymbol(node.id) ? 'node-op' : 'node-var'">{{ node.id }}</span>
    </span>
    <span v-else-if="node.type === 'cond'">
      <NodeV :node="node.cond" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">?</span>
      <NodeV :node="node.yes" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">:</span>
      <NodeV :node="node.no" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'let'">
      <span class="node-kw">let</span>
      <div v-for="binding, i of node.bindings" :key="i" class="node-block">
        <NodeV :node="binding" :selection="selection" :parent="node" />
      </div>
      <div>
        <span class="node-kw">in</span>
        <NodeV :node="node.body" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-else-if="node.type === 'binding'">
      <NodeV :node="node.lhs" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">=</span>
      <NodeV :node="node.rhs" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'case'">
      <span class="node-kw">case</span>
      <NodeV :node="node.subject" :selection="selection" :parent="node" />
      <span class="node-kw node-spaced">of</span>
      <div v-for="branch, i in node.branches" :key="i" class="node-block">
        <NodeV :node="branch" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-else-if="node.type === 'caseBranch'">
      <NodeV :node="node.pattern" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">-&gt;</span>
      <NodeV :node="node.body" :selection="selection" :parent="node" />
    </span>
    <PatternV v-else-if="node.type === 'pattern'" :node="node" />
    <span v-else-if="node.type === 'apply'">
      <NodeV :node="node.func" :selection="selection" :parent="node" />
      <span class="node-spaced"></span>
      <NodeV :node="node.arg" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'binOp'">
      <NodeV :node="node.lhs" :selection="selection" :parent="node" />
      <NodeV :node="node.op" :selection="selection" :parent="node" class="node-spaced" />
      <NodeV :node="node.rhs" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'lambda'">
      <span class="node-sym">\</span>
      <NodeV :node="node.param" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">-&gt;</span>
      <NodeV :node="node.body" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'lambdaCase'">
      <span class="node-sym">\case</span>
      <div v-for="branch of node.branches" class="node-block">
        <NodeV :node="branch" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-else-if="node.type === 'ann'">
      <NodeV :node="node.expr" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">::</span>
      <NodeV :node="node.ann" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'type'">
      <TypeV :type="node.val" />
    </span>
    <span v-else-if="node.type === 'def'">
      <NodeV :node="node.binding" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'mod'">
      <div v-for="def, i in node.defs" :key="i">
        <NodeV :node="def" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-if="withParen">)</span>
  </span>
</template>

<style>
.node.selected {
  background-color: dimgrey;
}

.node.fixed {
  outline: 1px solid lightblue;
}

.node {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  font-family: monospace;
  color: lightgrey;
}

.node-block {
  margin-left: 2ch;
  display: flex;
  align-items: end;
}

.node-kw {
  color: lightblue;
  margin-right: 1ch;
}

.node-lit, .node-con {
  color: lightgreen;
}

.node-sym {
  color: lightcoral;
}

.node-var {
  color: ivory;
}

.node-op {
  color: lightsalmon;
}

:not(.node-n-2) + .node-spaced:not(:empty) {
  margin-left: 1ch;
}

.node-spaced {
  margin-right: 1ch;
}
</style>