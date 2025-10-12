<script setup lang="ts">
import { type DId, type DRange, isSymbol, isUpper, Node } from '@dicel/core'

import { computed, useTemplateRef } from 'vue'
import { Selection, useSelectable } from '../utils/selectable'

import TypeV from './TypeV.vue'
import PatternV from './PatternV.vue'

const props = withDefaults(defineProps<{
  node: Node<DRange & DId> | Node
  selection?: Selection
  parent?: Node<DRange & DId> | Node | null
}>(), {
  parent: null,
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
    <span v-else-if="node.type === 'unit'">()</span>
    <span v-else-if="node.type === 'var'">
      <span :class="isSymbol(node.id) ? 'node-op' : isUpper(node.id[0]) ? 'node-con' : 'node-var'">{{ node.id }}</span>
    </span>
    <span v-else-if="node.type === 'roll'">
      <NodeV v-if="node.times" :node="node.times" :selection="selection" :parent="node" />
      <span class="node-sym">@</span>
      <NodeV :node="node.sides" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'cond'">
      <NodeV :node="node.cond" :selection="selection" :parent="node" />
      <div class="node-block">
        <span class="node-sym node-spaced-right">?</span>
        <NodeV :node="node.yes" :selection="selection" :parent="node" />
      </div>
      <div class="node-block">
        <span class="node-sym node-spaced-right">:</span>
        <NodeV :node="node.no" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-else-if="node.type === 'let' || node.type === 'letRes'">
      <span class="node-kw">let</span>
      <div v-for="binding, i of node.bindings" :key="i" class="node-block">
        <NodeV :node="binding" :selection="selection" :parent="node" />
      </div>
      <div>
        <span class="node-kw">in</span>
        <NodeV :node="node.body" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-else-if="node.type === 'binding' || node.type === 'bindingRes'">
      <NodeV :node="node.lhs" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">=</span>
      <NodeV :node="node.rhs" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'case' || node.type === 'caseRes'">
      <span class="node-kw">case</span>
      <NodeV :node="node.subject" :selection="selection" :parent="node" />
      <span class="node-kw node-spaced">of</span>
      <div v-for="branch, i in node.branches" :key="i" class="node-block">
        <NodeV :node="branch" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-else-if="node.type === 'caseBranch' || node.type === 'caseBranchRes'">
      <NodeV :node="node.pattern" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">-&gt;</span>
      <NodeV :node="node.body" :selection="selection" :parent="node" />
    </span>
    <PatternV v-else-if="node.type === 'pattern'" :node="node" />
    <span v-else-if="node.type === 'apply'">
      <NodeV :node="node.func" :selection="selection" :parent="node" />
      <NodeV :node="node.arg" :selection="selection" :parent="node" class="node-spaced-left" />
    </span>
    <span v-else-if="node.type === 'applyMulti'">
      <NodeV :node="node.func" :selection="selection" :parent="node" />
      <NodeV v-for="arg of node.args" :node="arg" :selection="selection" :parent="node" class="node-spaced-left" />
    </span>
    <span v-else-if="node.type === 'infix'">
      <template v-for="arg, i of node.args">
        <NodeV :node="arg" :selection="selection" :parent="node" />
        <NodeV v-if="i < node.args.length - 1" :node="node.ops[i]" :selection="selection" :parent="node" class="node-spaced" />
      </template>
    </span>
    <span v-else-if="node.type === 'sectionL'">
      <NodeV :node="node.arg" :selection="selection" :parent="node" />
      <NodeV :node="node.op" :selection="selection" :parent="node" class="node-spaced-left" />
    </span>
    <span v-else-if="node.type === 'sectionR'">
      <NodeV :node="node.op" :selection="selection" :parent="node" class="node-spaced-right" />
      <NodeV :node="node.arg" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'lambdaRes'">
      <span class="node-sym">\</span>
      <NodeV :node="node.param" :selection="selection" :parent="node" class="node-spaced-right" />
      <span class="node-sym node-spaced-right">-&gt;</span>
      <NodeV :node="node.body" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'lambdaMulti' || node.type === 'lambdaMultiRes'">
      <span class="node-sym">\</span>
      <NodeV v-for="param of node.params" :node="param" :selection="selection" :parent="node" class="node-spaced-right" />
      <span class="node-sym node-spaced-right">-&gt;</span>
      <NodeV :node="node.body" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'lambdaCase' || node.type === 'lambdaCaseRes'">
      <span class="node-sym">\case</span>
      <div v-for="branch of node.branches" class="node-block">
        <NodeV :node="branch" :selection="selection" :parent="node" />
      </div>
    </span>
    <span v-else-if="node.type === 'list'">
      [<template v-for="elem, i of node.elems" :key="i">
        <NodeV :node="elem" :selection="selection" :parent="node" />
        <span v-if="i < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>]
    </span>
    <span v-else-if="node.type === 'tuple'">
      (<template v-for="elem, i of node.elems" :key="i">
        <NodeV :node="elem" :selection="selection" :parent="node" />
        <span v-if="i < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>)
    </span>
    <span v-else-if="node.type === 'paren'">
      (<NodeV :node="node.expr" :selection="selection" :parent="node" />)
    </span>
    <span v-else-if="node.type === 'ann'">
      <NodeV :node="node.expr" :selection="selection" :parent="node" />
      <span class="node-sym node-spaced">::</span>
      <NodeV :node="node.ann" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'typeNode'">
      <TypeV :type="node.val" />
    </span>
    <span v-else-if="node.type === 'def' || node.type === 'defRes'">
      <NodeV :node="node.binding" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'decl'">
      <template v-for="var_, i of node.vars">
        <NodeV :node="var_" :selection="selection" :parent="node" />
        <span v-if="i < node.vars.length - 1" class="node-spaced-right">,</span>
      </template>
      <span class="node-sym node-spaced">::</span>
      <NodeV :node="node.ann" :selection="selection" :parent="node" />
    </span>
    <span v-else-if="node.type === 'fixityDecl'">
      <span class="node-kw node-spaced-right">infix{{ node.assoc === 'left' ? 'l' : node.assoc === 'right' ? 'r' : '' }}</span>
      <span class="node-lit node-spaced-right">{{ node.prec }}</span>
      <template v-for="var_, i of node.vars">
        <NodeV :node="var_" :selection="selection" :parent="node" />
        <span v-if="i < node.vars.length - 1" class="node-spaced-right">,</span>
      </template>
    </span>
    <span v-else-if="node.type === 'dataDecl'">
      <span class="node-kw node-spaced-right">data</span>
      <span class="node-con">{{ node.id }}</span>
      <template v-for="id of node.data.typeParams">
        <span class="node-var node-spaced-left">{{ id }}</span>
      </template>
      <span class="node-sym node-spaced">=</span>
      <template v-for="con, i of node.data.cons" :key="i">
        <span v-if="i > 0" class="node-sym node-spaced">|</span>
        <span class="node-con">{{ con.id }}</span>
        <TypeV v-for="param of con.params" :type="param" :has-parent="true" class="node-spaced-left" />
      </template>
    </span>
    <span v-else-if="node.type === 'import'">
      <span class="node-kw">import</span>
      <span class="node-var">{{ node.modId }}</span>
      (<template v-for="id, i of node.ids" :key="i">
        <NodeV :node="{ type: 'var', id }" :parent="node" />
        <span v-if="i < node.ids.length - 1" class="node-spaced-right">,</span>
      </template>)
    </span>
    <span v-else-if="node.type === 'mod' || node.type === 'modRes'">
      <div v-for="import_ of node.imports">
        <NodeV :node="import_" :selection="selection" :parent="node" />
      </div>

      <div v-for="dataDecl of node.dataDecls">
        <NodeV :node="dataDecl" :selection="selection" :parent="node" />
      </div>

      <div v-for="decl of node.decls">
        <NodeV :node="decl" :selection="selection" :parent="node" />
      </div>

      <div v-for="def of node.defs">
        <NodeV :node="def" :selection="selection" :parent="node" />
      </div>

      <div v-for="fixityDecl of node.fixityDecls">
        <NodeV :node="fixityDecl" :selection="selection" :parent="node" />
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
  align-items: start;
}

.node-block.end {
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

.node-spaced {
  margin-left: 1ch;
  margin-right: 1ch;
}

.node-spaced-left {
  margin-left: 1ch;
}

.node-spaced-right {
  margin-right: 1ch;
}
</style>
