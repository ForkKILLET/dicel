<script setup lang="ts">
import { describeType, type Type } from '@dicel/core'
import TypeDescV from './TypeDesc.vue'

defineProps<{
  type: Type
}>()
</script>

<template>
  <TypeDescV :type="describeType(type)" :parent="null" />
</template>
