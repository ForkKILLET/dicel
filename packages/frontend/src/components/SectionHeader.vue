<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="header">
    <u class="node-spaced-right">{{ title }}:</u>
    <slot></slot>
  </div>
</template>
