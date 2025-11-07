<script setup lang="ts">
import { Kind } from '@dicel/core'

import { computed } from 'vue'

const props = withDefaults(defineProps<{
  kind: Kind
  parent?: Kind | null
}>(), {
  parent: null,
})

const withParen = computed(() => Kind.checkParen(props.kind, props.parent))
</script>

<template>
  <span class="kind" :class="{ 'node-paren': withParen }" :data-ty="kind.ty">
    <template v-if="kind.ty === 'var'">
      <span class="node-var">{{ kind.id }}</span>
    </template>
    <template v-else-if="kind.ty === 'type'">
      <span class="node-con">*</span>
    </template>
    <template v-else-if="kind.ty === 'constr'">
      <span class="node-con">Constraint</span>
    </template>
    <template v-else-if="kind.ty === 'func'">
      <KindV :kind="kind.param" :parent="kind" />
      <span class="node-op node-spaced">-&gt;</span>
      <KindV :kind="kind.ret" :parent="kind" />
    </template>
  </span>
</template>

