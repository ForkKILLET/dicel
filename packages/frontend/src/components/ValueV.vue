<script setup lang="ts">
import { Value } from '@dicel/core'
import ValueDesc from './ValueDesc.vue'

defineProps<{
  value: Value
}>()
</script>

<template>
  <ValueDesc :value="Value.describe(value)" :parent="null" />
</template>