<script setup lang="ts">
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
    <span v-else-if="value === null">
      <span class="value-atom">()</span>
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