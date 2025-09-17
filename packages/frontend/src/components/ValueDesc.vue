
<script setup lang="ts">
import { Value, type ValueDesc } from '@dicel/core'
import { computed } from 'vue'

const props = defineProps<{
  value: ValueDesc
  parent: ValueDesc | null
}>()

const withParen = computed(() => Value.needsParen(props.value, props.parent))
</script>

<template>
  <div class="value">
    <template v-if="withParen">(</template>
    <span v-if="value.tag === 'num'">
      <span class="value-num">{{ value.val }}</span>
    </span>
    <span v-else-if="value.tag === 'func'">
      <span class="value-special">Func</span>
    </span>
    <span v-else-if="value.tag === 'con'" class="value-apply">
      <span class="value-con">{{ value.id }}</span>
      <template v-for="arg, i of value.args" :key="i">
        &nbsp;<ValueDesc :value="arg" :parent="value" />
      </template>
    </span>
    <span v-else-if="value.tag === 'list'">
      [<template v-for="(val, i) of value.vals" :key="i">
        <ValueDesc :value="val" :parent="value" />
        <span v-if="i + 1 < value.vals.length">,&nbsp;</span>
      </template>]
    </span>
    <span v-else-if="value.tag === 'tuple'">
      (<template v-for="arg, i of value.vals" :key="i">
        <ValueDesc :value="arg" :parent="value" />
        <span v-if="i + 1 < value.vals.length">,&nbsp;</span>
      </template>)
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