import { coincident } from 'curvy/number'
import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import * as Hierarchy from '../src/hierarchy.ts'
import { type XY, cornerArcs, onArc } from '../src/internal/polygon.ts'
import * as Interval from '../src/interval.ts'
import * as Point from '../src/point.ts'
import * as Polygon from '../src/polygon.ts'
import * as Rect from '../src/rect.ts'

const box = Frame.make({ width: 100, height: 40 })
const small = Frame.make({ width: 60, height: 20 })
const spec = Hierarchy.make({ rankGap: 40, nodeGap: 20, edgeGap: 10 })

// The order-axis position of the segment that runs with the flow at `y`.
const lineAt = (route: Hierarchy.HierarchyRoute | undefined, y: number) => {
  const list = route?.points ?? []
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1] as Point.Point
    const b = list[i] as Point.Point
    if (a.x === b.x && Math.min(a.y, b.y) <= y && y <= Math.max(a.y, b.y)) {
      return a.x
    }
  }
  return Number.NaN
}

const withIds = (ids: ReadonlyArray<string>) => ids.map((id) => Frame.setId(box, id))

const points = (route: Hierarchy.HierarchyRoute | undefined) =>
  route?.points.map((point) => [point.x, point.y])

// A flow adornment that faces along the line and takes `length` of it: a
// stand-in for an arrowhead at `at` 0 or 1.
const stub = (length: number, at: number) =>
  Adornment.make({
    frame: Frame.make({ width: length, height: 0 }),
    at,
    orient: at === 0 ? Adornment.orient.backward : Adornment.orient.forward,
  })

const labelOf = (frame: Frame.Frame, input: Omit<Adornment.AdornmentInput, 'frame'> = {}) =>
  Adornment.make({ frame, ...input })

const near = (a: number, b: number) => Math.abs(a - b) < 1e-7

// Whether `point` lies on `polygon` as placed in `rect`, rounded corners
// included, within a tolerance for the growth of rounded outlines.
const onPolygon = (point: Point.Point, polygon: Polygon.Polygon, rect: Rect.Rect) => {
  const { outlines, radius } = Polygon.apply(polygon, rect)
  const p: XY = [point.x, point.y]
  return outlines.some((outline) => {
    const corners = outline.map(({ x, y }): XY => [x, y])
    const arcs = cornerArcs(corners, radius)
    return corners.some((corner, i) => {
      const arc = arcs[i]
      if (arc !== undefined) {
        const distance = Math.hypot(p[0] - arc.center[0], p[1] - arc.center[1])
        if (near(distance, arc.radius) && onArc(arc, p)) {
          return true
        }
      }
      const a = arc?.end ?? corner
      const next = (i + 1) % corners.length
      const b = arcs[next]?.start ?? (corners[next] as XY)
      const length = Math.hypot(b[0] - a[0], b[1] - a[1])
      const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / length ** 2
      const cross = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / length
      return t >= -1e-9 && t <= 1 + 1e-9 && near(cross, 0)
    })
  })
}

const expectClose = (a: Point.Point, b: Point.Point | undefined) => {
  expect(a.x).toBeCloseTo(b?.x ?? Number.NaN, 9)
  expect(a.y).toBeCloseTo(b?.y ?? Number.NaN, 9)
}

// Whether `point` lies on the diamond inscribed in `rect`.
const onDiamond = (point: Point.Point, rect: Rect.Rect) =>
  Math.abs(point.x - rect.x - rect.width / 2) / (rect.width / 2) +
    Math.abs(point.y - rect.y - rect.height / 2) / (rect.height / 2) ===
  1

describe('make', () => {
  test('empty input applies the defaults', () => {
    expect(Hierarchy.make({}).toJSON()).toEqual({
      direction: Hierarchy.direction.down,
      backEdges: Hierarchy.backEdges.direct,
      rankGap: 0,
      nodeGap: 0,
      edgeGap: 0,
      alignItems: 0.5,
      stretchItems: 0,
      alignAdornments: 0.5,
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
    const layout = Hierarchy.apply([], [], spec)
    expect(Object.keys(layout.nodes)).toEqual([])
    expect(layout.edges).toEqual([])
    expect(layout.bounds).toEqual(Rect.make())
  })

  test('an edge to an unknown key throws', () => {
    const nodes = [Frame.setId(box, 'a')]
    // @ts-expect-error -- 'b' is not the id of any frame
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
      [Frame.setId(box, 'a'), Frame.setId(small, 'b')],
      [Edge.make({ source: 'a', target: 'b' })],
      Hierarchy.make({ rankGap: 40, nodeGap: 20, edgeGap: 10, direction }),
    )
    expect(layout.nodes.a).toEqual(a)
    expect(layout.nodes.b).toEqual(b)
    expect(points(layout.edges[0])).toEqual(route)
    expect(layout.bounds).toEqual(bounds)
  })

  test('frames need unique ids', () => {
    const anonymous = Frame.make({ width: 10 }) as unknown as Frame.Frame<string>
    expect(() => Hierarchy.apply([anonymous], [], spec)).toThrow(RangeError)
    expect(() =>
      Hierarchy.apply([Frame.setId(box, 'a'), Frame.setId(small, 'a')], [], spec),
    ).toThrow(RangeError)
  })

  test('nodes are keyed by id, even ids that name Object.prototype members', () => {
    const layout = Hierarchy.apply(
      [Frame.setId(box, '__proto__'), Frame.setId(box, 'constructor')],
      [Edge.make({ source: 'constructor', target: '__proto__' })],
      spec,
    )
    expect(Object.keys(layout.nodes)).toEqual(['__proto__', 'constructor'])
    expect(layout.nodes.constructor.y).toBe(0)
    expect(layout.nodes.__proto__.y).toBe(80)
  })

  test('the types check frame ids', () => {
    const a = Frame.make({ id: 'a', width: 10 })
    const b = Frame.make({ id: 'b', width: 10 })
    const layout = Hierarchy.apply([a, b], [Edge.make({ source: 'a', target: 'b' })], spec)
    expect(layout.nodes.a satisfies Rect.Rect).toBeDefined()
    expect(() =>
      // @ts-expect-error -- 'c' is not the id of any frame
      Hierarchy.apply([a, b], [Edge.make({ source: 'a', target: 'c' })], spec),
    ).toThrow(RangeError)
    expect(() =>
      // @ts-expect-error -- every frame needs an id
      Hierarchy.apply([a, Frame.make({ width: 10 })], [], spec),
    ).toThrow(RangeError)
    // @ts-expect-error -- the result only has the frames' ids
    expect(layout.nodes.c).toBeUndefined()

    // Inline frames and edges keep their literal ids too.
    const inline = Hierarchy.apply(
      [Frame.make({ id: 'x' }), Frame.setId(box, 'y')],
      [Edge.make({ source: 'x', target: 'y' })],
      spec,
    )
    expect(inline.nodes.y satisfies Rect.Rect).toBeDefined()
    expect(() =>
      Hierarchy.apply(
        [Frame.make({ id: 'x' }), Frame.setId(box, 'y')],
        // @ts-expect-error -- 'z' is not the id of any frame
        [Edge.make({ source: 'x', target: 'z' })],
        spec,
      ),
    ).toThrow(RangeError)

    // Ids known only at runtime widen to string.
    const ids: Array<string> = ['p', 'q']
    const dynamic = Hierarchy.apply(
      ids.map((id) => Frame.make({ id, width: 10 })),
      [Edge.make({ source: ids[0] ?? '', target: ids[1] ?? '' })],
      spec,
    )
    expect(dynamic.nodes.q?.y).toBe(40)
  })

  test('nodes without edges sit side by side, nodeGap apart', () => {
    const layout = Hierarchy.apply([Frame.setId(box, 'a'), Frame.setId(box, 'b')], [], spec)
    expect(layout.nodes.a).toEqual(Rect.make(0, 0, 100, 40))
    expect(layout.nodes.b).toEqual(Rect.make(120, 0, 100, 40))
  })

  test('a fan-out centers the parent and spreads its ports', () => {
    const layout = Hierarchy.apply(
      [Frame.setId(box, 'a'), Frame.setId(box, 'b'), Frame.setId(box, 'c')],
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      spec,
    )
    expect(layout.nodes.a).toEqual(Rect.make(60, 0, 100, 40))
    expect(layout.nodes.b).toEqual(Rect.make(0, 80, 100, 40))
    expect(layout.nodes.c).toEqual(Rect.make(120, 80, 100, 40))
    // The two ports sit edgeGap apart around the bottom center. Each edge
    // jogs in the middle of the channel below the parent, then drops
    // straight into its child.
    expect(points(layout.edges[0])).toEqual([
      [105, 40],
      [105, 50],
      [50, 50],
      [50, 80],
    ])
    expect(points(layout.edges[1])).toEqual([
      [115, 40],
      [115, 50],
      [170, 50],
      [170, 80],
    ])
  })

  test('a busy channel grows to fit its lanes, edgeGap apart', () => {
    // Two edges jog left and two jog right below the parent. Each pair
    // overlaps, so it takes two lanes, and the channel needs three edge gaps.
    const layout = Hierarchy.apply(
      ['a', 'b', 'c', 'd', 'e'].map((id) => Frame.setId(box, id)),
      ['b', 'c', 'd', 'e'].map((target) => Edge.make({ source: 'a', target })),
      spec,
    )
    expect(layout.nodes.b?.y).toBe(40 + 30 + 20)
    const lanes = layout.edges.map((route) => route.points[1]?.y)
    expect(lanes).toEqual([50, 60, 60, 50])
    // The outer edge of each side jogs first, so the edges nest without
    // crossing.
    expect(points(layout.edges[0])).toEqual([
      [215, 40],
      [215, 50],
      [50, 50],
      [50, 90],
    ])
    expect(points(layout.edges[1])).toEqual([
      [225, 40],
      [225, 60],
      [170, 60],
      [170, 90],
    ])
  })

  test('minLength stretches an edge over more ranks', () => {
    const layout = Hierarchy.apply(
      [Frame.setId(box, 'a'), Frame.setId(box, 'b')],
      [Edge.make({ source: 'a', target: 'b', minLength: 2 })],
      spec,
    )
    expect(layout.nodes.b?.y).toBe(40 + 2 * 40)
  })

  test('a route between touching ports keeps both ends', () => {
    const layout = Hierarchy.apply(
      [Frame.setId(small, 'a'), Frame.setId(small, 'b')],
      [Edge.make({ source: 'a', target: 'b' })],
      Hierarchy.make({}),
    )
    expect(layout.nodes.b).toEqual(Rect.make(0, 20, 60, 20))
    expect(points(layout.edges[0])).toEqual([
      [30, 20],
      [30, 20],
    ])
  })

  test('a cycle routes both edges from source to target', () => {
    const layout = Hierarchy.apply(
      [Frame.setId(box, 'a'), Frame.setId(box, 'b')],
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'b', target: 'a' })],
      spec,
    )
    expect(layout.nodes.a).toEqual(Rect.make(0, 0, 100, 40))
    expect(layout.nodes.b).toEqual(Rect.make(0, 80, 100, 40))
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

  describe('end adornments', () => {
    const three = ['a', 'b', 'c'].map((id) => Frame.setId(box, id))

    test('an adornment at the target keeps the last turn that far from it', () => {
      const layout = Hierarchy.apply(
        three,
        [
          Edge.make({ source: 'a', target: 'b', adornments: [stub(25, 1)] }),
          Edge.make({ source: 'a', target: 'c', adornments: [stub(25, 1)] }),
        ],
        spec,
      )
      // The channel above the children grows to 25, so each edge runs 35
      // straight into its child after its jog.
      expect(layout.nodes.b?.y).toBe(85)
      expect(points(layout.edges[0])).toEqual([
        [105, 40],
        [105, 50],
        [50, 50],
        [50, 85],
      ])
    })

    test('an adornment at the source moves the jog lane away from it', () => {
      const layout = Hierarchy.apply(
        three,
        [
          Edge.make({ source: 'a', target: 'b', adornments: [stub(25, 0)] }),
          Edge.make({ source: 'a', target: 'c' }),
        ],
        spec,
      )
      expect(points(layout.edges[0])).toEqual([
        [105, 40],
        [105, 65],
        [50, 65],
        [50, 95],
      ])
    })

    test('an adornment on a side port moves its column out', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b', 'c', 'x']),
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'x', target: 'c' }),
          Edge.make({
            source: 'a',
            target: 'c',
            sourceSide: Edge.side.right,
            adornments: [stub(30, 0)],
          }),
        ],
        spec,
      )
      expect(points(layout.edges[2])?.slice(0, 3)).toEqual([
        [100, 20],
        [130, 20],
        [130, 50],
      ])
      // The column's room pushes x along.
      expect(layout.nodes.x?.x).toBe(145)
    })

    test('an adornment on a wrap moves its turn away from the face', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b']),
        [
          Edge.make({
            source: 'a',
            target: 'b',
            sourceSide: Edge.side.top,
            adornments: [stub(30, 0)],
          }),
        ],
        spec,
      )
      expect(layout.nodes.a?.y).toBe(30)
      expect(points(layout.edges[0])?.slice(0, 2)).toEqual([
        [50, 30],
        [50, 0],
      ])
    })

    test('an edge that never turns and carries one end adornment needs no room', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b']),
        [Edge.make({ source: 'a', target: 'b', adornments: [stub(60, 1)] })],
        spec,
      )
      expect(layout.nodes.b?.y).toBe(80)
      expect(layout.edges[0]?.adornments[0]?.rect).toEqual(Rect.make(20, 50, 60, 0))
    })

    test('adornments at both ends each keep to their own channel', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b']),
        [Edge.make({ source: 'a', target: 'b', adornments: [stub(30, 0), stub(30, 1)] })],
        spec,
      )
      expect(layout.nodes.b?.y).toBe(100)
      const [start, end] = layout.edges[0]?.adornments ?? []
      expect(start?.along).toEqual(Interval.make(0, 30))
      expect(end?.along).toEqual(Interval.make(30, 30))
    })

    test('an end adornment faces into its node, flush with the port', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b']),
        [Edge.make({ source: 'a', target: 'b', adornments: [stub(10, 0), stub(10, 1)] })],
        spec,
      )
      const [start, end] = layout.edges[0]?.adornments ?? []
      // Upright, each is 10 wide around the line. It turns about its center.
      expect(start?.rect).toEqual(Rect.make(45, 45, 10, 0))
      expect(start?.angle).toBe(-Math.PI / 2)
      expect(end?.rect).toEqual(Rect.make(45, 75, 10, 0))
      expect(end?.angle).toBe(Math.PI / 2)
    })
  })

  describe('back edges', () => {
    const loop = Hierarchy.make({ ...spec.toJSON(), backEdges: Hierarchy.backEdges.loop })
    const nodes = [Frame.setId(box, 'a'), Frame.setId(box, 'b'), Frame.setId(box, 'c')]

    test('a loop leaves downstream and enters upstream, around both nodes', () => {
      const layout = Hierarchy.apply(
        nodes.slice(0, 2),
        [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'b', target: 'a' })],
        loop,
      )
      expect(layout.nodes.a).toEqual(Rect.make(0, 10, 100, 40))
      expect(layout.nodes.b).toEqual(Rect.make(0, 90, 100, 40))
      expect(points(layout.edges[0])).toEqual([
        [50, 50],
        [50, 90],
      ])
      // It turns below b and above a, in lanes outside the ranks.
      expect(points(layout.edges[1])).toEqual([
        [50, 130],
        [50, 140],
        [115, 140],
        [115, 0],
        [50, 0],
        [50, 10],
      ])
    })

    test('a loop enters beside the centered ports, so straight edges stay straight', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'b', target: 'c' }),
          Edge.make({ source: 'c', target: 'b' }),
        ],
        loop,
      )
      expect(points(layout.edges[0])).toEqual([
        [50, 40],
        [50, 80],
      ])
      expect(points(layout.edges[2])).toEqual([
        [50, 200],
        [50, 210],
        [115, 210],
        [115, 70],
        [60, 70],
        [60, 80],
      ])
    })

    test('an explicit side overrides the loop at its end only', () => {
      const layout = Hierarchy.apply(
        nodes.slice(0, 2),
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'b', target: 'a', sourceSide: Edge.side.top }),
        ],
        loop,
      )
      const b = layout.nodes.b
      const route = layout.edges[1]?.points ?? []
      expect(route[0]?.y).toBe(b.top)
      expect(route[route.length - 1]).toEqual(Point.make(50, layout.nodes.a.top))
    })
  })

  describe('rank bands', () => {
    const nodes = [
      Frame.setId(box, 'root'),
      Frame.make({ id: 'short', width: 40, height: 20 }),
      Frame.make({ id: 'tall', width: 40, height: 60 }),
      Frame.make({ id: 'end', width: 40, height: 20, align: 1 }),
      Frame.make({ id: 'fill', width: 40, height: 20, stretch: 1 }),
    ]
    const edges = (['short', 'tall', 'end', 'fill'] as const).map((target) =>
      Edge.make({ source: 'root', target }),
    )

    test('frames align and stretch within the thickest node of their rank', () => {
      const layout = Hierarchy.apply(nodes, edges, Hierarchy.make({ rankGap: 40, alignItems: 0 }))
      expect(layout.nodes.short).toMatchObject({ y: 80, height: 20 })
      expect(layout.nodes.tall).toMatchObject({ y: 80, height: 60 })
      expect(layout.nodes.end).toMatchObject({ y: 120, height: 20 })
      expect(layout.nodes.fill).toMatchObject({ y: 80, height: 60 })
    })

    test('alignItems defaults to centering', () => {
      const layout = Hierarchy.apply(nodes, edges, Hierarchy.make({ rankGap: 40 }))
      expect(layout.nodes.short).toMatchObject({ y: 100, height: 20 })
    })

    test('alignment stays physical when the flow reverses', () => {
      const layout = Hierarchy.apply(
        nodes,
        edges,
        Hierarchy.make({ rankGap: 40, alignItems: 0, direction: Hierarchy.direction.up }),
      )
      // The rank of the leaves spans y 0 to 60. Top alignment still means the top.
      expect(layout.nodes.short).toMatchObject({ y: 0, height: 20 })
      expect(layout.nodes.end).toMatchObject({ y: 40, height: 20 })
    })

    test('auto offsets along the flow position a node like auto margins', () => {
      const layout = Hierarchy.apply(
        [
          Frame.make({ id: 'tall', width: 40, height: 60 }),
          Frame.make({ id: 'auto', width: 40, height: 20, offsetTop: Number.POSITIVE_INFINITY }),
        ],
        [],
        Hierarchy.make({ alignItems: 0 }),
      )
      expect(layout.nodes.auto).toMatchObject({ y: 40 })
    })
  })

  describe('flow adornments', () => {
    const nodes = [Frame.setId(box, 'a'), Frame.setId(box, 'b')]
    const label = Frame.make({ width: 20, height: 10 })

    test('one in the middle takes room in the rank between the nodes', () => {
      const layout = Hierarchy.apply(
        nodes,
        [Edge.make({ source: 'a', target: 'b', adornments: [labelOf(label)] })],
        spec,
      )
      expect(layout.edges[0]?.adornments).toEqual([
        { rect: Rect.make(40, 60, 20, 10), angle: 0, along: Interval.make(20, 10) },
      ])
      // The label's thickness adds to the rank gap.
      expect(layout.nodes.b?.y).toBe(40 + 40 + 10)
      expect(points(layout.edges[0])).toEqual([
        [50, 40],
        [50, 90],
      ])
    })

    test('align puts one beside the line, and offsets add clearance', () => {
      const right = Frame.make({ width: 20, height: 10, align: 1, offsetLeft: 4 })
      const left = Frame.make({ width: 20, height: 10, align: 0, offsetRight: 4 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'b', adornments: [labelOf(right)] }),
          Edge.make({ source: 'a', target: 'b', adornments: [labelOf(left)] }),
        ],
        spec,
      )
      const [first, second] = layout.edges
      const firstRect = first?.adornments[0]?.rect as Rect.Rect
      const secondRect = second?.adornments[0]?.rect as Rect.Rect
      expect(firstRect.x).toBe(lineAt(first, firstRect.y) + 4)
      expect(secondRect.x).toBe(lineAt(second, secondRect.y) - 4 - 20)
    })

    test('alignAdornments sets the default side', () => {
      const layout = Hierarchy.apply(
        nodes,
        [Edge.make({ source: 'a', target: 'b', adornments: [labelOf(label)] })],
        Hierarchy.make({ rankGap: 40, alignAdornments: 1 }),
      )
      expect(layout.edges[0]?.adornments[0]?.rect.x).toBe(layout.edges[0]?.points[0]?.x)
    })

    test('ones in a layer on one run line up in order along the edge', () => {
      const gapped = Frame.make({ width: 20, height: 10, offsetTop: 2 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            adornments: [labelOf(label, { at: 0.6 }), labelOf(gapped, { at: 0.4 })],
          }),
        ],
        spec,
      )
      const [late, early] = layout.edges[0]?.adornments ?? []
      // The run holds both and the gap: 22 along the flow.
      expect(layout.nodes.b?.y).toBe(40 + 40 + 22)
      expect(early?.rect).toEqual(Rect.make(40, 62, 20, 10))
      expect(late?.rect).toEqual(Rect.make(40, 72, 20, 10))
    })

    test('layers overlap, and the longest one sizes the run', () => {
      const dot = Frame.make({ width: 6, height: 6 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            adornments: [labelOf(label, { at: 0.4 }), labelOf(label), labelOf(dot, { layer: 1 })],
          }),
        ],
        spec,
      )
      const [first, second, top] = layout.edges[0]?.adornments ?? []
      expect(layout.nodes.b?.y).toBe(40 + 40 + 20)
      expect(first?.rect.y).toBe(60)
      expect(second?.rect.y).toBe(70)
      // The dot centers on the run, over the two labels.
      expect(top?.rect).toEqual(Rect.make(47, 67, 6, 6))
    })

    test('ones near an end go to its stub and pack against the port', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            adornments: [labelOf(label, { at: 0.1 }), labelOf(label, { at: 0.9 })],
          }),
        ],
        spec,
      )
      const [early, late] = layout.edges[0]?.adornments ?? []
      expect(layout.nodes.b?.y).toBe(80)
      expect(early?.rect).toEqual(Rect.make(40, 40, 20, 10))
      expect(late?.rect).toEqual(Rect.make(40, 70, 20, 10))
    })

    test('positions on a reversed edge measure from the source', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({
            source: 'b',
            target: 'a',
            adornments: [labelOf(label, { at: 0.4 }), labelOf(label, { at: 0.6 })],
          }),
        ],
        spec,
      )
      // The back edge runs upward, so the label nearer its source (b) is lower.
      const [nearSource, nearTarget] = layout.edges[1]?.adornments ?? []
      expect(nearSource?.rect.y).toBeGreaterThan(nearTarget?.rect.y ?? Number.NaN)
    })

    test('a turned one measures its frame along the line', () => {
      const arrow = Frame.make({ width: 20, height: 10, offsetLeft: 4 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            adornments: [labelOf(arrow, { orient: Adornment.orient.forward })],
          }),
        ],
        spec,
      )
      const placed = layout.edges[0]?.adornments[0]
      // 24 along the flow, margin included, and 10 across it. The upright
      // rect turns a quarter turn about its center, at (50, 74).
      expect(layout.nodes.b?.y).toBe(40 + 40 + 24)
      expect(placed?.angle).toBe(Math.PI / 2)
      expect(placed?.rect).toEqual(Rect.make(40, 69, 20, 10))
      expect(placed?.along).toEqual(Interval.make(24, 20))
      // The bounds hold the turned box, which is 10 wide.
      expect(layout.bounds.width).toBe(100)
    })

    test.each([
      ['right', Hierarchy.direction.right, Rect.make(120, 15, 20, 10), 0],
      ['left', Hierarchy.direction.left, Rect.make(120, 15, 20, 10), Math.PI],
      ['up', Hierarchy.direction.up, Rect.make(40, 65, 20, 10), -Math.PI / 2],
    ] as const)('a turned one faces along the flow %s', (_, direction, rect, angle) => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            adornments: [labelOf(label, { orient: Adornment.orient.forward })],
          }),
        ],
        Hierarchy.make({ rankGap: 40, direction }),
      )
      expect(layout.edges[0]?.adornments[0]?.rect).toEqual(rect)
      expect(layout.edges[0]?.adornments[0]?.angle).toBe(angle)
    })

    test('align on a turned one is in its own frame', () => {
      // Above its local x axis, which points down the flow: to the right.
      const above = Frame.make({ width: 20, height: 10, align: 0 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            adornments: [labelOf(above, { orient: Adornment.orient.forward })],
          }),
        ],
        spec,
      )
      const rect = layout.edges[0]?.adornments[0]?.rect as Rect.Rect
      expect(rect.x + rect.width / 2).toBe(55)
    })
  })

  describe('absolute adornments', () => {
    const three = withIds(['a', 'b', 'c'])
    const dot = Frame.make({ width: 4, height: 4 })

    test('one sits at its position along the line and takes no room', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b']),
        [
          Edge.make({
            source: 'a',
            target: 'b',
            adornments: [labelOf(dot, { at: 0.25, position: Adornment.position.absolute })],
          }),
        ],
        spec,
      )
      expect(layout.nodes.b?.y).toBe(80)
      expect(layout.edges[0]?.adornments[0]).toEqual({
        rect: Rect.make(48, 48, 4, 4),
        angle: 0,
        along: Interval.make(8, 4),
      })
    })

    test('one on a rounded corner sits on its arc and faces along it', () => {
      const layout = Hierarchy.apply(
        three,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            radius: 8,
            adornments: [
              labelOf(dot, {
                at: 0,
                position: Adornment.position.absolute,
                orient: Adornment.orient.forward,
              }),
              labelOf(dot, { at: 1, position: Adornment.position.absolute }),
            ],
          }),
          Edge.make({ source: 'a', target: 'c' }),
        ],
        spec,
      )
      const route = layout.edges[0] as Hierarchy.HierarchyRoute
      expect(points(route)).toEqual([
        [105, 40],
        [105, 50],
        [50, 50],
        [50, 80],
      ])
      expect(route.radii).toEqual([0, 8, 8, 0])
      const [start, end] = route.adornments
      expect(start?.rect).toEqual(Rect.make(103, 38, 4, 4))
      expect(start?.angle).toBe(Math.PI / 2)
      expect(end?.rect).toEqual(Rect.make(48, 78, 4, 4))
      expect(end?.along).toEqual(Interval.make(93, 4))
    })

    test('the middle of a rounded corner maps onto the polyline evenly', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b']),
        [
          Edge.make({
            source: 'a',
            target: 'b',
            targetSide: Edge.side.left,
            radius: 10,
            adornments: [labelOf(dot, { position: Adornment.position.absolute })],
          }),
        ],
        Hierarchy.make({ rankGap: 40 }),
      )
      const route = layout.edges[0] as Hierarchy.HierarchyRoute
      const placed = route.adornments[0] as Hierarchy.HierarchyAdornment
      const total = route.points
        .slice(1)
        .reduce((sum, point, i) => sum + Point.distance(route.points[i] as Point.Point, point), 0)
      // Each corner swaps 2r of polyline for a quarter circle of length
      // pi r / 2, so the drawn line is shorter. Its middle still maps back
      // into the polyline.
      expect(placed.along.start + placed.along.size / 2).toBeGreaterThan(0)
      expect(placed.along.start + placed.along.size / 2).toBeLessThan(total)
    })
  })

  describe('corners', () => {
    const three = withIds(['a', 'b', 'c'])

    test('take the radius where the route has room', () => {
      const layout = Hierarchy.apply(
        three,
        [
          Edge.make({ source: 'a', target: 'b', radius: 4 }),
          Edge.make({ source: 'a', target: 'c', radius: 4 }),
        ],
        spec,
      )
      expect(layout.edges[0]?.radii).toEqual([0, 4, 4, 0])
    })

    test('shrink where a leg is short', () => {
      const layout = Hierarchy.apply(
        three,
        [
          Edge.make({ source: 'a', target: 'b', radius: 30 }),
          Edge.make({ source: 'a', target: 'c', radius: 30 }),
        ],
        spec,
      )
      // The jog sits 10 below a, so the first corner fits in 10.
      expect(points(layout.edges[0])).toEqual([
        [105, 40],
        [105, 50],
        [50, 50],
        [50, 80],
      ])
      expect(layout.edges[0]?.radii).toEqual([0, 10, 30, 0])
    })

    test('two corners on a short leg split it', () => {
      const layout = Hierarchy.apply(
        withIds(['a', 'b', 'c']),
        [
          Edge.make({ source: 'a', target: 'b', radius: 30 }),
          Edge.make({ source: 'a', target: 'c', radius: 30 }),
        ],
        Hierarchy.make({ rankGap: 200, nodeGap: 4, edgeGap: 4 }),
      )
      const route = layout.edges[0] as Hierarchy.HierarchyRoute
      const jog = Point.distance(route.points[1] as Point.Point, route.points[2] as Point.Point)
      expect(jog).toBeLessThan(60)
      expect(route.radii).toEqual([0, jog / 2, jog / 2, 0])
    })

    test('minRadius keeps room where layout sets the length', () => {
      const layout = Hierarchy.apply(
        three,
        [
          Edge.make({ source: 'a', target: 'b', radius: 30, minRadius: 25 }),
          Edge.make({ source: 'a', target: 'c' }),
        ],
        spec,
      )
      // The lane moves 25 from a. The leg below it runs on through the
      // next channel, so that side needs nothing more.
      expect(points(layout.edges[0])).toEqual([
        [105, 40],
        [105, 65],
        [50, 65],
        [50, 95],
      ])
      expect(layout.edges[0]?.radii).toEqual([0, 25, 30, 0])
    })

    test('keep clear of flow adornments and their gaps', () => {
      const arrow = Frame.make({ width: 9, height: 8, offsetLeft: 4 })
      const layout = Hierarchy.apply(
        three,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            radius: 30,
            adornments: [labelOf(arrow, { at: 1, orient: Adornment.orient.forward })],
          }),
          Edge.make({ source: 'a', target: 'c' }),
        ],
        spec,
      )
      // The last leg runs 30 into b, and the arrow and its gap take 13.
      const route = layout.edges[0] as Hierarchy.HierarchyRoute
      expect(points(route)?.at(-2)).toEqual([50, 50])
      expect(route.radii.at(-2)).toBe(17)
    })
  })

  describe('ports', () => {
    const nodes = [Frame.setId(box, 'a'), Frame.setId(box, 'b')]

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
      const a = layout.nodes.a
      // The edge steps out to its column, half of nodeGap plus half of
      // edgeGap beside the node. It then runs with the flow to its jog, in
      // the middle of the channel below the rank.
      expect(route.slice(0, 3)).toEqual([
        [a.right, 20],
        [a.right + 15, 20],
        [a.right + 15, 50],
      ])
    })

    test('side ports that share a side take their own columns, edgeGap apart', () => {
      const layout = Hierarchy.apply(
        [Frame.setId(box, 'a'), Frame.setId(box, 'b'), Frame.setId(box, 'c')],
        [
          Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.right }),
          Edge.make({ source: 'a', target: 'c', sourceSide: Edge.side.right }),
        ],
        spec,
      )
      // The edge heading farther out leaves higher and takes the outer
      // column, so the two never cross.
      expect(points(layout.edges[0])).toEqual([
        [160, 25],
        [175, 25],
        [175, 50],
        [50, 50],
        [50, 90],
      ])
      expect(points(layout.edges[1])).toEqual([
        [160, 15],
        [185, 15],
        [185, 60],
        [170, 60],
        [170, 90],
      ])
      // The columns reserve room beside a, which pushes c out.
      expect(layout.nodes.c).toEqual(Rect.make(120, 90, 100, 40))
    })

    test('a port facing against the flow wraps around its node', () => {
      const layout = Hierarchy.apply(
        nodes,
        [Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.top })],
        spec,
      )
      // It turns in a lane before the first rank, passes beside the node
      // in its column, and jogs back in the channel below.
      expect(layout.nodes.a).toEqual(Rect.make(0, 10, 100, 40))
      expect(points(layout.edges[0])).toEqual([
        [50, 10],
        [50, 0],
        [115, 0],
        [115, 60],
        [50, 60],
        [50, 90],
      ])
    })

    test('a side port runs straight out to where its edge continues', () => {
      const layout = Hierarchy.apply(
        [Frame.setId(box, 'a'), Frame.setId(box, 'b'), Frame.setId(box, 'c')],
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'a', target: 'c', sourceSide: Edge.side.right }),
        ],
        spec,
      )
      // c's port lies past a's column, so the edge turns once, above it.
      expect(points(layout.edges[1])).toEqual([
        [100, 20],
        [170, 20],
        [170, 80],
      ])
    })

    test('a column stops short of a node beside it in the rank', () => {
      const layout = Hierarchy.apply(
        ['a', 'b', 'c', 'x'].map((id) => Frame.setId(box, id)),
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'x', target: 'c' }),
          Edge.make({ source: 'a', target: 'c', sourceSide: Edge.side.right }),
        ],
        spec,
      )
      // x sits beside a, so the edge keeps its column and jogs below the
      // rank.
      expect(layout.nodes.x).toEqual(Rect.make(130, 0, 100, 40))
      expect(points(layout.edges[2])).toEqual([
        [100, 20],
        [115, 20],
        [115, 70],
        [170, 70],
        [170, 80],
      ])
    })

    test('auto ports keep clear of fixed ports on the same side', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.bottom, sourceAt: 0.5 }),
          Edge.make({ source: 'a', target: 'b' }),
        ],
        spec,
      )
      // The fixed port claims the nearer of the two spread positions, and
      // the auto port takes the other.
      expect(layout.edges[0]?.points[0]).toEqual(Point.make(50, 40))
      expect(layout.edges[1]?.points[0]).toEqual(Point.make(55, 40))
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
      const a = layout.nodes.a
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
        [Frame.setId(narrow, 'a'), Frame.setId(narrow, 'b')],
        [
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'a', target: 'b' }),
          Edge.make({ source: 'a', target: 'b' }),
        ],
        spec,
      )
      const a = layout.nodes.a
      const xs = layout.edges
        .map((route) => (route.points[0]?.x ?? NaN) - a.x)
        .toSorted((p, q) => p - q)
      expect(xs).toEqual([4, 8, 12])
    })
  })

  describe('self loops', () => {
    test('loops nest on the order-end side, edgeGap apart', () => {
      const layout = Hierarchy.apply(
        [Frame.make({ id: 'a', width: 100, height: 60 })],
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
        [Frame.setId(box, 'a')],
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
  describe('shapes', () => {
    const diamond = Frame.make({ id: 'd', width: 80, height: 40 })
    const nodes = [
      Frame.setId(small, 'a'),
      diamond,
      Frame.setId(small, 'b'),
      Frame.setId(small, 'c'),
    ]
    const shapes = { d: Polygon.make({ phase: 0.5 }) }

    test('ports meet a diamond at its tips and on its slopes', () => {
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'd' }),
          Edge.make({ source: 'd', target: 'b' }),
          Edge.make({ source: 'd', target: 'c' }),
        ],
        spec,
        { shapes },
      )
      const d = layout.nodes.d
      // The centered port meets the top tip. The two ports out of the
      // bottom sit 5 either side of the center, where the slopes are 2.5
      // up from the rect.
      expect(layout.edges[0]?.points.at(-1)).toEqual(Point.make(d.x + 40, d.top))
      expect(layout.edges[1]?.points[0]).toEqual(Point.make(d.x + 35, d.bottom - 2.5))
      expect(layout.edges[2]?.points[0]).toEqual(Point.make(d.x + 45, d.bottom - 2.5))
    })

    test.each(Object.entries(Hierarchy.direction))(
      'every port lies on the outline, %s',
      (_, direction) => {
        const layout = Hierarchy.apply(
          nodes,
          [
            Edge.make({ source: 'a', target: 'd' }),
            Edge.make({ source: 'd', target: 'b' }),
            Edge.make({ source: 'd', target: 'c' }),
            Edge.make({ source: 'd', target: 'd' }),
            Edge.make({ source: 'b', target: 'd', targetSide: Edge.side.left, targetAt: 0.25 }),
          ],
          Hierarchy.make({ rankGap: 40, nodeGap: 20, edgeGap: 10, direction }),
          { shapes },
        )
        const d = layout.nodes.d
        const ends = [
          layout.edges[0]?.points.at(-1),
          layout.edges[1]?.points[0],
          layout.edges[2]?.points[0],
          layout.edges[3]?.points[0],
          layout.edges[3]?.points.at(-1),
          layout.edges[4]?.points.at(-1),
        ]
        for (const point of ends) {
          expect(onDiamond(point as Point.Point, d)).toBe(true)
        }
        // A fixed port on the left at a quarter of the way down meets the
        // upper-left slope, a quarter of the width in.
        expect(layout.edges[4]?.points.at(-1)).toEqual(Point.make(d.x + 20, d.y + 10))
      },
    )

    test('a rounded diamond grows so its rounded tips touch the rect', () => {
      const rounded = Polygon.make({ phase: 0.5, radius: 8 })
      const layout = Hierarchy.apply(
        nodes,
        [
          Edge.make({ source: 'a', target: 'd' }),
          Edge.make({ source: 'd', target: 'b', sourceSide: Edge.side.left }),
          Edge.make({ source: 'd', target: 'c', sourceSide: Edge.side.bottom, sourceAt: 0.25 }),
        ],
        spec,
        { shapes: { d: rounded } },
      )
      const d = layout.nodes.d
      const top = layout.edges[0]?.points.at(-1) as Point.Point
      expect(top.x).toBe(d.x + 40)
      expect(top.y).toBeCloseTo(d.top, 9)
      const left = layout.edges[1]?.points[0] as Point.Point
      expect(left.x).toBeCloseTo(d.left, 9)
      expect(left.y).toBe(d.y + 20)
      // Off center, the port sits on the grown diamond's outline.
      const slope = layout.edges[2]?.points[0] as Point.Point
      expect(slope.x).toBe(d.x + 20)
      expect(onPolygon(slope, rounded, d)).toBe(true)
      expect(slope.y).toBeLessThan(d.bottom)
    })

    test.each([
      // Past the corner's arc, the port stays on the side.
      [0.5, 10, 40],
      // On the arc of radius 10 centered at (10, 30).
      [0.05, 10, 30 + Math.sqrt(75)],
      // The corners fit only at radius 20, half the height: a pill.
      [0.1, 1000, 20 + Math.sqrt(300)],
      [0.5, 1000, 40],
    ])('a rounded rect puts a port at %f with radius %f %f down', (at, radius, y) => {
      const layout = Hierarchy.apply(
        [Frame.setId(box, 'a'), Frame.setId(box, 'b')],
        [Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.bottom, sourceAt: at })],
        spec,
        { shapes: { a: Polygon.make({ radius }) } },
      )
      const start = layout.edges[0]?.points[0] as Point.Point
      expect(start.x).toBe(at * 100)
      expect(start.y).toBeCloseTo(y, 12)
    })

    test.each([
      ['a star', Polygon.make({ sides: 5, loops: 2, phase: 0.5 })],
      ['a rounded star', Polygon.make({ sides: 5, loops: 2, phase: 0.5, radius: 3 })],
      ['a hexagram', Polygon.make({ sides: 6, loops: 2 })],
      ['a rounded triangle', Polygon.make({ sides: 3, radius: 6 })],
    ])('ports meet %s on its outline', (_, polygon) => {
      const layout = Hierarchy.apply(
        [Frame.setId(box, 'a'), Frame.setId(box, 'b')],
        [0.125, 0.3, 0.5, 0.7, 0.875].map((at) =>
          Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.bottom, sourceAt: at }),
        ),
        spec,
        { shapes: { a: polygon } },
      )
      for (const route of layout.edges) {
        expect(onPolygon(route.points[0] as Point.Point, polygon, layout.nodes.a)).toBe(true)
      }
    })

    test.each([-4, Number.NaN, Number.POSITIVE_INFINITY])('a radius of %f is sharp', (radius) => {
      const edges = [
        Edge.make({ source: 'a', target: 'd', targetSide: Edge.side.top, targetAt: 0.125 }),
      ]
      expect(
        Hierarchy.apply(nodes, edges, spec, {
          shapes: { d: Polygon.make({ phase: 0.5, radius }) },
        }),
      ).toEqual(Hierarchy.apply(nodes, edges, spec, { shapes }))
    })

    test.each([
      ['the sharp rect', Polygon.make()],
      ['a phase of 1', Polygon.make({ phase: 1 })],
      ['a value that is no polygon', {} as Polygon.Polygon],
    ])('%s is no shape', (_, polygon) => {
      const nodes = [Frame.setId(box, 'a'), Frame.setId(box, 'b')]
      const edges = [
        Edge.make({ source: 'a', target: 'b' }),
        Edge.make({ source: 'a', target: 'b', sourceAt: 0.125 }),
      ]
      expect(Hierarchy.apply(nodes, edges, spec, { shapes: { a: polygon } })).toEqual(
        Hierarchy.apply(nodes, edges, spec),
      )
    })

    test('ids that name prototype properties have no shape', () => {
      const nodes = [Frame.setId(box, 'toString'), Frame.setId(box, 'constructor')]
      const edges = [Edge.make({ source: 'toString', target: 'constructor' })]
      // A plain object, whose prototype has both names.
      const shapes = JSON.parse('{}')
      expect(Hierarchy.apply(nodes, edges, spec, { shapes })).toEqual(
        Hierarchy.apply(nodes, edges, spec),
      )
    })
  })
})

// A pseudo-random graph for property checks. A linear congruential
// generator keeps it deterministic.
function randomGraph(seed: number, nodeCount: number, edgeCount: number, sides = false) {
  let state = seed
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const nodes: Array<Frame.Frame<string>> = []
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(
      Frame.make({
        id: `n${i}`,
        width: 20 + Math.floor(next() * 8) * 10,
        height: 20 + Math.floor(next() * 4) * 10,
      }),
    )
  }
  const edges: Array<Edge.Edge<string>> = []
  for (let i = 0; i < edgeCount; i++) {
    const source = `n${Math.floor(next() * nodeCount)}`
    const target = `n${Math.floor(next() * nodeCount)}`
    const adornments: Array<Adornment.Adornment> = []
    if (next() < 0.2) {
      adornments.push(
        Adornment.make({
          frame: Frame.make({ width: 30, height: 12 }),
          at: Math.floor(next() * 5) / 4,
          layer: Math.floor(next() * 2),
        }),
      )
    }
    // With `sides`, about a third of the ports get a random side, and about
    // a third an end adornment. Some edges carry a dot in the middle too.
    const side = () => (sides && next() < 0.35 ? Math.floor(next() * 4) : undefined)
    for (const at of [0, 1]) {
      if (sides && next() < 0.35) {
        adornments.push(stub(6 + Math.floor(next() * 4) * 6, at))
      }
    }
    if (sides && next() < 0.2) {
      adornments.push(
        Adornment.make({
          frame: Frame.make({ width: 6, height: 6 }),
          at: next(),
          position: Math.floor(next() * 2),
        }),
      )
    }
    const radius = Math.floor(next() * 3) * 6
    edges.push(
      Edge.make({
        source,
        target,
        adornments,
        sourceSide: side(),
        targetSide: side(),
        radius,
        minRadius: next() < 0.5 ? radius : 0,
      }),
    )
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

// A route's corners: one size per point, `0` at the ends, at most the
// edge's radius, never past a neighbor on a shared leg, and clear of the
// stretches its flow adornments cover. Flow adornments in one layer never
// overlap along the route.
function expectCorners(edge: Edge.Edge<string>, route: Hierarchy.HierarchyRoute): void {
  const { points: list, radii, adornments } = route
  expect(radii).toHaveLength(list.length)
  expect(radii[0]).toBe(0)
  expect(radii.at(-1)).toBe(0)
  const along = [0]
  for (let k = 1; k < list.length; k++) {
    along.push(
      (along[k - 1] as number) + Point.distance(list[k - 1] as Point.Point, list[k] as Point.Point),
    )
  }
  for (const [k, radius] of radii.entries()) {
    expect(radius).toBeGreaterThanOrEqual(0)
    expect(radius).toBeLessThanOrEqual(edge.radius + 1e-9)
    if (k > 0) {
      const leg = (along[k] as number) - (along[k - 1] as number)
      expect(radius + (radii[k - 1] as number)).toBeLessThanOrEqual(leg + 1e-9)
    }
  }
  const flow = adornments.filter((_, k) => edge.adornments[k]?.position !== 1)
  for (const [k, placed] of flow.entries()) {
    const { start, end } = placed.along
    for (const [c, radius] of radii.entries()) {
      const at = along[c] as number
      const overlap = Math.min(end, at + radius) - Math.max(start, at - radius)
      if (radius > 0) {
        expect(overlap).toBeLessThanOrEqual(1e-9)
      }
    }
    const layer = edge.adornments.filter((adornment) => adornment.position !== 1)[k]?.layer
    for (const [m, other] of flow.entries()) {
      const otherLayer = edge.adornments.filter((adornment) => adornment.position !== 1)[m]?.layer
      if (m > k && layer === otherLayer) {
        const overlap = Math.min(end, other.along.end) - Math.max(start, other.along.start)
        expect(overlap).toBeLessThanOrEqual(1e-9)
      }
    }
  }
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
      for (const frame of nodes) {
        const rect = layout.nodes[frame.id] as Rect.Rect
        expect([rect.width, rect.height]).toEqual([frame.width, frame.height])
      }

      // No two nodes overlap.
      const rects = Object.values<Rect.Rect>(layout.nodes)
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
        expect(onBoundary(route[0] as Point.Point, layout.nodes[edge.source] as Rect.Rect)).toBe(
          true,
        )
        expect(
          onBoundary(
            route[route.length - 1] as Point.Point,
            layout.nodes[edge.target] as Rect.Rect,
          ),
        ).toBe(true)
        expect(layout.edges[i]?.adornments).toHaveLength(edge.adornments.length)
        expectCorners(edge, layout.edges[i] as Hierarchy.HierarchyRoute)
      }

      // Orthogonal routes: every segment runs with or across the flow. The
      // segments across the flow are jogs between ranks. Jogs of different
      // edges that share a lane never overlap, and no jog crosses a node.
      const across: Array<[edge: number, at: number, from: number, to: number]> = []
      for (const [i, { points: route }] of layout.edges.entries()) {
        for (let k = 1; k < route.length; k++) {
          const a = route[k - 1] as Point.Point
          const b = route[k] as Point.Point
          expect(coincident(a.x, b.x) || coincident(a.y, b.y)).toBe(true)
          const flowAlongX = !hierarchy.isVertical
          const [aFlow, bFlow, aCross, bCross] = flowAlongX
            ? [a.x, b.x, a.y, b.y]
            : [a.y, b.y, a.x, b.x]
          if (coincident(aFlow, bFlow) && !coincident(aCross, bCross)) {
            across.push([i, aFlow, Math.min(aCross, bCross), Math.max(aCross, bCross)])
          }
        }
      }
      for (let m = 0; m < across.length; m++) {
        const [edgeA, atA, fromA, toA] = across[m] as [number, number, number, number]
        for (let n = m + 1; n < across.length; n++) {
          const [edgeB, atB, fromB, toB] = across[n] as [number, number, number, number]
          if (edgeA !== edgeB && coincident(atA, atB)) {
            expect(Math.min(toA, toB) - Math.max(fromA, fromB)).toBeLessThanOrEqual(1e-9)
          }
        }
        for (const rect of rects) {
          const [flowStart, flowEnd, crossStart, crossEnd] = hierarchy.isVertical
            ? [rect.top, rect.bottom, rect.left, rect.right]
            : [rect.left, rect.right, rect.top, rect.bottom]
          const insideFlow = atA > flowStart + 1e-9 && atA < flowEnd - 1e-9
          const overlapsCross = Math.min(toA, crossEnd) - Math.max(fromA, crossStart) > 1e-9
          expect(insideFlow && overlapsCross).toBe(false)
        }
      }

      // Bounds start at the origin and contain everything.
      expect([layout.bounds.x, layout.bounds.y]).toEqual([0, 0])
      for (const rect of rects) {
        expect(Rect.contains(layout.bounds, rect)).toBe(true)
      }
      for (const route of layout.edges) {
        for (const { rect } of route.adornments) {
          expect(Rect.contains(layout.bounds, rect)).toBe(true)
        }
      }
    }
  })

  // Orthogonal routes with side ports, wraps, end adornments, and both back
  // edge styles: every segment runs with or across the flow, no segment
  // passes through a node, no two edges overlap along a line, and a route
  // that turns keeps its first and last segments as long as the adornments
  // at its ends. Corners and flow adornments keep clear of each other.
  test.each([11, 12, 13, 14, 15, 16, 17, 18])('random graph %i with sides', (seed) => {
    const { nodes, edges } = randomGraph(seed, 12, 18, true)
    for (const backEdges of Object.values(Hierarchy.backEdges)) {
      for (const direction of Object.values(Hierarchy.direction)) {
        const hierarchy = Hierarchy.make({
          rankGap: 30,
          nodeGap: 20,
          edgeGap: 8,
          direction,
          backEdges,
        })
        const layout = Hierarchy.apply(nodes, edges, hierarchy)
        expect(Hierarchy.apply(nodes, edges, hierarchy)).toEqual(layout)

        const rects = Object.values<Rect.Rect>(layout.nodes)
        const lines: Array<
          [edge: number, vertical: boolean, at: number, from: number, to: number]
        > = []
        for (const [i, edge] of edges.entries()) {
          if (edge.source === edge.target) {
            continue
          }
          const route = layout.edges[i]?.points ?? []
          expect(onBoundary(route[0] as Point.Point, layout.nodes[edge.source] as Rect.Rect)).toBe(
            true,
          )
          expect(
            onBoundary(
              route[route.length - 1] as Point.Point,
              layout.nodes[edge.target] as Rect.Rect,
            ),
          ).toBe(true)
          expectCorners(edge, layout.edges[i] as Hierarchy.HierarchyRoute)
          if (route.length > 2) {
            const first = Point.distance(route[0] as Point.Point, route[1] as Point.Point)
            const last = Point.distance(
              route[route.length - 2] as Point.Point,
              route[route.length - 1] as Point.Point,
            )
            const stubOf = (at: number) =>
              Math.max(
                0,
                ...edge.adornments
                  .filter((adornment) => adornment.at === at && adornment.orient !== 0)
                  .map((adornment) => adornment.frame.width),
              )
            expect(first).toBeGreaterThanOrEqual(stubOf(0) - 1e-9)
            expect(last).toBeGreaterThanOrEqual(stubOf(1) - 1e-9)
          }
          for (let k = 1; k < route.length; k++) {
            const a = route[k - 1] as Point.Point
            const b = route[k] as Point.Point
            const vertical = coincident(a.x, b.x)
            expect(vertical || coincident(a.y, b.y)).toBe(true)
            const [at, from, to] = vertical
              ? [a.x, Math.min(a.y, b.y), Math.max(a.y, b.y)]
              : [a.y, Math.min(a.x, b.x), Math.max(a.x, b.x)]
            lines.push([i, vertical, at, from, to])
            for (const rect of rects) {
              const [crossStart, crossEnd, alongStart, alongEnd] = vertical
                ? [rect.left, rect.right, rect.top, rect.bottom]
                : [rect.top, rect.bottom, rect.left, rect.right]
              const insideCross = at > crossStart + 1e-9 && at < crossEnd - 1e-9
              const overlapsAlong = Math.min(to, alongEnd) - Math.max(from, alongStart) > 1e-9
              expect(insideCross && overlapsAlong).toBe(false)
            }
          }
        }
        for (let m = 0; m < lines.length; m++) {
          const [edgeA, verticalA, atA, fromA, toA] = lines[m] as (typeof lines)[number]
          for (let n = m + 1; n < lines.length; n++) {
            const [edgeB, verticalB, atB, fromB, toB] = lines[n] as (typeof lines)[number]
            if (edgeA !== edgeB && verticalA === verticalB && coincident(atA, atB)) {
              expect(Math.min(toA, toB) - Math.max(fromA, fromB)).toBeLessThanOrEqual(1e-9)
            }
          }
        }
      }
    }
  })

  test('uniform scaling scales the layout', () => {
    const { nodes, edges } = randomGraph(7, 12, 16)
    const scale = 1e6
    const scaled = nodes.map((frame) =>
      Frame.make({ id: frame.id, width: frame.width * scale, height: frame.height * scale }),
    )
    const scaledEdges = edges.map((edge) =>
      Edge.setAdornments(
        Edge.setRadius(edge, edge.radius * scale, edge.minRadius * scale),
        edge.adornments.map((adornment) =>
          Adornment.setFrame(
            adornment,
            Frame.make({
              width: adornment.frame.width * scale,
              height: adornment.frame.height * scale,
            }),
          ),
        ),
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
    for (const frame of nodes) {
      const rect = base.nodes[frame.id] as Rect.Rect
      const other = big.nodes[frame.id] as Rect.Rect
      expect(other.x / scale).toBeCloseTo(rect.x, 6)
      expect(other.y / scale).toBeCloseTo(rect.y, 6)
    }
    for (const [i, route] of base.edges.entries()) {
      expect(big.edges[i]?.points).toHaveLength(route.points.length)
      for (const [k, radius] of route.radii.entries()) {
        expect((big.edges[i]?.radii[k] ?? Number.NaN) / scale).toBeCloseTo(radius, 6)
      }
    }
  })

  test('non-dyadic sizes stay close to the dyadic layout', () => {
    const nodes = [
      Frame.make({ id: 'a', width: 0.1, height: 0.1 }),
      Frame.make({ id: 'b', width: 0.1, height: 0.1 }),
      Frame.make({ id: 'c', width: 0.1, height: 0.1 }),
    ]
    const layout = Hierarchy.apply(
      nodes,
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      Hierarchy.make({ rankGap: 0.3, nodeGap: 0.2 }),
    )
    const b = layout.nodes.b
    const c = layout.nodes.c
    expect(b.y).toBeCloseTo(0.4, 12)
    expect(c.x - b.right).toBeCloseTo(0.2, 12)
    expect(layout.nodes.a.x).toBeCloseTo(0.15, 12)
  })

  // Shapes move only the ends of routes: each port slides in along its
  // first or last segment onto the outline, and the rest of the layout
  // stays as it is.
  test.each([21, 22, 23, 24])('random graph %i with shapes', (seed) => {
    const { nodes, edges } = randomGraph(seed, 12, 18, true)
    const kinds = [
      Polygon.make({ phase: 0.5 }),
      Polygon.make({ phase: 0.5, radius: 6 }),
      Polygon.make({ radius: 1000 }),
      Polygon.make({ sides: 5, loops: 2, phase: 0.5, radius: 2 }),
      Polygon.make({ sides: 6, radius: 4 }),
      undefined,
    ]
    const kindOf = (id: string) => kinds[Number(id.slice(1)) % kinds.length]
    const shapes = Object.fromEntries(
      nodes.flatMap((frame): Array<[string, Polygon.Polygon]> => {
        const kind = kindOf(frame.id)
        return kind === undefined ? [] : [[frame.id, kind]]
      }),
    )
    for (const backEdges of Object.values(Hierarchy.backEdges)) {
      for (const direction of Object.values(Hierarchy.direction)) {
        const hierarchy = Hierarchy.make({
          rankGap: 30,
          nodeGap: 20,
          edgeGap: 8,
          direction,
          backEdges,
        })
        const plain = Hierarchy.apply(nodes, edges, hierarchy)
        const shaped = Hierarchy.apply(nodes, edges, hierarchy, { shapes })
        // Adornments packed against a port move with it, which can move the
        // bounds and so the origin of the drawing. Compare in the plain
        // layout's frame.
        const first = nodes[0]?.id as string
        const dx = (plain.nodes[first] as Rect.Rect).x - (shaped.nodes[first] as Rect.Rect).x
        const dy = (plain.nodes[first] as Rect.Rect).y - (shaped.nodes[first] as Rect.Rect).y
        // The shift by a non-dyadic amount rounds, so compare by closeness.
        for (const frame of nodes) {
          const rect = Rect.translate(shaped.nodes[frame.id] as Rect.Rect, dx, dy)
          const expected = plain.nodes[frame.id] as Rect.Rect
          expectClose(Point.make(rect.x, rect.y), Point.make(expected.x, expected.y))
          expect([rect.width, rect.height]).toEqual([expected.width, expected.height])
        }
        for (const [i, edge] of edges.entries()) {
          const before = plain.edges[i]?.points ?? []
          const after = (shaped.edges[i]?.points ?? []).map((point) =>
            Point.translate(point, dx, dy),
          )
          expect(after).toHaveLength(before.length)
          for (let k = 1; k + 1 < after.length; k++) {
            expectClose(after[k] as Point.Point, before[k])
          }
          for (const [end, next, id] of [
            [0, 1, edge.source],
            [after.length - 1, after.length - 2, edge.target],
          ] as const) {
            const moved = after[end] as Point.Point
            const was = before[end] as Point.Point
            const rect = plain.nodes[id] as Rect.Rect
            const kind = kindOf(id)
            if (kind === undefined) {
              expectClose(moved, was)
              continue
            }
            // On the outline, inside the rect, and on the line of the
            // segment it ends.
            expect(onPolygon(moved, kind, rect)).toBe(true)
            expect(Rect.contains(rect, moved)).toBe(true)
            const neighbor = after[next] as Point.Point
            const alongX = coincident(was.y, neighbor.y) && !coincident(was.x, neighbor.x)
            expect(alongX ? moved.y : moved.x).toBeCloseTo(alongX ? was.y : was.x, 9)
          }
        }
      }
    }
  })
})
