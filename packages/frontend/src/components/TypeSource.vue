<script setup lang="ts">
import type { TypeSource } from '@dicel/core'
import NodeV from './NodeV.vue'

defineProps<{
  source: TypeSource
}>()
</script>

<template>
  <template v-if="source.type === 'actual'">
    expression <NodeV :node="source.expr" />
  </template>
  <template v-else-if="source.type === 'actual.Func'">
    application <NodeV :node="source.expr" />
  </template>
  <template v-else-if="source.type === 'elim.Func.param'">
    the {{ source.from.source.type === 'actual.Func' ? 'argument' : 'parameter' }}
    of <TypeSource :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'elim.Func.ret'">
    the return type of <TypeSource :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'expect.Cond'">
    the expected type of the condition of <NodeV :node="source.condExpr" />
  </template>
  <template v-else-if="source.type === 'infer.Func.ret'">
    the inferred return type of function expression <NodeV :node="source.funcExpr" />
  </template>
  <template v-else-if="source.type === 'infer.Let.val'">
    the inferred value type of expression <NodeV :node="source.valExpr" />
    in let expression <NodeV :node="source.letExpr" />
  </template>
  <template v-else-if="source.type === 'actual.Pattern'">
    pattern <NodeV :node="source.pattern" />
  </template>
  <template v-else-if="source.type === 'elim.Apply.arg'">
    the argument of <TypeSource :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'elim.Apply.func'">
    the function of <TypeSource :source="source.from.source" />
  </template>
</template>