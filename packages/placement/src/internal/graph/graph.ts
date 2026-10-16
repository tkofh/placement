import type { Rect } from '../../rect.ts'

// A graph of points in the plane, joined by straight edges. It is stored as
// flat arrays in compressed sparse rows: the edges that leave node `i` are
// the half-edges `offsets[i]` up to `offsets[i + 1]`, in the order given.
// An undirected edge is two half-edges, one each way. Searches index their
// state by half-edge and work out its length and heading from the points as
// they go, which costs less than storing them for every half-edge.

export interface Graph {
  readonly xs: Float64Array
  readonly ys: Float64Array
  readonly offsets: Int32Array
  // The node each half-edge leaves from, and the node it leads to.
  readonly sources: Int32Array
  readonly targets: Int32Array
  // The cost of each half-edge per unit of length, or `undefined` when every
  // half-edge costs `1`. `Infinity` closes a half-edge.
  readonly weights: Float64Array | undefined
  // Whether every edge is horizontal or vertical, which lets a search
  // estimate the remaining length by the sum of the axis distances.
  readonly orthogonal: boolean
  // The smallest weight, which scales a search's estimate of what is left.
  readonly minWeight: number
}

// A rect that routes avoid, by the coordinates of its edges. A `Rect` is one.
export type Obstacle = Pick<Rect, 'left' | 'top' | 'right' | 'bottom'>

export interface GraphEdge {
  readonly from: number
  readonly to: number
  // The cost per unit of length, `1` by default.
  readonly weight?: number
}

/**
 * Builds a graph from points and undirected edges. Each node lists its edges
 * in input order. An edge from a node to itself, to a node that does not
 * exist, or with a negative or `NaN` weight is ignored.
 *
 * @param xs - The x coordinate of each node.
 * @param ys - The y coordinate of each node.
 * @param edges - The edges between nodes, by index.
 * @returns The graph.
 */
export function fromEdges(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  edges: ReadonlyArray<GraphEdge>,
): Graph {
  const count = xs.length
  const kept = edges.filter(
    ({ from, to, weight = 1 }) =>
      Number.isInteger(from) &&
      Number.isInteger(to) &&
      from >= 0 &&
      to >= 0 &&
      from < count &&
      to < count &&
      from !== to &&
      weight >= 0,
  )
  const offsets = new Int32Array(count + 1)
  for (const { from, to } of kept) {
    bump(offsets, from + 1, 1)
    bump(offsets, to + 1, 1)
  }
  for (let i = 0; i < count; i++) {
    bump(offsets, i + 1, offsets[i] as number)
  }
  const fill = offsets.slice(0, count)
  const targets = new Int32Array(2 * kept.length)
  const weights = kept.some(({ weight = 1 }) => weight !== 1)
    ? new Float64Array(2 * kept.length)
    : undefined
  for (const { from, to, weight = 1 } of kept) {
    const out = fill[from] as number
    fill[from] = out + 1
    const back = fill[to] as number
    fill[to] = back + 1
    targets[out] = to
    targets[back] = from
    if (weights !== undefined) {
      weights[out] = weight
      weights[back] = weight
    }
  }
  return fromRows(Float64Array.from(xs), Float64Array.from(ys), offsets, targets, weights)
}

function bump(list: Int32Array, index: number, amount: number): void {
  const value = list[index] as number
  list[index] = value + amount
}

/**
 * Builds a graph from its rows: the half-edges of each node, already
 * grouped. Each half-edge needs its twin in the target's row.
 *
 * @param xs - The x coordinate of each node.
 * @param ys - The y coordinate of each node.
 * @param offsets - Where each node's half-edges start, and where the last
 * one ends.
 * @param targets - The node each half-edge leads to.
 * @param weights - The weight of each half-edge, all `1` when omitted.
 * @param orthogonal - Whether every edge is horizontal or vertical, checked
 * when omitted.
 * @returns The graph.
 */
export function fromRows(
  xs: Float64Array,
  ys: Float64Array,
  offsets: Int32Array,
  targets: Int32Array,
  weights?: Float64Array,
  orthogonal?: boolean,
): Graph {
  const sources = new Int32Array(targets.length)
  let straight = true
  for (let node = 0; node < xs.length; node++) {
    const start = offsets[node] as number
    const end = offsets[node + 1] as number
    for (let e = start; e < end; e++) {
      sources[e] = node
    }
    if (orthogonal === undefined && straight) {
      for (let e = start; e < end; e++) {
        const to = targets[e] as number
        straight = xs[to] === xs[node] || ys[to] === ys[node]
        if (!straight) {
          break
        }
      }
    }
  }
  let minWeight = 1
  if (weights !== undefined) {
    minWeight = Number.POSITIVE_INFINITY
    for (const weight of weights) {
      minWeight = Math.min(minWeight, weight)
    }
    if (!Number.isFinite(minWeight)) {
      minWeight = 0
    }
  }
  return {
    xs,
    ys,
    offsets,
    sources,
    targets,
    weights,
    orthogonal: orthogonal ?? straight,
    minWeight,
  }
}
