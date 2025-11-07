<script setup lang="ts">
import { showStr, type TypedValue } from '@dicel/core'
import SymRef from '@comp/SymRef.vue'

defineProps<{
  desc: TypedValue.Desc
}>()
</script>

<template>
  <span class="node-value">
    <span v-if="desc.ty === 'num'" class="node-lit">{{ desc.val }}</span>
    <span v-else-if="desc.ty === 'char'" class="node-lit">{{ showStr(desc.val, '\'') }}</span>
    <span v-else-if="desc.ty === 'str'" class="node-lit">{{ showStr(desc.val, '"') }}</span>
    <span v-else-if="desc.ty === 'func'" class="node-special">Func</span>
    <span v-else-if="desc.ty === 'list'">
      <span>[</span>
        <template v-for="elem, ix of desc.elems" :key="ix" :desc="elem">
          <TypedValueDesc :desc="elem" />
          <span v-if="ix < desc.elems.length - 1">, </span>
        </template>
      <span>]</span>
    </span>
    <span v-else-if="desc.ty === 'tuple'">
      <span>(</span>
        <template v-for="elem, ix of desc.elems" :key="ix" :desc="elem">
          <TypedValueDesc :desc="elem" />
          <span v-if="ix < desc.elems.length - 1">, </span>
        </template>
      <span>)</span>
    </span>
    <span v-else-if="desc.ty === 'data'">
      <SymRef :sym-id="desc.con" />
      <TypedValueDesc v-for="arg of desc.args" :desc="arg" class="node-spaced-left" />
    </span>
    <span v-else-if="desc.ty === 'record'">
      <SymRef :sym-id="desc.con" />
      <span class="node-spaced">{</span>
        <template v-for="field, ix of desc.fields" :key="ix" :desc="field">
          <TypedValueDesc :desc="field" />
          <span v-if="ix < desc.fields.length - 1">, </span>
        </template>
      <span class="node-spaced-left">}</span>
    </span>
  </span>
</template>
