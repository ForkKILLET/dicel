<script setup lang="ts">
import type { TypeSource } from '@dicel/core'
import Node from './Node.vue'

defineProps<{
  source: TypeSource
}>()
</script>

<template>
  <template v-if="source.type === 'actual'">
    expression <Node :node="source.expr" />
  </template>
  <template v-else-if="source.type === 'actual.Func'">
    application <Node :node="source.expr" />
  </template>
  <template v-else-if="source.type === 'elim.Func.param'">
    the {{ source.from.source.type === 'actual.Func' ? 'argument' : 'parameter' }}
    of <TypeSource :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'elim.Func.ret'">
    the return type of <TypeSource :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'expect.Cond'">
    the expected type of the condition of <Node :node="source.condExpr" />
  </template>
  <template v-else-if="source.type === 'infer.Func.ret'">
    the inferred return type of function expression <Node :node="source.funcExpr" />
  </template>
  <template v-else-if="source.type === 'infer.Let.val'">
    the inferred value type of expression <Node :node="source.valExpr" />
    in let expression <Node :node="source.letExpr" />
  </template>
</template>