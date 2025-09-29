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
      <span class="type-scheme-op">∀</span>
      <span
        v-for="id, i of typeScheme.typeParamSet"
        :key="id"
        class="type-var"
        :class="{ 'node-spaced-left': i > 0 }"
      >{{ id }}</span>
      <span class="type-scheme-op node-spaced-right">.</span>
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

.type-var {
  color: ivory;
}

.type-scheme-op {
  color: lightcoral;
}
</style>