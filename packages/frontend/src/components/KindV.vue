<script setup lang="ts">
import { Kind } from '@dicel/core'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  kind: Kind
  parent?: Kind | null
}>(), {
  parent: null,
})

const withParen = computed(() => Kind.needsParen(props.kind, props.parent))
</script>

<template>
  <span class="kind" :data-sub="kind.sub">
    <template v-if="withParen">(</template>
    <template v-if="kind.sub === 'var'">
      <span class="node-var">{{ kind.id }}</span>
    </template>
    <template v-else-if="kind.sub === 'type'">
      <span class="node-con">*</span>
    </template>
    <template v-else-if="kind.sub === 'func'">
      <KindV :kind="kind.param" :parent="kind" />
      <span class="node-op node-spaced">-&gt;</span>
      <KindV :kind="kind.ret" :parent="kind" />
    </template>
    <template v-if="withParen">)</template>
  </span>
</template>

