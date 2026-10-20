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
// preferred pairs as it can, the weightier first: each edge prefers its
// source before its target. The edges are taken from the heaviest down, and
// in input order among equals, and each that would close a cycle with those
// taken before it is left out, so a cycle breaks at its lightest edge. Every
// edge weighs the same when `weights` leaves it out. Among the items that
// are free to go next, the lowest index goes first, so items without a
// preference between them keep input order.
export function preferredOrder(
  count: number,
  preferred: ReadonlyArray<DirectedEdge>,
  weights: ReadonlyArray<number> = [],
): Array<number> {
  const weight = (k: number) => weights[k] ?? 0
  const taken = [...preferred.keys()].toSorted((a, b) => weight(b) - weight(a) || a - b)
  const before: Array<Array<number>> = Array.from({ length: count }, () => [])
  const pending = Array.from({ length: count }, () => 0)
  // Whether `to` already follows `from` through the edges taken.
  const follows = (from: number, to: number) => {
    const seen = new Uint8Array(count)
    const stack = [from]
    seen[from] = 1
    while (stack.length > 0) {
      const node = stack.pop() as number
      if (node === to) {
        return true
      }
      for (const next of before[node] as Array<number>) {
        if (seen[next] === 0) {
          seen[next] = 1
          stack.push(next)
        }
      }
    }
    return false
  }
  for (const k of taken) {
    const { source, target } = preferred[k] as DirectedEdge
    if (source === target || follows(target, source)) {
      continue
    }
    ;(before[source] as Array<number>).push(target)
    const waiting = pending[target] as number
    pending[target] = waiting + 1
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
