<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { parse, check, execute, type Node, type ExRange, type ExId, type Check, showValue, type ExprEx, type NodeEx } from '@dicel/core'
import type { ParseErr } from 'parsecond'
import { Ok, type Result } from 'fk-result'
import NodeV from './components/Node.vue'
import ValueV from './components/Value.vue'
import TypeSchemeV from './components/TypeScheme.vue'
import CheckErr from './components/CheckErr.vue'
import NodeLabelled from './components/NodeLabelled.vue'
import { incrementMap } from './utils'

const input = ref(localStorage['input'] ?? '')
watch(input, () => {
  localStorage['input'] = input.value
})
const parseResult = computed(() => parse(input.value))

namespace CheckPass {
  export type Ok = Check.Ok & {
    expr: ExprEx
  }
  export type ParseErrWrapped = {
    type: 'Parse'
    err: ParseErr | null
  }
  export type Err = Check.Err | ParseErrWrapped
  export type Res = Result<Ok, Err>
}
const checkResult = computed<CheckPass.Res>(() => parseResult.value
  .mapErr(err => ({ type: 'Parse', err }))
  .bind(({ val: expr }) => check(expr).map(ok => ({ ...ok, expr }))
))

const doExecute = (checkVal: CheckPass.Ok) => {
  disTotal.value ++
  executeResult.value = execute(checkVal.expr)
    .tap(val => {
      const count = incrementMap(dis, showValue(val))
      if (count > disMax.value) disMax.value = count
    })
    .tapErr(() => {
      const count = incrementMap(dis, 'Error')
      if (count > disMax.value) disMax.value = count
    })
}
const doExecuteToMultiple = (m: number) => {
  if (! checkResult.value.isOk) return
  const n = m - disTotal.value % m
  for (let i = 0; i < n; i++) {
    doExecute(checkResult.value.val)
  }
}

namespace ExecutePass {
  export type Ok = any
  export type Err = Check.Err | Error
  export type Res = Result<Ok, Err>
}
const executeResult = ref<ExecutePass.Res>(Ok(null))

const disTotal = ref(0)
const dis = reactive(new Map<string, number>())
const disMax = ref(0)
const disEntriesSorted = computed(() => checkResult.value.match(
  ({ typeScheme: { type } }) =>{
    const entries = [...dis.entries()]

    if (type.sub === 'con' && type.id === 'Num')
      entries.sort((a, b) => Number(a[0]) - Number(b[0]))

    const errIndex = entries.findIndex(e => e[0] === 'Error')
    if (errIndex > 0) {
      const [errEntry] = entries.splice(errIndex, 1)
      entries.unshift(errEntry)
    }

    return entries
  },
  () => [],
))

watch(parseResult, result => result.tap(() => {
  dis.clear()
  disMax.value = 0
  disTotal.value = 0
}))
watch(checkResult, result => result.tap(doExecute), { immediate: true })

export type Selection = {
  node: NodeEx | null
  fixedNode: NodeEx | null
}
const selection = reactive<Selection>({
  node: null,
  fixedNode: null,
})

declare global {
  interface Window {
    $node: Node<ExRange & ExId> | null
  }
}

window.$node = null

watch(selection, () => {
  if (! inputEl.value) return
  const node = selection.node ?? selection.fixedNode
  if (node) {
    window.$node = node
    const { start, end } = node.range
    inputEl.value.focus()
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
            <NodeLabelled :node="selection.node" />
          </div>
          <div>
            Fixed node:
            <NodeLabelled :node="selection.fixedNode" />
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
        <div class="section">
          Result:
          <button @click="doExecute(checkResult.val)">Re-run</button>
          <button @click="doExecuteToMultiple(100)">Re-run to 100x</button>
          <button @click="doExecuteToMultiple(1000)">Re-run to 1000x</button>
        </div>

        <div v-if="executeResult.isOk" class="execute ok section">
          Value:
          <ValueV :value="executeResult.val" />
        </div>
        <div v-else class="execute err section">
          Execute Error:
          <pre>{{ executeResult.err }}</pre>
        </div>

        <div class="section">
          Distribution (<span class="dis-total">{{ disTotal }}x</span>):
          <div class="dis-scroll">
            <svg class="dis-graph" :width="dis.size * 35" :height="140">
              <g
                v-for="[val, count], i of disEntriesSorted"
                :key="val"
              >
                <g
                  :transform="`translate(${i * 35}, 0)`"
                  class="dis-bar"
                  :class="{ 'dis-bar-err': val === 'Error' }"
                >
                  <rect
                    class="dis-bar-bar"
                    :x="0"
                    :y="100 * (1 - count / disMax)"
                    :width="30"
                    :height="100 * count / disMax"
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
                  >{{ (count / disTotal * 100).toFixed(1) }}%</text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </main>
    <footer>
      <a href="https://github.com/ForkKILLET/Dicel">Dicel</a> made by <a href="https://github.com/ForkKILLET" target="_blank">ForkKILLET</a> with &gt;_&lt;
    </footer>
  </div>
</template>

<style scoped>
.root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  place-items: center;
  align-items: stretch;
  font-family: monospace;
}

.section {
  padding: 1em;
}

.sub-section {
  padding: .5em 0;
}

main {
  padding: 1em;
}

footer {
  position: fixed;
  bottom: 0;
  width: 100%;
  text-align: center;
}

.err {
  color: lightcoral;
}

textarea {
  box-sizing: border-box;
  width: 50%;
  min-height: 20vh;
  resize: vertical;
  outline: none;
  border: 1px solid grey;
}
textarea:hover, textarea:focus {
  border-color: lightblue;
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

button + button {
  margin-left: 1ch;
}

pre {
  margin: 0;
}

.dis-total {
  color: lightgreen;
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

.dis-bar-err .dis-bar-bar, .dis-bar-err .dis-bar-val {
  fill: lightcoral;
}

</style>
