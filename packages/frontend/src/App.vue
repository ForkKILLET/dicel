<script setup lang="ts">
import {
  Runner, RunnerCache,
  type Node, type DRange, type DId,
} from '@dicel/core'
import { Selection } from './utils/selectable'

import { computed, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
import CheckErr from './components/passes/CheckErr.vue'
import ParseOk from './components/passes/ParseOk.vue'
import CheckOk from './components/passes/CheckOk.vue'
import DesugarOk from './components/passes/DesugarOk.vue'
import ExecuteResult from './components/passes/ExecuteResult.vue'
import ParseErr from './components/passes/ParseErr.vue'
import DesugarErr from './components/passes/DesugarErr.vue'
import ResolveOk from './components/passes/ResolveOk.vue'
import ResolveErr from './components/passes/ResolveErr.vue'

declare global {
  interface Window {
    $node: Node<DRange & DId> | null
  }
}
window.$node = null

const source = ref<string>(localStorage['source'] ?? '')
const runnerCache = reactive(RunnerCache.empty())
const result = computed(() => runnerCache.result)
const runner = new Runner(runnerCache)
const selection = reactive<Selection>(Selection())

onMounted(() => {
  watch(source, () => {
    localStorage['source'] = source.value
    runner.run(source.value)
  }, { immediate: true })

  watch(selection, () => {
    if (! inputEl.value) return
    const node = selection.node ?? selection.fixedNode
    if (node) window.$node = node

    if (! followSelection.value) return
    if (node) {
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

const leftEl = useTemplateRef('leftEl')
const rightEl = useTemplateRef('rightEl')
</script>

<template>
  <div class="root">
    <main>
      <div class="col" ref="leftEl">
        <div class="section">
          <button @click="followSelection = ! followSelection">Selection: {{ followSelection ? 'on' : 'off' }}</button>
          <textarea class="code" v-model="source" spellcheck="false" ref="inputEl"></textarea>
        </div>
      </div>
      <div class="col" ref="rightEl"></div>
    </main>

    <template v-if="result">
      <Teleport :to="leftEl">
        <template v-if="result.parse">
          <ParseOk :result="result" :selection="selection" />
          <Teleport :to="leftEl">
            <template v-if="result.resolve">
              <ResolveOk :result="result" />
              <Teleport :to="leftEl">
                <template v-if="result.desugar">
                  <DesugarOk :result="result" />
                  <Teleport :to="leftEl">
                    <template v-if="result.check" >
                      <CheckOk :result="result" />
                      <Teleport :to="rightEl">
                        <ExecuteResult :result="result" :runner="runner" :runner-cache="runnerCache" />
                      </Teleport>
                    </template>
                    <CheckErr v-else :err="result.err" />
                  </Teleport>
                </template>
                <DesugarErr v-else :err="result.err" />
              </Teleport>
            </template>
            <ResolveErr v-else :err="result.err" />
          </Teleport>
        </template>
        <ParseErr v-else :err="result.err" />
      </Teleport>
    </template>

    <footer>
      <p>
        <a href="https://github.com/ForkKILLET/Dicel">Dicel</a>
        made by <a href="https://github.com/ForkKILLET" target="_blank">ForkKILLET</a>
        with &gt;_&lt;
      </p>
    </footer>
  </div>
</template>

<style>
.root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  place-items: center;
  align-items: stretch;
  font-family: monospace;
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
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
}

.super-section {
  display: flex;
  flex-direction: column;
}

.section {
  box-sizing: border-box;
  padding: 1em;
  margin: .5em 0;
  background-color: black;
}

.section-head {
  margin-bottom: .5em;
}

.section {
  position: relative;
  border: 1px solid grey;
}

.badge {
  float: right;
  padding: .2em .5em;
  margin: calc(-1em - 1px) calc(-1em - 1px) 0 0;
}

.section.ok {
  border: 1px solid lightgreen;
}
.section.ok .badge {
  background-color: lightgreen;
  color: black;
}

.section.err {
  border: 1px solid lightcoral;
}
.section.err .badge {
  background-color: lightcoral;
  color: black;
}

.err {
  color: lightcoral;
}

textarea {
  box-sizing: border-box;
  margin-top: .5em;
  padding: .5em;
  width: 100%;
  min-height: 20vh;
  resize: vertical;
  outline: none;
  border: 1px solid grey;
  background-color: black;
}
textarea:hover, textarea:focus {
  border-color: lightblue;
}

.error-stack {
  margin-left: 2ch;
}

pre {
  overflow-x: auto;
}

button {
  border: none;
  outline: none;
  font: inherit;
  color: ivory;
  padding: 0;
  background: unset;
}

button::before {
  content: '[';
}
button::after {
  content: ']';
}
button:hover, button:focus {
  text-decoration: underline;
  cursor: pointer;
}
button:focus {
  text-decoration-style: dashed;
}

button + button {
  margin-left: 1ch;
}

pre {
  margin: 0;
}

.dis-measure-container {
  height: 0;
}

.dis-measure {
  visibility: hidden;
}

.dis-total {
  color: lightgreen;
}

.dis-scroll {
  padding: 1em 0;
  max-width: 45vw;
  overflow-x: auto;
  font-size: .9em;
}

.dis-bar {
  transition: transform .2s;
}

.dis-bar-bar {
  fill: lightblue;
  transition: height .2s, y .2s;
}

.horizontal .dis-bar-count, .horizontal .dis-bar-val {
  text-anchor: middle;
}
.vertical .dis-bar-count, .vertical .dis-bar-val {
  dominant-baseline: central;
}

.dis-bar-count {
  fill: lightgreen;
}

.dis-bar-val {
  fill: ivory;
}

.dis-bar-err .dis-bar-bar, .dis-bar-err .dis-bar-val {
  fill: lightcoral;
}
</style>
