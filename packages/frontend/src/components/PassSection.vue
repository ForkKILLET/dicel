<script setup lang="ts" generic="P extends Pass">
import { type Pass, type PassErrMap, type PassOutputMap, type PassStateMap } from '@dicel/core'

import { computed } from 'vue'
import { refStorage } from '@util/stoage'

const props = defineProps<{
  pass: P
  modId: string
  stateMap: PassStateMap
}>()

const state = computed(() => props.stateMap[props.pass])

const folded = refStorage(`folded.${props.modId}.${props.pass}.section`, false)
</script>

<template>
  <section :class="[state.status, folded ? 'folded' : null]">
    <div @click="folded = ! folded" class="badge">
      <span class="pass">{{ pass }}</span>
      <span v-if="state.status !== 'pending'" class="pass-time node-spaced-left">{{ state.time }}ms</span>
    </div>
    <div v-show="! folded" ref="sectionMainEl" class="main">
      <slot v-if="state.status === 'ok'" name="ok" :output="(state.output as PassOutputMap[P])"></slot>
      <slot v-else-if="state.status === 'err'" name="err" :err="(state.err as PassErrMap[P])"></slot>
      <span v-else-if="state.status === 'pending'" class="obscure">Skipped</span>
    </div>
  </section>
</template>

<style scoped>
section.folded {
  display: inline-block;
  padding: 0;
}
section.folded + section.folded {
  margin-left: 1em;
}

section:not(.folded) + section.folded {
  margin-left: auto;
}

section.ok {
  border-color: lightgreen;
}
section.err {
  border-color: lightcoral;
}
section.pending {
  border-color: grey;
}

section:not(.folded) > .badge {
  position: absolute;
  top: 0;
  right: 0;
}

.badge {
  padding: .2em .5em;
  cursor: pointer;
  user-select: none;
}

section.ok .badge {
  background-color: lightgreen;
  color: black;
}
section.err .badge {
  background-color: lightcoral;
  color: black;
}
section.pending .badge {
  background-color: grey;
  color: black;
}

.pass-time {
  color: darkslategrey;
}
</style>
