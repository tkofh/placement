import { coincident } from 'curvy/number'
import { describe, expect, test } from 'vitest'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import * as Hierarchy from '../src/hierarchy.ts'
import * as Point from '../src/point.ts'
import * as Rect from '../src/rect.ts'

const box = Frame.make({ width: 100, height: 40 })
const small = Frame.make({ width: 60, height: 20 })
const spec = Hierarchy.make({ rankGap: 40, nodeGap: 20, edgeGap: 10 })

const lineOf = (route: Hierarchy.HierarchyRoute | undefined) => route?.points[1]?.x ?? Number.NaN

const points = (route: Hierarchy.HierarchyRoute | undefined) =>
  route?.points.map((point) => [point.x, point.y])

describe('make', () => {
  test('empty input applies the defaults', () => {
    expect(Hierarchy.make({}).toJSON()).toEqual({
      direction: Hierarchy.direction.down,
      rankGap: 0,
      nodeGap: 0,
      edgeGap: 0,
      alignItems: 0.5,
      stretchItems: 0,
      alignLabels: 0.5,
    })
  })

  test.each([
    ['down', Hierarchy.direction.down, true, false],
    ['up', Hierarchy.direction.up, true, true],
    ['right', Hierarchy.direction.right, false, false],
    ['left', Hierarchy.direction.left, false, true],
  ] as const)('%s flow', (_, direction, isVertical, isReverse) => {
    const hierarchy = Hierarchy.make({ direction })
    expect(hierarchy.isVertical).toBe(isVertical)
    expect(hierarchy.isReverse).toBe(isReverse)
  })

  test('isHierarchy accepts hierarchies and rejects everything else', () => {
    expect(Hierarchy.isHierarchy(spec)).toBe(true)
    expect(Hierarchy.isHierarchy({ direction: 0 })).toBe(false)
    expect(Hierarchy.isHierarchy(null)).toBe(false)
  })
})

describe('apply', () => {
  test('an empty graph has empty results', () => {
    const layout = Hierarchy.apply(new Map(), [], spec)
    expect(layout.nodes.size).toBe(0)
    expect(layout.edges).toEqual([])
    expect(layout.bounds).toEqual(Rect.make())
  })

  test('an edge to an unknown key throws', () => {
    const nodes = new Map([['a', box]])
    expect(() => Hierarchy.apply(nodes, [Edge.make({ source: 'a', target: 'b' })], spec)).toThrow(
      RangeError,
    )
  })

  test.each([
    [
      'down',
      Hierarchy.direction.down,
      Rect.make(0, 0, 100, 40),
      Rect.make(20, 80, 60, 20),
      [
        [50, 40],
        [50, 80],
      ],
      Rect.make(0, 0, 100, 100),
    ],
    [
      'up',
      Hierarchy.direction.up,
      Rect.make(0, 60, 100, 40),
      Rect.make(20, 0, 60, 20),
      [
        [50, 60],
        [50, 20],
      ],
      Rect.make(0, 0, 100, 100),
    ],
    [
      'right',
      Hierarchy.direction.right,
      Rect.make(0, 0, 100, 40),
      Rect.make(140, 10, 60, 20),
      [
        [100, 20],
        [140, 20],
      ],
      Rect.make(0, 0, 200, 40),
    ],
    [
      'left',
      Hierarchy.direction.left,
      Rect.make(100, 0, 100, 40),
      Rect.make(0, 10, 60, 20),
      [
        [100, 20],
        [60, 20],
      ],
      Rect.make(0, 0, 200, 40),
    ],
  ] as const)('a single edge flows %s', (_, direction, a, b, route, bounds) => {
    const layout = Hierarchy.apply(
      new Map([
        ['a', box],
        ['b', small],
      ]),
      [Edge.make({ source: 'a', target: 'b' })],
      Hierarchy.make({ rankGap: 40, nodeGap: 20, edgeGap: 10, direction }),
    )
    expect(layout.nodes.get('a')).toEqual(a)
    expect(layout.nodes.get('b')).toEqual(b)
    expect(points(layout.edges[0])).toEqual(route)
    expect(layout.bounds).toEqual(bounds)
  })

  test('nodes keep the map order and keys', () => {
    const keyA = { name: 'a' }
    const keyB = { name: 'b' }
    const layout = Hierarchy.apply(
      new Map([
        [keyB, box],
        [keyA, box],
      ]),
      [Edge.make({ source: keyA, target: keyB })],
      spec,
    )
    expect([...layout.nodes.keys()]).toEqual([keyB, keyA])
    expect(layout.nodes.get(keyA)?.y).toBe(0)
    expect(layout.nodes.get(keyB)?.y).toBe(80)
  })

  test('nodes without edges sit side by side, nodeGap apart', () => {
    const layout = Hierarchy.apply(
      new Map([
        ['a', box],
        ['b', box],
      ]),
      [],
      spec,
    )
    expect(layout.nodes.get('a')).toEqual(Rect.make(0, 0, 100, 40))
    expect(layout.nodes.get('b')).toEqual(Rect.make(120, 0, 100, 40))
  })

  test('a fan-out centers the parent and spreads its ports', () => {
    const layout = Hierarchy.apply(
      new Map([
        ['a', box],
        ['b', box],
        ['c', box],
      ]),
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      spec,
    )
    expect(layout.nodes.get('a')).toEqual(Rect.make(60, 0, 100, 40))
    expect(layout.nodes.get('b')).toEqual(Rect.make(0, 80, 100, 40))
    expect(layout.nodes.get('c')).toEqual(Rect.make(120, 80, 100, 40))
    // The two ports sit edgeGap apart around the bottom center.
    expect(points(layout.edges[0])).toEqual([
      [105, 40],
      [50, 60],
      [50, 80],
    ])
    expect(points(layout.edges[1])).toEqual([
      [115, 40],
      [170, 60],
      [170, 80],
    ])
  })

  test('minLength stretches an edge over more ranks', () => {
    const layout = Hierarchy.apply(
      new Map([
        ['a', box],
        ['b', box],
      ]),
      [Edge.make({ source: 'a', target: 'b', minLength: 2 })],
      spec,
    )
    expect(layout.nodes.get('b')?.y).toBe(40 + 2 * 40)
  })

  test('a cycle routes both edges from source to target', () => {
    const layout = Hierarchy.apply(
      new Map([
        ['a', box],
        ['b', box],
      ]),
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'b', target: 'a' })],
      spec,
    )
    expect(layout.nodes.get('a')).toEqual(Rect.make(0, 0, 100, 40))
    expect(layout.nodes.get('b')).toEqual(Rect.make(0, 80, 100, 40))
    expect(points(layout.edges[0])).toEqual([
      [45, 40],
      [45, 80],
    ])
    // The back edge leaves b's top and enters a's bottom.
    expect(points(layout.edges[1])).toEqual([
      [55, 80],
      [55, 40],
    ])
  })

  describe('rank bands', () => {
    const nodes = new Map([
      ['root', box],
      ['short', Frame.make({ width: 40, height: 20 })],
      ['tall', Frame.make({ width: 40, height: 60 })],
      ['end', Frame.make({ width: 40, height: 20, align: 1 })],
      ['fill', Frame.make({ width: 40, height: 20, stretch: 1 })],
    ])
    const edges = ['short', 'tall', 'end', 'fill'].map((target) =>
      Edge.make({ source: 'root', target }),
    )

    test('frames align and stretch within the thickest node of their rank', () => {
      const layout = Hierarchy.apply(nodes, edges, Hierarchy.make({ rankGap: 40, alignItems: 0 }))
      expect(layout.nodes.get('short')).toMatchObject({ y: 80, height: 20 })
      expect(layout.nodes.get('tall')).toMatchObject({ y: 80, height: 60 })
      expect(layout.nodes.get('end')).toMatchObject({ y: 120, height: 20 })
      expect(layout.nodes.get('fill')).toMatchObject({ y: 80, height: 60 })
    })

    test('alignItems defaults to centering', () => {
      const layout = Hierarchy.apply(nodes, edges, Hierarchy.make({ rankGap: 40 }))
      expect(layout.nodes.get('short')).toMatchObject({ y: 100, height: 20 })
    })

    test('alignment stays physical when the flow reverses', () => {
      const layout = Hierarchy.apply(
        nodes,
        edges,
        Hierarchy.make({ rankGap: 40, alignItems: 0, direction: Hierarchy.direction.up }),
      )
      // The rank of the leaves spans y 0 to 60. Top alignment still means the top.
      expect(layout.nodes.get('short')).toMatchObject({ y: 0, height: 20 })
      expect(layout.nodes.get('end')).toMatchObject({ y: 40, height: 20 })
    })

    test('auto offsets along the flow position a node like auto margins', () => {
      const layout = Hierarchy.apply(
        new Map([
          ['tall', Frame.make({ width: 40, height: 60 })],
          ['auto', Frame.make({ width: 40, height: 20, offsetTop: Number.POSITIVE_INFINITY })],
        ]),
        [],
        Hierarchy.make({ alignItems: 0 }),
      )
      expect(layout.nodes.get('auto')).toMatchObject({ y: 40 })
    })
  })

  describe('labels', () => {
    const nodes = new Map([
      ['a', box],
      ['b', box],
    ])

    test('a label takes its own rank between the nodes', () => {
      const label = Frame.make({ width: 20, height: 10 })
      const layout = Hierarchy.apply(
        nodes,
        [Edge.make({ source: 'a', target: 'b', labels: [{ frame: label }] })],
        spec,
      )
      expect(layout.edges[0]?.labels).toEqual([Rect.make(40, 60, 20, 10)])
      // The label's thickness adds to the rank gap.
      expect(layout.nodes.get('b')?.y).toBe(40 + 40 + 10)
      expect(points(layout.edges[0])).toEqual([
        [50, 40],
        [50, 90],
      ])
    })

    test('align puts a label beside the line, and offsets add clearance', () => {
      const right = Frame.make({ width: 20, height: 10, align: 1, offsetLeft: 4 })
      const left = Frame.make({ width: 20, height: 10, align: 0, offsetRight: 4 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'b', labels: [{ frame: right }] }),
          Edge.make({ source: 'a', target: 'b', labels: [{ frame: left }] }),
        ],
        spec,
      )
      const [first, second] = layout.edges
      expect(first?.labels[0]?.x).toBe(lineOf(first) + 4)
      expect(second?.labels[0]?.x).toBe(lineOf(second) - 4 - 20)
    })

    test('alignLabels sets the default side', () => {
      const label = Frame.make({ width: 20, height: 10 })
      const layout = Hierarchy.apply(
        nodes,
        [Edge.make({ source: 'a', target: 'b', labels: [{ frame: label }] })],
        Hierarchy.make({ rankGap: 40, alignLabels: 1 }),
      )
      expect(layout.edges[0]?.labels[0]?.x).toBe(layout.edges[0]?.points[0]?.x)
    })

    test('several labels take distinct ranks in order along the edge', () => {
      const label = Frame.make({ width: 20, height: 10 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            labels: [
              { frame: label, at: 0.9 },
              { frame: label, at: 0.1 },
            ],
          }),
        ],
        spec,
      )
      const [late, early] = layout.edges[0]?.labels ?? []
      expect(early?.y).toBeLessThan(late?.y ?? NaN)
      const a = layout.nodes.get('a') as Rect.Rect
      const b = layout.nodes.get('b') as Rect.Rect
      expect(early?.y).toBeGreaterThan(a.bottom)
      expect(late?.bottom).toBeLessThan(b.y)
    })

    test('labels on a reversed edge measure from the source', () => {
      const label = Frame.make({ width: 20, height: 10 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({
            source: 'b',
            target: 'a',
            labels: [
              { frame: label, at: 0.1 },
              { frame: label, at: 0.9 },
            ],
          }),
        ],
        spec,
      )
      // The back edge runs upward, so the label near its source (b) is lower.
      const [nearSource, nearTarget] = layout.edges[1]?.labels ?? []
      expect(nearSource?.y).toBeGreaterThan(nearTarget?.y ?? NaN)
    })
  })

  describe('ports', () => {
    const nodes = new Map([
      ['a', box],
      ['b', box],
    ])

    test('fixed ports end the route at the requested point', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            sourceSide: Edge.side.bottom,
            sourceAt: 0.25,
            targetSide: Edge.side.top,
            targetAt: 0.75,
          }),
        ],
        spec,
      )
      const route = layout.edges[0]?.points ?? []
      expect(route[0]).toEqual(Point.make(25, 40))
      expect(route[route.length - 1]).toEqual(Point.make(75, 80))
    })

    test('a side port steps sideways before turning with the flow', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            sourceSide: Edge.side.right,
            sourceAt: 0.5,
          }),
        ],
        spec,
      )
      const route = points(layout.edges[0]) ?? []
      const a = layout.nodes.get('a') as Rect.Rect
      // The stub is half the node gap long.
      expect(route.slice(0, 3)).toEqual([
        [a.right, 20],
        [a.right + 10, 20],
        [a.right + 10, 40],
      ])
    })

    test('a port facing against the flow wraps around its node', () => {
      const layout = Hierarchy.apply(
        nodes,
        [Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.top })],
        spec,
      )
      const route = points(layout.edges[0]) ?? []
      const a = layout.nodes.get('a') as Rect.Rect
      expect(route[0]).toEqual([a.x + 50, a.y])
      // It rises a quarter of the rank gap, then passes beside the node.
      expect(route[1]?.[1]).toBe(a.y - 10)
      expect(route[route.length - 1]?.[1]).toBe(layout.nodes.get('b')?.y)
    })

    test('positions along order faces mirror with the flow', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            sourceSide: Edge.side.right,
            sourceAt: 0.25,
          }),
        ],
        Hierarchy.make({ rankGap: 40, nodeGap: 20, direction: Hierarchy.direction.up }),
      )
      const a = layout.nodes.get('a') as Rect.Rect
      // `at` is physical: a quarter of the way down the right side.
      expect(layout.edges[0]?.points[0]).toEqual(Point.make(a.right, a.y + 10))
    })

    test('auto positions spread ports that share a side', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'a', target: 'b' }),
        ],
        spec,
      )
      expect(
        layout.edges.map((route) => route.points[0]?.x ?? Number.NaN).toSorted((p, q) => p - q),
      ).toEqual([40, 50, 60])
    })

    test('crowded ports spread evenly over the side', () => {
      // Three ports 10 apart need 20 of the 16 available.
      const narrow = Frame.make({ width: 16, height: 20 })
      const layout = Hierarchy.apply(
        new Map([
          ['a', narrow],
          ['b', narrow],
        ]),
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'a', target: 'b' }),
        ],
        spec,
      )
      const a = layout.nodes.get('a') as Rect.Rect
      const xs = layout.edges
        .map((route) => (route.points[0]?.x ?? NaN) - a.x)
        .toSorted((p, q) => p - q)
      expect(xs).toEqual([4, 8, 12])
    })
  })

  describe('self loops', () => {
    test('loops nest on the order-end side, edgeGap apart', () => {
      const layout = Hierarchy.apply(
        new Map([['a', Frame.make({ width: 100, height: 60 })]]),
        [Edge.make({ source: 'a', target: 'a' }), Edge.make({ source: 'a', target: 'a' })],
        spec,
      )
      expect(points(layout.edges[0])).toEqual([
        [100, 20],
        [110, 20],
        [110, 40],
        [100, 40],
      ])
      expect(points(layout.edges[1])).toEqual([
        [100, 10],
        [120, 10],
        [120, 50],
        [100, 50],
      ])
      // Layout reserves room for the loops.
      expect(layout.bounds).toEqual(Rect.make(0, 0, 120, 60))
    })

    test('a loop between two sides walks around the corner', () => {
      const layout = Hierarchy.apply(
        new Map([['a', box]]),
        [
          Edge.make({
            source: 'a',
            target: 'a',
            sourceSide: Edge.side.right,
            targetSide: Edge.side.bottom,
          }),
        ],
        spec,
      )
      expect(points(layout.edges[0])).toEqual([
        [100, 20],
        [110, 20],
        [110, 50],
        [50, 50],
        [50, 40],
      ])
    })
  })
})

// A pseudo-random graph for property checks. A linear congruential
// generator keeps it deterministic.
function randomGraph(seed: number, nodeCount: number, edgeCount: number) {
  let state = seed
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const nodes = new Map<number, Frame.Frame>()
  for (let i = 0; i < nodeCount; i++) {
    nodes.set(
      i,
      Frame.make({
        width: 20 + Math.floor(next() * 8) * 10,
        height: 20 + Math.floor(next() * 4) * 10,
      }),
    )
  }
  const edges: Array<Edge.Edge<number>> = []
  for (let i = 0; i < edgeCount; i++) {
    const source = Math.floor(next() * nodeCount)
    const target = Math.floor(next() * nodeCount)
    const labels = next() < 0.2 ? [{ frame: Frame.make({ width: 30, height: 12 }) }] : []
    edges.push(Edge.make({ source, target, labels }))
  }
  return { nodes, edges }
}

function onBoundary(point: Point.Point, rect: Rect.Rect): boolean {
  const withinX = point.x >= rect.left - 1e-9 && point.x <= rect.right + 1e-9
  const withinY = point.y >= rect.top - 1e-9 && point.y <= rect.bottom + 1e-9
  const onVertical = coincident(point.x, rect.left) || coincident(point.x, rect.right)
  const onHorizontal = coincident(point.y, rect.top) || coincident(point.y, rect.bottom)
  return (onVertical && withinY) || (onHorizontal && withinX)
}

describe('properties', () => {
  test.each([1, 2, 3, 4, 5, 6])('random graph %i', (seed) => {
    const { nodes, edges } = randomGraph(seed, 14, 20)
    for (const direction of Object.values(Hierarchy.direction)) {
      const hierarchy = Hierarchy.make({ rankGap: 30, nodeGap: 20, edgeGap: 8, direction })
      const layout = Hierarchy.apply(nodes, edges, hierarchy)

      // Deterministic.
      expect(Hierarchy.apply(nodes, edges, hierarchy)).toEqual(layout)

      // Node sizes are the frame sizes.
      for (const [key, frame] of nodes) {
        const rect = layout.nodes.get(key) as Rect.Rect
        expect([rect.width, rect.height]).toEqual([frame.width, frame.height])
      }

      // No two nodes overlap.
      const rects = [...layout.nodes.values()]
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i] as Rect.Rect
          const b = rects[j] as Rect.Rect
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          expect(overlapX <= 1e-9 || overlapY <= 1e-9).toBe(true)
        }
      }

      // Routes start on the source and end on the target.
      for (const [i, edge] of edges.entries()) {
        const route = layout.edges[i]?.points ?? []
        expect(route.length).toBeGreaterThanOrEqual(2)
        expect(
          onBoundary(route[0] as Point.Point, layout.nodes.get(edge.source) as Rect.Rect),
        ).toBe(true)
        expect(
          onBoundary(
            route[route.length - 1] as Point.Point,
            layout.nodes.get(edge.target) as Rect.Rect,
          ),
        ).toBe(true)
        expect(layout.edges[i]?.labels).toHaveLength(edge.labels.length)
      }

      // Bounds start at the origin and contain everything.
      expect([layout.bounds.x, layout.bounds.y]).toEqual([0, 0])
      for (const rect of rects) {
        expect(Rect.contains(layout.bounds, rect)).toBe(true)
      }
    }
  })

  test('uniform scaling scales the layout', () => {
    const { nodes, edges } = randomGraph(7, 12, 16)
    const scale = 1e6
    const scaled = new Map(
      [...nodes].map(([key, frame]) => [
        key,
        Frame.make({ width: frame.width * scale, height: frame.height * scale }),
      ]),
    )
    const scaledEdges = edges.map((edge) =>
      Edge.setLabels(
        edge,
        edge.labels.map(() => ({ frame: Frame.make({ width: 30 * scale, height: 12 * scale }) })),
      ),
    )
    const base = Hierarchy.apply(
      nodes,
      edges,
      Hierarchy.make({ rankGap: 30, nodeGap: 20, edgeGap: 8 }),
    )
    const big = Hierarchy.apply(
      scaled,
      scaledEdges,
      Hierarchy.make({ rankGap: 30 * scale, nodeGap: 20 * scale, edgeGap: 8 * scale }),
    )
    for (const [key, rect] of base.nodes) {
      const other = big.nodes.get(key) as Rect.Rect
      expect(other.x / scale).toBeCloseTo(rect.x, 6)
      expect(other.y / scale).toBeCloseTo(rect.y, 6)
    }
    for (const [i, route] of base.edges.entries()) {
      expect(big.edges[i]?.points).toHaveLength(route.points.length)
    }
  })

  test('non-dyadic sizes stay close to the dyadic layout', () => {
    const nodes = new Map([
      ['a', Frame.make({ width: 0.1, height: 0.1 })],
      ['b', Frame.make({ width: 0.1, height: 0.1 })],
      ['c', Frame.make({ width: 0.1, height: 0.1 })],
    ])
    const layout = Hierarchy.apply(
      nodes,
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      Hierarchy.make({ rankGap: 0.3, nodeGap: 0.2 }),
    )
    const b = layout.nodes.get('b') as Rect.Rect
    const c = layout.nodes.get('c') as Rect.Rect
    expect(b.y).toBeCloseTo(0.4, 12)
    expect(c.x - b.right).toBeCloseTo(0.2, 12)
    expect((layout.nodes.get('a') as Rect.Rect).x).toBeCloseTo(0.15, 12)
  })
})
