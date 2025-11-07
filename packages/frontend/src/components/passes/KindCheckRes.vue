<script setup lang="ts">
import { type PassStateMap, ConType, isLower, VarType } from '@dicel/core'

import { ref } from 'vue'
import KindV from '@comp/KindV.vue'
import PassSection from '@comp/PassSection.vue'
import TypeV from '@comp/TypeV.vue'
import { refStorage } from '@util/stoage'
import SectionHeader from '@comp/SectionHeader.vue'
import SwitchButton from '@comp/SwitchButton.vue'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const folded = refStorage(`folded.${props.modId}.kindCheck`, false)
const showAll = ref(false)
</script>

<template>
  <PassSection pass="kindCheck" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output: { kindEnv, kindEnvIntro } }">
      <SectionHeader title="Kinds">
        <SwitchButton :reversed="true" v-model="folded" />
        <SwitchButton v-model="showAll">external</SwitchButton>
      </SectionHeader>

      <div v-if="! folded">
        <template v-for="kind, id in showAll ? kindEnv : kindEnvIntro" :key="id">
          <div>
            <TypeV :type="isLower(id) ? VarType(id) : ConType(id)" :has-parent="true" />
            <span class="node-sym node-spaced">::</span>
            <KindV :kind="kind" />
          </div>
        </template>
      </div>
    </template>

    <template #err="{ err }">
      <template v-if="err.type === 'UnifyKindErr'">
        Cannot unify kind <KindV :kind="err.err.lhs" /> with kind <KindV :kind="err.err.rhs" /> because {{
          err.err.type === 'Recursion' ? 'of recursion' :
          err.err.type === 'DiffShape' ? 'they are of different shapes' :
          'of unknown reasons'
        }}.
      </template>
      <template v-else-if="err.type === 'UndefinedCon'">
        Undefined type constructor '{{ err.id }}'.
      </template>
      <template v-else-if="err.type === 'UndefinedVar'">
        Undefined type variable '{{ err.id }}'.
      </template>
    </template>
  </PassSection>
</template>
