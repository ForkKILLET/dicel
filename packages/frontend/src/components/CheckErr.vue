<script setup lang="ts">
import type { CheckMod } from '@dicel/core'
import TypeSourced from './TypeSourced.vue'

defineProps<{
  err: CheckMod.Err
}>()
</script>

<template>
  <div class="check-err-block">
    <template v-if="err.type === 'UnifyErr'">
      Cannot unify
        <div class="check-err-block"><TypeSourced :type="err.err.lhs" /></div>
      with
        <div class="check-err-block"><TypeSourced :type="err.err.rhs" /></div>
      because {{
        err.err.type === 'Recursion' ? 'of recursion' :
        err.err.type === 'DiffSub' ? 'they are of different kinds' :
        err.err.type === 'DiffCon' ? 'they are different constructors' :
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
</template>

<style scoped>
.check-err-block {
  margin-left: 2ch;
}
</style>