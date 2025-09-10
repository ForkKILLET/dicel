<script setup lang="ts">
import { typeNeedsParen, type TypeDesc } from '@dicel/core'
import { computed } from 'vue'

const props = defineProps<{
  type: TypeDesc
  parent: TypeDesc | null
}>()

const paren = computed(() => typeNeedsParen(props.type, props.parent))
</script>

<template>
  <span class="type">
    <template v-if="paren">(</template>
    <template v-if="type.sub === 'var'">
      <span class="type-var">{{ type.id }}</span>
    </template>
    <template v-else-if="type.sub === 'con'">
      <span class="type-con">{{ type.id }}</span>
    </template>
    <template v-else-if="type.sub === 'tuple'">
      (<template v-for="arg, i of type.args" :key="i">
        <TypeDesc :type="arg" :parent="type" />
        <span v-if="i + 1 < type.args.length">,&nbsp;</span>
      </template>)
    </template>
    <template v-else-if="type.sub === 'func'">
      <template v-for="arg, i of type.args" :key="i">
        <TypeDesc :type="arg" :parent="type" />
        <span v-if="i + 1 < type.args.length">&nbsp;-&gt;&nbsp;</span>
      </template>
    </template>
    <template v-else-if="type.sub === 'apply'">
      <template v-for="arg, i of type.args" :key="i">
        <TypeDesc :type="arg" :parent="type" />
        <span v-if="i + 1 < type.args.length">&nbsp;</span>
      </template>
    </template>
    <template v-if="paren">)</template>
  </span>
</template>

<style>
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
}</style>