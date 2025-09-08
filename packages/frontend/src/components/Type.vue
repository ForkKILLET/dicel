<script setup lang="ts">
import type { Type, TypeSub } from '@dicel/core'

withDefaults(defineProps<{
  type: Type
  withParen?: boolean
}>(), {
  withParen: false
})

const is = (type: Type, subs: TypeSub[]): boolean => subs.includes(type.sub)
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
    <span v-else-if="type.sub === 'func'">
      <Type :type="type.param" :with-paren="is(type.param, ['func'])" />
      <span class="type-op type-spaced">-&gt;</span>
      <Type :type="type.ret" />
    </span>
    <span v-else-if="type.sub === 'apply'">
      <Type :type="type.func" :with-paren="is(type.func, ['func'])" />
      <span class="type-spaced"> </span>
      <Type :type="type.arg" :with-paren="is(type.arg, ['func', 'apply'])" />
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