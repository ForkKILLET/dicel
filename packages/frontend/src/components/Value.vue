<script setup lang="ts">
import { Dice } from '@dicel/core'

defineProps<{
  value: any
}>()
</script>

<template>
  <div class="value">
    <span v-if="typeof value === 'number'">
      <span class="value-atom">{{ value }}</span>
    </span>
    <span v-else-if="typeof value === 'boolean'">
      <span class="value-atom">{{ value ? 'True' : 'False' }}</span>
    </span>
    <span v-else-if="typeof value === 'function'">
      <span class="value-special">[Function]</span>
    </span>
    <span v-else-if="(value instanceof Dice)">
      <span class="value-special">[Dice]</span>
    </span>
  </div>
</template>

<style scoped>
.value {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  font-family: monospace;
}

.value-atom {
  color: lightgreen;
}

.value-special {
  color: lightblue;
}
</style>