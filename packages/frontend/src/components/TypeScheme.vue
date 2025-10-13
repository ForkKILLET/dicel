<script setup lang="ts">
import { type TypeScheme } from '@dicel/core'
import Type from './TypeV.vue'

defineProps<{
  typeScheme: TypeScheme
}>()
</script>

<template>
  <div class="type-scheme">
    <span v-if="typeScheme.typeParamSet.size">
      <span class="node-sym">∀</span>
      <Type
        v-for="param, i of typeScheme.typeParamSet"
        :key="param.id"
        :type="param"
        :class="{ 'node-spaced-left': i > 0 }"
      />
      <span class="node-sym node-spaced-right">.</span>
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
