<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { parse, check, execute, type Node, type ExRange, type ExId, type Check, showValue } from '@dicel/core'
import NodeV from './components/Node.vue'
import ValueV from './components/Value.vue'
import TypeSchemeV from './components/TypeScheme.vue'
import CheckErr from './components/CheckErr.vue'
import { incrementMap } from './utils'
import type { ParseErr } from 'parsecond'
import { Ok, type Result } from 'fk-result'

const input = ref(localStorage['input'] ?? '')
watch(input, () => {
  localStorage['input'] = input.value
})
const parseResult = computed(() => parse(input.value))

type ParseErrWrapper = {
  type: 'Parse'
  err: ParseErr | null
}
type CheckResult = Result<Check.Ok, Check.Err | ParseErrWrapper>
const checkResult = computed<CheckResult>(() => parseResult.value
  .mapErr(err => ({ type: 'Parse', err }))
  .bind(val => check(val.val))
)

const doExecute = (checkVal: Check.Ok) => {
  executeCount.value ++
  executeResult.value = execute(checkVal.expr)
    .tap(val => {
      const count = incrementMap(distribution, showValue(val))
      if (count > distributionMax.value) distributionMax.value = count
    })
}
const doExecuteToMultiple = (m: number) => {
  if (! checkResult.value.isOk) return
  const n = m - executeCount.value % m
  for (let i = 0; i < n; i++) {
    doExecute(checkResult.value.val)
  }
}
type ExecuteResult = Result<any, Check.Err | ParseErrWrapper | Error>
const executeResult = ref<ExecuteResult>(Ok(null))

const executeCount = ref(0)
const distribution = reactive(new Map<string, number>())
const distributionMax = ref(0)
const distributionEntriesSorted = computed(() => checkResult.value.match(
  ({ typeScheme: { type } }) =>{
    const entries = [...distribution.entries()]
    if (type.sub === 'con' && type.id === 'Num')
      entries.sort((a, b) => Number(a[0]) - Number(b[0]))
    return entries
  },
  () => [],
))

watch(parseResult, result => result.tap(() => {
  distribution.clear()
  distributionMax.value = 0
  executeCount.value = 0
}))
watch(checkResult, result => result.tap(doExecute), { immediate: true })

export type Selection = {
  node: Node<ExRange & ExId> | null
}
const selection = reactive<Selection>({
  node: null
})

declare global {
  interface Window {
    $node: Node<ExRange & ExId> | null
  }
}

window.$node = null

watch(selection, () => {
  if (! inputEl.value) return
  inputEl.value.focus()
  if (selection.node) {
    window.$node = selection.node
    const { start, end } = selection.node.range
    inputEl.value.setSelectionRange(start, end)
  }
  else {
    inputEl.value.setSelectionRange(null, null)
  }
})

const inputEl = useTemplateRef('inputEl')

</script>

<template>
  <div class="root">
    <main>
      <div class="input-container section">
        <textarea class="code" v-model="input" spellcheck="false" ref="inputEl"></textarea>
      </div>

      <div class="parse result section">
        <div v-if="parseResult.isOk" class="parse ok">
          Expr: <NodeV
            :node="parseResult.val.val"
            :selection="selection"
            @mouseleave="selection.node = null"
          />

          <div>
            Selected node:
            <template v-if="selection.node">
              [{{ selection.node.type }}#{{ selection.node.astId }}@{{ selection.node.range.start }}:{{ selection.node.range.end }}]
              <NodeV
                :node="selection.node"
                :selection="{ node: null }"
              />
            </template>
            <template v-else>[null]</template>
          </div>
        </div>
        <div v-else class="parse err">
          Parse Error:
          <template v-if="parseResult.err === null">
            Unknown error
          </template>
          <template v-else>
            {{ parseResult.err.type }}
          </template>
        </div>
      </div>

      <div v-if="parseResult.isOk" class="check result section">
        <div v-if="checkResult.isOk" class="check ok">
          Type: <TypeSchemeV :type-scheme="checkResult.val.typeScheme" />
        </div>
        <div v-else-if="checkResult.err.type !== 'Parse'" class="check err">
          Check Error:
          <CheckErr :err="checkResult.err" />
        </div>
      </div>

      <div v-if="checkResult.isOk" class="execute result">
        <div v-if="executeResult.isOk" class="execute ok">
          <div class="section">
            <div>
              Result:
              <button @click="doExecute(checkResult.val)">Re-run</button>
              <button @click="doExecuteToMultiple(100)">Re-run to 100x</button>
              <button @click="doExecuteToMultiple(1000)">Re-run to 1000x</button>
            </div>
            <ValueV :value="executeResult.val" />
          </div>

          <div class="section">
            Distribution ({{ executeCount }}x):
            <div class="dis-scroll">
              <svg class="dis-graph" :width="distribution.size * 35" :height="140">
                <g
                  v-for="[val, count], i of distributionEntriesSorted"
                  :key="val"
                >
                  <g :transform="`translate(${i * 35}, 0)`" class="dis-bar">
                    <rect
                      class="dis-bar-bar"
                      :x="0"
                      :y="100 * (1 - count / distributionMax)"
                      :width="30"
                      :height="100 * count / distributionMax"
                    />
                    <text
                      class="dis-bar-val"
                      :x="15"
                      :y="100 + 10"
                    >{{ val }}</text>
                    <text
                      class="dis-bar-count"
                      :x="15"
                      :y="100 + 20"
                    >{{ count }}</text>
                    <text
                      class="dis-bar-count"
                      :x="15"
                      :y="100 + 30"
                    >{{ (count / executeCount * 100).toFixed(1) }}%</text>
                  </g>
                </g>
              </svg>
            </div>
          </div>
        </div>
        <div v-else class="execute err">
          Execute Error:
          <pre>{{ executeResult.err }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  place-items: center;
  align-items: stretch;
}

.section {
  padding: 1em;
}

main {
  font-family: monospace;
  padding: 1em;
}

.err {
  color: crimson
}

.input-container > textarea {
  box-sizing: border-box;
  width: 50%;
  min-height: 20vh;
  resize: vertical;
}

button {
  border: none;
  outline: none;
  font: inherit;
  padding: 0;
  background: unset;
}

button::before {
  content: '[';
}
button::after {
  content: ']';
}
button:hover {
  text-decoration: underline;
  cursor: pointer;
}

button + button {
  margin-left: 1ch;
}

.dis-scroll {
  padding: 1em 0;
  overflow-x: auto;
}

.dis-bar-bar {
  transition: y 0.2s, height 0.2s;
  fill: lightblue;
}

.dis-bar-count, .dis-bar-val {
  text-anchor: middle;
  font-size: .8em;
}

.dis-bar-count {
  fill: lightgreen;
}

.dis-bar-val {
  fill: ivory;
}

</style>
