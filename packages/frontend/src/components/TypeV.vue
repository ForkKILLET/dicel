<script setup lang="ts">
import { Type } from '@dicel/core'
import TypeDescV from './TypeDesc.vue'

defineProps<{
  type: Type
}>()
</script>

<template>
  <TypeDescV :type="Type.describe(type)" :parent="null" />
</template>
