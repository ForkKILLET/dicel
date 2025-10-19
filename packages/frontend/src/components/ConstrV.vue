<script setup lang="ts">
import { ApplyType, ConType, type Constr } from '@dicel/core'
import TypeV from './TypeV.vue'

defineProps<{
  constr: Constr
}>()
</script>

<template>
  <TypeV :type="ApplyType(ConType(constr.classId), constr.arg)" />
</template>
