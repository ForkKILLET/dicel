import { computed, type Ref } from 'vue'
import { Node, type DRange, type DId } from '@dicel/core'
import { useEventListener } from '@vueuse/core'

export type Selection = {
  node: Node<DRange & DId> | null
  fixedNode: Node<DRange & DId> | null
}
export const Selection = (): Selection => ({ node: null, fixedNode: null })

export type Selectable = {
  node: Node<DRange & DId> | Node
  selection: Selection
}

export const useSelectable = (target: Ref<HTMLElement | null>, data: Selectable) => {
  useEventListener(target, 'mousemove', el => {
    el.stopPropagation()
    if ('range' in data.node) data.selection.node = data.node
  })
  useEventListener(target, 'click', el => {
    el.stopPropagation()
    if (! ('range' in data.node)) return
    data.selection.fixedNode = data.selection.fixedNode?.astId === data.node.astId
      ? null
      : data.node
  })

  return {
    classes: computed(() => ({
      [data.node.type]: true,
      selected: 'range' in data.node && data.selection.node?.astId === data.node.astId,
      fixed: 'range' in data.node && data.selection.fixedNode?.astId === data.node.astId,
    }))
  }
}