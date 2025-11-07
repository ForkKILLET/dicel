<script setup lang="ts">
import { inject } from 'vue'
import NodeLoc from '@comp/NodeLoc.vue'
import { kNodeSelection } from '@util/inject'
import SectionHeader from './SectionHeader.vue'
import NodeInfo from './NodeInfo.vue'

const selection = inject(kNodeSelection)!
</script>

<template>
  <section>
    <div class="node-selection">
      <SectionHeader title="Hovering node">
        <NodeLoc :loc="selection.hoveringLoc" />
      </SectionHeader>

      <NodeInfo v-if="selection.hoveringLoc" :node="selection.hoveringLoc.node" />
    </div>

    <div class="node-selection">
      <SectionHeader title="Selected node">
        <NodeLoc :loc="selection.selectedLoc" />
      </SectionHeader>

      <NodeInfo v-if="selection.selectedLoc" :node="selection.selectedLoc.node" />
    </div>
  </section>
</template>

<style scoped>
.node-selection {
  min-height: 10em;
}
</style>
