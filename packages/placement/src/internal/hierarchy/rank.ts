import { RELATIVE_TOLERANCE } from 'curvy/number'

// Layer assignment by network simplex (Gansner, Koutsofios, North, and Vo,
// "A Technique for Drawing Directed Graphs", 1993). The solver minimizes the
// weighted sum of edge lengths, sum(weight * (rank(head) - rank(tail))),
// subject to rank(head) - rank(tail) >= minLength for every edge.
//
// Ranks and minimum lengths are integers, so the ranking arithmetic is exact.
// Weights can be any non-negative number, so cut values are float sums. A cut
// value counts as negative only below a tolerance relative to the total
// weight (see PRECISION.md, "Degeneracy of distributed space"). Otherwise
// cancellation residue could make the solver pivot forever.

export interface RankEdge {
  readonly tail: number
  readonly head: number
  readonly weight: number
  readonly minLength: number
}

// Merges parallel edges: their weights add and the longest minimum length
// wins. The result keeps first-appearance order.
function simplify(edges: ReadonlyArray<RankEdge>): Array<RankEdge> {
  const merged = new Map<
    string,
    { tail: number; head: number; weight: number; minLength: number }
  >()

  for (const edge of edges) {
    const key = `${edge.tail}:${edge.head}`
    const existing = merged.get(key)
    if (existing === undefined) {
      merged.set(key, { ...edge })
    } else {
      existing.weight += edge.weight
      existing.minLength = Math.max(existing.minLength, edge.minLength)
    }
  }

  return [...merged.values()]
}

// Returns an integer rank per node. Every edge must point from tail to head
// in an acyclic graph. Each connected component is ranked on its own and
// normalized so that its smallest rank is 0.
export function rank(nodeCount: number, input: ReadonlyArray<RankEdge>): Array<number> {
  const edges = simplify(input)
  const ranks: Array<number> = Array.from({ length: nodeCount }, () => 0)

  const incident: Array<Array<number>> = Array.from({ length: nodeCount }, () => [])
  for (const [index, edge] of edges.entries()) {
    incident[edge.tail]?.push(index)
    incident[edge.head]?.push(index)
  }

  const component = Array.from({ length: nodeCount }, () => -1)
  let componentCount = 0

  for (let start = 0; start < nodeCount; start++) {
    if (component[start] !== -1) {
      continue
    }

    const nodes: Array<number> = []
    const stack = [start]
    component[start] = componentCount

    while (stack.length > 0) {
      const node = stack.pop() as number
      nodes.push(node)
      for (const edgeIndex of incident[node] as Array<number>) {
        const edge = edges[edgeIndex] as RankEdge
        const other = edge.tail === node ? edge.head : edge.tail
        if (component[other] === -1) {
          component[other] = componentCount
          stack.push(other)
        }
      }
    }

    nodes.sort((a, b) => a - b)
    const componentEdges = edges
      .map((_, index) => index)
      .filter((index) => component[(edges[index] as RankEdge).tail] === componentCount)

    networkSimplex(nodes, edges, componentEdges, incident, ranks)
    componentCount++
  }

  return ranks
}

function networkSimplex(
  nodes: ReadonlyArray<number>,
  edges: ReadonlyArray<RankEdge>,
  componentEdges: ReadonlyArray<number>,
  incident: ReadonlyArray<ReadonlyArray<number>>,
  ranks: Array<number>,
): void {
  if (nodes.length === 1) {
    ranks[nodes[0] as number] = 0
    return
  }

  initRanks(nodes, edges, componentEdges, ranks)

  const slack = (index: number): number => {
    const edge = edges[index] as RankEdge
    return (ranks[edge.head] as number) - (ranks[edge.tail] as number) - edge.minLength
  }

  // Feasible tight tree. Grow a tree of tight edges (slack 0) from the first
  // node. When it stops growing, shift the tree by the smallest slack among
  // the edges that leave it, which makes that edge tight.
  const inTree = new Map<number, boolean>()
  const isTreeEdge = new Uint8Array(edges.length)
  const root = nodes[0] as number
  inTree.set(root, true)

  const growTightTree = (): number => {
    const stack = [...inTree.keys()]
    while (stack.length > 0) {
      const node = stack.pop() as number
      for (const edgeIndex of incident[node] as ReadonlyArray<number>) {
        const edge = edges[edgeIndex] as RankEdge
        const other = edge.tail === node ? edge.head : edge.tail
        if (!inTree.has(other) && slack(edgeIndex) === 0) {
          inTree.set(other, true)
          isTreeEdge[edgeIndex] = 1
          stack.push(other)
        }
      }
    }
    return inTree.size
  }

  while (growTightTree() < nodes.length) {
    let best = -1
    let bestSlack = Number.POSITIVE_INFINITY
    for (const edgeIndex of componentEdges) {
      const edge = edges[edgeIndex] as RankEdge
      if (inTree.has(edge.tail) !== inTree.has(edge.head)) {
        const s = slack(edgeIndex)
        if (s < bestSlack) {
          best = edgeIndex
          bestSlack = s
        }
      }
    }
    const edge = edges[best] as RankEdge
    const delta = inTree.has(edge.tail) ? bestSlack : -bestSlack
    for (const node of inTree.keys()) {
      const current = ranks[node] as number
      ranks[node] = current + delta
    }
  }

  // Tree bookkeeping: postorder numbers (lim), the smallest lim in each
  // subtree (low), and the parent edge of each node.
  const low = new Map<number, number>()
  const lim = new Map<number, number>()
  const parent = new Map<number, number>()
  const parentEdge = new Map<number, number>()
  const cut = new Map<number, number>()

  const treeNeighbors = (node: number): Array<[edge: number, other: number]> => {
    const result: Array<[number, number]> = []
    for (const edgeIndex of incident[node] as ReadonlyArray<number>) {
      if (isTreeEdge[edgeIndex] === 1) {
        const edge = edges[edgeIndex] as RankEdge
        result.push([edgeIndex, edge.tail === node ? edge.head : edge.tail])
      }
    }
    return result
  }

  const postorder: Array<number> = []

  const assignLowLim = (): void => {
    postorder.length = 0
    parent.clear()
    parentEdge.clear()
    let nextLim = 1
    const visited = new Set<number>([root])
    const stack: Array<{
      node: number
      low: number
      neighbors: Array<[number, number]>
      i: number
    }> = [{ node: root, low: nextLim, neighbors: treeNeighbors(root), i: 0 }]

    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as (typeof stack)[number]
      if (frame.i < frame.neighbors.length) {
        const [edgeIndex, other] = frame.neighbors[frame.i] as [number, number]
        frame.i++
        if (!visited.has(other)) {
          visited.add(other)
          parent.set(other, frame.node)
          parentEdge.set(other, edgeIndex)
          stack.push({ node: other, low: nextLim, neighbors: treeNeighbors(other), i: 0 })
        }
        continue
      }
      low.set(frame.node, frame.low)
      lim.set(frame.node, nextLim++)
      postorder.push(frame.node)
      stack.pop()
    }
  }

  // The cut value of a tree edge is the weight of the edges crossing the cut
  // from the tail component to the head component, minus the weight crossing
  // back. Computing children first lets each node reuse its children's values.
  const assignCutValues = (): void => {
    cut.clear()
    for (const child of postorder) {
      if (child === root) {
        continue
      }
      const parentNode = parent.get(child) as number
      const treeEdgeIndex = parentEdge.get(child) as number
      const treeEdge = edges[treeEdgeIndex] as RankEdge
      const childIsTail = treeEdge.tail === child
      let value = treeEdge.weight

      for (const edgeIndex of incident[child] as ReadonlyArray<number>) {
        if (edgeIndex === treeEdgeIndex) {
          continue
        }
        const edge = edges[edgeIndex] as RankEdge
        const isOut = edge.tail === child
        const other = isOut ? edge.head : edge.tail
        if (other === parentNode) {
          continue
        }
        const pointsToHead = isOut === childIsTail
        value += pointsToHead ? edge.weight : -edge.weight
        if (isTreeEdge[edgeIndex] === 1) {
          const otherCut = cut.get(edgeIndex) as number
          value += pointsToHead ? -otherCut : otherCut
        }
      }

      cut.set(treeEdgeIndex, value)
    }
  }

  const isDescendant = (node: number, subtreeRoot: number): boolean => {
    const nodeLim = lim.get(node) as number
    return (
      (low.get(subtreeRoot) as number) <= nodeLim && nodeLim <= (lim.get(subtreeRoot) as number)
    )
  }

  const updateRanks = (): void => {
    // Reverse postorder visits every parent before its children.
    for (let i = postorder.length - 1; i >= 0; i--) {
      const node = postorder[i] as number
      if (node === root) {
        continue
      }
      const edge = edges[parentEdge.get(node) as number] as RankEdge
      const parentRank = ranks[parent.get(node) as number] as number
      ranks[node] = edge.tail === node ? parentRank - edge.minLength : parentRank + edge.minLength
    }
  }

  let totalWeight = 0
  for (const edgeIndex of componentEdges) {
    totalWeight += (edges[edgeIndex] as RankEdge).weight
  }
  const tolerance = RELATIVE_TOLERANCE * totalWeight

  assignLowLim()
  assignCutValues()

  // Network simplex terminates in theory, but degenerate pivots can cycle.
  // The cap is far above the iteration counts that real inputs reach.
  const maxIterations = 50 * (nodes.length + componentEdges.length)

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let leaving = -1
    for (const edgeIndex of componentEdges) {
      if (isTreeEdge[edgeIndex] === 1 && (cut.get(edgeIndex) as number) < -tolerance) {
        leaving = edgeIndex
        break
      }
    }
    if (leaving === -1) {
      break
    }

    // The entering edge crosses the same cut in the other direction, with
    // the least slack.
    const leavingEdge = edges[leaving] as RankEdge
    const flip = (lim.get(leavingEdge.tail) as number) > (lim.get(leavingEdge.head) as number)
    const subtreeRoot = flip ? leavingEdge.head : leavingEdge.tail

    let entering = -1
    let enteringSlack = Number.POSITIVE_INFINITY
    for (const edgeIndex of componentEdges) {
      const edge = edges[edgeIndex] as RankEdge
      if (
        flip === isDescendant(edge.tail, subtreeRoot) &&
        flip !== isDescendant(edge.head, subtreeRoot)
      ) {
        const s = slack(edgeIndex)
        if (s < enteringSlack) {
          entering = edgeIndex
          enteringSlack = s
        }
      }
    }
    if (entering === -1) {
      break
    }

    isTreeEdge[leaving] = 0
    isTreeEdge[entering] = 1
    assignLowLim()
    assignCutValues()
    updateRanks()
  }

  let minRank = Number.POSITIVE_INFINITY
  for (const node of nodes) {
    minRank = Math.min(minRank, ranks[node] as number)
  }
  for (const node of nodes) {
    const current = ranks[node] as number
    ranks[node] = current - minRank
  }
}

// Longest-path initial ranking. Each node sits as low as its successors
// allow, with sinks at rank 0. The result is feasible: every edge spans at
// least its minimum length.
function initRanks(
  nodes: ReadonlyArray<number>,
  edges: ReadonlyArray<RankEdge>,
  componentEdges: ReadonlyArray<number>,
  ranks: Array<number>,
): void {
  const outDegree = new Map<number, number>()
  const incoming = new Map<number, Array<number>>()
  for (const node of nodes) {
    outDegree.set(node, 0)
    incoming.set(node, [])
  }
  for (const edgeIndex of componentEdges) {
    const edge = edges[edgeIndex] as RankEdge
    outDegree.set(edge.tail, (outDegree.get(edge.tail) as number) + 1)
    incoming.get(edge.head)?.push(edgeIndex)
  }

  const assigned = new Map<number, number>()
  const queue = nodes.filter((node) => outDegree.get(node) === 0)
  for (const node of queue) {
    assigned.set(node, 0)
  }

  for (let i = 0; i < queue.length; i++) {
    const node = queue[i] as number
    const nodeRank = assigned.get(node) as number
    for (const edgeIndex of incoming.get(node) as Array<number>) {
      const edge = edges[edgeIndex] as RankEdge
      const candidate = nodeRank - edge.minLength
      const current = assigned.get(edge.tail)
      assigned.set(edge.tail, current === undefined ? candidate : Math.min(current, candidate))
      const remaining = (outDegree.get(edge.tail) as number) - 1
      outDegree.set(edge.tail, remaining)
      if (remaining === 0) {
        queue.push(edge.tail)
      }
    }
  }

  for (const node of nodes) {
    ranks[node] = assigned.get(node) ?? 0
  }
}
