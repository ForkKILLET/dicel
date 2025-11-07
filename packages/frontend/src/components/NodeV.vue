<script setup lang="ts">
import { Node, showStr } from '@dicel/core'

import { computed, inject, useTemplateRef } from 'vue'
import { reactivePick } from '@vueuse/core'
import TypeV from '@comp/TypeV.vue'
import TypeScheme from '@comp/TypeSchemeV.vue'
import { useSelectable } from '@util/nodeSelection'
import { kNodeSelection } from '@util/inject'

const props = withDefaults(defineProps<{
  node: Node
  path?: Node[]
  isBrief?: boolean
}>(), {
  path: () => [],
})

const selection = inject(kNodeSelection)!

const nodeRef = useTemplateRef('node')
const { classes } = useSelectable(nodeRef, selection, reactivePick(props, ['node', 'path']))

const parent = computed(() => props.path.at(-1) ?? null)

const pathNew = computed(() => [...props.path, props.node])

const withParen = computed(() => Node.checkParen(props.node, parent.value))
</script>

<template>
  <span
    class="node"
    ref="node"
    :class="{
      ...classes,
      'node-root': ! parent,
      'node-host': node.ty === 'mod' || node.ty === 'bindingHost',
      'node-paren': withParen,
    }"
    :data-ty="node.ty"
    :data-id="node.astId"
  >
    <template v-if="node.ty === 'num'">
      <span class="node-lit">{{ node.val }}</span>
    </template>
    <template v-else-if="node.ty === 'unit'">
      ()
    </template>
    <template v-else-if="node.ty === 'char'">
      <span class="node-lit">{{ showStr(node.val, '\'') }}</span>
    </template>
    <template v-else-if="node.ty === 'str'">
      <span class="node-lit">{{ showStr(node.val, '"') }}</span>
    </template>
    <template v-else-if="node.ty === 'var'">
      <NodeV :node="node.id" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'id'">
      <span :class="{ big: 'node-con', small: 'node-var', sym: 'node-op', other: null }[node.style]">{{ node.id }}</span>
    </template>
    <template v-else-if="node.ty === 'roll'">
      <NodeV v-if="node.times" :node="node.times" :path="pathNew" />
      <span class="node-sym">@</span>
      <NodeV :node="node.sides" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'cond'">
      <span class="node-kw">if</span>
      <NodeV :node="node.cond" :path="pathNew" />
      <div class="node-inline-block">
        <span class="node-kw">then</span>
        <NodeV :node="node.yes" :path="pathNew" />
      </div>
      <div class="node-inline-block">
        <span class="node-kw">else</span>
        <NodeV :node="node.no" :path="pathNew" />
      </div>
    </template>
    <template v-else-if="node.ty === 'let'">
      <span class="node-kw">let</span>
      <NodeV :node="node.bindingHost" :path="pathNew" />
      <div>
        <span class="node-kw">in</span>
        <NodeV :node="node.body" :path="pathNew" />
      </div>
    </template>
    <template v-else-if="node.ty === 'binding'">
      <NodeV :node="node.pat" :path="pathNew" />
      <span class="node-sym node-spaced">=</span>
      <NodeV :node="node.body" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'equationApplyHead' || node.ty === 'equationApplyFlattenHead'">
      <NodeV :node="node.func" :path="pathNew" />
      <template v-for="param of node.params">
        <NodeV :node="param" :path="pathNew" class="node-spaced-left" />
      </template>
    </template>
    <template v-else-if="node.ty === 'equationInfixHead'">
      <NodeV :node="node.lhs" :path="pathNew" />
      <NodeV :node="node.op" :path="pathNew" class="node-spaced" />
      <NodeV :node="node.rhs" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'equation'">
      <NodeV :node="node.head" :path="pathNew" />
      <span class="node-sym node-spaced">=</span>
      <NodeV :node="node.body" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'case'">
      <span class="node-kw">case</span>
      <NodeV :node="node.scrutinee" :path="pathNew" />
      <span class="node-kw node-spaced">of</span>
      <div v-for="branch, ix in node.branches" :key="ix" class="node-inline-block">
        <NodeV :node="branch" :path="pathNew" />
      </div>
    </template>
    <template v-else-if="node.ty === 'caseBranch'">
      <NodeV :node="node.pat" :path="pathNew" />
      <span class="node-sym node-spaced">-&gt;</span>
      <NodeV :node="node.body" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'varPat'">
      <NodeV :node="node.id" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'numPat'">
      <span class="node-lit">{{ node.val }}</span>
    </template>
    <template v-else-if="node.ty === 'unitPat'">
      ()
    </template>
    <template v-else-if="node.ty === 'dataPat'">
      <NodeV :node="node.con" :path="pathNew" />
      <template v-for="arg of node.args">
        <span class="node-spaced-right"></span>
        <NodeV :node="arg" :path="pathNew" />
      </template>
    </template>
    <template v-else-if="node.ty === 'recordPatPunningField'">
      <NodeV :node="node.key" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'recordPatRebindingField'">
      <NodeV :node="node.key" :path="pathNew" />
      <span class="node-sym">@</span>
      <NodeV :node="node.pat" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'recordPat'">
      <NodeV :node="node.con" :path="pathNew" class="node-spaced-right" />
      <span class="node-spaced-right">{</span>
      <template v-for="field, ix of node.fields">
        <NodeV :node="field" :path="pathNew" />
        <span v-if="ix < node.fields.length - 1" class="node-spaced-right">,</span>
      </template>
      <span class="node-spaced-left">}</span>
    </template>
    <template v-else-if="node.ty === 'infixPat'">
      <template v-for="args, ix of node.args">
        <NodeV :node="args" :path="pathNew" />
        <span v-if="ix < node.args.length - 1" class="node-spaced">
          <NodeV :node="node.ops[ix]" :path="pathNew" />
        </span>
      </template>
    </template>
    <template v-else-if="node.ty === 'varRef'">
      <NodeV :node="node.id" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'wildcardPat'">
      <span class="node-sym">_</span>
    </template>
    <template v-else-if="node.ty === 'listPat'">
      [<template v-for="elem, ix of node.elems">
        <NodeV :node="elem" :path="pathNew" />
        <span v-if="ix < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>]
    </template>
    <template v-else-if="node.ty === 'tuplePat'">
      (<template v-for="elem, ix of node.elems">
        <NodeV :node="elem" :path="pathNew" />
        <span v-if="ix < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>)
    </template>
    <template v-else-if="node.ty === 'recordPunningField'">
      <NodeV :node="node.key" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'recordBindingField'">
      <NodeV :node="node.key" :path="pathNew" />
      <template v-if="node.val">
        <span class="node-sym node-spaced">=</span>
        <NodeV :node="node.val" :path="pathNew" />
      </template>
    </template>
    <template v-else-if="node.ty === 'record'">
      <NodeV :node="node.con" :path="pathNew" class="node-spaced-right" />
      <span class="node-spaced-right">{</span>
      <template v-for="field, ix of node.fields">
        <NodeV :node="field" :path="pathNew" />
        <span v-if="ix < node.fields.length - 1" class="node-spaced-right">,</span>
      </template>
      <span class="node-spaced-left">}</span>
    </template>
    <template v-else-if="node.ty === 'recordUpdatePunningMatchingField'">
      <NodeV :node="node.key" :path="pathNew" />
      <span class="node-sym node-spaced">-&gt;</span>
      <NodeV :node="node.body" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'recordUpdatePipeField'">
      <NodeV :node="node.key" :path="pathNew" />
      <span class="node-sym node-spaced">|></span>
      <NodeV :node="node.func" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'recordUpdateMatchingField'">
      <NodeV :node="node.key" :path="pathNew" />
      <span class="node-sym">@</span>
      <NodeV :node="node.pat" :path="pathNew" />
      <span class="node-sym node-spaced">-&gt;</span>
      <NodeV :node="node.body" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'recordUpdate'">
      <NodeV :node="node.con" :path="pathNew" class="node-spaced-right" />
      <span class="node-spaced-right">{</span>
      <template v-for="field, ix of node.fields">
        <NodeV :node="field" :path="pathNew" />
        <span v-if="ix < node.fields.length - 1" class="node-spaced-right">,</span>
      </template>
      <span class="node-spaced-left">}</span>
    </template>
    <template v-else-if="node.ty === 'apply'">
      <NodeV :node="node.func" :path="pathNew" />
      <NodeV :node="node.arg" :path="pathNew" class="node-spaced-left" />
    </template>
    <template v-else-if="node.ty === 'applyMulti'">
      <NodeV :node="node.func" :path="pathNew" />
      <NodeV v-for="arg of node.args" :node="arg" :path="pathNew" class="node-spaced-left" />
    </template>
    <template v-else-if="node.ty === 'infix'">
      <template v-for="arg, ix of node.args">
        <NodeV :node="arg" :path="pathNew" />
        <NodeV v-if="ix < node.args.length - 1" :node="node.ops[ix]" :path="pathNew" class="node-spaced" />
      </template>
    </template>
    <template v-else-if="node.ty === 'sectionL'">
      <NodeV :node="node.arg" :path="pathNew" />
      <NodeV :node="node.op" :path="pathNew" class="node-spaced-left" />
    </template>
    <template v-else-if="node.ty === 'sectionR'">
      <NodeV :node="node.op" :path="pathNew" class="node-spaced-right" />
      <NodeV :node="node.arg" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'lambda'">
      <span class="node-sym">\</span>
      <NodeV :node="node.param" :path="pathNew" class="node-spaced-right" />
      <span class="node-sym node-spaced-right">-&gt;</span>
      <NodeV :node="node.body" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'lambdaMulti'">
      <span class="node-sym">\</span>
      <NodeV v-for="param of node.params" :node="param" :path="pathNew" class="node-spaced-right" />
      <span class="node-sym node-spaced-right">-&gt;</span>
      <NodeV :node="node.body" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'lambdaCase'">
      <span class="node-sym">\case</span>
      <div v-for="branch of node.branches" class="node-inline-block">
        <NodeV :node="branch" :path="pathNew" />
      </div>
    </template>
    <template v-else-if="node.ty === 'list'">
      [<template v-for="elem, ix of node.elems" :key="ix">
        <NodeV :node="elem" :path="pathNew" />
        <span v-if="ix < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>]
    </template>
    <template v-else-if="node.ty === 'tuple'">
      (<template v-for="elem, ix of node.elems" :key="ix">
        <NodeV :node="elem" :path="pathNew" />
        <span v-if="ix < node.elems.length - 1" class="node-spaced-right">,</span>
      </template>)
    </template>
    <template v-else-if="node.ty === 'paren'">
      (<NodeV :node="node.expr" :path="pathNew" />)
    </template>
    <template v-else-if="node.ty === 'ann'">
      <NodeV :node="node.expr" :path="pathNew" />
      <span class="node-sym node-spaced">::</span>
      <NodeV :node="node.ann" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'type'">
      <TypeV :type="node.type" />
    </template>
    <template v-else-if="node.ty === 'typeScheme'">
      <TypeScheme :type-scheme="node.typeScheme" :is-implicit="node.isImplicit" />
    </template>
    <template v-else-if="node.ty === 'sigDecl'">
      <template v-for="id, ix of node.ids">
        <NodeV :node="id" :path="pathNew" />
        <span v-if="ix < node.ids.length - 1" class="node-spaced-right">,</span>
      </template>
      <span class="node-sym node-spaced">::</span>
      <NodeV :node="node.sig" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'fixityDecl'">
      <span class="node-kw node-spaced-right">infix{{ node.fixity.assoc === 'left' ? 'l' : node.fixity.assoc === 'right' ? 'r' : '' }}</span>
      <span class="node-lit node-spaced-right">{{ node.fixity.prec }}</span>
      <template v-for="id, ix of node.ids">
        <NodeV :node="id" :path="pathNew" />
        <span v-if="ix < node.ids.length - 1" class="node-spaced-right">,</span>
      </template>
    </template>
    <template v-else-if="node.ty === 'dataApplyCon'">
      <NodeV :node="node.func" :path="pathNew" />
      <NodeV v-for="param of node.params" :node="param" :path="pathNew" class="node-spaced-left" />
    </template>
    <template v-else-if="node.ty === 'dataInfixCon'">
      <NodeV :node="node.lhs" :path="pathNew" />
      <NodeV :node="node.op" :path="pathNew" class="node-spaced" />
      <NodeV :node="node.rhs" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'dataDef'">
      <span class="node-kw node-spaced-right">data</span>
      <NodeV :node="node.id" :path="pathNew" />
      <NodeV v-for="param of node.params" :node="param" class="node-spaced-left" />
      <span class="node-sym node-spaced">=</span>
      <template v-for="con, ix of node.cons" :key="ix">
        <span v-if="ix > 0" class="node-sym node-spaced">|</span>
        <NodeV :node="con" :path="pathNew" />
      </template>
    </template>
    <template v-else-if="node.ty === 'recordDefField'">
      <NodeV :node="node.key" :path="pathNew" />
      <span class="node-sym node-spaced">::</span>
      <NodeV :node="node.type" :path="pathNew" />
    </template>
    <template v-else-if="node.ty === 'recordDef'">
      <span class="node-kw node-spaced-right">record</span>
      <NodeV :node="node.id" :path="pathNew" />
      <NodeV v-for="param of node.params" :node="param" class="node-spaced-left" />
      <span class="node-sym node-spaced">=</span>
      <span class="node-spaced-right">{</span>
      <template v-for="field, ix of node.fields" :key="ix">
        <NodeV :node="field" :path="pathNew" />
        <span v-if="ix < node.fields.length - 1" class="node-sym node-spaced-right">,</span>
      </template>
      <span class="node-spaced-left">}</span>
    </template>
    <template v-else-if="node.ty === 'importItem'">
      <NodeV :node="node.id" :path="pathNew" />
      <template v-if="node.qid">
        <span class="node-kw node-spaced">as</span>
        <NodeV :node="node.qid" :path="pathNew" />
      </template>
    </template>
    <template v-else-if="node.ty === 'import'">
      <span class="node-kw">import</span>
      <NodeV :node="node.modId" :path="pathNew" class="node-spaced-right" />
      <span v-if="node.isOpen" class="node-kw">open</span>
      <template v-if="node.items">
        <span class="node-spaced-right">{</span>
        <template v-for="item, ix of node.items" :key="ix">
          <NodeV :node="item" :path="pathNew" />
          <span v-if="ix < node.items.length - 1" class="node-spaced-right">,</span>
        </template>
        <span class="node-spaced-left">}</span>
      </template>
      <span :class="node.items ? null : 'node-spaced-left'">
        <template v-if="node.qid">
          <span class="node-kw node-spaced">as</span>
          <NodeV :node="node.qid" :path="pathNew" />
        </template>
      </span>
    </template>
    <template v-else-if="node.ty === 'bindingHost'">
      <div v-for="sigDecl of node.sigDecls">
        <NodeV :node="sigDecl" :path="pathNew" />
      </div>

      <div v-for="fixityDecl of node.fixityDecls">
        <NodeV :node="fixityDecl" :path="pathNew" />
      </div>

      <div v-for="binding of node.bindings">
        <NodeV :node="binding" :path="pathNew" />
      </div>
    </template>
    <template v-else-if="node.ty === 'classDef'">
      <span class="node-kw">class</span>
      <NodeV class="node-spaced-right" :node="node.id" :path="pathNew" />
      <NodeV :node="node.param" class="node-spaced-right" />
      <template v-if="! isBrief">
        <span class="node-kw node-spaced-right">where</span>
        <NodeV :node="node.bindingHost" :path="pathNew" class="node-block" />
      </template>
    </template>
    <template v-else-if="node.ty === 'instanceDef'">
      <span class="node-kw">instance</span>
      <NodeV class="node-spaced-right" :node="node.classId" :path="pathNew" />
      <NodeV :node="node.arg" />
      <template v-if="! isBrief">
        <span class="node-kw node-spaced">where</span>
        <NodeV :node="node.bindingHost" :path="pathNew" class="node-block" />
      </template>
    </template>
    <template v-else-if="node.ty === 'mod'">
      <div v-for="import_ of node.imports">
        <NodeV :node="import_" :path="pathNew" />
      </div>

      <div v-for="dataDef of node.dataDefs">
        <NodeV :node="dataDef" :path="pathNew" />
      </div>

      <div v-for="recordDef of node.recordDefs">
        <NodeV :node="recordDef" :path="pathNew" />
      </div>

      <div v-for="classDef of node.classDefs">
        <NodeV :node="classDef" :path="pathNew" />
      </div>

      <div v-for="instanceDef of node.instanceDefs">
        <NodeV :node="instanceDef" :path="pathNew" />
      </div>

      <NodeV :node="node.bindingHost" :path="pathNew" />
    </template>
  </span>
</template>

<style>
.node.hovering {
  background-color: dimgrey;
}

.node.selected {
  outline: 1px solid lightblue;
}

.node {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  font-family: monospace;
  color: lightgrey;
}

.node-host > * + * {
  margin-top: 1ch;
}

.node-host:not(.node-root) {
  margin-bottom: 1ch;
}

.node-indent {
  margin-left: 2ch;
}

.node-inline-block {
  margin-left: 2ch;
}

.node-block {
  display: block;
  margin-left: 2ch;
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

.node-paren::before {
  content: '(';
}

.node-paren::after {
  content: ')';
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

.node-special {
  color: #ddc3f7;
}
</style>
