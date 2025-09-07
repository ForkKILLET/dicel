<script setup lang="ts">
import type { TypeSourced } from '@dicel/core'
import Type from './Type.vue'
import TypeSource from './TypeSource.vue'

defineProps<{
  type: TypeSourced
}>()
</script>

<template>
  <span>
    type <Type :type="type" /> of <TypeSource :source="type.source" />
  </span>
</template>