<script setup lang="ts">
import type { ExId, Expr, ExprType, ExRange, Node } from '@dicel/core'
import type { Selection } from '../App.vue'
import Type from './Type.vue'

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
  <div
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
    <span v-else-if="node.type === 'varOp'">
      <span class="expr-op">{{ node.id }}</span>
    </span>
    <span v-else-if="node.type === 'cond'">
      <Node :node="node.cond" :selection="selection" />
      <span class="expr-op expr-spaced">?</span>
      <Node :node="node.yes" :selection="selection" />
      <span class="expr-op expr-spaced">:</span>
      <Node :node="node.no" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'let'">
      <span class="expr-kw">let</span>
      <Node :node="node.binding" :selection="selection" />
      <div class="expr-i-2">
        <span class="expr-kw expr-i-n1">in</span>
        <Node :node="node.body" :selection="selection" />
      </div>
    </span>
    <span v-else-if="node.type === 'binding'">
      <Node :node="node.lhs" :selection="selection" />
      <span class="expr-op expr-spaced">=</span>
      <Node :node="node.rhs" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'apply'">
      <template v-if="node.func.type === 'apply' && node.func.func.type === 'varOp'">
        <Node :node="node.func.arg" :selection="selection" :with-paren="! is(node.func.arg, ['var', 'num', 'unit'])"  />
        <Node class="expr-spaced" :node="node.func.func" :selection="selection" />
        <Node :node="node.arg" :selection="selection" :with-paren="! is(node.arg, ['var', 'num', 'unit'])"  />
      </template>
      <template v-else>
        <Node :node="node.func" :selection="selection" :with-paren="! is(node.func, ['var', 'num', 'unit', 'apply'])" />
        <span class="expr-spaced"></span>
        <Node :node="node.arg" :selection="selection" :with-paren="! is(node.arg, ['var', 'num', 'unit'])" />
      </template>
    </span>
    <span v-else-if="node.type === 'lambda'">
      <span class="expr-op">\</span>
      <Node :node="node.param" :selection="selection" />
      <span class="expr-op expr-spaced">-&gt;</span>
      <Node :node="node.body" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'ann'">
      <Node :node="node.expr" :selection="selection" :with-paren="is(node.expr, ['lambda'])" />
      <span class="expr-op expr-spaced">::</span>
      <Node :node="node.ann" :selection="selection" />
    </span>
    <span v-else-if="node.type === 'type'">
      <Type :type="node.val" />
    </span>
    <span v-if="withParen">)</span>
  </div>
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