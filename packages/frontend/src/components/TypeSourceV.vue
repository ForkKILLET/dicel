<script setup lang="ts">
import { type TypeSource } from '@dicel/core'
import NodeRef from '@comp/NodeRef.vue'

defineProps<{
  source: TypeSource
}>()
</script>

<template>
  <template v-if="source.type === 'actual'">
    expression <NodeRef :ast-id="source.expr" />
  </template>
  <template v-else-if="source.type === 'actual.func'">
    application <NodeRef :ast-id="source.funcNode" />
  </template>
  <template v-else-if="source.type === 'actual.pat'">
    pattern <NodeRef :ast-id="source.pat" />
  </template>
  <template v-else-if="source.type === 'actual.record'">
    record expression <NodeRef :ast-id="source.recordExpr" />
  </template>
  <template v-else-if="source.type === 'elim.func.param'">
    the {{ source.from.source.type === 'actual.func' ? 'argument' : 'parameter' }}
    of <TypeSourceV :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'elim.func.ret'">
    the return type of <TypeSourceV :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'expect.cond'">
    the expected type of the condition of <NodeRef :ast-id="source.condExpr" />
  </template>
  <template v-else-if="source.type === 'expect.record.field'">
    field <NodeRef :ast-id="source.fieldKey" /> of record <NodeRef :ast-id="source.recordDef" />
  </template>
  <template v-else-if="source.type === 'expect.class.member'">
    class member <NodeRef :ast-id="source.sigDecl" />
  </template>
  <template v-else-if="source.type === 'infer.func.ret'">
    the inferred return type of function <NodeRef :ast-id="source.funcNode" />
  </template>
  <template v-else-if="source.type === 'infer.binding.var'">
    the inferred type of variable <NodeRef :ast-id="source.varPat" />
    in binding <NodeRef :ast-id="source.bindingNode" />
  </template>
  <template v-else-if="source.type === 'infer.binding.val'">
    the inferred type of expression <NodeRef :ast-id="source.valExpr" />
    in binding <NodeRef :ast-id="source.bindingNode" />
  </template>
  <template v-else-if="source.type === 'infer.case'">
    the inferred type of case expression <NodeRef :ast-id="source.caseExpr" />
  </template>
  <template v-else-if="source.type === 'infer.lambda.param'">
    the inferred type of lambda parameter <NodeRef :ast-id="source.lambdaExpr" />
  </template>
  <template v-else-if="source.type === 'ann.ann'">
    the annotated type in expression <NodeRef :ast-id="source.annExpr" />
  </template>
  <template v-else-if="source.type === 'ann.decl'">
    the annotated type in declaration <NodeRef :ast-id="source.sigDecl" />
  </template>
  <template v-else-if="source.type === 'elim.apply.arg'">
    the argument of <TypeSourceV :source="source.from.source" />
  </template>
  <template v-else-if="source.type === 'elim.apply.func'">
    the function of <TypeSourceV :source="source.from.source" />
  </template>
</template>
