import { RELATIVE_TOLERANCE, coincident } from 'curvy/number'
import type { PointLike } from '../../point.ts'
import type { Graph, Obstacle } from './graph.ts'

// Shortest paths on a graph of points, for a cost of weighted length plus a
// cost per turn. A turn depends on the heading a path arrives with, so the
// search's state is the half-edge it arrived along, not the node. Waypoints
// add layers of that state: a path at its next waypoint moves to the next
// layer at no cost, so one search finds the best route through all of them,
// with the turns at the waypoints counted. The search is A*, with an
// estimate of the remaining length that never exceeds it: the distance to
// the next waypoint plus the distances between the rest, by the sum of the
// axis distances on a graph whose edges are all horizontal or vertical, and
// in a straight line otherwise.
//
// Two edges run straight on when their cross product is within rounding of
// zero, relative to their lengths, and their dot product is positive.
//
// Costs are float sums, so comparing them uses `coincident`. A path replaces
// another only when it is cheaper beyond rounding, and the queue pops equal
// costs in the order they were pushed, so ties go to the first path found,
// which follows the order of each node's edges.

export interface SearchOptions {
  // The cost of each turn. Defaults to `0`.
  readonly bendCost?: number
  // Added to the cost of each clockwise or counterclockwise turn, as seen on
  // screen, where the Y axis points down. Both default to `0`.
  readonly clockwiseCost?: number
  readonly counterclockwiseCost?: number
  // The headings the path may leave its start with, and arrive at its end
  // with, as vectors of any length. Any heading when omitted.
  readonly depart?: ReadonlyArray<PointLike>
  readonly arrive?: ReadonlyArray<PointLike>
  // The nodes the path passes through, in order.
  readonly via?: ReadonlyArray<number>
  // Rects whose interior the path may not cross. It may run along their
  // edges.
  readonly avoid?: ReadonlyArray<Obstacle>
}

export interface Path {
  // The nodes along the path, from start to end.
  readonly nodes: Int32Array
  readonly cost: number
}

const before = (a: number, b: number) => a < b && !coincident(a, b)

/**
 * Finds the cheapest path between two nodes. A path never reverses along
 * its own heading. An edge between coincident points has no heading, so a
 * turn across it is free.
 *
 * @param graph - The graph to search.
 * @param from - The start node.
 * @param to - The end node.
 * @param options - The costs and constraints of the path.
 * @returns The cheapest path, or `undefined` when no path meets the
 * constraints. A path that starts at its end, through waypoints at the same
 * node, is that node alone at no cost.
 */
export function shortestPath(
  graph: Graph,
  from: number,
  to: number,
  options: SearchOptions = {},
): Path | undefined {
  const { xs, ys, offsets, sources, targets, weights } = graph
  const weightOf = (e: number) => (weights === undefined ? 1 : (weights[e] as number))
  const dxOf = (e: number) =>
    (xs[targets[e] as number] as number) - (xs[sources[e] as number] as number)
  const dyOf = (e: number) =>
    (ys[targets[e] as number] as number) - (ys[sources[e] as number] as number)
  const nodeCount = xs.length
  const stops = [...(options.via ?? []), to]
  if ([from, ...stops].some((node) => !Number.isInteger(node) || node < 0 || node >= nodeCount)) {
    return undefined
  }
  const bendCost = finiteCost(options.bendCost)
  const clockwiseCost = bendCost + finiteCost(options.clockwiseCost)
  const counterclockwiseCost = bendCost + finiteCost(options.counterclockwiseCost)
  const depart = headings(options.depart)
  const arrive = headings(options.arrive)
  const avoid = (options.avoid ?? []).filter(
    (r) =>
      Number.isFinite(r.left) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.right) &&
      Number.isFinite(r.bottom),
  )

  // The first leg still to travel: waypoints at the start are passed.
  const firstLeg = passed(stops, 0, from)
  if (firstLeg === stops.length) {
    return { nodes: Int32Array.of(from), cost: 0 }
  }

  const distance = graph.orthogonal
    ? (a: number, b: number) =>
        Math.abs((xs[a] as number) - (xs[b] as number)) +
        Math.abs((ys[a] as number) - (ys[b] as number))
    : (a: number, b: number) =>
        Math.hypot((xs[a] as number) - (xs[b] as number), (ys[a] as number) - (ys[b] as number))
  // What is left after reaching the stop of each leg.
  const rest = new Float64Array(stops.length)
  for (let leg = stops.length - 2; leg >= 0; leg--) {
    rest[leg] = (rest[leg + 1] as number) + distance(stops[leg] as number, stops[leg + 1] as number)
  }
  const estimate = (leg: number, node: number) =>
    graph.minWeight * (distance(node, stops[leg] as number) + (rest[leg] as number))

  const edgeCount = targets.length
  const stateCount = stops.length * edgeCount
  const cost = new Float64Array(stateCount).fill(Number.POSITIVE_INFINITY)
  const parent = new Int32Array(stateCount).fill(-1)
  const closed = new Uint8Array(stateCount)
  const queue = new Queue()

  // Whether each half-edge may be used: 0 unknown, 1 open, 2 closed.
  const usable = new Uint8Array(edgeCount)
  const open = (e: number) => {
    if (usable[e] === 0) {
      const weight = weightOf(e)
      const a = sources[e] as number
      const b = targets[e] as number
      const blocked =
        weight === Number.POSITIVE_INFINITY ||
        avoid.some((region) =>
          crosses(region, xs[a] as number, ys[a] as number, xs[b] as number, ys[b] as number),
        )
      usable[e] = blocked ? 2 : 1
    }
    return usable[e] === 1
  }

  const relax = (state: number, total: number, from: number) => {
    const known = cost[state] as number
    if (known === Number.POSITIVE_INFINITY || (total < known && !coincident(total, known))) {
      cost[state] = total
      parent[state] = from
      const leg = Math.floor(state / edgeCount)
      queue.push(total + estimate(leg, targets[state - leg * edgeCount] as number), state)
    }
  }

  for (let e = offsets[from] as number; e < (offsets[from + 1] as number); e++) {
    const dx = dxOf(e)
    const dy = dyOf(e)
    const length = lengthOf(dx, dy)
    if (open(e) && matches(depart, dx, dy, length)) {
      relax(firstLeg * edgeCount + e, length * weightOf(e), -1)
    }
  }

  while (queue.size > 0) {
    const state = queue.pop()
    if (closed[state] === 1) {
      continue
    }
    closed[state] = 1
    const leg = Math.floor(state / edgeCount)
    const e = state - leg * edgeCount
    const node = targets[e] as number
    const total = cost[state] as number
    const ax = dxOf(e)
    const ay = dyOf(e)
    const la = lengthOf(ax, ay)

    if (node === stops[leg]) {
      const next = passed(stops, leg, node)
      if (next === stops.length) {
        if (matches(arrive, ax, ay, la)) {
          return { nodes: trace(state, parent, targets, edgeCount, from), cost: total }
        }
      } else {
        relax(next * edgeCount + e, total, state)
        continue
      }
    }

    for (let f = offsets[node] as number; f < (offsets[node + 1] as number); f++) {
      if (!open(f)) {
        continue
      }
      const bx = dxOf(f)
      const by = dyOf(f)
      const lb = lengthOf(bx, by)
      let turn = 0
      if (la > 0 && lb > 0) {
        const cross = ax * by - ay * bx
        if (Math.abs(cross) > RELATIVE_TOLERANCE * la * lb) {
          turn = cross > 0 ? clockwiseCost : counterclockwiseCost
        } else if (ax * bx + ay * by < 0) {
          continue
        }
      }
      relax(leg * edgeCount + f, total + lb * weightOf(f) + turn, state)
    }
  }
  return undefined
}

const finiteCost = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : 0

// The length of a vector, exact when it is horizontal or vertical.
const lengthOf = (dx: number, dy: number) =>
  dx === 0 ? Math.abs(dy) : dy === 0 ? Math.abs(dx) : Math.hypot(dx, dy)

interface Direction extends PointLike {
  readonly length: number
}

// The headings with their lengths, or `undefined` for any heading. Headings
// without a direction are dropped.
function headings(list: ReadonlyArray<PointLike> | undefined): Array<Direction> | undefined {
  if (list === undefined) {
    return undefined
  }
  const result: Array<Direction> = []
  for (const { x, y } of list) {
    const length = lengthOf(x, y)
    if (length > 0 && Number.isFinite(length)) {
      result.push({ x, y, length })
    }
  }
  return result
}

// Whether a vector of the given length points along one of the headings.
const matches = (
  list: ReadonlyArray<Direction> | undefined,
  x: number,
  y: number,
  length: number,
) =>
  list === undefined ||
  (length > 0 &&
    list.some(
      (h) =>
        Math.abs(h.x * y - h.y * x) <= RELATIVE_TOLERANCE * h.length * length &&
        h.x * x + h.y * y > 0,
    ))

// The first leg from `leg` on whose stop is not `node`.
function passed(stops: ReadonlyArray<number>, leg: number, node: number): number {
  let next = leg
  while (next < stops.length && stops[next] === node) {
    next++
  }
  return next
}

// Whether the segment from (x1, y1) to (x2, y2) crosses the interior of the
// rect. The segment is clipped to the closed rect (Liang and Barsky), and the
// middle of what is left lies strictly inside unless the segment only runs
// along an edge or touches a corner.
function crosses(r: Obstacle, x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  const clip = (p: number, q: number) => {
    if (p === 0) {
      return q >= 0
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) {
        return false
      }
      t0 = Math.max(t0, t)
    } else {
      if (t < t0) {
        return false
      }
      t1 = Math.min(t1, t)
    }
    return true
  }
  if (!(clip(-dx, x1 - r.left) && clip(dx, r.right - x1))) {
    return false
  }
  if (!(clip(-dy, y1 - r.top) && clip(dy, r.bottom - y1))) {
    return false
  }
  const t = (t0 + t1) / 2
  const x = x1 + dx * t
  const y = y1 + dy * t
  return before(r.left, x) && before(x, r.right) && before(r.top, y) && before(y, r.bottom)
}

// The nodes of the path that ends in `state`. A state whose parent arrived
// along the same half-edge moved to the next leg there, and adds no node.
function trace(
  state: number,
  parent: Int32Array,
  targets: Int32Array,
  edgeCount: number,
  from: number,
): Int32Array {
  const nodes: Array<number> = []
  let current = state
  while (current !== -1) {
    const previous = parent[current] as number
    if (previous === -1 || previous % edgeCount !== current % edgeCount) {
      nodes.push(targets[current % edgeCount] as number)
    }
    current = previous
  }
  nodes.push(from)
  return Int32Array.from(nodes.toReversed())
}

// A binary heap of states by priority. Priorities within rounding distance
// pop in the order they were pushed.
class Queue {
  #priorities: Array<number> = []
  #states: Array<number> = []
  #order: Array<number> = []
  #pushed = 0

  get size(): number {
    return this.#states.length
  }

  push(priority: number, state: number): void {
    this.#priorities.push(priority)
    this.#states.push(state)
    this.#order.push(this.#pushed++)
    let i = this.#states.length - 1
    while (i > 0) {
      const up = (i - 1) >> 1
      if (!this.#first(i, up)) {
        break
      }
      this.#swap(i, up)
      i = up
    }
  }

  pop(): number {
    const top = this.#states[0] as number
    const last = this.#states.length - 1
    this.#swap(0, last)
    this.#priorities.pop()
    this.#states.pop()
    this.#order.pop()
    let i = 0
    for (;;) {
      const left = 2 * i + 1
      const right = left + 1
      let best = i
      if (left < last && this.#first(left, best)) {
        best = left
      }
      if (right < last && this.#first(right, best)) {
        best = right
      }
      if (best === i) {
        return top
      }
      this.#swap(i, best)
      i = best
    }
  }

  #first(a: number, b: number): boolean {
    const p = this.#priorities[a] as number
    const q = this.#priorities[b] as number
    return coincident(p, q) ? (this.#order[a] as number) < (this.#order[b] as number) : p < q
  }

  #swap(a: number, b: number): void {
    swap(this.#priorities, a, b)
    swap(this.#states, a, b)
    swap(this.#order, a, b)
  }
}

function swap(list: Array<number>, a: number, b: number): void {
  const held = list[a] as number
  list[a] = list[b] as number
  list[b] = held
}
