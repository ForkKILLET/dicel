<script setup lang="ts">
import { ApplyType, ConType, type Constr } from '@dicel/core'

import TypeV from '@comp/TypeV.vue'

defineProps<{
  constr: Constr
}>()
</script>

<template>
  <TypeV class="constr" :type="ApplyType(ConType(constr.classId), constr.arg)" />
</template>
