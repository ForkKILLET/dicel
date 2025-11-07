<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'

const props = withDefaults(defineProps<{
  el?: HTMLElement | null
  direction?: 'horizontal' | 'vertical'
  moveDirection?: 1 | - 1
}>(), {
  direction: 'vertical',
  moveDirection: 1
})

interface Pos {
  x: number
  y: number
}

const getPointerPos = (ev: MouseEvent | TouchEvent): Pos => {
  const { clientX: x, clientY: y } =  ev instanceof MouseEvent ? ev : ev.touches[0]
  return { x, y }
}

const dividerEl = useTemplateRef('splitterEl')
const isMoving = ref(false)
let pos0: Pos | null = null

const onMoveStart = (ev: PointerEvent | TouchEvent) => {
  isMoving.value = true
  pos0 = getPointerPos(ev)
  document.body.style.cursor = props.direction === 'horizontal'
    ? 'ns-resize'
    : 'ew-resize'
}

const onMove = (ev: MouseEvent | TouchEvent) => {
  const { el, moveDirection, direction } = props
  if (! pos0 || ! el) return
  const pos1 = getPointerPos(ev)
  if (direction === 'vertical') {
    el.style.width = `${el.clientWidth + (pos1.x - pos0.x) * moveDirection}px`
  }
  else {
    el.style.height = `${el.clientHeight + (pos1.y - pos0.y) * moveDirection}px`
  }
  pos0 = pos1
}

const onMoveEnd = (ev: MouseEvent | TouchEvent) => {
  onMove(ev)
  pos0 = null
  isMoving.value = false
  document.body.style.cursor = ''
}

useEventListener(dividerEl, ['pointerdown', 'touchstart'], onMoveStart)
useEventListener(['pointermove', 'touchmove'], onMove)
useEventListener(['pointerup', 'touchend', 'touchcancel'], onMoveEnd)
useEventListener(window, 'selectstart', ev => {
  if (isMoving.value) ev.preventDefault()
})
</script>

<template>
  <div ref="splitterEl" :class="['splitter', { moving: isMoving }, direction]">
    <div class="splitter-inner"></div>
  </div>
</template>

<style scoped>
.splitter {
  flex-grow: 0;
  cursor: pointer;
  display: flex;
  justify-content: center;
}

.splitter.vertical {
  flex-direction: row;
  height: 100%;
  width: 3px;
}
.splitter.vertical.moving {
  cursor: ew-resize;
}

.splitter.horizontal {
  flex-direction: column;
  width: 100%;
  width: 3px;
}
.splitter.horizontal.moving {
  cursor: ns-resize;
}

.splitter-inner {
  background-color: grey;
  transition: background-color .3s;
  box-sizing: border-box;
}
.splitter.vertical > .splitter-inner {
  height: 100%;
  width: 1px;
}
.splitter.horizontal > .splitter-inner {
  width: 100%;
  height: 1px;
}

.splitter.moving > .splitter-inner {
  background-color: lightblue;
}
.splitter.vertical.moving > .splitter-inner {
  width: 2px;
}
.splitter.horizontal.moving > .splitter-inner {
  height: 2px;
}
</style>
