import { describe, expect, test } from 'vitest'
import { crossedRuns, crossingsBetween } from '../src/internal/graph/crossings.ts'
import {
  type Graph,
  type GraphEdge,
  type Obstacle,
  fromEdges,
} from '../src/internal/graph/graph.ts'
import {
  type Endpoint,
  type SearchOptions,
  markAlong,
  markThrough,
  searchAll,
  shortestPath,
} from '../src/internal/graph/search.ts'
import {
  ALL_DIRECTIONS,
  DOWN,
  LEFT,
  type Pin,
  RIGHT,
  UP,
  visibilityGraph,
} from '../src/internal/graph/visibility.ts'
import * as Rect from '../src/rect.ts'

// A visibility graph as four neighbors per node, up, right, down, and left,
// `-1` where a node has none.
interface Grid {
  readonly xs: Float64Array
  readonly ys: Float64Array
  readonly neighbors: Int32Array
  readonly pins: Int32Array
}

function build(obstacles: ReadonlyArray<Obstacle>, pins: ReadonlyArray<Pin>): Grid {
  const { graph, pins: pinNodes } = visibilityGraph(obstacles, pins)
  const neighbors = new Int32Array(graph.xs.length * 4).fill(-1)
  for (let node = 0; node < graph.xs.length; node++) {
    for (let e = graph.offsets[node] as number; e < (graph.offsets[node + 1] as number); e++) {
      const target = graph.targets[e] as number
      const dx = Math.sign((graph.xs[target] as number) - (graph.xs[node] as number))
      const dy = Math.sign((graph.ys[target] as number) - (graph.ys[node] as number))
      const direction = dy < 0 ? UP : dx > 0 ? RIGHT : dy > 0 ? DOWN : LEFT
      // Every edge is horizontal or vertical, one per direction.
      expect(graph.sources[e]).toBe(node)
      expect(Math.abs(dx) + Math.abs(dy)).toBe(1)
      expect(neighbors[4 * node + direction]).toBe(-1)
      neighbors[4 * node + direction] = graph.targets[e] as number
    }
  }
  return { xs: graph.xs, ys: graph.ys, neighbors, pins: pinNodes }
}

const box = (left: number, top: number, right: number, bottom: number): Obstacle => ({
  left,
  top,
  right,
  bottom,
})

const free = (x: number, y: number): Pin => ({ x, y, directions: ALL_DIRECTIONS })

const nodes = (graph: Grid) => [...graph.xs].map((x, i) => [x, graph.ys[i]])

// The edges as pairs of points, each from a node to its right or lower
// neighbor.
function edges(graph: Grid): Array<[number, number, number, number]> {
  const result: Array<[number, number, number, number]> = []
  for (let i = 0; i < graph.xs.length; i++) {
    for (const direction of [RIGHT, DOWN]) {
      const j = graph.neighbors[4 * i + direction] as number
      if (j !== -1) {
        result.push([
          graph.xs[i] as number,
          graph.ys[i] as number,
          graph.xs[j] as number,
          graph.ys[j] as number,
        ])
      }
    }
  }
  return result
}

function nodeAt(graph: Grid, x: number, y: number): number {
  for (let i = 0; i < graph.xs.length; i++) {
    if (graph.xs[i] === x && graph.ys[i] === y) {
      return i
    }
  }
  return -1
}

// The points next to a node, up, right, down, and left, or `null`.
function around(graph: Grid, node: number): Array<[number, number] | null> {
  return [UP, RIGHT, DOWN, LEFT].map((direction) => {
    const j = graph.neighbors[4 * node + direction] as number
    return j === -1 ? null : [graph.xs[j] as number, graph.ys[j] as number]
  })
}

const inside = (o: Obstacle, x: number, y: number) =>
  o.left < x && x < o.right && o.top < y && y < o.bottom

describe('visibilityGraph', () => {
  test('nothing makes an empty graph', () => {
    const graph = build([], [])
    expect(graph.xs.length).toBe(0)
    expect(graph.pins.length).toBe(0)
  })

  test('one obstacle is a ring around its corners', () => {
    const graph = build([box(0, 0, 10, 20)], [])
    expect(nodes(graph)).toEqual([
      [0, 0],
      [10, 0],
      [0, 20],
      [10, 20],
    ])
    expect(edges(graph)).toEqual([
      [0, 0, 10, 0],
      [0, 0, 0, 20],
      [10, 0, 10, 20],
      [0, 20, 10, 20],
    ])
  })

  test('a rect is an obstacle, by its edges', () => {
    expect(build([Rect.make(0, 0, 10, 20)], [])).toEqual(build([box(0, 0, 10, 20)], []))
  })

  test('lines stop where they meet the interior of an obstacle', () => {
    const graph = build([box(0, 0, 10, 10), box(20, 5, 30, 15)], [])
    expect(nodes(graph)).toEqual([
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
      // The top of the second obstacle starts at the side of the first.
      [10, 5],
      [20, 5],
      [30, 5],
      // The bottom of the first ends at the side of the second.
      [0, 10],
      [10, 10],
      [20, 10],
      [0, 15],
      [10, 15],
      [20, 15],
      [30, 15],
    ])
    // The left side of the first obstacle skips y = 5, which the top of the
    // second does not reach.
    expect(around(graph, nodeAt(graph, 0, 10))).toEqual([[0, 0], [10, 10], [0, 15], null])
    expect(around(graph, nodeAt(graph, 20, 10))).toEqual([[20, 5], null, [20, 15], [10, 10]])
  })

  test('a corner inside another obstacle makes no lines', () => {
    const obstacles = [box(0, 0, 20, 20), box(10, 10, 30, 30)]
    const graph = build(obstacles, [])
    expect(nodeAt(graph, 20, 20)).toBe(-1)
    expect(nodeAt(graph, 10, 10)).toBe(-1)
    // The outline of the union is a ring with two notches.
    expect(nodes(graph)).toEqual([
      [0, 0],
      [20, 0],
      [30, 0],
      [20, 10],
      [30, 10],
      [0, 20],
      [10, 20],
      [0, 30],
      [10, 30],
      [30, 30],
    ])
  })

  test('an obstacle without area blocks nothing, and a non-finite one is ignored', () => {
    const graph = build([box(0, 0, 10, 10), box(5, -5, 5, 15), box(0, Number.NaN, 4, 4)], [])
    // The zero-width obstacle adds lines through its ends, but its own
    // vertical line stops at the interior of the first obstacle.
    expect(nodes(graph)).toEqual([-5, 0, 10, 15].flatMap((y) => [0, 5, 10].map((x) => [x, y])))
    // Horizontal lines cross it.
    expect(around(graph, nodeAt(graph, 5, 0))).toEqual([[5, -5], [10, 0], null, [0, 0]])
  })
})

describe('pins', () => {
  test('a free pin joins the lines in every direction', () => {
    const graph = build([box(0, 0, 10, 10), box(20, 0, 30, 10)], [free(15, 5)])
    const pin = graph.pins[0] as number
    expect([graph.xs[pin], graph.ys[pin]]).toEqual([15, 5])
    expect(around(graph, pin)).toEqual([
      [15, 0],
      [20, 5],
      [15, 10],
      [10, 5],
    ])
  })

  test('a pin leaves only in its directions', () => {
    const graph = build(
      [box(0, 0, 10, 10)],
      [{ x: 5, y: -4, directions: (1 << UP) | (1 << RIGHT) }],
    )
    const pin = graph.pins[0] as number
    // Up and right reach the bounds, the pin itself and the obstacle.
    expect(around(graph, pin)).toEqual([null, [10, -4], null, null])
    expect(nodes(graph)).toContainEqual([10, -4])
  })

  test('a pin passes through its owner, but not through other obstacles', () => {
    const obstacles = [box(-2, -2, 12, 12), box(20, 0, 30, 10)]
    const owned = build(obstacles, [{ x: 10, y: 5, directions: 1 << RIGHT, owner: 0 }])
    const pin = owned.pins[0] as number
    expect(around(owned, pin)).toEqual([null, [12, 5], null, null])
    // The lines of the second obstacle's top and bottom stop at the first.
    expect(around(owned, nodeAt(owned, 12, 5))).toEqual([
      [12, 0],
      [20, 5],
      [12, 10],
      [10, 5],
    ])

    const buried = build(obstacles, [{ x: 10, y: 5, directions: 1 << RIGHT }])
    expect(around(buried, buried.pins[0] as number)).toEqual([null, null, null, null])
  })

  test('a pin without directions joins a line that passes through it', () => {
    const graph = build([box(0, 0, 10, 10)], [{ x: 4, y: 0, directions: 0 }])
    expect(around(graph, graph.pins[0] as number)).toEqual([null, [10, 0], null, [0, 0]])
  })

  test('pins at one point share a node, and a pin on a corner is the corner', () => {
    const graph = build([box(0, 0, 10, 10)], [free(10, 0), free(20, 5), free(20, 5)])
    expect([...graph.pins]).toEqual([
      nodeAt(graph, 10, 0),
      nodeAt(graph, 20, 5),
      nodeAt(graph, 20, 5),
    ])
  })

  test('a pin can sit outside the obstacles, which widens the bounds', () => {
    const graph = build([box(0, 0, 10, 10)], [free(-10, 20)])
    expect(around(graph, graph.pins[0] as number)).toEqual([[-10, 10], [0, 20], null, null])
  })
})

describe('precision', () => {
  // Two boxes that touch, from rounded and exact sums.
  const touching = (gap: number) => [box(0, 0, 0.1 + 0.2, 0.25), box(0.3 + gap, 0.125, 0.5, 0.5)]

  test('noise where edges meet does not change the graph', () => {
    const noisy = build(touching(0), [])
    const exact = build([box(0, 0, 0.3, 0.25), box(0.3, 0.125, 0.5, 0.5)], [])
    expect([...noisy.neighbors]).toEqual([...exact.neighbors])
    expect(noisy.xs.length).toBe(exact.xs.length)
  })

  test('lines within rounding distance merge, at the pin among them', () => {
    const graph = build([box(0, 0, 0.3, 0.25)], [{ x: 0.1 + 0.2, y: 0.5, directions: 1 << UP }])
    const pin = graph.pins[0] as number
    expect(graph.xs[pin]).toBe(0.1 + 0.2)
    // One vertical line runs down the right side to the pin.
    expect(new Set(graph.xs)).toEqual(new Set([0, 0.1 + 0.2]))
    expect(around(graph, nodeAt(graph, 0.1 + 0.2, 0))).toEqual([
      null,
      null,
      [0.1 + 0.2, 0.25],
      [0, 0],
    ])
  })

  test('scaling the input does not change the graph', () => {
    const obstacles = [box(0.1, 0.2, 0.7, 0.9), box(1.3, 0.1, 2.9, 0.4), box(0.9, 1.1, 1.7, 2.3)]
    const scaled = obstacles.map((o) =>
      box(o.left * 1e6, o.top * 1e6, o.right * 1e6, o.bottom * 1e6),
    )
    const a = build(obstacles, [free(1.1, 0.7)])
    const b = build(scaled, [free(1.1e6, 0.7e6)])
    expect([...b.neighbors]).toEqual([...a.neighbors])
    expect([...b.pins]).toEqual([...a.pins])
  })
})

// A deterministic scene: integer obstacles that may overlap, and free pins
// outside their interiors.
function randomScene(seed: number, count: number, pinCount: number) {
  let state = seed
  const next = (n: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return Math.floor((state / 2147483648) * n)
  }
  const obstacles: Array<Obstacle> = []
  for (let i = 0; i < count; i++) {
    const left = next(40)
    const top = next(40)
    obstacles.push(box(left, top, left + 2 + next(10), top + 2 + next(10)))
  }
  const pins: Array<Pin> = []
  while (pins.length < pinCount) {
    const x = next(52)
    const y = next(52)
    if (!obstacles.some((o) => inside(o, x, y))) {
      pins.push(free(x, y))
    }
  }
  return { obstacles, pins }
}

// The cheapest route cost between two points of a graph given as adjacency,
// for a cost of length plus `bend` per turn.
function cheapest(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  neighbors: ArrayLike<number>,
  from: number,
  to: number,
  bend: number,
): number {
  const count = xs.length * 4
  const cost = new Float64Array(count).fill(Number.POSITIVE_INFINITY)
  const done = new Uint8Array(count)
  for (let d = 0; d < 4; d++) {
    cost[4 * from + d] = 0
  }
  for (;;) {
    let best = -1
    for (let s = 0; s < count; s++) {
      if (done[s] === 0 && (best === -1 || (cost[s] as number) < (cost[best] as number))) {
        best = s
      }
    }
    if (best === -1 || cost[best] === Number.POSITIVE_INFINITY) {
      return Number.POSITIVE_INFINITY
    }
    const node = best >> 2
    if (node === to) {
      return cost[best] as number
    }
    done[best] = 1
    for (let d = 0; d < 4; d++) {
      const j = neighbors[4 * node + d] as number
      if (j === -1) {
        continue
      }
      const length =
        Math.abs((xs[j] as number) - (xs[node] as number)) +
        Math.abs((ys[j] as number) - (ys[node] as number))
      const turn = node === from || (best & 3) === d ? 0 : bend
      const total = (cost[best] as number) + length + turn
      if (total < (cost[4 * j + d] as number)) {
        cost[4 * j + d] = total
      }
    }
  }
}

// The cheapest route cost between two points of a graph given as adjacency,
// for a cost of length plus `bend` per turn, where two turns one way and
// then the other around a run shorter than `2 * radius` cost `bend * run /
// radius` together (see `SearchOptions.radius`): a plain Dijkstra over the
// node, the heading, the node a run that short began at with a turn, and
// the way that turn went, to check the search against.
function cheapestWithRadius(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  neighbors: ArrayLike<number>,
  from: number,
  to: number,
  bend: number,
  radius: number,
): number {
  const count = xs.length
  const reach = 2 * radius
  const distance = (a: number, b: number) =>
    Math.abs((xs[a] as number) - (xs[b] as number)) +
    Math.abs((ys[a] as number) - (ys[b] as number))
  const share = (length: number) => Math.min(1, length / reach)
  // `count` as the origin means none.
  const key = (node: number, d: number, origin: number, way: number) =>
    ((node * 4 + d) * (count + 1) + origin) * 2 + way
  const cost = new Map<number, number>()
  const open: Array<[number, number]> = []
  const relax = (k: number, total: number) => {
    if (total < (cost.get(k) ?? Number.POSITIVE_INFINITY)) {
      cost.set(k, total)
      open.push([total, k])
    }
  }
  for (let d = 0; d < 4; d++) {
    relax(key(from, d, count, 0), 0)
  }
  let best = Number.POSITIVE_INFINITY
  while (open.length > 0) {
    let at = 0
    for (const [i, entry] of open.entries()) {
      if (entry[0] < (open[at] as [number, number])[0]) {
        at = i
      }
    }
    const [total, k] = open.splice(at, 1)[0] as [number, number]
    if (total > (cost.get(k) as number) || total >= best) {
      if (total >= best) {
        break
      }
      continue
    }
    const way = k % 2
    const origin = Math.floor(k / 2) % (count + 1)
    const d = Math.floor(k / 2 / (count + 1)) % 4
    const node = Math.floor(k / 2 / (count + 1) / 4)
    const paid = origin === count ? 0 : share(distance(origin, node))
    const owed = origin === count ? 0 : bend * (1 - paid)
    if (node === to) {
      best = Math.min(best, total + owed)
    }
    for (let next = 0; next < 4; next++) {
      const j = neighbors[4 * node + next] as number
      if (j === -1) {
        continue
      }
      const length = distance(node, j)
      if (node === from && total === 0) {
        relax(key(j, next, count, 0), length)
      } else if (next === d) {
        if (origin !== count && distance(origin, j) < reach) {
          relax(
            key(j, next, origin, way),
            total + length + bend * (share(distance(origin, j)) - paid),
          )
        } else {
          relax(key(j, next, count, 0), total + length + owed)
        }
      } else if ((next - d + 4) % 4 !== 2) {
        const turning = (next - d + 4) % 4 === 1 ? 0 : 1
        if (origin !== count && turning !== way) {
          relax(key(j, next, count, 0), total + length + bend * paid)
        } else if (length < reach) {
          relax(key(j, next, node, turning), total + length + owed + bend * share(length))
        } else {
          relax(key(j, next, count, 0), total + length + owed + bend)
        }
      }
    }
  }
  return best
}

// What a path costs for its length plus `bend` per turn, where two turns one
// way and then the other around a run shorter than `2 * radius` cost `bend *
// run / radius` together, pairs taken from the start.
function jogCost(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  nodes: ArrayLike<number>,
  bend: number,
  radius: number,
): number {
  const reach = 2 * radius
  const runs: Array<{ d: number; length: number }> = []
  for (let i = 1; i < nodes.length; i++) {
    const dx = (xs[nodes[i] as number] as number) - (xs[nodes[i - 1] as number] as number)
    const dy = (ys[nodes[i] as number] as number) - (ys[nodes[i - 1] as number] as number)
    const d = dx > 0 ? RIGHT : dx < 0 ? LEFT : dy > 0 ? DOWN : UP
    const length = Math.abs(dx) + Math.abs(dy)
    const last = runs.at(-1)
    if (last !== undefined && last.d === d) {
      last.length += length
    } else {
      runs.push({ d, length })
    }
  }
  let total = runs.reduce((sum, run) => sum + run.length, 0)
  const ways = runs
    .slice(1)
    .map((run, i) => ((run.d - (runs[i] as { d: number }).d + 4) % 4 === 1 ? 0 : 1) as number)
  let i = 0
  while (i < ways.length) {
    const run = (runs[i + 1] as { length: number }).length
    if (i + 1 < ways.length && ways[i] !== ways[i + 1] && run < reach) {
      total += (2 * bend * run) / reach
      i += 2
    } else {
      total += bend
      i += 1
    }
  }
  return total
}

// Whether two headings are the same, or with `s` of `-1`, opposite.
const same = (a: readonly [number, number], b: readonly [number, number], s = 1) =>
  a[0] === s * b[0] && a[1] === s * b[1]

// What a path on a graph whose edges are all horizontal or vertical costs,
// by the rules the search prices it by (see `SearchOptions`): its length;
// `bend` per turn, where two turns one way and then the other around a run
// shorter than `2 * radius` cost `bend * run / radius` together, pairs taken
// from the start; `crossing` per path it runs straight across, as `through`
// counts them; a run that begins with a turn and ends with one the other
// way, across the paths that run along it at both ends, or for a run past
// twice the radius, that ran along it where it began and do where it ends,
// one at most; and a dodge: a jog shorter than twice the radius that brings
// the path back onto the line it left by another such jog the other way
// pays what staying on that line would have, less what the way around
// paid.
function costOfPath(
  graph: Graph,
  nodes: ReadonlyArray<number>,
  bend: number,
  radius: number,
  crossing: number,
  through: ArrayLike<number>,
): number {
  const { xs, ys } = graph
  const reach = 2 * radius
  const count = (node: number, slot: number) => through[2 * node + slot] ?? 0
  const sign = (a: number, b: number): [number, number] => [
    Math.sign((xs[b] as number) - (xs[a] as number)),
    Math.sign((ys[b] as number) - (ys[a] as number)),
  ]
  // The runs, each with its heading, its first and last index, and length.
  const runs: Array<{ d: [number, number]; from: number; to: number; length: number }> = []
  let total = 0
  for (let i = 1; i < nodes.length; i++) {
    const [a, b] = [nodes[i - 1] as number, nodes[i] as number]
    const d = sign(a, b)
    const length =
      Math.abs((xs[b] as number) - (xs[a] as number)) +
      Math.abs((ys[b] as number) - (ys[a] as number))
    total += length
    const last = runs.at(-1)
    if (last !== undefined && last.d[0] === d[0] && last.d[1] === d[1]) {
      last.to = i
      last.length += length
      // Straight on through the node between.
      total += crossing * count(a, d[1] === 0 ? 1 : 0)
    } else {
      runs.push({ d, from: i - 1, to: i, length })
    }
  }
  // Which way each turn goes, `0` clockwise, at the start of run `r`.
  const wayAt = (r: number) => {
    const [u, v] = [
      (runs[r - 1] as { d: [number, number] }).d,
      (runs[r] as { d: [number, number] }).d,
    ]
    return u[0] * v[1] - u[1] * v[0] > 0 ? 0 : 1
  }
  let r = 1
  while (r < runs.length) {
    const run = runs[r] as { length: number }
    if (r + 1 < runs.length && wayAt(r) !== wayAt(r + 1) && run.length < reach) {
      total += (2 * bend * run.length) / reach
      r += 2
    } else {
      total += bend
      r += 1
    }
  }
  for (let k = 1; k + 1 < runs.length; k++) {
    const run = runs[k] as { d: [number, number]; from: number; to: number; length: number }
    if (wayAt(k) === wayAt(k + 1)) {
      continue
    }
    const along = run.d[1] === 0 ? 0 : 1
    const [start, end] = [nodes[run.from] as number, nodes[run.to] as number]
    total +=
      crossing *
      (run.length < reach
        ? Math.min(count(start, along), count(end, along))
        : count(start, along) > 0
          ? Math.min(1, count(end, along))
          : 0)
  }
  for (let k = 3; k + 1 < runs.length; k++) {
    const [line, away, beside, back, on] = runs.slice(k - 3, k + 2) as Array<{
      d: [number, number]
      from: number
      to: number
      length: number
    }>
    if (
      !(line && away && beside && back && on) ||
      !same(line.d, beside.d) ||
      !same(line.d, on.d) ||
      !same(away.d, back.d, -1) ||
      ![away, back].every(({ length }) => length < reach)
    ) {
      continue
    }
    const [left, here] = [nodes[away.from] as number, nodes[on.from] as number]
    const [hx, hy] = on.d
    if ((hy === 0 ? ys : xs)[left] !== (hy === 0 ? ys : xs)[here]) {
      continue
    }
    // What staying on the line would have cost, if the line runs there.
    let at = left
    let stay = count(at, hy === 0 ? 1 : 0)
    while (at !== here) {
      let step = -1
      for (let e = graph.offsets[at] as number; e < (graph.offsets[at + 1] as number); e++) {
        const [dx, dy] = sign(at, graph.targets[e] as number)
        if (dx === hx && dy === hy) {
          step = graph.targets[e] as number
        }
      }
      if (
        step < 0 ||
        Math.abs((hy === 0 ? xs : ys)[step]! - (hy === 0 ? xs : ys)[left]!) > beside.length
      ) {
        stay = Number.NaN
        break
      }
      at = step
      stay += count(at, hy === 0 ? 1 : 0)
    }
    if (Number.isNaN(stay)) {
      continue
    }
    // What the way around paid: straight across inside its runs, and its
    // two jogs.
    let paid = 0
    for (let i = away.from + 1; i < back.to; i++) {
      const [u, v] = [
        sign(nodes[i - 1] as number, nodes[i] as number),
        sign(nodes[i] as number, nodes[i + 1] as number),
      ]
      if (u[0] === v[0] && u[1] === v[1]) {
        paid += count(nodes[i] as number, u[1] === 0 ? 1 : 0)
      }
    }
    const jog = away.d[1] === 0 ? 0 : 1
    paid += Math.min(count(nodes[away.from] as number, jog), count(nodes[away.to] as number, jog))
    paid += Math.min(count(nodes[back.from] as number, jog), count(nodes[back.to] as number, jog))
    total += crossing * Math.max(stay - paid, 0)
  }
  return total
}

// The cheapest of every path without a repeated node between two nodes,
// by `costOfPath`.
function cheapestByPaths(
  graph: Graph,
  from: number,
  to: number,
  bend: number,
  radius: number,
  crossing: number,
  through: ArrayLike<number>,
): number {
  let best = Number.POSITIVE_INFINITY
  const path = [from]
  const seen = new Set([from])
  const walk = (node: number) => {
    if (node === to) {
      best = Math.min(best, costOfPath(graph, path, bend, radius, crossing, through))
      return
    }
    for (let e = graph.offsets[node] as number; e < (graph.offsets[node + 1] as number); e++) {
      const next = graph.targets[e] as number
      if (!seen.has(next)) {
        seen.add(next)
        path.push(next)
        walk(next)
        path.pop()
        seen.delete(next)
      }
    }
  }
  walk(from)
  return best
}

// Every point on the grid of all obstacle and pin coordinates that lies
// outside every interior, joined to its grid neighbors when the step between
// them stays outside every interior. Any optimal route runs on this grid.
function fullGrid(obstacles: ReadonlyArray<Obstacle>, pins: ReadonlyArray<Pin>) {
  const xs = [...new Set([...obstacles.flatMap((o) => [o.left, o.right]), ...pins.map((p) => p.x)])]
  const ys = [...new Set([...obstacles.flatMap((o) => [o.top, o.bottom]), ...pins.map((p) => p.y)])]
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)
  const blocked = (x: number, y: number) => obstacles.some((o) => inside(o, x, y))
  const index = (i: number, j: number) => j * xs.length + i
  const neighbors = new Int32Array(xs.length * ys.length * 4).fill(-1)
  const px: Array<number> = []
  const py: Array<number> = []
  for (const [j, y] of ys.entries()) {
    for (const [i, x] of xs.entries()) {
      px.push(x)
      py.push(y)
      if (blocked(x, y)) {
        continue
      }
      const right = xs[i + 1]
      if (right !== undefined && !blocked(right, y) && !blocked((x + right) / 2, y)) {
        neighbors[4 * index(i, j) + RIGHT] = index(i + 1, j)
        neighbors[4 * index(i + 1, j) + LEFT] = index(i, j)
      }
      const below = ys[j + 1]
      if (below !== undefined && !blocked(x, below) && !blocked(x, (y + below) / 2)) {
        neighbors[4 * index(i, j) + DOWN] = index(i, j + 1)
        neighbors[4 * index(i, j + 1) + UP] = index(i, j)
      }
    }
  }
  const pinNodes = pins.map((p) => index(xs.indexOf(p.x), ys.indexOf(p.y)))
  return { xs: px, ys: py, neighbors, pins: pinNodes }
}

describe('random scenes', () => {
  test.each([1, 2, 3, 4, 5, 6, 7, 8])('scene %i keeps its invariants', (seed) => {
    const { obstacles, pins } = randomScene(seed, 12, 4)
    const graph = build(obstacles, pins)
    const opposite = [DOWN, LEFT, UP, RIGHT]
    for (let i = 0; i < graph.xs.length; i++) {
      const x = graph.xs[i] as number
      const y = graph.ys[i] as number
      expect(obstacles.some((o) => inside(o, x, y))).toBe(false)
      for (const direction of [UP, RIGHT, DOWN, LEFT]) {
        const j = graph.neighbors[4 * i + direction] as number
        if (j === -1) {
          continue
        }
        expect(graph.neighbors[4 * j + (opposite[direction] as number)]).toBe(i)
        const dx = (graph.xs[j] as number) - x
        const dy = (graph.ys[j] as number) - y
        const step = [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ][direction] as [number, number]
        // A step moves along its direction only, and its middle stays
        // outside every interior.
        expect(Math.sign(dx)).toBe(step[0])
        expect(Math.sign(dy)).toBe(step[1])
        expect(obstacles.some((o) => inside(o, x + dx / 2, y + dy / 2))).toBe(false)
      }
    }
  })

  test.each(Array.from({ length: 24 }, (_, i) => i + 1))(
    'scene %i has the cheapest routes of the full grid',
    (seed) => {
      const { obstacles, pins } = randomScene(seed, 12, 4)
      const graph = build(obstacles, pins)
      const grid = fullGrid(obstacles, pins)
      for (const bend of [0, 7, 100]) {
        for (let a = 0; a < pins.length; a++) {
          for (let b = a + 1; b < pins.length; b++) {
            const expected = cheapest(
              grid.xs,
              grid.ys,
              grid.neighbors,
              grid.pins[a] as number,
              grid.pins[b] as number,
              bend,
            )
            const actual = cheapest(
              graph.xs,
              graph.ys,
              graph.neighbors,
              graph.pins[a] as number,
              graph.pins[b] as number,
              bend,
            )
            expect(actual).toBe(expected)
          }
        }
      }
    },
  )
})

// A graph from a list of points and pairs of point indices.
function graphOf(
  points: ReadonlyArray<readonly [number, number]>,
  pairs: ReadonlyArray<readonly [number, number] | GraphEdge>,
): Graph {
  return fromEdges(
    points.map(([x]) => x),
    points.map(([, y]) => y),
    pairs.map((pair) => ('from' in pair ? pair : { from: pair[0], to: pair[1] })),
  )
}

// A square ring: 0 top left, 1 top right, 2 bottom right, 3 bottom left.
const ring = graphOf(
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ],
)

const route = (
  graph: Graph,
  from: number | ReadonlyArray<Endpoint>,
  to: number | ReadonlyArray<Endpoint>,
  options?: SearchOptions,
) => {
  const path = shortestPath(graph, from, to, options)
  return path === undefined ? undefined : { nodes: [...path.nodes], cost: path.cost }
}

describe('fromEdges', () => {
  test('each node lists its edges in input order, both ways', () => {
    expect([...ring.offsets]).toEqual([0, 2, 4, 6, 8])
    expect([...ring.targets]).toEqual([1, 3, 0, 2, 1, 3, 2, 0])
    expect([...ring.sources]).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect(ring.weights).toBeUndefined()
    expect(ring.orthogonal).toBe(true)
    expect(ring.minWeight).toBe(1)
  })

  test('invalid edges are ignored', () => {
    const graph = graphOf(
      [
        [0, 0],
        [3, 4],
      ],
      [
        [0, 0],
        [0, 2],
        [-1, 1],
        [0.5, 1],
        { from: 0, to: 1, weight: Number.NaN },
        { from: 0, to: 1, weight: -1 },
        { from: 1, to: 0, weight: 2 },
      ],
    )
    expect([...graph.targets]).toEqual([1, 0])
    expect([...(graph.weights ?? [])]).toEqual([2, 2])
    expect(graph.orthogonal).toBe(false)
    expect(graph.minWeight).toBe(2)
  })
})

describe('shortestPath', () => {
  test('equal paths go to the first edge listed', () => {
    expect(route(ring, 0, 2)).toEqual({ nodes: [0, 1, 2], cost: 20 })
  })

  test('a path to its start is the start alone', () => {
    expect(route(ring, 2, 2)).toEqual({ nodes: [2], cost: 0 })
    expect(route(ring, 2, 2, { via: [2, 2] })).toEqual({ nodes: [2], cost: 0 })
  })

  test('unknown nodes and unreachable ends have no path', () => {
    const split = graphOf(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      [[0, 1]],
    )
    expect(route(split, 0, 2)).toBeUndefined()
    expect(route(ring, 0, 4)).toBeUndefined()
    expect(route(ring, -1, 2)).toBeUndefined()
    expect(route(ring, 0, 2, { via: [1.5] })).toBeUndefined()
  })

  test('collinear edges do not turn', () => {
    const graph = graphOf(
      [
        [0, 0],
        [5, 0],
        [10, 0],
        [10, 10],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    )
    expect(route(graph, 0, 3, { bendCost: 100 })).toEqual({ nodes: [0, 1, 2, 3], cost: 120 })
  })

  // A zigzag of length 40 with four turns, two clockwise and two
  // counterclockwise (0, 1, 2, 3, 4, 5), and a detour of length 50 with two
  // clockwise turns (0, 6, 7, 5).
  const zigzag = graphOf(
    [
      [0, 0],
      [10, 0],
      [10, 5],
      [20, 5],
      [20, 0],
      [30, 0],
      [0, -10],
      [30, -10],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [0, 6],
      [6, 7],
      [7, 5],
    ],
  )

  test.each([
    [0, [0, 1, 2, 3, 4, 5], 40],
    [4, [0, 1, 2, 3, 4, 5], 56],
    [10, [0, 6, 7, 5], 70],
  ])('a bend cost of %i trades length for turns', (bendCost, nodes, cost) => {
    expect(route(zigzag, 0, 5, { bendCost })).toEqual({ nodes, cost })
  })

  test.each([
    ['clockwise', { clockwiseCost: 5 }, 10],
    ['counterclockwise', { counterclockwiseCost: 5 }, 0],
  ])('a cost on %s turns sends the path the other way around', (_, options, side) => {
    const { graph, pins } = visibilityGraph([box(0, 0, 10, 10)], [free(-5, 5), free(15, 5)])
    const path = shortestPath(graph, pins[0] as number, pins[1] as number, options)
    const ys = [...(path?.nodes ?? [])].map((node) => graph.ys[node])
    expect(ys).toContain(side)
    expect(path?.cost).toBe(30)
  })

  test('a turn cost adds to the bend cost', () => {
    // The zigzag costs 40 + 2 * 5 + 2 * 7 = 64, the detour 50 + 2 * 5.
    expect(route(zigzag, 0, 5, { bendCost: 4, clockwiseCost: 1, counterclockwiseCost: 3 })).toEqual(
      { nodes: [0, 6, 7, 5], cost: 60 },
    )
  })

  test.each([
    ['leaving down', [{ node: 0, headings: [{ x: 0, y: 3 }] }], 2, { nodes: [0, 3, 2], cost: 20 }],
    ['arriving down', 0, [{ node: 2, headings: [{ x: 0, y: 1 }] }], { nodes: [0, 1, 2], cost: 20 }],
    ['arriving left', 0, [{ node: 2, headings: [{ x: -1, y: 0 }] }], undefined],
    ['leaving in no direction', [{ node: 0, headings: [{ x: 0, y: 0 }] }], 2, undefined],
  ] as const)('headings constrain the ends: %s', (_, from, to, expected) => {
    expect(route(ring, from, to)).toEqual(expected)
  })

  test('the cheapest of several starts and ends wins, and the path names them', () => {
    const path = shortestPath(
      ring,
      [{ node: 0 }, { node: 1, headings: [{ x: -1, y: 0 }] }, { node: 1 }],
      [{ node: 3, headings: [{ x: 1, y: 0 }] }, { node: 2 }],
    )
    expect(path).toEqual({ nodes: Int32Array.of(1, 2), cost: 10, start: 2, end: 1 })
    expect(shortestPath(ring, [], 2)).toBeUndefined()
    expect(shortestPath(ring, 0, [])).toBeUndefined()
  })

  test('the cost of an endpoint weighs against the path to it', () => {
    // The next node costs 10 to reach, the one past it 20.
    expect(route(ring, 0, [{ node: 1, cost: 5 }, { node: 2 }])).toEqual({
      nodes: [0, 1],
      cost: 15,
    })
    expect(route(ring, 0, [{ node: 1, cost: 15 }, { node: 2 }])).toEqual({
      nodes: [0, 1, 2],
      cost: 20,
    })
    expect(route(ring, [{ node: 0, cost: 15 }, { node: 3 }], 2)).toEqual({
      nodes: [3, 2],
      cost: 10,
    })
    // Negative and non-finite costs are none.
    expect(route(ring, 0, [{ node: 1, cost: -5 }, { node: 2 }])).toEqual({
      nodes: [0, 1],
      cost: 10,
    })
    expect(route(ring, 0, [{ node: 1, cost: Number.NaN }])).toEqual({ nodes: [0, 1], cost: 10 })
  })

  test('a path goes on past an end that costs more than the way to another', () => {
    // Only the end at 2 that is reached heading down lies past 1.
    const path = shortestPath(ring, 0, [
      { node: 1, cost: 100 },
      { node: 2, headings: [{ x: 0, y: 1 }] },
    ])
    expect(path).toEqual({ nodes: Int32Array.of(0, 1, 2), cost: 20, start: 0, end: 1 })
  })

  test('a path of one node costs its endpoints, the cheapest pair', () => {
    expect(route(ring, [{ node: 2, cost: 3 }], [{ node: 2, cost: 4 }])).toEqual({
      nodes: [2],
      cost: 7,
    })
    const path = shortestPath(
      ring,
      [
        { node: 2, cost: 3 },
        { node: 2, cost: 1 },
      ],
      [{ node: 2, cost: 4 }, { node: 2 }],
    )
    expect(path).toEqual({ nodes: Int32Array.of(2), cost: 1, start: 1, end: 1 })
  })

  test('among paths of equal cost, the one with fewer turns wins', () => {
    // Two paths 30 long: right, down, and right again through 1 and 2,
    // listed first, and down, then right, through 4 and 5.
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [20, 10],
        [0, 5],
        [0, 10],
      ],
      [
        [0, 1],
        [0, 4],
        [1, 2],
        [4, 5],
        [2, 3],
        [5, 3],
      ],
    )
    expect(route(graph, 0, 3)).toEqual({ nodes: [0, 4, 5, 3], cost: 30 })
  })

  test('a start that is an end needs an end that allows any heading', () => {
    // Otherwise the path goes around to arrive with an allowed heading.
    expect(route(ring, 1, [{ node: 1, headings: [{ x: 1, y: 0 }] }])).toEqual({
      nodes: [1, 2, 3, 0, 1],
      cost: 40,
    })
    expect(route(ring, 1, [{ node: 1, headings: [{ x: 1, y: 0 }] }, { node: 1 }])).toEqual({
      nodes: [1],
      cost: 0,
    })
  })

  test('a path passes through its waypoints in order', () => {
    expect(route(ring, 0, 2, { via: [3] })).toEqual({ nodes: [0, 3, 2], cost: 20 })
    expect(route(ring, 0, 1, { via: [3, 2] })).toEqual({ nodes: [0, 3, 2, 1], cost: 30 })
  })

  test('a path never reverses along its heading', () => {
    const line = graphOf(
      [
        [0, 0],
        [10, 0],
      ],
      [[0, 1]],
    )
    expect(route(line, 0, 0, { via: [1] })).toBeUndefined()
    expect(route(ring, 0, 0, { via: [2] })).toEqual({ nodes: [0, 1, 2, 3, 0], cost: 40 })
  })

  test('the turn at a waypoint counts toward the best path', () => {
    // Two ways to the waypoint 3: through 1, which costs more but arrives
    // heading down toward 5, and through 2, which arrives heading right.
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [0, 10],
        [10, 10],
        [10, 20],
        [10, 30],
      ],
      [{ from: 0, to: 1, weight: 1.5 }, [1, 3], [0, 2], [2, 3], [3, 4], [4, 5]],
    )
    expect(route(graph, 0, 5, { via: [3], bendCost: 10 })).toEqual({
      nodes: [0, 1, 3, 4, 5],
      cost: 55,
    })
    expect(route(graph, 0, 3, { bendCost: 10 })).toEqual({ nodes: [0, 2, 3], cost: 30 })
  })

  test('avoided rects close the edges through their interior, not along their sides', () => {
    expect(route(ring, 0, 2, { avoid: [box(2, -5, 8, 5)] })).toEqual({
      nodes: [0, 3, 2],
      cost: 20,
    })
    expect(route(ring, 0, 2, { avoid: [box(0, -10, 10, 0), box(-5, -5, 0, 0)] })).toEqual({
      nodes: [0, 1, 2],
      cost: 20,
    })
    expect(route(ring, 0, 2, { avoid: [box(-1, -1, 11, 11)] })).toBeUndefined()
    // A rect across a diagonal edge closes it.
    const diagonal = graphOf(
      [
        [0, 0],
        [10, 10],
      ],
      [[0, 1]],
    )
    expect(route(diagonal, 0, 1, { avoid: [box(4, 4, 6, 6)] })).toBeUndefined()
    expect(route(diagonal, 0, 1, { avoid: [box(10, 0, 20, 10), box(4, 6, 5, 7)] })).toBeDefined()
  })

  test('weights scale the cost of an edge, and an infinite weight closes it', () => {
    const weighted = (weight: number) =>
      graphOf(
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        [{ from: 0, to: 1, weight }, [1, 2], [2, 3], [3, 0]],
      )
    expect(route(weighted(3), 0, 2)).toEqual({ nodes: [0, 3, 2], cost: 20 })
    expect(route(weighted(0.5), 0, 2)).toEqual({ nodes: [0, 1, 2], cost: 15 })
    expect(route(weighted(Number.POSITIVE_INFINITY), 0, 1)).toEqual({
      nodes: [0, 3, 2, 1],
      cost: 30,
    })
  })

  test('diagonal edges turn only where their heading changes', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 10],
        [20, 20],
        [20, 0],
      ],
      [
        [0, 1],
        [1, 2],
        [0, 3],
        [3, 2],
      ],
    )
    const path = shortestPath(graph, 0, 2, { bendCost: 100 })
    expect([...(path?.nodes ?? [])]).toEqual([0, 1, 2])
    expect(path?.cost).toBeCloseTo(20 * Math.SQRT2, 12)
    // A diagonal that turns pays for it.
    const bent = shortestPath(graph, 1, 3, { bendCost: 100 })
    expect([...(bent?.nodes ?? [])]).toEqual([1, 0, 3])
    expect(bent?.cost).toBeCloseTo(10 * Math.SQRT2 + 20 + 100, 12)
  })
})

// A grid of `columns` by `rows` nodes 10 apart, numbered row by row from
// the top left, joined to their neighbors by the edges `keep` accepts.
function grid(
  columns: number,
  rows: number,
  keep: (a: number, b: number) => boolean = () => true,
): Graph {
  const points: Array<[number, number]> = []
  const pairs: Array<[number, number]> = []
  for (let k = 0; k < columns * rows; k++) {
    points.push([(k % columns) * 10, Math.floor(k / columns) * 10])
    if (k % columns > 0 && keep(k - 1, k)) {
      pairs.push([k - 1, k])
    }
    if (k >= columns && keep(k - columns, k)) {
      pairs.push([k - columns, k])
    }
  }
  return graphOf(points, pairs)
}

describe('jogs', () => {
  // A path that steps `d` down between two runs to the right.
  const step = (d: number) =>
    graphOf(
      [
        [0, 0],
        [10, 0],
        [10, d],
        [20, d],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    )

  test.each([0.5, 1, 2, 4, 8, 12])(
    'a jog %f long costs its two turns by its share of twice the radius',
    (d) => {
      expect(route(step(d), 0, 3, { bendCost: 40, radius: 4 })).toEqual({
        nodes: [0, 1, 2, 3],
        cost: 20 + d + 80 * Math.min(1, d / 8),
      })
    },
  )

  test('a short jog beats a turn fewer where its share costs less', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [10, 2],
        [20, 2],
        [0, 2],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [0, 4],
        [4, 2],
      ],
    )
    expect(route(graph, 0, 3, { bendCost: 40 })).toEqual({ nodes: [0, 4, 2, 3], cost: 62 })
    expect(route(graph, 0, 3, { bendCost: 40, radius: 4 })).toEqual({
      nodes: [0, 1, 2, 3],
      cost: 42,
    })
  })

  test('two turns the same way around a short run cost in full', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [10, 2],
        [0, 2],
        [0, 10],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    )
    expect(route(graph, 0, 4, { bendCost: 40, radius: 4 })).toEqual({
      nodes: [0, 1, 2, 3, 4],
      cost: 150,
    })
  })

  test('a turn before a short last run costs in full at the end', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [10, 2],
      ],
      [
        [0, 1],
        [1, 2],
      ],
    )
    expect(route(graph, 0, 2, { bendCost: 40, radius: 4 })).toEqual({
      nodes: [0, 1, 2],
      cost: 52,
    })
    expect(route(graph, 0, [{ node: 2, cost: 3 }], { bendCost: 40, radius: 4 })).toEqual({
      nodes: [0, 1, 2],
      cost: 55,
    })
  })

  test('a jog keeps its share through a waypoint on it', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [10, 1],
        [10, 2],
        [20, 2],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    )
    expect(route(graph, 0, 4, { bendCost: 40, radius: 4, via: [2] })).toEqual({
      nodes: [0, 1, 2, 3, 4],
      cost: 42,
    })
  })

  test('a jog across a run that another path runs along crosses it', () => {
    // A path across, from 0 to 3, over the path down the middle, from 6 to
    // 7. It could step onto that path's line at 1, ride it one unit to 4,
    // and step off, which switches sides of that path without running
    // straight through any node of it, and step back at 5 and 2: two cheap
    // jogs instead of a crossing. The jog along the path counts as the
    // crossing it is, so the path runs straight across instead.
    //
    //        6
    //  0 --- 1 --- 2 --- 3
    //        4 --- 5
    //        7
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [15, 0],
        [20, 0],
        [10, 1],
        [15, 1],
        [10, -10],
        [10, 10],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [1, 4],
        [4, 5],
        [5, 2],
        [6, 1],
        [4, 7],
      ],
    )
    const through = new Int32Array(2 * 8)
    markThrough(graph, through, shortestPath(graph, 6, 7), 1)
    const across = [{ x: 1, y: 0 }]
    const options = { bendCost: 40, radius: 4, crossingCost: 50, through }
    expect(route(graph, 0, [{ node: 3, headings: across }], options)).toEqual({
      nodes: [0, 1, 2, 3],
      cost: 70,
    })
    expect(route(graph, 0, [{ node: 3, headings: across }], { ...options, via: [4, 5] })).toEqual({
      nodes: [0, 1, 4, 5, 2, 3],
      cost: 92,
    })
  })

  test('a long ride along another path, off on the far side, crosses it too', () => {
    // From 0 to 5, arriving east, over the path down the middle from 6 to
    // 7. Riding that path from 1 to 4, far longer than twice the radius,
    // and stepping off east would switch sides of it for two turns and no
    // crossing, where turning at 3 and running straight across at 4 costs
    // a turn and a crossing. The ride counts as the crossing it is.
    //
    //        6
    //  0 --- 1
    //        |
    //  3 --- 4 --- 5
    //        7
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [20, 0],
        [0, 30],
        [10, 30],
        [20, 30],
        [10, -50],
        [10, 50],
      ],
      [
        [0, 1],
        [1, 4],
        [4, 5],
        [0, 3],
        [3, 4],
        [6, 1],
        [4, 7],
      ],
    )
    const through = new Int32Array(2 * 8)
    markThrough(graph, through, shortestPath(graph, 6, 7), 1)
    const east = [{ x: 1, y: 0 }]
    const options = { bendCost: 40, radius: 4, crossingCost: 50, through }
    expect(route(graph, 0, [{ node: 5, headings: east }], options)).toEqual({
      nodes: [0, 3, 4, 5],
      cost: 140,
    })
    expect(route(graph, 0, [{ node: 5, headings: east }], { ...options, via: [1, 4] })).toEqual({
      nodes: [0, 1, 4, 5],
      cost: 180,
    })
  })

  test('a radius does nothing on a graph with edges that run any way', () => {
    const graph = graphOf(
      [
        [0, 0],
        [10, 0],
        [10, 2],
        [20, 2],
        [30, 3],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    )
    expect(route(graph, 0, 3, { bendCost: 40, radius: 4 })?.cost).toBe(102)
  })
})

describe('crossings', () => {
  // 0 1 2
  // 3 4 5
  // 6 7 8
  const square = grid(3, 3)

  //  0  1  2
  //  3  4  5
  //  6  7  8
  //  9 10 11
  const tall = grid(3, 4)

  test.each([
    [10, [6, 7, 8]],
    [50, [6, 3, 0, 1, 2, 5, 8]],
  ])('a crossing that costs %i takes the path %j', (crossingCost, expected) => {
    // Another path runs straight down through the middle, from 4 to 10.
    // Stepping over to run across where it starts or ends crosses it too,
    // so the way around is the long one, over the top.
    const through = new Int32Array(2 * tall.xs.length)
    markThrough(tall, through, shortestPath(tall, 4, 10), 1)
    expect(route(tall, 6, 8, { crossingCost, through })?.nodes).toEqual(expected)
  })

  test.each([
    [10, [3, 4, 5]],
    [50, [3, 0, 1, 2, 5]],
  ])(
    'a path across the end of another, where a crossing costs %i, takes the path %j',
    (crossingCost, expected) => {
      // Another path starts in the middle and runs down: what it leads
      // from goes on up, so running straight across its start crosses it.
      const through = new Int32Array(2 * square.xs.length)
      markThrough(square, through, shortestPath(square, 4, 7), 1)
      expect(route(square, 3, 5, { crossingCost, through })?.nodes).toEqual(expected)
    },
  )

  test('a path that turns at the end of another, or ends along it, crosses nothing', () => {
    // Another path ends in the middle, arriving from the left. A path
    // down from the top that turns there, or that ends there arriving
    // the same way, runs nowhere across it.
    const graph = grid(3, 3, (a, b) => !(a === 1 && b === 2))
    const through = new Int32Array(2 * graph.xs.length)
    markThrough(graph, through, shortestPath(graph, 3, 4), 1)
    const options = { crossingCost: 50, bendCost: 5, through }
    expect(route(graph, 1, 5, options)).toEqual({ nodes: [1, 4, 5], cost: 25 })
    expect(route(graph, 0, [{ node: 4, headings: [{ x: 1, y: 0 }] }], options)).toEqual({
      nodes: [0, 3, 4],
      cost: 25,
    })
  })

  test('a path that turns where another runs straight on pays nothing', () => {
    const graph = grid(3, 3, (a, b) => !(a === 0 && b === 1))
    const through = new Int32Array(2 * graph.xs.length)
    markThrough(graph, through, shortestPath(graph, 1, 7), 1)
    expect(route(graph, 3, 1, { crossingCost: 50, bendCost: 5, through })).toEqual({
      nodes: [3, 4, 1],
      cost: 25,
    })
  })

  test('counting a path out undoes counting it in', () => {
    const through = new Int32Array(2 * square.xs.length)
    const path = shortestPath(square, 1, 7)
    markThrough(square, through, path, 1)
    // Down through 4, and down at its ends, 1 and 7.
    expect([...through.keys()].filter((slot) => through[slot] !== 0)).toEqual([3, 9, 15])
    expect([...through].filter((count) => count !== 0)).toEqual([1, 1, 1])
    markThrough(square, through, path, -1)
    expect(through.every((count) => count === 0)).toBe(true)
  })

  test('the first path found runs again among all the others', () => {
    // The path down from 2 to 10 goes first, straight through 6, where the
    // path across from 5 to 7, which must run east all the way, crosses
    // it. Found again among the others, the first one takes the long way
    // around instead, clear of the other's ends too.
    //
    //  0  1  2  3
    //  4  5  6  7
    //  8  9 10 11
    const graph = grid(4, 3)
    const east = [{ x: 1, y: 0 }]
    const ends = [
      [2, 10],
      [[{ node: 5, headings: east }], [{ node: 7, headings: east }]],
    ] as const
    const find = (crossingCost: number) =>
      searchAll(graph, 2, crossingCost, (k, through) => {
        const [from, to] = ends[k] as readonly [number | Array<Endpoint>, number | Array<Endpoint>]
        return shortestPath(graph, from, to, {
          crossingCost,
          ...(through === undefined ? {} : { through }),
        })
      }).paths.map((path) => Array.from(path?.nodes ?? []))
    expect(find(50)).toEqual([
      [2, 1, 0, 4, 8, 9, 10],
      [5, 6, 7],
    ])
    expect(find(0)).toEqual([
      [2, 6, 10],
      [5, 6, 7],
    ])
  })

  //  0  1  2  3
  //  4  5  6  7
  //  8  9 10 11
  const wide = grid(4, 3)

  test.each([
    ['meet and run straight across', [3, 4, 5], [1, 4, 7], 1, square],
    ['meet where both turn', [3, 4, 1], [5, 4, 7], 0, square],
    ['share a run, in from one side and out the other', [4, 5, 6, 7], [1, 5, 6, 10], 1, wide],
    ['share a run, in and out on one side', [4, 5, 6, 7], [1, 5, 6, 2], 0, wide],
    ['share a run the other way, across', [4, 5, 6, 7], [10, 6, 5, 1], 1, wide],
    ['share a run the other way, on one side', [4, 5, 6, 7], [10, 6, 5, 9], 0, wide],
    ['share a run that one starts on', [4, 5, 6, 7], [5, 6, 10], 0, wide],
    ['share a run that one ends on', [4, 5, 6, 7], [1, 5, 6], 0, wide],
    ['meet where one runs straight on across the start of the other', [3, 4, 5], [4, 7], 1, square],
    ['meet where one runs straight on across the end of the other', [3, 4, 5], [1, 4], 1, square],
    ['end at one node', [3, 4], [1, 4], 0, square],
  ] as const)('paths that %s cross %i times', (_, p, q, expected, graph) => {
    expect(crossingsBetween(graph, p, q)).toBe(expected)
    expect(crossingsBetween(graph, q, p)).toBe(expected)
  })

  test('the runs that paths share and cross on are found by index', () => {
    expect(crossedRuns(wide, [4, 5, 6, 7], [1, 5, 6, 10])).toEqual([[1, 2]])
    expect(crossedRuns(wide, [1, 5, 6, 10], [4, 5, 6, 7])).toEqual([[1, 2]])
    expect(crossedRuns(wide, [4, 5, 6, 7], [1, 5, 6, 2])).toEqual([])
    // A crossing at a node is not a run.
    expect(crossedRuns(square, [3, 4, 5], [1, 4, 7])).toEqual([])
  })
})

describe('partners', () => {
  // 0 1 2
  // 3 4 5
  // 6 7 8
  const square = grid(3, 3)
  const partner = { nodes: Int32Array.of(0, 3, 4, 5, 2), cost: 0, start: 0, end: 0 }

  test.each([
    [0.4, [0, 1, 2]],
    [0.6, [0, 3, 4, 5, 2]],
  ])('a partner discount of %f takes the path %j', (partnerDiscount, expected) => {
    // Along the partner, the detour is twice as long.
    const partners = new Uint8Array(square.targets.length)
    markAlong(square, partners, partner, false)
    const path = shortestPath(square, 0, 2, { partnerDiscount, partners })
    expect(Array.from(path?.nodes ?? [])).toEqual(expected)
  })

  test('a partner that runs the other way pulls back along it', () => {
    const forward = new Uint8Array(square.targets.length)
    markAlong(square, forward, partner, false)
    const back = new Uint8Array(square.targets.length)
    markAlong(square, back, { ...partner, nodes: partner.nodes.toReversed() }, true)
    expect(back).toEqual(forward)
    // Four half-edges, none of them back the other way.
    expect(forward.reduce((sum, mark) => sum + mark, 0)).toBe(4)
    expect(shortestPath(square, 2, 0, { partnerDiscount: 0.6, partners: forward })?.nodes).toEqual(
      Int32Array.of(2, 1, 0),
    )
  })

  test('marking can leave half-edges out', () => {
    const marks = new Uint8Array(square.targets.length)
    markAlong(square, marks, partner, false, (e) => square.sources[e] !== 4)
    expect(marks.reduce((sum, mark) => sum + mark, 0)).toBe(3)
  })

  test('searchAll finds the paths it is asked to again', () => {
    const calls: Array<number> = []
    searchAll(
      square,
      3,
      0,
      (k) => {
        calls.push(k)
        return undefined
      },
      (k) => k !== 1,
    )
    expect(calls).toEqual([0, 1, 2, 0, 2])
  })

  test('searchAll runs as many rounds as asked, and says which', () => {
    const calls: Array<[number, number]> = []
    searchAll(
      square,
      3,
      0,
      (k, _, round) => {
        calls.push([k, round])
        return undefined
      },
      (k) => k !== 1,
      2,
    )
    expect(calls).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [2, 2],
    ])
  })
})

describe('routes on random scenes', () => {
  test.each(Array.from({ length: 12 }, (_, i) => i + 1))(
    'scene %i matches the cheapest route on the full grid',
    (seed) => {
      const { obstacles, pins } = randomScene(seed, 12, 4)
      const { graph, pins: pinNodes } = visibilityGraph(obstacles, pins)
      const grid = fullGrid(obstacles, pins)
      for (const bendCost of [0, 7, 100]) {
        for (let a = 0; a < pins.length; a++) {
          for (let b = a + 1; b < pins.length; b++) {
            const expected = cheapest(
              grid.xs,
              grid.ys,
              grid.neighbors,
              grid.pins[a] as number,
              grid.pins[b] as number,
              bendCost,
            )
            const path = shortestPath(graph, pinNodes[a] as number, pinNodes[b] as number, {
              bendCost,
            })
            if (expected === Number.POSITIVE_INFINITY) {
              expect(path).toBeUndefined()
              continue
            }
            expect(path?.cost).toBe(expected)
            // The path is made of edges, and costs what it says.
            const nodes = [...(path?.nodes ?? [])]
            let total = 0
            let heading: string | undefined
            for (let i = 1; i < nodes.length; i++) {
              const u = nodes[i - 1] as number
              const v = nodes[i] as number
              const edges = graph.targets.slice(graph.offsets[u], graph.offsets[u + 1])
              expect(edges).toContain(v)
              const dx = (graph.xs[v] as number) - (graph.xs[u] as number)
              const dy = (graph.ys[v] as number) - (graph.ys[u] as number)
              const next = `${Math.sign(dx)},${Math.sign(dy)}`
              total +=
                Math.abs(dx) +
                Math.abs(dy) +
                (heading !== undefined && heading !== next ? bendCost : 0)
              heading = next
            }
            expect(total).toBe(expected)
          }
        }
      }
    },
  )
})

describe('routes with a radius on random scenes', () => {
  test.each(Array.from({ length: 12 }, (_, i) => i + 1))(
    'scene %i matches the cheapest route for its jogs on the graph and the full grid',
    (seed) => {
      const { obstacles, pins } = randomScene(seed, 12, 4)
      const { graph, pins: pinNodes } = visibilityGraph(obstacles, pins)
      const own = build(obstacles, pins)
      const grid = fullGrid(obstacles, pins)
      for (const bendCost of [7, 100]) {
        for (const radius of [1, 3, 8]) {
          for (let a = 0; a < pins.length; a++) {
            for (let b = a + 1; b < pins.length; b++) {
              const expected = cheapestWithRadius(
                own.xs,
                own.ys,
                own.neighbors,
                own.pins[a] as number,
                own.pins[b] as number,
                bendCost,
                radius,
              )
              const path = shortestPath(graph, pinNodes[a] as number, pinNodes[b] as number, {
                bendCost,
                radius,
              })
              if (expected === Number.POSITIVE_INFINITY) {
                expect(path).toBeUndefined()
                continue
              }
              expect(path?.cost).toBeCloseTo(expected, 9)
              // The path costs what it says, and the graph holds a route as
              // cheap as any on the full grid.
              expect(jogCost(graph.xs, graph.ys, path?.nodes ?? [], bendCost, radius)).toBeCloseTo(
                expected,
                9,
              )
              expect(
                cheapestWithRadius(
                  grid.xs,
                  grid.ys,
                  grid.neighbors,
                  grid.pins[a] as number,
                  grid.pins[b] as number,
                  bendCost,
                  radius,
                ),
              ).toBeCloseTo(expected, 9)
            }
          }
        }
      }
    },
  )
})

describe('dodges', () => {
  // Two lines a unit apart, joined by a rung at every column:
  //
  //  0 -- 1 -- 2 -- 3 -- 4
  //  |    |    |    |    |
  //  5 -- 6 -- 7 -- 8 -- 9
  const ladder = graphOf(
    [0, 10, 12, 14, 30, 0, 10, 12, 14, 30].map((x, i) => [x, i < 5 ? 0 : 1] as const),
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [0, 5],
      [1, 6],
      [2, 7],
      [3, 8],
      [4, 9],
    ],
  )
  const east = [{ x: 1, y: 0 }]
  // Another path runs down through 2, and turns away before the line below.
  const through = new Int32Array(2 * ladder.xs.length)
  through[2 * 2 + 1] = 1
  const options = { bendCost: 40, radius: 3, crossingCost: 50, through }

  test('a path that steps off its line around a crossing and back pays for it', () => {
    // Along the top, from 0 to 4, across the path down through 2. Stepping
    // down at 1 and back up at 3 keeps off 2 for two jogs a unit long, 2 *
    // 40 * 1 / 6 each, 32 and 80 / 3 in all, less than the crossing; it
    // pays the crossing anyway, so it runs straight across instead.
    expect(
      route(ladder, [{ node: 0, headings: east }], [{ node: 4, headings: east }], options),
    ).toEqual({ nodes: [0, 1, 2, 3, 4], cost: 80 })
    expect(costOfPath(ladder, [0, 1, 6, 7, 8, 3, 4], 40, 3, 50, through)).toBeCloseTo(
      32 + 80 / 3 + 50,
      12,
    )
    expect(cheapestByPaths(ladder, 0, 4, 40, 3, 50, through)).toBe(80)
  })

  test('a path that moves to another line pays nothing for the line it left', () => {
    // From 0 to 9, stepping down for good past the crossing at 2: a jog
    // a unit long, and no crossing.
    const path = route(
      ladder,
      [{ node: 0, headings: east }],
      [{ node: 9, headings: east }],
      options,
    )
    expect(path?.cost).toBeCloseTo(31 + 80 / 6, 12)
    expect(path?.nodes.slice(-3)).toEqual([7, 8, 9])
  })
})

describe('dodges on random graphs', () => {
  // The graphs where the search's path is not the cheapest simple path. A
  // dodge's charge depends on the path back to where it left the line,
  // which the search's state does not hold: of two paths into one state,
  // it keeps the cheaper, which may owe a dodge the other would not have,
  // so the path it finds can cost more than the cheapest. In graph 64 it
  // costs less, by a loop through a node it would otherwise run straight
  // across, which no simple path takes.
  const costlier = new Set([50, 54, 111])
  const looping = new Set([64])

  test.each(Array.from({ length: 120 }, (_, i) => i + 1))(
    'graph %i matches the cheapest of every path, or the known exceptions',
    (seed) => {
      let state = seed
      const next = (n: number) => {
        state = (state * 1103515245 + 12345) % 2147483648
        return Math.floor((state / 2147483648) * n)
      }
      // A grid of 4 by 4 at uneven spacing, some edges missing, and some
      // nodes marked as crossed.
      const at = (count: number) => {
        const list = [0]
        for (let k = 1; k < count; k++) {
          list.push((list[k - 1] as number) + 1 + next(3))
        }
        return list
      }
      const [cols, rows] = [at(4), at(4)]
      const points = rows.flatMap((y) => cols.map((x) => [x, y] as const))
      const pairs: Array<[number, number]> = []
      for (let k = 0; k < 16; k++) {
        if (k % 4 > 0 && next(6) !== 0) {
          pairs.push([k - 1, k])
        }
        if (k >= 4 && next(6) !== 0) {
          pairs.push([k - 4, k])
        }
      }
      const graph = graphOf(points, pairs)
      const through = new Int32Array(32)
      for (let k = 0; k < 10; k++) {
        through[next(32)] = 1 + next(2)
      }
      for (const radius of [2, 4, 8]) {
        for (const crossingCost of [30, 80]) {
          const [from, to] = [next(16), next(16)]
          const options = { bendCost: 10, radius, crossingCost, through }
          const path = shortestPath(graph, from, to, options)
          const expected =
            from === to ? 0 : cheapestByPaths(graph, from, to, 10, radius, crossingCost, through)
          if (expected === Number.POSITIVE_INFINITY) {
            expect(path).toBeUndefined()
            continue
          }
          const cost = path?.cost ?? Number.NaN
          // The path costs what the search says, by the rules.
          expect(
            costOfPath(graph, [...(path?.nodes ?? [])], 10, radius, crossingCost, through),
          ).toBeCloseTo(cost, 9)
          if (costlier.has(seed)) {
            expect(cost).toBeGreaterThanOrEqual(expected - 1e-9)
          } else if (looping.has(seed)) {
            expect(cost).toBeLessThanOrEqual(expected + 1e-9)
          } else {
            expect(cost).toBeCloseTo(expected, 9)
          }
        }
      }
    },
  )
})
