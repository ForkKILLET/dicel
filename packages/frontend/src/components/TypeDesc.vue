<script setup lang="ts">
import { Type, type TypeDesc } from '@dicel/core'
import { computed } from 'vue'

const props = defineProps<{
  type: TypeDesc
  parent: TypeDesc | null
}>()

const paren = computed(() => Type.needsParen(props.type, props.parent))
</script>

<template>
  <span class="type" :data-sub="type.sub">
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
    <template v-else-if="type.sub === 'list'">
      [<TypeDesc :type="type.arg" :parent="type" />]
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
}
</style>
