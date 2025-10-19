<script setup lang="ts">
import type { Pipeline } from '@dicel/core'
import TypeSourced from '../TypeSourced.vue'
import ConstrV from '../ConstrV.vue'

defineProps<{
  err: Pipeline.CheckErr['err']
}>()
</script>

<template>
  <div class="err section">
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
          err.err.type === 'DiffShape' ? 'they are of different shapes' :
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
      <template v-else-if="err.type === 'UnknownImport'">
        Module '{{ err.modId }}' has no exported symbol '{{ err.id }}'.
      </template>
      <template v-else-if="err.type === 'ConflictDefs'">
        Conflict definitions for '{{ err.id }}'.
      </template>
      <template v-else-if="err.type === 'DuplicateDecls'">
        Duplicate declarations for '{{ err.id }}'.
      </template>
      <template v-else-if="err.type === 'ConstrsSolveErr'">
        <template v-if="err.err.type === 'NoInstance'">
          No instance found for constraint <ConstrV :constr="err.err.constr" />
        </template>
        <template v-else-if="err.err.type === 'AmbiguousInstance'">
          Ambiguous instances found for constraint <ConstrV :constr="err.err.constr" />:
          <div class="check-err-block">
            <div v-for="inst of err.err.instances">
              <ConstrV :constr="inst" />
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style>
.check-err-block {
  margin-left: 2ch;
}
</style>
