<script setup lang="ts">
import { Fixity, type Pipeline } from '@dicel/core'
import NodeV from '../NodeV.vue'

defineProps<{
  err: Pipeline.DesugarErr['err']
}>()
</script>

<template>
  <div class="desugar err section">
    <div class="badge">desugar</div>
    Desugar Error:
    <template v-if="err.type === 'fixity'">
      Cannot mix <NodeV :node="{ type: 'var', id: err.lOp }" /> [{{ Fixity.show(err.lFixity) }}]
      and <NodeV :node="{ type: 'var', id: err.rOp }" /> [{{ Fixity.show(err.rFixity) }}]
      in the same infix expression
    </template>
    <template v-else-if="err.type === 'section'">
      Arbitrary section expression <NodeV :node="err.expr" />
    </template>
  </div>
</template>