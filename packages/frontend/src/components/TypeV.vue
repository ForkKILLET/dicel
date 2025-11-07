<script setup lang="ts">
import { Type } from '@dicel/core'

import { computed } from 'vue'
import TypeDescV from '@comp/TypeDescV.vue'

const props = defineProps<{
  type: Type
  hasParent?: boolean
}>()

const typeDesc = computed(() => Type.describe(props.type))
const parentDesc = computed<Type.Desc | null>(() => props.hasParent
  ? { ty: 'dummy', inner: typeDesc.value }
  : null
)
</script>

<template>
  <TypeDescV :type="typeDesc" :parent="parentDesc" />
</template>
