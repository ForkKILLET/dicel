<script setup lang="ts">
import type { TypeSourced } from '@dicel/core'
import Type from '@comp/TypeV.vue'
import TypeSourceV from '@comp/TypeSourceV.vue'

defineProps<{
  type: TypeSourced
}>()
</script>

<template>
  <span>
    type <Type :type="type" /> of <TypeSourceV :source="type.source" />
  </span>
</template>
