<script setup lang="ts">
import type { Pipeline } from '@dicel/core'
import TypeSourced from '../TypeSourced.vue'

defineProps<{
  err: Pipeline.CheckErr['err']
}>()
</script>

<template>
  <div class="check err section">
    <div class="badge">check</div>
    Check Error:
    <div>
      <template v-if="err.type === 'UnifyErr'">
        Cannot unify
          <div class="check-err-block"><TypeSourced :type="err.err.lhs" /></div>
        with
          <div class="check-err-block"><TypeSourced :type="err.err.rhs" /></div>
        because {{
          err.err.type === 'Recursion' ? 'of recursion' :
          err.err.type === 'DiffSub' ? 'they are of different shapes' :
          err.err.type === 'DiffCon' ? 'they are different constructors' :
          err.err.type === 'RigidVar' ? `the variable '${err.err.var}' is rigid` :
          'of unknown reasons'
        }}.
      </template>
      <template v-else-if="err.type === 'UndefinedVar'">
        Undefined variable '{{ err.id }}'.
      </template>
      <template v-else-if="err.type === 'PatternErr'">
        Illegal pattern {{ err.err.type }}
      </template>
      <template v-else-if="err.type === 'NoMain'">
        Undefined variable 'main'.
      </template>
    </div>
  </div>
</template>

<style>
.check-err-block {
  margin-left: 2ch;
}
</style>