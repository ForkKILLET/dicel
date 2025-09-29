import { DefaultMap, Map, Set } from './containers'


export namespace Graph {
  export type Graph<K> = Map<K, Set<K>>

  export type SCC<K> = { color: number, nodes: Set<K> }

  export const solveSCCs = <K>(graph: Graph<K>) => {
    const graphRev = DefaultMap.empty<K, Set<K>>(Set.empty)
    for (const [from, tos] of graph) {
      for (const to of tos) {
        graphRev.get(to).add(from)
      }
    }

    const visited = Set.empty<K>()
    const colorMap = Map.empty<K, number>()
    const stack: K[] = []
    let color = 0
    const comps = Array.of<SCC<K>>()

    const dfs = (node: K) => {
      visited.add(node)
      for (const to of graph.get(node)!) {
        if (! visited.has(to)) dfs(to)
      }
      stack.push(node)
    }

    const dfsRev = (node: K, compNodes: Set<K>) => {
      compNodes.add(node)
      colorMap.set(node, color)
      for (const to of graphRev.get(node)) {
        if (! colorMap.has(to)) dfsRev(to, compNodes)
      }
    }

    for (const node of graph.keys()) {
      if (! visited.has(node)) dfs(node)
    }

    while (stack.length > 0) {
      const node = stack.pop()!
      if (! colorMap.has(node)) {
        color ++
        const nodes = Set.empty<K>()
        dfsRev(node, nodes)
        comps.push({ color, nodes })
      }
    }

    return { colorMap, comps }
  }

  export const condense = <K>(graph: Graph<K>, colorMap: Map<K, number>, comps: SCC<K>[]): Graph<number> => {
    const condensedGraph: Graph<number> = Map.of(comps.map(({ color }) => [color, Set.empty()]))
    for (const [from, tos] of graph) {
      const fromColor = colorMap.get(from)!
      for (const to of tos) {
        const toColor = colorMap.get(to)!
        if (fromColor !== toColor) condensedGraph.get(fromColor)!.add(toColor)
      }
    }
    return condensedGraph
  }

  export const topoSort = <K>(graph: Graph<K>) => {
    const sinks = Array.of<K>()
    const outDegMap = DefaultMap.empty<K, number>(() => 0)
    for (const [from, tos] of graph) {
      const outDegree = tos.size
      outDegMap.set(from, outDegree)
      if (outDegree === 0) sinks.push(from)
    }

    const sorted = Array.of<K>()
    while (sinks.length > 0) {
      const sink = sinks.pop()!
      sorted.push(sink)
      for (const [from, tos] of graph) {
        if (tos.has(sink)) {
          const outDeg = outDegMap.update(from, deg => deg - 1)
          if (outDeg === 0) sinks.push(from)
        }
      }
    }
    return sorted
  }
}