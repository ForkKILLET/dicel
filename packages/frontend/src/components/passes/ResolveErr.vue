<script setup lang="ts">
import { type Pipeline } from '@dicel/core'
import KindV from '../KindV.vue'

defineProps<{
  err: Pipeline.ResolveErr['err']
}>()
</script>

<template>
  <div class="err section">
    <div class="badge">resolve</div>
    Resolve Error:
    <template v-if="err.type === 'Duplicate'">
      Duplicate {{ err.sub }} for '{{ err.id }}'.
    </template>
    <template v-else-if="err.type === 'ConflictDef'">
      Conflicting definitions for '{{ err.id }}'.
    </template>
    <template v-else-if="err.type === 'MissingDef'">
      Missing definition for '{{ err.id }}'.
    </template>
    <template v-else-if="err.type === 'UnknownMod'">
      Unknown module '{{ err.modId }}'.
    </template>
    <template v-else-if="err.type === 'UnifyKindErr'">
      Cannot unify kind <KindV :kind="err.err.lhs" /> with kind <KindV :kind="err.err.rhs" /> because {{
        err.err.type === 'Recursion' ? 'of recursion' :
        err.err.type === 'DiffShape' ? 'they are of different shapes' :
        'of unknown reasons'
      }}.
    </template>
    <template v-else-if="err.type === 'NoMain'">
      Undefined entry variable 'main'.
    </template>
    <template v-else-if="err.type === 'UndefinedCon'">
      Undefined type constructor '{{ err.id }}'.
    </template>
    <template v-else-if="err.type === 'UndefinedVar'">
      Undefined type variable '{{ err.id }}'.
    </template>
    <template v-else-if="err.type === 'UnknownImport'">
      Module '{{ err.modId }}' has no exported symbol '{{ err.id }}'.
    </template>
    <template v-else>
      {{ err.type }}
    </template>
  </div>
</template>
