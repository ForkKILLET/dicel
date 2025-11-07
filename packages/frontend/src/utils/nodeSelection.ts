import { computed, type Ref } from 'vue'
import { Node } from '@dicel/core'
import { useEventListener } from '@vueuse/core'

export type NodePath = Node[]
export type NodeLoc = {
  node: Node
  path?: Node[]
}

export type NodeSelection = {
  hoveringLoc: NodeLoc | null
  selectedLoc: NodeLoc | null
}
export const NodeSelection = (): NodeSelection => ({ hoveringLoc: null, selectedLoc: null })

const ignore = (loc: NodeLoc): boolean => {
  if (! loc.node.astId) return true
  const parent = loc.path?.at(-1) ?? null
  if (loc.node.ty === 'id' && parent && Node.is(parent, ['var', 'varPat', 'varRef'])) return true
  return false
}

export const useSelectable = (target: Ref<HTMLElement | null>, selection: NodeSelection, loc: NodeLoc) => {
  useEventListener(target, 'mousemove', ev => {
    if (ignore(loc)) return
    ev.stopPropagation()
    selection.hoveringLoc = loc
  })
  useEventListener(target, 'mouseleave', () => {
    if (selection.hoveringLoc?.node.astId === loc.node.astId) {
      selection.hoveringLoc = null
    }
  })
  useEventListener(target, 'click', ev => {
    if (ignore(loc)) return
    ev.stopPropagation()
    selection.selectedLoc = selection.selectedLoc?.node.astId === loc.node.astId
      ? null
      : loc
  })

  return {
    classes: computed(() => {
      if (ignore(loc)) return {
        hovering: false,
        selected: false,
      }
      return {
        hovering: selection.hoveringLoc?.node.astId === loc.node.astId,
        selected: selection.selectedLoc?.node.astId === loc.node.astId,
      }
    })
  }
}
