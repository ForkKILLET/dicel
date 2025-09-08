<script setup lang="ts">
import type { Value, ValueTag } from '@dicel/core'

defineProps<{
  val: Value
  withParen?: boolean
}>()

const is = (val: Value, tags: ValueTag[]): boolean => tags.includes(val.tag)
</script>

<template>
  <div class="value">
    <template v-if="withParen">(</template>
    <span v-if="val.tag === 'num'">
      <span class="value-atom">{{ val.val }}</span>
    </span>
    <span v-else-if="val.tag === 'bool'">
      <span class="value-con">{{ val.val ? 'True' : 'False' }}</span>
    </span>
    <span v-else-if="val.tag === 'func'">
      <span class="value-special">[Func]</span>
    </span>
    <span v-else-if="val.tag === 'con'">
      <span class="value-con">{{ val.id }}</span>
      <Value
        v-for="arg, i of val.args"
        :key="i"
        class="value-con-arg"
        :val="arg"
        :with-paren="is(arg, ['con'])"
      />
    </span>
    <span v-else-if="val.tag === 'unit'">
      <span class="value-con">()</span>
    </span>
    <template v-if="withParen">)</template>
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

.value-con {
  color: ivory;
}

.value-con-arg {
  margin-left: 1ch;
}

.value + .value {
  margin-left: 1ch;
}
</style>