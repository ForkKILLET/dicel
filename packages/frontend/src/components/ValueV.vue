<script setup lang="ts">
import type { Value } from '@dicel/core'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: Value
  parent?: Value | null
}>(), {
  parent: null,
})

const withParen = computed(() => props.parent !== null && (
  props.parent.tag === 'con' && props.value.tag === 'con' && props.value.args.length > 0
))
</script>

<template>
  <div class="value">
    <template v-if="withParen">(</template>
    <span v-if="value.tag === 'num'">
      <span class="value-num">{{ value.val }}</span>
    </span>
    <span v-else-if="value.tag === 'func'">
      <span class="value-special">[Func]</span>
    </span>
    <span v-else-if="value.tag === 'con'">
      <template v-if="value.id === ','">
        (<template v-for="arg, i of value.args" :key="i">
          <ValueV :value="arg" :parent="value" />
          <span v-if="i + 1 < value.args.length">,&nbsp;</span>
        </template>)
      </template>
      <span v-else class="value-apply">
        <span class="value-con">{{ value.id }}</span>
        <template v-for="arg, i of value.args" :key="i">
          &nbsp;<ValueV :value="arg" :parent="value" />
        </template>
      </span>
    </span>
    <span v-else-if="value.tag === 'unit'"></span>
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

.value-num {
  color: lightgreen;
}

.value-special {
  color: lightblue;
}

.value-apply {
  display: inline-flex;
}

.value-con {
  color: ivory;
}
</style>