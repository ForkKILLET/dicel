<script setup lang="ts">
import { ApplyType, ConType, TypeScheme, type Pipeline } from '@dicel/core'

import { ref } from 'vue'
import TypeSchemeV from '../TypeScheme.vue'
import NodeV from '../NodeV.vue'
import TypeV from '../TypeV.vue'

defineProps<{
  result: Pipeline.CheckOutput
}>()

const showAll = ref(false)
</script>

<template>
  <div class="super-section">
    <div class="ok section">
      <div class="badge">check</div>
      <div class="section-head">
        Types: <button @click="showAll = ! showAll">{{ showAll ? 'all' : 'user' }}</button>
      </div>
      <template v-for="typeScheme, id in result.typeEnv" :key="id">
        <div v-if="showAll || result.modRes.idSet.has(id)">
          <NodeV :node="{ type: 'var', id }" />
          <span class="node-sym node-spaced">::</span>
          <TypeSchemeV :type-scheme="TypeScheme.prettify(typeScheme)" />
        </div>
      </template>
    </div>

    <div class="ok section">
      <div class="section-head">Constraints:</div>

      <div v-for="constr of result.inferState.constrs">
        <TypeV :type="ApplyType(ConType(constr.classId), constr.arg)" />
      </div>
    </div>
  </div>
</template>
