<script setup lang="ts">
import { Type, type TypeDesc } from '@dicel/core'
import TypeDescV from './TypeDesc.vue'
import { computed } from 'vue'

const props = defineProps<{
  type: Type
  hasParent?: boolean
}>()

const typeDesc = computed(() => Type.describe(props.type))
const parentDesc = computed<TypeDesc | null>(() => props.hasParent
  ? { sub: 'dummy', inner: typeDesc.value }
  : null
)
</script>

<template>
  <TypeDescV :type="typeDesc" :parent="parentDesc" />
</template>
