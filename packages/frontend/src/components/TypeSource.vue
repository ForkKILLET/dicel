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
    application <NodeV :node="source.funcNode" />
  </template>
  <template v-else-if="source.type === 'actual.Pattern'">
    pattern <NodeV :node="source.pattern" />
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
    the inferred return type of function <NodeV :node="source.funcNode" />
  </template>
  <template v-else-if="source.type === 'infer.Binding.var'">
    the inferred type of variable <NodeV :node="{ type: 'var', id: source.varId }" /> in binding <NodeV :node="source.bindingNode" />
  </template>
  <template v-else-if="source.type === 'infer.Binding.val'">
    the inferred type of expression <NodeV :node="source.valExpr" />
    in binding <NodeV :node="source.bindingNode" />
  </template>
  <template v-else-if="source.type === 'infer.Case'">
    the inferred type of case expression <NodeV :node="source.caseExpr" />
  </template>
  <template v-else-if="source.type === 'infer.Lambda.param'">
    the inferred type of lambda parameter <NodeV :node="source.lambdaExpr" />
  </template>
  <template v-else-if="source.type === 'ann.Ann'">
    the annotated type in expression <NodeV :node="source.annExpr" />
  </template>
  <template v-else-if="source.type === 'ann.Decl'">
    the annotated type in declaration <NodeV :node="source.declNode" />
  </template>
  <template v-else-if="source.type === 'elim.Apply.arg'">
    the argument of <TypeSource :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'elim.Apply.func'">
    the function of <TypeSource :source="source.from.source" />
  </template>
</template>