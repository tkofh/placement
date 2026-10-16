// Cycle removal, the first phase of layered layout and the step that turns
// pairwise preferences into an order. A depth-first search in node order
// reverses every back edge, the edges that point to a node still on the
// search stack. The search visits nodes and edges in input order, so the
// result is deterministic and favors the order the caller wrote.

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

// Returns the position of each item in an order that follows as many of the
// preferred pairs as it can: each edge prefers its source before its target.
// When the preferences form a cycle, a depth-first search in input order
// breaks it. Among the items that are free to go next, the lowest index goes
// first, so items without a preference between them keep input order.
export function preferredOrder(
  count: number,
  preferred: ReadonlyArray<DirectedEdge>,
): Array<number> {
  const reversed = findReversed(count, preferred)
  const before: Array<Array<number>> = Array.from({ length: count }, () => [])
  const pending = Array.from({ length: count }, () => 0)
  for (const [k, { source, target }] of preferred.entries()) {
    const [first, second] = reversed[k] ? [target, source] : [source, target]
    ;(before[first] as Array<number>).push(second)
    const waiting = pending[second] as number
    pending[second] = waiting + 1
  }

  const position = Array.from({ length: count }, () => -1)
  const ready: Array<number> = []
  for (let i = 0; i < count; i++) {
    if (pending[i] === 0) {
      ready.push(i)
    }
  }
  let next = 0
  while (ready.length > 0) {
    let pick = 0
    for (let k = 1; k < ready.length; k++) {
      if ((ready[k] as number) < (ready[pick] as number)) {
        pick = k
      }
    }
    const item = ready.splice(pick, 1)[0] as number
    position[item] = next++
    for (const after of before[item] as Array<number>) {
      const left = (pending[after] as number) - 1
      pending[after] = left
      if (left === 0) {
        ready.push(after)
      }
    }
  }
  return position
}
