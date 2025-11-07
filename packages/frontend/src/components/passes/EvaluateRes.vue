<script setup lang="ts">
import PassSection from '@comp/PassSection.vue'
import SectionHeader from '@comp/SectionHeader.vue'
import SwitchButton from '@comp/SwitchButton.vue'
import SymRef from '@comp/SymRef.vue'
import TypedValueV from '@comp/TypedValueV.vue'
import type { PassStateMap } from '@dicel/core'
import { kModOutputs } from '@util/inject'
import { refStorage } from '@util/stoage'
import { inject } from 'vue'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const folded = refStorage(`folded.${props.modId}.evaluate`, false)

const outputs = inject(kModOutputs)!
</script>

<template>
  <PassSection pass="evaluate" :mod-id="modId" :state-map="stateMap">
    <template #ok="{ output: { introScope } }">
      <SectionHeader title="Scope">
        <SwitchButton :reversed="true" v-model="folded" />
      </SectionHeader>

      <div v-if="! folded">
        <div v-for="[symId, { value }] of introScope">
          <SymRef :sym-id="symId" />
          <span class="node-sym node-spaced">=</span>
          <template v-if="value">
            <TypedValueV :value="value" :type="outputs.typeCheck!.typeEnv[symId].type" />
          </template>
          <template>
            <span class="node-special">Uninit</span>
          </template>
        </div>
      </div>
    </template>

    <template #err="{ err }">
      {{ err.message }}
    </template>
  </PassSection>
</template>
