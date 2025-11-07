<script setup lang="ts">
import { Type, TypedValue, Value } from '@dicel/core'
import { kModOutputs } from '@util/inject'
import { computed, inject } from 'vue'
import TypedValueDesc from './TypedValueDesc.vue'

const props = defineProps<{
  value: Value
  type: Type
}>()

inject(kModOutputs)

const desc = computed(() => TypedValue.describe(props))
</script>

<template>
  <TypedValueDesc :desc="desc" />
</template>
