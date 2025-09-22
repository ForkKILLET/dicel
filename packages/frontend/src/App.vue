<script setup lang="ts">
import { capitalize, computed, reactive, ref, useTemplateRef, watch } from 'vue'
import {
  type Node, type DRange, type DId, type Check, Value,
  UnitValue, ErrValue, builtinData, Type, uncurryApplyType, TypeSubst,
  parseMod, toInternal,
  type CheckMod, checkMod,
  type Mod, executeMod, isSymbol,
} from '@dicel/core'
import type { ParseErr } from 'parsecond'
import { zip } from 'remeda'
import { Ok, type Result } from 'fk-result'

import NodeV from './components/NodeV.vue'
import ValueV from './components/ValueV.vue'
import TypeSchemeV from './components/TypeScheme.vue'
import CheckErr from './components/CheckErr.vue'
import NodeLabelled from './components/NodeLabelled.vue'

import type { Cmp } from './utils'
import { Selection } from './utils/selectable'

const input = ref(localStorage['input'] ?? '')
watch(input, () => {
  localStorage['input'] = input.value
})
const parseResult = computed(() => parseMod(input.value))

const toInternalResult = computed(() => parseResult.value.map(toInternal))

namespace CheckPass {
  export type Ok = CheckMod.Ok & {
    mod: Mod<{}, 'int'>
  }
  export type ParseErrWrapped = {
    type: 'Parse'
    err: ParseErr | null
  }
  export type Err = CheckMod.Err | ParseErrWrapped
  export type Res = Result<Ok, Err>
}
const checkResult = computed<CheckPass.Res>(() => toInternalResult.value
  .mapErr<CheckPass.Err>(err => ({ type: 'Parse', err }))
  .bind(modInt => checkMod(modInt, { isMain: true })
  .map(ok => ({ ...ok, mod: modInt }))
))

const doExecute = (checkVal: CheckPass.Ok) => {
  const result = executeMod(checkVal.mod).map(env => env['main'].value)

  executeResult.value = result
  executeResults.value.push(result)

  const { label, value } = result
    .tapErr(err => console.error(err, err.expr))
    .match(
      value => ({ label: Value.show(value), value }),
      err => ({ label: 'Error', value: ErrValue(err.message) })
    )

  const count = (dis.get(label)?.count ?? 0) + 1
  dis.set(label, { label, value, count })
  if (count > disMax.value) disMax.value = count
}
const doExecuteToMultiple = (m: number) => {
  if (! checkResult.value.isOk) return
  const n = m - disTotal.value % m
  for (let i = 0; i < n; i++) {
    doExecute(checkResult.value.val)
  }
}

namespace ExecutePass {
  export type Ok = Value
  export type Err = Check.Err | Error
  export type Res = Result<Ok, Err>
}
const executeResult = ref<ExecutePass.Res>(Ok(UnitValue()))

const executeResults = ref<ExecutePass.Res[]>([])
const disTotal = computed(() => executeResults.value.length)

type DisBucket = {
  label: string
  value: Value
  count: number
}
const dis = reactive(new Map<string, DisBucket>())
const disMax = ref(0)

const disMeasureEl = useTemplateRef('disMeasure')
const disChWidth = computed(() => disMeasureEl.value?.getBoundingClientRect().width ?? 0)
const disChHeight = computed(() => disMeasureEl.value?.getBoundingClientRect().height ?? 0)
const disGraphDir = ref<'vertical' | 'horizontal'>('horizontal')
const disGraphDirNext = computed(() => disGraphDir.value === 'horizontal' ? 'vertical' : 'horizontal')

const sortByCount = ref(true)
const sortDir = ref(1)

const makeCmp = (type: Type): Cmp<Value> => {
  if (type.sub !== 'con' && type.sub !== 'apply') return () => 0
  
  const [con, ...args] = uncurryApplyType(type)
  Type.assert(con, ['con'])

  if (con.id === 'Num') return (a, b) => {
    Value.assert(a, 'num')
    Value.assert(b, 'num')
    return a.val - b.val
  }

  const data = builtinData[con.id]
  return (a, b) => {
    Value.assert(a, 'con')
    Value.assert(b, 'con')

    const aIndex = data.cons.findIndex(con => con.id === a.id)
    const bIndex = data.cons.findIndex(con => con.id === b.id)

    const deltaIndex = aIndex - bIndex
    if (deltaIndex !== 0) return deltaIndex
    
    const con = data.cons[aIndex]
    const conSubst: TypeSubst = Object.fromEntries(zip(data.typeParams, args))

    return zip(a.args, b.args)
      .reduce((res, [aArg, bArg], index) => {
        const argType = TypeSubst.apply(conSubst)(con.params[index])
        return res || makeCmp(argType)(aArg, bArg)
      }, 0)
  }
}

const cmpBase = computed<Cmp<DisBucket>>(() => {
  if (! checkResult.value.isOk) return () => 0

  if (sortByCount.value)
    return (a, b) => a.count - b.count

  const { type } = checkResult.value.val.env['main']

  return (a, b) => makeCmp(type)(a.value, b.value)
})

const cmp = computed<Cmp<DisBucket>>(() =>
  (a, b) => sortDir.value * cmpBase.value(a, b)
)

type DisBar = {
  x: number
  y: number
  width: number
  height: number

  label: string
  ratio: number
  prob: string
  count: number
}
const disBars = computed<DisBar[]>(() => {
  if (! disTotal.value || ! disMax.value || ! disChWidth.value) return []

  const entries = [...dis.entries()]
    .sort((a, b) => cmp.value(a[1], b[1]))

  const errIndex = entries.findIndex(e => e[0] === 'Error')
  if (errIndex > 0) {
    const [errEntry] = entries.splice(errIndex, 1)
    entries.unshift(errEntry)
  }

  const cases: DisBar[] = []
  let x = 0.5 * disChWidth.value
  for (const [label, { count }] of entries) {
    const ratio = count / disMax.value
    const width = Math.max(5, label.length) * disChWidth.value
    cases.push({
      x,
      y: 100 * (1 - ratio),
      width,
      height: 100 * ratio,
      label,
      ratio,
      prob: `${(count / disTotal.value * 100).toFixed(1)}%`,
      count,
    })
    x += width + 5
  }

  return cases
})
const disTotalWidth = computed(() => {
  const lastCase = disBars.value.at(-1)
  if (! lastCase) return 0
  const { x, width } = lastCase
  return x + width + 0.5 * disChWidth.value
})
const disCountWidth = computed(() => String(disMax.value).length * disChWidth.value)
const disProbWidth = computed(() => '100.0%'.length * disChWidth.value)
const disLabelWidth = computed(() => Math.max(...disBars.value.map(bar => bar.width)))

watch(parseResult, result => result.tap(() => {
  executeResults.value = []
  dis.clear()
  disMax.value = 0
}))
watch(checkResult, result => result.tap(doExecute), { immediate: true })

const selection = reactive<Selection>(Selection())

declare global {
  interface Window {
    $node: Node<DRange & DId> | null
  }
}

window.$node = null

Object.assign(window, { Type })

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

const followSelection = ref(false)
const inputEl = useTemplateRef('inputEl')

</script>

<template>
  <div class="root">
    <main>
      <div class="left">
        <div class="input-container section">
          <textarea class="code" v-model="input" spellcheck="false" ref="inputEl"></textarea>
        </div>

        <div class="parse result section">
          <button>Selection: {{ followSelection ? 'on' : 'off' }}</button>
          <div v-if="parseResult.isOk" class="parse ok">
            AST: <NodeV
              :node="parseResult.val"
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
            Types:
            <div v-for="typeScheme, id in checkResult.val.env" :key="id">
              <span class="node-var">{{isSymbol(id) ? `(${id})` : id}}</span> :: <TypeSchemeV :type-scheme="typeScheme" />
            </div>
          </div>
          <div v-else-if="checkResult.err.type !== 'Parse'" class="check err">
            Check Error:
            <CheckErr :err="checkResult.err" />
          </div>
        </div>
      </div>

      <div class="right">
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

          <div class="dis section">
            <div>
              Distribution (<span class="dis-total">{{ disTotal }}x</span>):
              <button @click="disGraphDir = disGraphDirNext">{{ capitalize(disGraphDir) }} view</button>
              <button @click="sortByCount = ! sortByCount">Sort by {{ sortByCount ? 'count' : 'label' }}</button>
              <button @click="sortDir = - sortDir">Sort {{ sortDir > 0 ? 'desc' : 'asc' }}</button>
            </div>
            <div class="dis-scroll">
              <div class="dis-measure-container">
                <span class="dis-measure" ref="disMeasure">x</span>
              </div>
              <svg
                v-if="disGraphDir === 'horizontal'"
                class="dis-graph horizontal"
                :width="disTotalWidth + 10"
                :height="140"
              >
                <g
                  v-for="{ x, y, width, height, label, count, prob } of disBars"
                  :key="label"
                  class="dis-bar"
                  :class="{ 'dis-bar-err': label === 'Error' }"
                  :transform="`translate(${x + width / 2}, ${0})`"
                >
                  <rect
                    class="dis-bar-bar"
                    :x="- 15"
                    :y="y"
                    :width="30"
                    :height="height"
                  />
                  <text
                    class="dis-bar-val"
                    :x="0"
                    :y="100 + disChHeight"
                  >{{ label }}</text>
                  <text
                    class="dis-bar-count"
                    :x="0"
                    :y="100 + disChHeight * 2"
                  >{{ count }}</text>
                  <text
                    class="dis-bar-count"
                    :x="0"
                    :y="100 + disChHeight * 3"
                  >{{ prob }}</text>
                </g>
              </svg>
              <svg
                v-else-if="disGraphDir === 'vertical'"
                class="dis-graph vertical"
                :width="disCountWidth + disProbWidth + 200 + disLabelWidth + 20"
                :height="dis.size * 15 + 10"
              >
                <g
                  v-for="{ label, count, prob, ratio }, i of disBars"
                  :key="label"
                  class="dis-bar"
                  :class="{ 'dis-bar-err': label === 'Error' }"
                >
                  <text
                    class="dis-bar-count"
                    :x="0"
                    :y="15 * i + 10"
                  >{{ count }}</text>
                  <text
                    class="dis-bar-count"
                    :x="disCountWidth + 5"
                    :y="15 * i + 10"
                  >{{ prob }}</text>
                  <rect
                    class="dis-bar-bar"
                    :x="disCountWidth + disProbWidth + 10"
                    :y="15 * i + 10 - 15 / 2"
                    :width="ratio * 200"
                    :height="15"
                  />
                  <text
                    class="dis-bar-val"
                    :x="disCountWidth + disProbWidth + 200 + 15"
                    :y="15 * i + 10"
                  >{{ label }}</text>
                </g>
              </svg>
            </div>
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
  display: flex;
  padding: 1em;
}

.left, .right {
  flex-basis: 50%;
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
  width: 100%;
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
