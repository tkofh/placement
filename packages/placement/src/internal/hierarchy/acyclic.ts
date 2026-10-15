// Cycle removal, the first phase of layered layout. A depth-first search in
// node order reverses every back edge, the edges that point to a node still
// on the search stack. The search visits nodes and edges in input order, so
// the result is deterministic and favors the order the caller wrote.

export interface DirectedEdge {
  readonly source: number
  readonly target: number
}

// Returns one flag per edge: true when layout must reverse the edge to make
// the graph acyclic. The caller removes self loops beforehand.
export function findReversed(
  nodeCount: number,
  edges: ReadonlyArray<DirectedEdge>,
): ReadonlyArray<boolean> {
  const outgoing: Array<Array<number>> = Array.from({ length: nodeCount }, () => [])
  for (const [index, edge] of edges.entries()) {
    outgoing[edge.source]?.push(index)
  }

  // 0 is unvisited, 1 is on the stack, 2 is finished.
  const state = new Uint8Array(nodeCount)
  const reversed: Array<boolean> = edges.map(() => false)

  for (let start = 0; start < nodeCount; start++) {
    if (state[start] !== 0) {
      continue
    }

    // Each frame holds a node and the position of its next outgoing edge.
    const stack: Array<[node: number, next: number]> = [[start, 0]]
    state[start] = 1

    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as [number, number]
      const [node, next] = frame
      const out = outgoing[node] as Array<number>

      if (next === out.length) {
        state[node] = 2
        stack.pop()
        continue
      }

      frame[1] = next + 1
      const edgeIndex = out[next] as number
      const target = (edges[edgeIndex] as DirectedEdge).target

      if (state[target] === 1) {
        reversed[edgeIndex] = true
      } else if (state[target] === 0) {
        state[target] = 1
        stack.push([target, 0])
      }
    }
  }

  return reversed
}
