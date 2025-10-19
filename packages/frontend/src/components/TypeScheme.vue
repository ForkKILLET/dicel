<script setup lang="ts">
import { ApplyType, ConType, type TypeScheme } from '@dicel/core'
import Type from './TypeV.vue'
import TypeV from './TypeV.vue'

defineProps<{
  typeScheme: TypeScheme
}>()
</script>

<template>
  <div class="type-scheme">
    <span v-if="typeScheme.boundVarSet.size">
      <span class="node-sym">∀</span>
      <Type
        v-for="param, i of typeScheme.boundVarSet"
        :key="param.id"
        :type="param"
        :class="{ 'node-spaced-left': i > 0 }"
      />
      <span class="node-sym node-spaced-right">.</span>
    </span>

    <span v-if="typeScheme.constrs.length">
      <template v-if="typeScheme.constrs.length > 1">(</template>
      <span
        v-for="constr, i of typeScheme.constrs"
        :key="i"
      >
        <TypeV :type="ApplyType(ConType(constr.classId), constr.arg)" />
        <span v-if="i < typeScheme.constrs.length - 1" class="node-spaced-right">,</span>
      </span>
      <template v-if="typeScheme.constrs.length > 1">)</template>
      <span class="node-sym node-spaced">=&gt;</span>
    </span>

    <Type :type="typeScheme.type" />
  </div>
</template>

<style scoped>
.type-scheme {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  font-family: monospace;
  color: lightgrey;
}
</style>
