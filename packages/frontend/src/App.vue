<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { parse, check, execute, Dice, type Node, type ExRange, type ExId } from '@dicel/core'
import { Err, Ok } from 'fk-result'
import NodeV from './components/Node.vue'
import ValueV from './components/Value.vue'
import TypeSchemeV from './components/TypeScheme.vue'
import Type from './components/Type.vue'

const input = ref(localStorage['input'] ?? '')
watch(input, () => {
  localStorage['input'] = input.value
})
const parseResult = computed(() => parse(input.value))
const checkResult = computed(() => parseResult.value
  .mapErr(err => ({ type: 'Parse', err }))
  .bind(val => check(val.val))
)
const executeResult = computed(() => checkResult.value
  .mapErr(err => ({ type: 'Parse', err }))
  .bind(val => execute(val.expr))
)
const rollResult = computed(() => executeResult.value
  .mapErr(err => ({ type: 'Execute', err }))
  .bind(val => {
    if (val instanceof Dice) return Ok(val.roll())
    return Err(null)
  })
)

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
      <div class="input-container">
        <textarea class="code" v-model="input" spellcheck="false" ref="inputEl"></textarea>
      </div>

      <div class="parse result">
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
          <template v-if="parseResult.val === null">
            Unknown error
          </template>
          <template v-else>
            {{ parseResult.val.type }}
          </template>
        </div>
      </div>

      <div v-if="parseResult.isOk" class="check result">
        <div v-if="checkResult.isOk" class="check ok">
          <div>
            Type: <TypeSchemeV :type-scheme="checkResult.val.typeScheme" />
          </div>
          <div>
            New Expr: <NodeV :node="checkResult.val.expr" :selection="{ node: null }" />
          </div>
        </div>
        <div v-else class="check err">
          Check Error:
          <template v-if="checkResult.val.type === 'UnifyErr'">
            Cannot unify type <Type :type="checkResult.val.err.lhs" /> with <Type :type="checkResult.val.err.rhs" /> because {{
              checkResult.val.err.type === 'Recursion' ? 'of recursion' :
              checkResult.val.err.type === 'DiffSub' ? 'they are of different kinds' :
              checkResult.val.err.type === 'DiffCon' ? 'they are different constructors' :
              'of unknown reasons'
            }}.
          </template>
          <template v-else-if="checkResult.val.type === 'UndefinedVar'">
            Undefined variable '{{ checkResult.val.id }}'.
          </template>
        </div>
      </div>

      <div v-if="checkResult.isOk" class="execute result">
        <div v-if="executeResult.isOk" class="execute ok">
          Result: <ValueV :value="executeResult.val" />
        </div>
        <div v-else class="execute err">
          Execute Error:
          <pre>{{ executeResult.val }}</pre>
        </div>
      </div>

      <div v-if="executeResult.isOk" class="roll result">
        <div v-if="rollResult.isOk" class="roll ok">
          Roll: <ValueV :value="rollResult.val" />
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

main {
  font-family: monospace;
}

main > * {
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
</style>
