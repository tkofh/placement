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
// A path may start at any of several endpoints and end at any of several,
// each with the headings it allows, so one search can choose a port.
//
// Costs are float sums, so comparing them uses `coincident`. A path replaces
// another only when it is cheaper beyond rounding, or as cheap with fewer
// turns, and the queue pops equal costs in the order they were pushed, so
// remaining ties go to the first path found, which follows the order of
// each node's edges.

export interface Endpoint {
  readonly node: number
  // The headings the path may leave or arrive with, as vectors of any
  // length. Any heading when omitted.
  readonly headings?: ReadonlyArray<PointLike> | undefined
}

export interface SearchOptions {
  // The cost of each turn. Defaults to `0`.
  readonly bendCost?: number
  // Added to the cost of each clockwise or counterclockwise turn, as seen on
  // screen, where the Y axis points down. Both default to `0`.
  readonly clockwiseCost?: number
  readonly counterclockwiseCost?: number
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
  // The endpoints the path starts and ends at, by index.
  readonly start: number
  readonly end: number
}

const before = (a: number, b: number) => a < b && !coincident(a, b)

/**
 * Finds the cheapest path from any of the starts to any of the ends. Among
 * paths of equal cost, the one with fewer turns wins. A path never reverses
 * along its own heading. An edge between coincident points has no heading,
 * so a turn across it is free.
 *
 * @param graph - The graph to search.
 * @param from - The start node, or the endpoints the path may start at.
 * @param to - The end node, or the endpoints the path may end at.
 * @param options - The costs and constraints of the path.
 * @returns The cheapest path, or `undefined` when no path meets the
 * constraints. A path from a node to itself, through waypoints at that
 * node, is that node alone at no cost, when the end allows any heading.
 */
export function shortestPath(
  graph: Graph,
  from: number | ReadonlyArray<Endpoint>,
  to: number | ReadonlyArray<Endpoint>,
  options: SearchOptions = {},
): Path | undefined {
  const { xs, ys, offsets, sources, targets, weights } = graph
  const weightOf = (e: number) => (weights === undefined ? 1 : (weights[e] as number))
  const dxOf = (e: number) =>
    (xs[targets[e] as number] as number) - (xs[sources[e] as number] as number)
  const dyOf = (e: number) =>
    (ys[targets[e] as number] as number) - (ys[sources[e] as number] as number)
  const nodeCount = xs.length
  const valid = (node: number) => Number.isInteger(node) && node >= 0 && node < nodeCount
  const starts = endpoints(from)
  const ends = endpoints(to)
  const via = options.via ?? []
  if (
    starts.length === 0 ||
    ends.length === 0 ||
    ![...starts, ...ends].every(({ node }) => valid(node)) ||
    !via.every(valid)
  ) {
    return undefined
  }
  const bendCost = finiteCost(options.bendCost)
  const clockwiseCost = bendCost + finiteCost(options.clockwiseCost)
  const counterclockwiseCost = bendCost + finiteCost(options.counterclockwiseCost)
  const avoid = (options.avoid ?? []).filter(
    (r) =>
      Number.isFinite(r.left) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.right) &&
      Number.isFinite(r.bottom),
  )

  // Leg `k` leads to waypoint `k`, and the last leg to the ends.
  const lastLeg = via.length
  const legCount = lastLeg + 1
  // The first leg from `leg` on whose waypoint is not `node`.
  const passed = (leg: number, node: number) => {
    let next = leg
    while (next < lastLeg && via[next] === node) {
      next++
    }
    return next
  }
  // The first end at `node` that allows arriving along (dx, dy), or -1.
  const arrival = (node: number, dx: number, dy: number, length: number) =>
    ends.findIndex((end) => end.node === node && matches(end.headings, dx, dy, length))

  for (const [index, start] of starts.entries()) {
    if (passed(0, start.node) === lastLeg) {
      const end = ends.findIndex((e) => e.node === start.node && e.headings === undefined)
      if (end !== -1) {
        return { nodes: Int32Array.of(start.node), cost: 0, start: index, end }
      }
    }
  }

  const distance = graph.orthogonal
    ? (a: number, b: number) =>
        Math.abs((xs[a] as number) - (xs[b] as number)) +
        Math.abs((ys[a] as number) - (ys[b] as number))
    : (a: number, b: number) =>
        Math.hypot((xs[a] as number) - (xs[b] as number), (ys[a] as number) - (ys[b] as number))
  const toEnd = (node: number) => {
    let nearest = Number.POSITIVE_INFINITY
    for (const end of ends) {
      nearest = Math.min(nearest, distance(node, end.node))
    }
    return nearest
  }
  // The fewest turns from `node`, heading along (hx, hy), to `target`, on a
  // graph whose edges are horizontal or vertical: none when the target lies
  // straight ahead, one when it lies ahead or level off to one side, and two
  // when it lies behind. Going straight never lowers the count, and a turn
  // lowers it by at most one, so the estimate stays a lower bound that A*
  // can trust. Within rounding, a target counts as aligned and ahead, the
  // lower count.
  const turnsTo = (node: number, target: number, hx: number, hy: number) => {
    const dx = (xs[target] as number) - (xs[node] as number)
    const dy = (ys[target] as number) - (ys[node] as number)
    const band = RELATIVE_TOLERANCE * (Math.abs(dx) + Math.abs(dy))
    const ahead = dx * hx + dy * hy >= -band
    if (Math.abs(dx * hy - dy * hx) <= band) {
      return ahead ? 0 : 2
    }
    return ahead ? 1 : 2
  }
  const turnCost = graph.orthogonal ? bendCost : 0
  // What is left after reaching the waypoint of each leg.
  const rest = new Float64Array(legCount)
  for (let leg = lastLeg - 1; leg >= 0; leg--) {
    const at = via[leg] as number
    rest[leg] =
      leg === lastLeg - 1
        ? toEnd(at)
        : (rest[leg + 1] as number) + distance(at, via[leg + 1] as number)
  }
  // A lower bound on the cost left from the state that arrived along `e`.
  const estimate = (leg: number, e: number) => {
    const node = targets[e] as number
    const hx = Math.sign(dxOf(e))
    const hy = Math.sign(dyOf(e))
    const turns = (target: number) =>
      turnCost > 0 && (hx !== 0 || hy !== 0) ? turnCost * turnsTo(node, target, hx, hy) : 0
    if (leg < lastLeg) {
      const at = via[leg] as number
      return graph.minWeight * (distance(node, at) + (rest[leg] as number)) + turns(at)
    }
    let best = Number.POSITIVE_INFINITY
    for (const end of ends) {
      best = Math.min(best, graph.minWeight * distance(node, end.node) + turns(end.node))
    }
    return best
  }

  const edgeCount = targets.length
  const stateCount = legCount * edgeCount
  const cost = new Float64Array(stateCount).fill(Number.POSITIVE_INFINITY)
  const bends = new Int32Array(stateCount)
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

  const relax = (state: number, total: number, turns: number, from: number) => {
    const known = cost[state] as number
    const better =
      known === Number.POSITIVE_INFINITY ||
      (coincident(total, known) ? turns < (bends[state] as number) : total < known)
    if (better) {
      cost[state] = total
      bends[state] = turns
      parent[state] = from
      const leg = Math.floor(state / edgeCount)
      queue.push(total + estimate(leg, state - leg * edgeCount), turns, state)
    }
  }

  for (const start of starts) {
    const leg = passed(0, start.node)
    for (let e = offsets[start.node] as number; e < (offsets[start.node + 1] as number); e++) {
      const dx = dxOf(e)
      const dy = dyOf(e)
      const length = lengthOf(dx, dy)
      if (open(e) && matches(start.headings, dx, dy, length)) {
        relax(leg * edgeCount + e, length * weightOf(e), 0, -1)
      }
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
    const turns = bends[state] as number
    const ax = dxOf(e)
    const ay = dyOf(e)
    const la = lengthOf(ax, ay)

    if (leg < lastLeg && node === via[leg]) {
      relax(passed(leg, node) * edgeCount + e, total, turns, state)
      continue
    }
    if (leg === lastLeg) {
      const end = arrival(node, ax, ay, la)
      if (end !== -1) {
        const nodes = trace(state, parent, sources, targets, edgeCount)
        const first = nodes[0] as number
        const leave = firstState(state, parent) % edgeCount
        const dx = dxOf(leave)
        const dy = dyOf(leave)
        const start = starts.findIndex(
          (s) => s.node === first && matches(s.headings, dx, dy, lengthOf(dx, dy)),
        )
        return { nodes, cost: total, start, end }
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
      let turned = 0
      if (la > 0 && lb > 0) {
        const cross = ax * by - ay * bx
        if (Math.abs(cross) > RELATIVE_TOLERANCE * la * lb) {
          turn = cross > 0 ? clockwiseCost : counterclockwiseCost
          turned = 1
        } else if (ax * bx + ay * by < 0) {
          continue
        }
      }
      relax(leg * edgeCount + f, total + lb * weightOf(f) + turn, turns + turned, state)
    }
  }
  return undefined
}

interface Resolved {
  readonly node: number
  readonly headings: Array<Direction> | undefined
}

const endpoints = (value: number | ReadonlyArray<Endpoint>): Array<Resolved> =>
  typeof value === 'number'
    ? [{ node: value, headings: undefined }]
    : value.map(({ node, headings: list }) => ({ node, headings: headings(list) }))

// The state a path starts with: the first of its chain of parents.
function firstState(state: number, parent: Int32Array): number {
  let current = state
  while ((parent[current] as number) !== -1) {
    current = parent[current] as number
  }
  return current
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
  sources: Int32Array,
  targets: Int32Array,
  edgeCount: number,
): Int32Array {
  const nodes: Array<number> = []
  let current = state
  let first = state
  while (current !== -1) {
    const previous = parent[current] as number
    if (previous === -1 || previous % edgeCount !== current % edgeCount) {
      nodes.push(targets[current % edgeCount] as number)
    }
    first = current
    current = previous
  }
  nodes.push(sources[first % edgeCount] as number)
  return Int32Array.from(nodes.toReversed())
}

// A binary heap of states by priority, then by turns. Priorities within
// rounding distance pop with fewer turns first, then in the order they were
// pushed.
class Queue {
  #priorities: Array<number> = []
  #turns: Array<number> = []
  #states: Array<number> = []
  #order: Array<number> = []
  #pushed = 0

  get size(): number {
    return this.#states.length
  }

  push(priority: number, turns: number, state: number): void {
    this.#priorities.push(priority)
    this.#turns.push(turns)
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
    this.#turns.pop()
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
    if (!coincident(p, q)) {
      return p < q
    }
    const s = this.#turns[a] as number
    const t = this.#turns[b] as number
    return s === t ? (this.#order[a] as number) < (this.#order[b] as number) : s < t
  }

  #swap(a: number, b: number): void {
    swap(this.#priorities, a, b)
    swap(this.#turns, a, b)
    swap(this.#states, a, b)
    swap(this.#order, a, b)
  }
}

function swap(list: Array<number>, a: number, b: number): void {
  const held = list[a] as number
  list[a] = list[b] as number
  list[b] = held
}
