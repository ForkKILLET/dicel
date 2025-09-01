<script setup lang="ts">
import type { Type } from '@dicel/core'

withDefaults(defineProps<{
  type: Type
  withParen?: boolean
}>(), {
  withParen: false
})
</script>

<template>
  <div class="type">
    <template v-if="withParen">(</template>
    <span v-if="type.sub === 'var'">
      <span class="type-var">{{ type.id }}</span>
    </span>
    <span v-else-if="type.sub === 'con'">
      <span class="type-con">{{ type.id }}</span>
    </span>
    <span v-else-if="type.sub === 'dice'">
      <span class="type-con">Dice</span>
      <span class="type-spaced"></span>
      <Type :type="type.inner" />
    </span>
    <span v-else-if="type.sub === 'func'">
      <Type :type="type.param" :with-paren="type.param.sub === 'func'" />
      <span class="type-op type-spaced">-&gt;</span>
      <Type :type="type.ret" />
    </span>
    <template v-if="withParen">)</template>
  </div>
</template>

<style scoped>
.type {
  display: inline-block;
  text-align: left;
  vertical-align: top;
  font-family: monospace;
  color: lightgrey;
}

.type-op {
  color: lightcoral;
}

.type-con {
  color: lightgreen;
}

.type-var {
  color: ivory;
}

.type-spaced {
  margin-left: 1ch;
}

.type-spaced:not(:empty) {
  margin-right: 1ch;
}
</style>