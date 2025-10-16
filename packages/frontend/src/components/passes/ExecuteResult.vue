<script setup lang="ts">
import { zip, capitalize } from 'remeda'
import {
  builtinData, Type, TypeSubst, uncurryApplyType, Value, EvaluateError,
  type Pipeline, type Runner, type RunnerCache
} from '@dicel/core'
import type { Cmp } from '../../utils'

import { useTemplateRef, computed, ref } from 'vue'
import ValueV from '../ValueV.vue'
import NodeV from '../NodeV.vue'

const props = defineProps<{
  result: Pipeline.ResultState<['execute']>
  runner: Runner
  runnerCache: RunnerCache
}>()

const disMeasureEl = useTemplateRef('disMeasure')
const disChWidth = computed(() => disMeasureEl.value?.getBoundingClientRect().width ?? 0)
const disChHeight = computed(() => disMeasureEl.value?.getBoundingClientRect().height ?? 0)
const disGraphDir = ref<'vertical' | 'horizontal'>('horizontal')
const disGraphDirNext = computed(() => disGraphDir.value === 'horizontal' ? 'vertical' : 'horizontal')

const sortByCount = ref(true)
const sortDir = ref(1)

const buildValueCmp = (type: Type): Cmp<Value> => {
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
        return res || buildValueCmp(argType)(aArg, bArg)
      }, 0)
  }
}

const cmpAsc = computed<Cmp<RunnerCache.Sample>>(() => {
  const { result } = props.runner.cache
  if (! result?.check) return () => 0

  if (sortByCount.value) return (a, b) => a.count - b.count

  const { type } = result.typeEnv['main']
  return (a, b) => buildValueCmp(type)(a.value, b.value)
})

const cmp = computed<Cmp<RunnerCache.Sample>>(() =>
  (a, b) => sortDir.value * cmpAsc.value(a, b)
)

type DisBar = {
  x: number
  y: number
  width: number
  height: number

  value: Value
  label: string
  ratio: number
  prob: string
  count: number
}
const disBars = computed<DisBar[]>(() => {
  const cache = props.runnerCache
  if (! cache.totalRuns) return []

  const entries = Object.entries(cache.samples)
    .sort((a, b) => cmp.value(a[1], b[1]))

  const errIndex = entries.findIndex(e => e[0] === 'Error')
  if (errIndex > 0) {
    const [errEntry] = entries.splice(errIndex, 1)
    entries.unshift(errEntry)
  }

  const cases: DisBar[] = []
  let x = 0.5 * disChWidth.value
  for (const [label, { value, count }] of entries) {
    const ratio = count / cache.maxCount
    const width = Math.max(5, label.length) * disChWidth.value
    cases.push({
      x,
      y: 100 * (1 - ratio),
      width,
      height: 100 * ratio,
      value,
      label,
      ratio,
      prob: `${(count / cache.totalRuns * 100).toFixed(1)}%`,
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
const disCountWidth = computed(() => String(props.runnerCache.maxCount).length * disChWidth.value)
const disProbWidth = computed(() => '100.0%'.length * disChWidth.value)
const disLabelWidth = computed(() => Math.max(...disBars.value.map(bar => bar.width)))


</script>

<template>
  <div class="execute super-section">
    <div class="section">
      Result:
      <button @click="runner.run(null)">Re-run</button>
      <button @click="runner.runToMultiple(100)">Re-run to 100x</button>
      <button @click="runner.runToMultiple(1000)">Re-run to 1000x</button>
    </div>

    <div v-if="result.execute" class="execute ok section">
      <div class="badge">execute</div>
      Value:
      <ValueV :value="result.mainValue" />
    </div>
    <div v-else class="execute err section">
      <div class="badge">execute</div>
      <template v-if="(result.err instanceof EvaluateError)">
        <pre>{{ result.err }}</pre>
        at <NodeV :node="result.err.node" />
      </template>
      <template v-else>
        Internal {{ result.err }}
      </template>
    </div>

    <div class="dis ok section">
      <div>
        Distribution (<span class="dis-total">{{ runnerCache.totalRuns }}x</span>):
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
          xmlns:xhtml="http://www.w3.org/1999/xhtml"
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
          :height="runnerCache.totalSamples * 15 + 10"
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
              :y="15 * i + 10 - 10 / 2"
              :width="ratio * 200"
              :height="10"
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
</template>
