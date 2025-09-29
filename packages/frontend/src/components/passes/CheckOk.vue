<script setup lang="ts">
import { isSymbolOrComma, type Pipeline } from '@dicel/core'
import TypeSchemeV from '../TypeScheme.vue'

defineProps<{
  result: Pipeline.CheckOutput
}>()
</script>

<template>
  <div class="check ok section">
    <div class="badge">check</div>
      Types:
    <div v-for="typeScheme, id in result.typeEnv" :key="id">
      <span class="node-var">{{isSymbolOrComma(id) ? `(${id})` : id}}</span> :: <TypeSchemeV :type-scheme="typeScheme" />
    </div>
  </div>
</template>