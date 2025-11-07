<script setup lang="ts">
import { type PassStateMap, TypeScheme, VarType } from '@dicel/core'

import { inject, provide, ref } from 'vue'
import PassSection from '@comp/PassSection.vue'
import { refStorage } from '@util/stoage'
import TypeSchemeV from '@comp/TypeSchemeV.vue'
import { kModOutputs, kTypeShowPrettyIds } from '@util/inject'
import SwitchButton from '@comp/SwitchButton.vue'
import TypeSourcedV from '@comp/TypeSourcedV.vue'
import ConstrV from '@comp/ConstrV.vue'
import SymInfoV from '@comp/SymInfoV.vue'
import TypeV from '@comp/TypeV.vue'
import NodeRef from '@comp/NodeRef.vue'
import EvidenceV from '@comp/EvidenceV.vue'
import SectionHeader from '@comp/SectionHeader.vue'
import ConstrsV from '@comp/ConstrsV.vue'

const props = defineProps<{
  modId: string
  stateMap: PassStateMap
}>()

const foldedEnv = refStorage(`folded.${props.modId}.typeCheck.env`, false)
const foldedEvidences = refStorage(`folded.${props.modId}.typeCheck.evidences`, false)
const showAll = ref(false)
const showSource = ref(true)
const showPrettyIds = ref(true)

const outputs = inject(kModOutputs)!

provide(kTypeShowPrettyIds, showPrettyIds)
</script>

<template>
  <PassSection pass="typeCheck" :state-map="stateMap" :mod-id="modId">
    <template #ok="{ output: { typeEnv, typeEnvIntro, bindingEvidenceMap } }">
      <SectionHeader title="Types">
        <SwitchButton :reversed="true" v-model="foldedEnv" />
        <SwitchButton v-model="showAll">external</SwitchButton>
        <SwitchButton v-model="showSource">source</SwitchButton>
        <SwitchButton v-model="showPrettyIds">prettify</SwitchButton>
      </SectionHeader>

      <div v-if="! foldedEnv">
        <template v-for="typeScheme, id in showAll ? typeEnv : typeEnvIntro" :key="id">
          <div>
            <SymInfoV :info="outputs.nameResolve!.symInfoMap.get(id)!" :show-source="showSource" />
            <span class="node-sym node-spaced">::</span>
            <TypeSchemeV :type-scheme="TypeScheme.prettify(typeScheme)" />
          </div>
        </template>
      </div>

      <SectionHeader title="Evidences">
        <SwitchButton :reversed="true" v-model="foldedEvidences" />
      </SectionHeader>

      <div v-if="! foldedEvidences">
        <div v-for="[bindingAstId, { evidenceMap }] of bindingEvidenceMap">
          <NodeRef :ast-id="bindingAstId" flavor="link"/>
          <span class="node-sym node-spaced">=&gt;</span>
          <span>{</span>
          <template v-for="[astId, evidences] of evidenceMap">
            <div v-if="evidences.length" class="node-indent">
              <NodeRef :ast-id="astId" />
              <span class="node-sym node-spaced">=&gt;</span>
              <span>[</span>
              <template v-for="evidence, ix of evidences" :key="ix">
                <EvidenceV :evidence="evidence" />
                <span v-if="ix + 1 < evidences.length" class="node-spaced-right">,</span>
              </template>
              <span>]</span>
            </div>
          </template>
          <span>}</span>
        </div>
      </div>
    </template>

    <template #err="{ err }">
      <template v-if="err.via === 'UnifyErr'">
        Cannot unify
          <div class="node-indent"><TypeSourcedV :type="err.err.lhs" /></div>
        with
          <div class="node-indent"><TypeSourcedV :type="err.err.rhs" /></div>
        because
        <template v-if="err.err.type === 'Recursion'">of recursion</template>
        <template v-else-if="err.err.type === 'DiffShape'">they are of different shapes</template>
        <template v-else-if="err.err.type === 'DiffCon'">they are different constructors</template>
        <template v-else-if="err.err.type === 'RigidVar'">the variable <TypeV :type="VarType(err.err.var)" /> is rigid</template>
        <template v-else>of unknown reasons</template>.
      </template>

      <template v-else-if="err.via === 'PatErr'">
        Illegal pattern {{ err.err.type }}
      </template>

      <template v-else-if="err.via === 'ConstrsSolveErr'">
        <template v-if="err.err.type === 'NoInstance'">
          No instance found for constraint <ConstrV :constr="err.err.constr" />
        </template>
        <template v-else-if="err.err.type === 'AmbiguousInstance'">
          Ambiguous instances found for constraint <ConstrV :constr="err.err.constr" />:
          <div class="node-indent">
            <div v-for="inst of err.err.instances">
              <ConstrV :constr="inst" />
            </div>
          </div>
        </template>
      </template>

      <template v-else-if="err.via === 'InstanceErr'">
        <template v-if="err.err.type === 'ExtraConstrs'">
          Extra constraints <ConstrsV :constrs="err.err.extraConstrs" /> collected
          <div class="node-indent">
            from member definition <NodeRef :ast-id="err.err.def" />
          </div>
          cannot be entailed by known constraints <ConstrsV :constrs="err.err.knownConstrs" />
          <div class="node-indent">
            <div>from class context <NodeRef :ast-id="err.err.class" :is-brief="true" /></div>
            <div>and member declaration <NodeRef :ast-id="err.err.decl" :is-brief="true" />.</div>
          </div>
        </template>
      </template>
    </template>
  </PassSection>
</template>
