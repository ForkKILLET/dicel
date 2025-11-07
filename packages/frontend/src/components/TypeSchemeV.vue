<script setup lang="ts">
import { type TypeScheme } from '@dicel/core'
import TypeV from './TypeV.vue'
import { computed, provide } from 'vue'
import { kTypeSchemeImplicit } from '@util/inject'

const props = defineProps<{
  typeScheme: TypeScheme
  isImplicit?: boolean
}>()

provide(kTypeSchemeImplicit, computed(() => props.isImplicit))
</script>

<template>
  <div class="type-scheme">
    <TypeV :type="{ ty: 'forall', ...typeScheme }" :parent="null" />
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
