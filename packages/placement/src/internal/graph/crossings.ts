import { coincident } from 'curvy/number'
import { turnOf } from '../orient.ts'
import type { Graph } from './graph.ts'

// Crossings between paths on one graph whose edges are all horizontal or
// vertical. Two paths that meet at a node and part again cross there when
// each runs straight on through it, across the other, or when one does
// and the other starts or ends there, leaving or arriving across it: what
// a path leads to past its end goes on its way. Two that share a run of
// edges, either way along it, cross on it when they come onto it and
// leave it on different sides of each other: the side of each stretch
// next to the run, left of it, straight on in line with it, or right of
// it, as seen along the run. A path that starts or ends on the run
// crosses nothing there, nor do two that both end at the node.

/**
 * Counts the crossings between two paths on one graph.
 *
 * @param graph - The graph the paths run on, with horizontal and vertical
 * edges.
 * @param p - One path's nodes, from start to end.
 * @param q - The other's.
 * @returns How many times the paths cross.
 */
export function crossingsBetween(graph: Graph, p: ArrayLike<number>, q: ArrayLike<number>): number {
  let count = 0
  const crossed = () => {
    count++
  }
  walkShared(graph, p, q, crossed, crossed)
  return count
}

/**
 * Finds the runs that two paths on one graph share and cross each other
 * on, which a search that counts crossings only where paths run straight
 * on across each other does not see.
 *
 * @param graph - The graph the paths run on, with horizontal and vertical
 * edges.
 * @param p - One path's nodes, from start to end.
 * @param q - The other's.
 * @returns The first and last index in `p` of each such run.
 */
export function crossedRuns(
  graph: Graph,
  p: ArrayLike<number>,
  q: ArrayLike<number>,
): Array<readonly [number, number]> {
  const runs: Array<readonly [number, number]> = []
  walkShared(
    graph,
    p,
    q,
    () => {},
    (first, last) => {
      runs.push([first, last])
    },
  )
  return runs
}

/**
 * Prices the runs that one path shares with another and crosses it on (see
 * `crossedRuns`) for a search that counts crossings only where paths run
 * straight on across each other: each node of such a run that `p` runs
 * straight on through counts an equal share of one crossing, in the slot
 * of the search's counts that a path along the run pays for (see
 * `SearchOptions.through`), so that riding the whole run costs what
 * running straight across it does.
 *
 * @param graph - The graph the paths run on, with horizontal and vertical
 * edges.
 * @param p - The path to price, by its nodes.
 * @param q - The path it shares runs with.
 * @param marks - The counts, at `2 * node` horizontally and `2 * node + 1`
 * vertically, which this adds to.
 * @returns Whether it marked any node.
 */
export function markCrossedRuns(
  graph: Graph,
  p: Int32Array,
  q: ArrayLike<number>,
  marks: Float64Array,
): boolean {
  let marked = false
  for (const [from, to] of crossedRuns(graph, p, q)) {
    const nodes = straightOn(graph, p, from, to)
    const vertical = coincident(
      graph.xs[p[from] as number] as number,
      graph.xs[p[to] as number] as number,
    )
    for (const node of nodes) {
      const slot = 2 * node + (vertical ? 0 : 1)
      const count = marks[slot] as number
      marks[slot] = count + 1 / nodes.length
      marked = true
    }
  }
  return marked
}

// The nodes of the run of a path from index `from` to index `to` that the
// path runs straight on through: none when it turns at both ends of a run
// of one edge.
function straightOn(graph: Graph, nodes: Int32Array, from: number, to: number): Array<number> {
  const { xs, ys } = graph
  const inLine = (a: number, b: number, c: number) =>
    (coincident(xs[a] as number, xs[b] as number) &&
      coincident(xs[b] as number, xs[c] as number)) ||
    (coincident(ys[a] as number, ys[b] as number) && coincident(ys[b] as number, ys[c] as number))
  const found: Array<number> = []
  for (let k = Math.max(from, 1); k <= Math.min(to, nodes.length - 2); k++) {
    if (inLine(nodes[k - 1] as number, nodes[k] as number, nodes[k + 1] as number)) {
      found.push(nodes[k] as number)
    }
  }
  return found
}

// Walks `p` past the nodes and runs it shares with `q`, calling `atNode`
// with the index in `p` of each node the paths cross at, and `onRun` with
// the first and last index in `p` of each run they cross on.
function walkShared(
  graph: Graph,
  p: ArrayLike<number>,
  q: ArrayLike<number>,
  atNode: (index: number) => void,
  onRun: (first: number, last: number) => void,
): void {
  const at = new Map<number, number>()
  for (let j = 0; j < q.length; j++) {
    if (!at.has(q[j] as number)) {
      at.set(q[j] as number, j)
    }
  }
  let i = 0
  while (i < p.length) {
    const j = at.get(p[i] as number)
    if (j === undefined) {
      i++
      continue
    }
    // The run the paths share from here, and the way q walks along it.
    const next = p[i + 1]
    const way = next === undefined ? 0 : next === q[j + 1] ? 1 : next === q[j - 1] ? -1 : 0
    if (way === 0) {
      if (throughEach(graph, p[i] as number, p[i - 1], p[i + 1], q[j - 1], q[j + 1])) {
        atNode(i)
      }
      i++
      continue
    }
    let length = 0
    while (i + length + 1 < p.length && p[i + length + 1] === q[j + way * (length + 1)]) {
      length++
    }
    const last = i + length
    const into = [p[i - 1], q[j - way]]
    const out = [p[last + 1], q[j + way * (length + 1)]]
    if (into.every((node) => node !== undefined) && out.every((node) => node !== undefined)) {
      const start = p[i] as number
      const end = p[last] as number
      const first = heading(graph, start, p[i + 1] as number)
      const final = heading(graph, p[last - 1] as number, end)
      const before = into.map((node) => side(graph, first, start, node as number))
      const after = out.map((node) => side(graph, final, end, node as number))
      const [b0, b1] = before as [number, number]
      const [a0, a1] = after as [number, number]
      if (b0 !== b1 && a0 !== a1 && b0 < b1 !== a0 < a1) {
        onRun(i, last)
      }
    }
    i = last + 1
  }
}

// Whether two paths that meet at `node`, and share no edge there, cross
// there: both run straight on through it, or one does and the other starts
// or ends there, leaving or arriving across it.
function throughEach(
  graph: Graph,
  node: number,
  p0: number | undefined,
  p1: number | undefined,
  q0: number | undefined,
  q1: number | undefined,
): boolean {
  // The heading of a path straight on through the node, or of its one arm
  // out of the node where it ends there, or `undefined`.
  const way = (a: number | undefined, b: number | undefined): [number, number] | undefined => {
    if (a === undefined || b === undefined) {
      const arm = a ?? b
      return arm === undefined ? undefined : heading(graph, node, arm)
    }
    const [ux, uy] = heading(graph, a, node)
    const [vx, vy] = heading(graph, node, b)
    return ux === vx && uy === vy ? [ux, uy] : undefined
  }
  const [p, q] = [way(p0, p1), way(q0, q1)]
  const ends = [p0, p1, q0, q1].filter((arm) => arm === undefined).length
  return (
    p !== undefined &&
    q !== undefined &&
    ends <= 1 &&
    (p[0] !== 0 || p[1] !== 0) &&
    (q[0] !== 0 || q[1] !== 0) &&
    p[0] * q[0] + p[1] * q[1] === 0
  )
}

// The unit heading from one node to another, by the signs of the axis
// distances.
function heading(graph: Graph, from: number, to: number): [number, number] {
  return [
    Math.sign((graph.xs[to] as number) - (graph.xs[from] as number)),
    Math.sign((graph.ys[to] as number) - (graph.ys[from] as number)),
  ]
}

// Where the stretch from `node` to `arm` lies next to a run that heads
// along `run` and starts or ends at `node`: `-1` to the left, as seen
// along the run, `0` in line with it, and `1` to the right, with the Y
// axis down.
function side(graph: Graph, run: [number, number], node: number, arm: number): number {
  return turnOf(run, heading(graph, node, arm))
}
