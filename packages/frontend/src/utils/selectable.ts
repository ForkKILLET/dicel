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
  selection?: Selection
}

export const useSelectable = (target: Ref<HTMLElement | null>, data: Selectable) => {
  const selectionAvailable = (data: Selectable): data is { selection: Selection, node: Node<DRange & DId> } =>
    'range' in data.node && !! data.selection

  useEventListener(target, 'mousemove', el => {
    el.stopPropagation()
    if (! selectionAvailable(data)) return
    data.selection.node = data.node
  })
  useEventListener(target, 'click', el => {
    el.stopPropagation()
    if (! selectionAvailable(data)) return
    data.selection.fixedNode = data.selection.fixedNode?.astId === data.node.astId
      ? null
      : data.node
  })

  return {
    classes: computed(() => ({
      [data.node.type]: true,
      selected: selectionAvailable(data) && data.selection.node?.astId === data.node.astId,
      fixed: selectionAvailable(data) && data.selection.fixedNode?.astId === data.node.astId,
    }))
  }
}
