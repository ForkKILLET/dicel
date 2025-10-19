<script setup lang="ts">
import type { Pipeline } from '@dicel/core'

defineProps<{
  err: Pipeline.ParseErr['err']
}>()
</script>

<template>
  <div class="err section">
    <div class="badge">parse</div>
    Parse Error:
    <template v-if="err === null">
      Unknown Error
    </template>
    <template v-else>
      {{ err.type }}
    </template>
  </div>
</template>
