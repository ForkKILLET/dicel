<script setup lang="ts">
import type { ExId, Expr, ExprType, ExRange, Node } from '@dicel/core'
import type { Selection } from '../App.vue'
import TypeV from './TypeV.vue'

const props = withDefaults(defineProps<{
  node: Node<ExRange & ExId> | Node,
  selection?: Selection
  withParen?: boolean
}>(), {
  withParen: false,
  selection: (): Selection => ({ node: null, fixedNode: null })
})

const is = (expr: Expr, types: ExprType[]): boolean => types.includes(expr.type)

const onMouseMove = () => {
  if ('range' in props.node) props.selection.node = props.node
}

const onClick = () => {
  if (! ('range' in props.node)) return
  props.selection.fixedNode = props.selection.fixedNode?.astId === props.node.astId
    ? null
    : props.node
}
</script>

<template>
  <span
    class="expr"
    :class="{
      [node.type]: true,
      selected: 'range' in node && selection.node?.astId === node.astId,
      fixed: 'range' in node && selection.fixedNode?.astId === node.astId,
    }"
    @mousemove.stop="onMouseMove"
    @click.stop="onClick"
  >
    <span v-if="withParen">(</span>
    <span v-if="node.type === 'num'">
      <span class="expr-lit">{{ node.val }}</span>
    </span>
    <span v-if="node.type === 'unit'">
      <span class="expr-con">()</span>
    </span>
    <span v-else-if="node.type === 'var'">
      <span class="expr-var">{{ node.id }}</span>
    </span>
    <span v-else-if="node.type === 'cond'">
      <NodeV :node="node.cond" :selection="selection" />
      <span class="expr-op expr-spaced">?</span>
      <NodeV :node="node.yes" :selection="selection" />
      <span class="expr-op expr-spaced">:</span>
      <NodeV :node="node.no" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'let'">
      <span class="expr-kw">let</span>
      <NodeV :node="node.binding" :selection="selection" />
      <div class="expr-i-2">
        <span class="expr-kw expr-i-n1">in</span>
        <NodeV :node="node.body" :selection="selection" />
      </div>
    </span>
    <span v-else-if="node.type === 'binding'">
      <NodeV :node="node.lhs" :selection="selection" />
      <span class="expr-op expr-spaced">=</span>
      <NodeV :node="node.rhs" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'apply'">
      <NodeV :node="node.func" :selection="selection" :with-paren="! is(node.func, ['var', 'num', 'unit', 'apply'])" />
      <span class="expr-spaced"></span>
      <NodeV :node="node.arg" :selection="selection" :with-paren="! is(node.arg, ['var', 'num', 'unit'])" />
    </span>
    <span v-else-if="node.type === 'lambda'">
      <span class="expr-op">\</span>
      <NodeV :node="node.param" :selection="selection" />
      <span class="expr-op expr-spaced">-&gt;</span>
      <NodeV :node="node.body" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'ann'">
      <NodeV :node="node.expr" :selection="selection" :with-paren="is(node.expr, ['lambda'])" />
      <span class="expr-op expr-spaced">::</span>
      <NodeV :node="node.ann" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'type'">
      <TypeV :type="node.val" />
    </span>
    <span v-if="withParen">)</span>
  </span>
</template>

<style scoped>
.expr {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  font-family: monospace;
  color: lightgrey;
}

.expr-i-2 + .expr {
  vertical-align: bottom;
}

.expr.selected {
  background-color: dimgrey;
}

.expr.fixed {
  outline: 1px solid lightblue;
}

.expr-i-2 {
  margin-left: 2ch;
}

.expr-i-4 {
  margin-left: 4ch;
}

.expr-i-n1 {
  margin-left: -1ch;
}

.expr-kw {
  color: lightblue;
  margin-right: 1ch;
}

.expr-lit, .expr-con {
  color: lightgreen;
}

.expr-op {
  color: lightcoral;
}

.expr-var {
  color: ivory;
}

:not(.expr-n-2) + .expr-spaced:not(:empty) {
  margin-left: 1ch;
}

.expr-spaced {
  margin-right: 1ch;
}
</style>