import { describe, expect, test } from 'vitest'
import { crossingsBetween } from '../src/internal/graph/crossings.ts'
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

describe('crossings', () => {
  // 0 1 2
  // 3 4 5
  // 6 7 8
  const square = grid(3, 3)

  test.each([
    [10, [3, 4, 5]],
    [50, [3, 0, 1, 2, 5]],
  ])('a crossing that costs %i takes the path %j', (crossingCost, expected) => {
    // Another path runs straight down through the middle.
    const through = new Int32Array(2 * square.xs.length)
    markThrough(square, through, shortestPath(square, 1, 7), 1)
    expect(route(square, 3, 5, { crossingCost, through })?.nodes).toEqual(expected)
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
    expect([...through].filter((count) => count !== 0)).toEqual([1])
    markThrough(square, through, path, -1)
    expect(through.every((count) => count === 0)).toBe(true)
  })

  test('the first path found runs again among all the others', () => {
    // The path down from 1 to 7 goes first, straight through 4, where the
    // path across from 3 to 5, which must run east all the way, crosses
    // it. Found again among the others, the first one takes the long way
    // around instead.
    const graph = grid(3, 3, (a, b) => !(a === 1 && b === 2) && !(a === 2 && b === 5) && b !== 8)
    const east = [{ x: 1, y: 0 }]
    const ends = [
      [1, 7],
      [[{ node: 3, headings: east }], [{ node: 5, headings: east }]],
    ] as const
    const find = (crossingCost: number) =>
      searchAll(graph, 2, crossingCost, (k, through) => {
        const [from, to] = ends[k] as readonly [number | Array<Endpoint>, number | Array<Endpoint>]
        return shortestPath(graph, from, to, {
          crossingCost,
          ...(through === undefined ? {} : { through }),
        })
      }).paths.map((path) => Array.from(path?.nodes ?? []))
    expect(find(30)).toEqual([
      [1, 0, 3, 6, 7],
      [3, 4, 5],
    ])
    expect(find(0)).toEqual([
      [1, 4, 7],
      [3, 4, 5],
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
  ] as const)('paths that %s cross %i times', (_, p, q, expected, graph) => {
    expect(crossingsBetween(graph, p, q)).toBe(expected)
    expect(crossingsBetween(graph, q, p)).toBe(expected)
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
