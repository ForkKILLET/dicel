<script setup lang="ts">
import { type ModStateMap, type Node, Pipeline } from '@dicel/core'
import { NodeSelection } from './utils/nodeSelection'

import { onMounted, provide, reactive, ref, shallowReactive, useTemplateRef, watch } from 'vue'
import ModPipeline from '@comp/ModPipeline.vue'
import SwitchButton from '@comp/SwitchButton.vue'
import { kModStates, kNodeSelection, kTypeSchemeImplicit, kTypeShowPrettyIds } from '@util/inject'
import { useElementSize } from '@vueuse/core'
import { refStorage } from '@util/stoage'
import SplitterBar from '@comp/SplitterBar.vue'

const DEFAULT_SOURCE = 'main = @6'

const source = ref<string>(localStorage['source'] ?? DEFAULT_SOURCE)
const selection = reactive<NodeSelection>(NodeSelection())
const modStates: ModStateMap = shallowReactive({})
const pipeline = new Pipeline(modStates)

const selectedModId = ref<string>('Main')

onMounted(() => {
  pipeline.loadStd()

  watch(source, () => {
    localStorage['source'] = source.value

    selection.hoveringLoc = selection.selectedLoc = null

    pipeline.load('Main', source.value)
  }, { immediate: true })

  watch(selection, () => {
    if (! inputEl.value) return

    const loc = selection.hoveringLoc ?? selection.selectedLoc
    if (! loc) return
    const { node } = loc
    window.$node = node

    if (! followSelection.value) return
    if (node.range) {
      const { start, end } = node.range
      inputEl.value.focus()
      inputEl.value.setSelectionRange(start, end)
    }
    else {
      inputEl.value.setSelectionRange(null, null)
    }
  })
})

const followSelection = ref(false)
const inputEl = useTemplateRef('inputEl')
const leftEl = useTemplateRef('left')
const rightEl = useTemplateRef('right')

const inputHeight = refStorage('inputHeight', 200)
const { height: inputActualHeight } = useElementSize(inputEl)

onMounted(() => {
  inputEl.value!.style.height = `${inputHeight.value}px`
})
watch(inputActualHeight, height => {
  inputHeight.value = height
})

declare global {
  interface Window {
    $node: Node | null
    $pipeline: Pipeline
  }
}

window.$node = null
window.$pipeline = pipeline

provide(kModStates, modStates)
provide(kNodeSelection, selection)
provide(kTypeShowPrettyIds, ref(true))
provide(kTypeSchemeImplicit, ref(false))
</script>

<template>
  <div class="app">
    <main>
      <div class="col left" ref="left">
        <section>
          <div class="mod-tabs">
            <span
              v-for="modState, id of modStates"
              class="mod-tab"
              :class="[
                modState[pipeline.passSeq.at(-1)!].status === 'ok' ? 'ok' : 'err',
                id === selectedModId ? 'selected' : null,
              ]"
              @click="selectedModId = id"
            >
              {{ id }}
            </span>
          </div>
        </section>

        <section>
          <SwitchButton v-model="followSelection">range</SwitchButton>

          <textarea
            v-model="source"
            ref="inputEl"
            spellcheck="false"
          ></textarea>
        </section>
      </div>
      <SplitterBar :el="leftEl" />
      <div class="col right" ref="right">
      </div>

      <KeepAlive :key="selectedModId">
        <ModPipeline :mod-id="selectedModId" :left-el="leftEl" :right-el="rightEl" />
      </KeepAlive>
    </main>

    <footer>
      <p>
        <a href="https://github.com/ForkKILLET/Dicel">Dicel</a>
        made by <a href="https://github.com/ForkKILLET" target="_blank">ForkKILLET</a>
        with &gt;_&lt;
      </p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  place-items: center;
  align-items: stretch;
}

main {
  display: flex;
  gap: 1em;
  box-sizing: border-box;
  padding: 1em;
  height: calc(100% - 1em);
}

footer {
  position: fixed;
  height: 2em;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  bottom: 0;
}

footer .logo {
  height: 2em;
}

.col {
  text-align: right;
  scrollbar-width: none;
  overflow-y: auto;
  min-width: 20em;
}

.col.left {
  width: 50%;
}
.col.right {
  flex: 1;
}

@media (max-width: 800px) or (orientation: portrait) {
  .col.empty {
    display: none;
  }
}

:deep(section .header) {
  margin-bottom: .5em;
}
:deep(section :not(.badge) + .header) {
  margin-top: 1em;
}

:deep(section) {
  position: relative;
  box-sizing: border-box;
  padding: 1em;
  border: 1px solid grey;
  background-color: black;
  text-align: left;
}
:deep(section:not(:first-child)) {
  margin-top: 1em;
}

textarea {
  margin-top: .5em;
  width: 100%;
}

.mod-tabs {
  border-bottom: 1px solid grey;
}

.mod-tab {
  margin-right: .5em;
  padding: .1em .5em 0 .5em;
  border-style: solid;
  border-width: 1px 1px 0 1px;
  cursor: pointer;
}
.mod-tab.ok {
  border-color: lightgreen;
}
.mod-tab.err {
  border-color: lightcoral;
}
.mod-tab.selected {
  color: black;
}
.mod-tab.selected.ok {
  background-color: lightgreen;
}
.mod-tab.selected.err {
  background-color: lightcoral;
}
</style>
