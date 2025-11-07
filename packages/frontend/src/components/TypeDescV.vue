<script setup lang="ts">
import { Type } from '@dicel/core'
import { kTypeSchemeImplicit, kTypeShowPrettyIds } from '@util/inject'

import { computed, inject, ref } from 'vue'
import ConstrsV from './ConstrsV.vue'

const props = defineProps<{
  type: Type.Desc
  parent: Type.Desc | null
}>()

const paren = computed(() => Type.checkParen(props.type, props.parent))

const showPrettyIds = inject(kTypeShowPrettyIds) ?? ref(true)

const isImplicit = inject(kTypeSchemeImplicit) ?? ref(false)
</script>

<template>
  <span class="type" :class="{ 'node-paren': paren }" :data-ty="type.ty">
    <template v-if="type.ty === 'var'">
      <span
        :class="['type-var', 'node-special', { rigid: type.rigid }]"
      >{{ type.rigid && showPrettyIds ? type.customId : type.id }}</span>
    </template>
    <template v-else-if="type.ty === 'con'">
      <span v-if="type.id === '[]'">[]</span>
      <span v-else class="node-con">{{ type.id }}</span>
    </template>
    <template v-else-if="type.ty === 'tuple'">
      (<template v-for="arg, ix of type.args" :key="ix">
        <TypeDescV :type="arg" :parent="type" />
        <span v-if="ix + 1 < type.args.length" class="node-spaced-right">,</span>
      </template>)
    </template>
    <template v-else-if="type.ty === 'list'">
      [<TypeDescV :type="type.arg" :parent="type" />]
    </template>
    <template v-else-if="type.ty === 'func'">
      <template v-for="arg, ix of type.args" :key="ix">
        <TypeDescV :type="arg" :parent="type" />
        <span v-if="ix + 1 < type.args.length" class="node-op node-spaced">-&gt;</span>
      </template>
    </template>
    <template v-else-if="type.ty === 'apply'">
      <template v-for="arg, ix of type.args" :key="ix">
        <TypeDescV :type="arg" :parent="type" />
        <span v-if="ix + 1 < type.args.length">&nbsp;</span>
      </template>
    </template>
    <template v-else-if="type.ty === 'forall'">
      <span v-if="! isImplicit && type.boundVarSet.size">
        <span class="node-sym">∀</span>
        <TypeDescV
          v-for="param, i of type.boundVarSet"
          :key="param.id"
          :type="param"
          :parent="null"
          :class="{ 'node-spaced-left': i > 0 }"
        />
        <span class="node-sym node-spaced-right">.</span>
      </span>

      <span v-if="type.constrs.length">
        <ConstrsV :constrs="type.constrs" />
        <span class="node-sym node-spaced">=&gt;</span>
      </span>

      <TypeDescV :type="type.type" :parent="type" />
    </template>
  </span>
</template>

<style>
.type {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  font-family: monospace;
  color: lightgrey;
}

.type-var.rigid {
  text-decoration: dotted underline;
}
</style>
