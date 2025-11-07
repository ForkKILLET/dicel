<script setup lang="ts">
defineProps<{
  reversed?: boolean
}>()

const model = defineModel<boolean>()
</script>

<template>
  <button @click="model = ! model">{{ model === reversed ? '+' : '-' }}<slot></slot></button>
</template>
