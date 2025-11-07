<script setup lang="ts">
import { PASSES, type ModOutputs, type Pass } from '@dicel/core'

import { computed, inject, provide } from 'vue'

import ParseRes from '@comp/passes/ParseRes.vue'
import SyntaxDesugarRes from '@comp/passes/SyntaxDesugarRes.vue'
import NameResolveRes from '@comp/passes/NameResolveRes.vue'
import ModResolveRes from '@comp/passes/ModResolveRes.vue'
import SemanticsDesugarRes from '@comp/passes/SemanticsDesugarRes.vue'
import KindCheckRes from '@comp/passes/KindCheckRes.vue'
import BindingGroupResolveRes from '@comp/passes/BindingGroupResolveRes.vue'
import TypeCheckRes from '@comp/passes/TypeCheckRes.vue'

import NodeSelection from '@comp/NodeSelection.vue'

import { kModStates, kModOutputs } from '@util/inject'
import ClassDesugarRes from './passes/ClassDesugarRes.vue'
import EvaluateRes from './passes/EvaluateRes.vue'

const modStates = inject(kModStates)!

const props = defineProps<{
  modId: string
  leftEl: HTMLElement | null
  rightEl: HTMLElement | null
}>()

const stateMap = computed(() => modStates[props.modId])

provide(kModOutputs, computed(() => {
  const outputs: ModOutputs<Pass> = {}
  for (const pass of PASSES) {
    const passState = stateMap.value[pass]
    if (passState.status === 'ok') outputs[pass] = passState.output as any
  }
  return outputs
}))
</script>

<template>
  <template v-if="stateMap">
    <Teleport :to="leftEl">
      <NodeSelection />
    </Teleport>

    <Teleport :to="rightEl">
      <ParseRes               :mod-id="modId" :state-map="stateMap" />
      <SyntaxDesugarRes       :mod-id="modId" :state-map="stateMap" />
      <ModResolveRes          :mod-id="modId" :state-map="stateMap" />
      <NameResolveRes         :mod-id="modId" :state-map="stateMap" />
      <SemanticsDesugarRes    :mod-id="modId" :state-map="stateMap" />
      <KindCheckRes           :mod-id="modId" :state-map="stateMap" />
      <BindingGroupResolveRes :mod-id="modId" :state-map="stateMap" />
      <TypeCheckRes           :mod-id="modId" :state-map="stateMap" />
      <ClassDesugarRes        :mod-id="modId" :state-map="stateMap" />
      <EvaluateRes            :mod-id="modId" :state-map="stateMap" />
    </Teleport>
  </template>
</template>
