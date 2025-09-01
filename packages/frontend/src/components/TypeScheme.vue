<script setup lang="ts">
import { type TypeScheme } from '@dicel/core'
import Type from './Type.vue'

defineProps<{
  typeScheme: TypeScheme
}>()
</script>

<template>
  <div class="type-scheme">
    <span v-if="typeScheme.typeParams.size">
      <span class="type-scheme-op">forall</span>
      <span class="type-var" v-for="id of typeScheme.typeParams" :key="id">{{ id }}</span>
      <span class="type-scheme-op">.</span>
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
  margin-right: 1ch;
}

.type-var + .type-var {
  margin-left: 1ch;
}
</style>