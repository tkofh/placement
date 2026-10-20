import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Interval from '../src/interval.ts'
import * as Point from '../src/point.ts'
import * as Polygon from '../src/polygon.ts'
import * as Rect from '../src/rect.ts'

const pointsOf = (layout: Connector.ConnectorLayout, i = 0) =>
  layout.edges[i]?.points.map(({ x, y }) => [x, y])

// Corners cost nothing here, so that the routes show the mechanism each
// test is about, not the trade between corners and length.
const spec = Connector.make({ clearance: 10, gap: 4, bendCost: 0 })

// An edge from the right of `a` to the top of `b`, with rounded corners.
const rightToTop = (from: number, to: number) =>
  Edge.make({
    source: 'a',
    target: 'b',
    sourceSide: Edge.side.right,
    sourceAt: from,
    targetSide: Edge.side.top,
    targetAt: to,
    radius: 30,
  })

// An edge from the right of `a` to the left of `b`, at the same position
// along both sides.
const across = (at: number) =>
  Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3, sourceAt: at, targetAt: at })
const pair = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 0, 40, 20) }

// An arrowhead 8 long, with a margin of 2 trailing it.
const arrow = (at: number, orient: number) =>
  Adornment.make({ width: 8, height: 6, marginLeft: 2, at, orient })

// An upright label, 20 by 10.
const label = (at: number, position: number = Adornment.position.flow) =>
  Adornment.make({ width: 20, height: 10, at, position })

describe('make', () => {
  const defaults = {
    clearance: 0,
    gap: 0,
    bendCost: Number.NaN,
    alignAdornments: 0.5,
    justifyAdornments: 0.5,
    justifyAdornmentsSpace: 0,
    justifyAdornmentsSpaceOuter: 0,
    adornmentGap: 0,
    jogAt: 0.5,
    jogSlant: 1,
    merge: 0,
    mergeGap: Number.NaN,
  }

  test('lengths default to zero, the corner cost to auto, and adornments to the middle', () => {
    expect(Connector.make().toJSON()).toEqual(defaults)
  })

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('%f acts as the default', (value) => {
    expect(
      Connector.make({
        clearance: value,
        gap: value,
        adornmentGap: value,
        ...Object.fromEntries(
          [
            'alignAdornments',
            'justifyAdornments',
            'justifyAdornmentsSpace',
            'justifyAdornmentsSpaceOuter',
            'jogAt',
          ].map((key) => [key, Number.isFinite(value) ? defaults[key as 'jogAt'] : value]),
        ),
      }).toJSON(),
    ).toEqual(defaults)
  })

  test.each([
    [8, 8],
    [0, 0],
    [-1, 0],
    [Number.NaN, Number.NaN],
    [Number.POSITIVE_INFINITY, Number.NaN],
  ])('corner cost %f reads as %f', (value, expected) => {
    expect(Connector.make({ bendCost: value }).bendCost).toBe(expected)
  })

  test('a finite adornment alignment stays as given', () => {
    expect(Connector.make({ alignAdornments: -1 }).alignAdornments).toBe(-1)
  })

  test('the jog position clamps to the run', () => {
    expect(Connector.make({ jogAt: -1 }).jogAt).toBe(0)
    expect(Connector.make({ jogAt: 2 }).jogAt).toBe(1)
  })

  test.each([
    [Connector.merge.side, Connector.merge.side],
    [Connector.merge.near, Connector.merge.near],
    [3, Connector.merge.none],
    [0.5, Connector.merge.none],
    [Number.NaN, Connector.merge.none],
  ])('merge %f reads as %i', (value, expected) => {
    expect(Connector.make({ merge: value }).merge).toBe(expected)
  })

  test.each([
    [2, 2],
    [0, 0],
    [-1, Number.NaN],
    [Number.POSITIVE_INFINITY, Number.NaN],
  ])('merge gap %f reads as %f', (value, expected) => {
    expect(Connector.make({ mergeGap: value }).mergeGap).toBe(expected)
  })

  test('setMergeGap, data-first and data-last', () => {
    const base = Connector.make()
    expect(Connector.setMergeGap(base, 2).mergeGap).toBe(2)
    expect(base.pipe(Connector.setMergeGap(3)).mergeGap).toBe(3)
    expect(base.mergeGap).toBe(Number.NaN)
  })

  test('setMerge, data-first and data-last', () => {
    const base = Connector.make()
    expect(Connector.setMerge(base, Connector.merge.near).merge).toBe(2)
    expect(base.pipe(Connector.setMerge(Connector.merge.side)).merge).toBe(1)
    expect(base.merge).toBe(0)
  })

  test('isConnector', () => {
    expect(Connector.isConnector(Connector.make())).toBe(true)
    expect(Connector.isConnector({ clearance: 0 })).toBe(false)
    expect(Connector.isConnector(null)).toBe(false)
  })
})

describe('setters', () => {
  test.each([
    ['setClearance', Connector.setClearance, 'clearance'],
    ['setGap', Connector.setGap, 'gap'],
    ['setBendCost', Connector.setBendCost, 'bendCost'],
    ['setAlignAdornments', Connector.setAlignAdornments, 'alignAdornments'],
    ['setJustifyAdornments', Connector.setJustifyAdornments, 'justifyAdornments'],
    ['setJustifyAdornmentsSpace', Connector.setJustifyAdornmentsSpace, 'justifyAdornmentsSpace'],
    [
      'setJustifyAdornmentsSpaceOuter',
      Connector.setJustifyAdornmentsSpaceOuter,
      'justifyAdornmentsSpaceOuter',
    ],
    ['setAdornmentGap', Connector.setAdornmentGap, 'adornmentGap'],
    ['setJogAt', Connector.setJogAt, 'jogAt'],
    ['setJogSlant', Connector.setJogSlant, 'jogSlant'],
  ] as const)('%s, data-first and data-last', (_, set, key) => {
    const base = Connector.make()
    expect(set(base, 0.75)[key]).toBe(0.75)
    expect(base.pipe(set(0.75))[key]).toBe(0.75)
    expect(base[key]).toBe(Connector.make().toJSON()[key])
  })
})

describe('apply', () => {
  test('an edge to an unknown id throws', () => {
    expect(() =>
      Connector.apply(pair, [Edge.make({ source: 'a', target: 'c' as 'b' })], spec),
    ).toThrow(RangeError)
  })

  test('auto sides face each other, and a jog centers between the rects', () => {
    const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
    const layout = Connector.apply(rects, [Edge.make({ source: 'a', target: 'b' })], spec)
    expect(pointsOf(layout)).toEqual([
      [40, 10],
      [70, 10],
      [70, 50],
      [100, 50],
    ])
    expect(layout.edges[0]?.radii).toEqual([0, 0, 0, 0])
  })

  test('the corner cost defaults to twice the clearance and gap, and saves a corner', () => {
    // At 28 a corner, one corner and 10 more length beat two corners.
    const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
    const auto = Connector.make({ clearance: 10, gap: 4 })
    const layout = Connector.apply(rects, [Edge.make({ source: 'a', target: 'b' })], auto)
    expect(pointsOf(layout)).toEqual([
      [40, 10],
      [120, 10],
      [120, 40],
    ])
    expect(
      Connector.apply(
        rects,
        [Edge.make({ source: 'a', target: 'b' })],
        auto.pipe(Connector.setBendCost(10)),
      ),
    ).toEqual(
      Connector.apply(
        rects,
        [Edge.make({ source: 'a', target: 'b' })],
        spec.pipe(Connector.setBendCost(10)),
      ),
    )
  })

  test('the spec moves jogs along their runs, and an edge overrides it', () => {
    const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
    const edges = [Edge.make({ source: 'a', target: 'b' })]
    const quarter = spec.pipe(Connector.setJogAt(0.25))
    // A quarter of the way from the source port, and as far toward the
    // target as the clearance lets it.
    expect(pointsOf(Connector.apply(rects, edges, quarter))?.[1]).toEqual([55, 10])
    expect(
      pointsOf(Connector.apply(rects, edges, quarter, { edges: [{ jogAt: 1 }] }))?.[1],
    ).toEqual([90, 10])
  })

  test('a jog too short for its corners slants, unless the spec keeps it upright', () => {
    const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 8, 40, 20) }
    // Pinned ports keep the jog, which auto ports would slide away.
    const edges = [
      Edge.make({
        source: 'a',
        target: 'b',
        sourceSide: 1,
        targetSide: 3,
        sourceAt: 0.5,
        targetAt: 0.5,
        radius: 8,
      }),
    ]
    const slanted = Connector.apply(rects, edges, spec).edges[0]
    expect(slanted?.points.map(({ x, y }) => [x, y])).toEqual([
      [40, 10],
      [67, 10],
      [73, 18],
      [100, 18],
    ])
    expect(slanted?.radii).toEqual([0, 5, 5, 0])
    const upright = Connector.apply(rects, edges, spec.pipe(Connector.setJogSlant(0))).edges[0]
    expect(upright?.points.map(({ x, y }) => [x, y])).toEqual([
      [40, 10],
      [70, 10],
      [70, 18],
      [100, 18],
    ])
    expect(upright?.radii).toEqual([0, 4, 4, 0])
  })

  test('auto ports slide to straighten a short jog between them', () => {
    // 8 apart: a's port slides down as far as its side allows, short of
    // its end by the gap, and b's the rest of the way up.
    const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 8, 40, 20) }
    const edges = [Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3, radius: 8 })]
    expect(pointsOf(Connector.apply(rects, edges, spec))).toEqual([
      [40, 16],
      [100, 16],
    ])
  })

  test('a straight route needs no corners', () => {
    const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(0, 100, 40, 20) }
    expect(
      pointsOf(Connector.apply(rects, [Edge.make({ source: 'a', target: 'b' })], spec)),
    ).toEqual([
      [20, 20],
      [20, 100],
    ])
  })

  test('given ports place the ends, and routes keep the clearance', () => {
    const edge = Edge.make({
      source: 'a',
      target: 'b',
      sourceSide: Edge.side.bottom,
      sourceAt: 0.25,
      targetSide: Edge.side.top,
      targetAt: 0.75,
    })
    expect(pointsOf(Connector.apply(pair, [edge], spec))).toEqual([
      [10, 20],
      [10, 30],
      [70, 30],
      [70, -10],
      [130, -10],
      [130, 0],
    ])
  })

  test('auto positions on a shared side spread out without crossing', () => {
    const rects = {
      a: Rect.make(0, 40, 40, 40),
      up: Rect.make(100, 0, 40, 20),
      down: Rect.make(100, 100, 40, 20),
    }
    const right = Edge.side.right
    const layout = Connector.apply(
      rects,
      [
        Edge.make({ source: 'a', target: 'down', sourceSide: right }),
        Edge.make({ source: 'a', target: 'up', sourceSide: right }),
      ],
      spec,
    )
    // The edge to the upper rect leaves a third of the way down the side.
    expect(layout.edges[1]?.points[0]?.y).toBeCloseTo(40 + 40 / 3, 12)
    expect(layout.edges[0]?.points[0]?.y).toBeCloseTo(40 + 80 / 3, 12)
  })

  test('ports on a shared side take the order their routes part in', () => {
    // The farther rect sits farther right, but its route turns right later,
    // so its port goes on the left, and the routes nest instead of crossing.
    const rects = {
      a: Rect.make(0, 0, 40, 20),
      near: Rect.make(200, 0, 40, 20),
      far: Rect.make(280, 200, 40, 20),
    }
    const bottom = Edge.side.bottom
    const layout = Connector.apply(
      rects,
      [
        Edge.make({ source: 'a', target: 'near', sourceSide: bottom }),
        Edge.make({ source: 'a', target: 'far', sourceSide: bottom }),
      ],
      spec,
    )
    expect(layout.edges[0]?.points[0]?.x).toBeCloseTo(80 / 3, 12)
    expect(layout.edges[1]?.points[0]?.x).toBeCloseTo(40 / 3, 12)
  })

  test('a route leaves by another side to cross fewer routes', () => {
    // Out of the left of b, the route to a would cross the one from d,
    // which comes up past a. Out of the top, it crosses only the one from
    // c, which it must, to reach the side of a they share.
    const rects = {
      a: Rect.make(10, 130, 80, 40),
      b: Rect.make(200, 180, 80, 40),
      c: Rect.make(120, 250, 80, 40),
      d: Rect.make(10, 250, 80, 40),
    }
    const edges = [
      Edge.make({ source: 'd', target: 'b' }),
      Edge.make({ source: 'b', target: 'a' }),
      Edge.make({ source: 'c', target: 'a' }),
    ]
    // A crossing costs two fifths of a corner: 16 at 40.
    const routed = (bendCost: number) =>
      Connector.apply(rects, edges, Connector.make({ clearance: 10, gap: 4, bendCost }))
    const [x, y] = pointsOf(routed(0), 1)?.[0] ?? []
    expect(x).toBe(200)
    expect(y).toBeCloseTo(580 / 3, 12)
    expect(pointsOf(routed(40), 1)?.[0]).toEqual([240, 180])
  })

  test('routes that part from a merge in order keep it through unavoidable crossings', () => {
    // Three routes merge on the left of db and run back west as one bundle,
    // then turn north and peel off west one by one: auth first, then
    // billing, then orders. The routes from events down to the workers
    // must cross auth's and billing's, which come from the west, but not
    // orders', which comes down from above, so orders' column keeps east
    // of them while the other two run as a bundle west of them. Billing's
    // route to events must cross orders' route to db, so the segments on
    // the shared column prefer orders in a cycle. The cycle breaks at those
    // unavoidable crossings, not at the bundle's own order: auth's column
    // sits west of billing's, and billing's west of orders', so none
    // crosses another's lane.
    const rects = {
      orders: Rect.make(512, 96, 120, 40),
      billing: Rect.make(500, 260, 120, 40),
      auth: Rect.make(505, 342, 112, 40),
      events: Rect.make(784, 176, 136, 40),
      db: Rect.make(784, 360, 120, 40),
      mailer: Rect.make(557, 540, 112, 36),
      indexer: Rect.make(692, 540, 112, 36),
    }
    const head = arrow(1, Adornment.orient.forward)
    const edge = (source: keyof typeof rects, target: keyof typeof rects) =>
      Edge.make({ source, target, radius: 16, thickness: 2, adornments: [head] })
    const edges = [
      edge('auth', 'db'),
      edge('billing', 'events'),
      edge('orders', 'db'),
      edge('billing', 'db'),
      edge('events', 'mailer'),
      edge('events', 'indexer'),
    ]
    const layout = Connector.apply(
      rects,
      edges,
      Connector.make({ clearance: 16, gap: 8, merge: Connector.merge.side, mergeGap: 4 }),
    )
    // The x of each vertical segment of a route, from its source.
    const columns = (i: number) => {
      const points = layout.edges[i]?.points ?? []
      const found: Array<number> = []
      for (let k = 1; k < points.length; k++) {
        const [a, b] = [points[k - 1] as Point.Point, points[k] as Point.Point]
        if (a.x === b.x && a.y !== b.y) {
          found.push(a.x)
        }
      }
      return found
    }
    // The column of each route to db is its last, and of each route from
    // events its first.
    const [auth, orders, billing] = [columns(0).at(-1), columns(2).at(-1), columns(3).at(-1)]
    const [mailer, indexer] = [columns(4)[0], columns(5)[0]]
    expect(auth).toBeLessThan(billing as number)
    expect(billing).toBeLessThan(mailer as number)
    expect(mailer).toBeLessThan(indexer as number)
    expect(indexer).toBeLessThan(orders as number)
    // The bundle keeps the merge gap, with the strokes 2 wide.
    expect((billing as number) - (auth as number)).toBeCloseTo(6, 9)
  })

  test('an auto end comes in on a side with room for its corner and arrowhead', () => {
    // Down the seam between b and c, 10 apart, the route reaches the right
    // of b with one corner, but only 5 in front of the port. Round the top
    // it needs a corner more and 10 more length, 30 at a corner cost of 20.
    const rects = {
      a: Rect.make(125, 0, 40, 20),
      b: Rect.make(100, 100, 40, 20),
      c: Rect.make(150, 100, 40, 20),
    }
    const tight = Connector.make({ clearance: 10, gap: 4, bendCost: 20 })
    const routed = (edge: Edge.Edge<'a' | 'b' | 'c'>) =>
      pointsOf(Connector.apply(rects, [edge], tight))
    expect(routed(Edge.make({ source: 'a', target: 'b' }))).toEqual([
      [145, 20],
      [145, 110],
      [140, 110],
    ])
    // With a corner of 10 and an arrowhead of 10, the end needs 20, and
    // falls short by its whole radius: twice the corner cost, 40. From the
    // left of a, one corner reaches the top of b, with a jog of 5 onto the
    // port that costs a quarter of its two corners in the search and that
    // the port then slides away, so the end comes in there with room for
    // both.
    const dressed = Edge.make({
      source: 'a',
      target: 'b',
      radius: 10,
      adornments: [arrow(1, Adornment.orient.forward)],
    })
    const layout = Connector.apply(rects, [dressed], tight)
    expect(pointsOf(layout)).toEqual([
      [125, 10],
      [115, 10],
      [115, 100],
    ])
    expect(layout.edges[0]?.radii).toEqual([0, 10, 0])
    // A given side has no rival.
    expect(routed(dressed.pipe(Edge.setTargetPort(Edge.side.right, 0.5)))).toEqual([
      [145, 20],
      [145, 110],
      [140, 110],
    ])
  })

  test('ends next to each other whose routes cross trade ports', () => {
    // From the middle of the bottom of a, the routes to and from b run on
    // one path and never part, so the edge order places them, and they
    // cross. Traded, the route to b turns inside the one back.
    const rects = {
      a: Rect.make(0, 0, 40, 40),
      b: Rect.make(140, 100, 40, 40),
      c: Rect.make(150, 0, 40, 40),
    }
    const edges = [
      Edge.make({ source: 'b', target: 'c' }),
      Edge.make({ source: 'a', target: 'b' }),
      Edge.make({ source: 'b', target: 'a' }),
    ]
    const routed = (bendCost: number) =>
      Connector.apply(rects, edges, Connector.make({ clearance: 10, gap: 4, bendCost }))
    expect(pointsOf(routed(0), 1)?.[0]?.[0]).toBeCloseTo(40 / 3, 12)
    const traded = routed(40)
    const near = (i: number, expected: Array<[number, number]>) => {
      const points = pointsOf(traded, i) ?? []
      expect(points).toHaveLength(expected.length)
      for (const [k, [x, y]] of expected.entries()) {
        expect(points[k]?.[0]).toBeCloseTo(x, 12)
        expect(points[k]?.[1]).toBeCloseTo(y, 12)
      }
    }
    near(1, [
      [80 / 3, 40],
      [80 / 3, 340 / 3],
      [140, 340 / 3],
    ])
    near(2, [
      [140, 380 / 3],
      [40 / 3, 380 / 3],
      [40 / 3, 40],
    ])
  })

  test('a loop leaves on the right and enters on the top', () => {
    const layout = Connector.apply(
      { a: Rect.make(0, 0, 40, 20) },
      [Edge.make({ source: 'a', target: 'a' })],
      spec,
    )
    expect(pointsOf(layout)).toEqual([
      [40, 10],
      [50, 10],
      [50, -10],
      [20, -10],
      [20, 0],
    ])
  })

  test.each([
    ['source', { sourceSide: Edge.side.bottom }, [20, 20], [40, 10]],
    ['target', { targetSide: Edge.side.left }, [20, 0], [0, 10]],
  ] as const)(
    'a loop with a given %s side takes the next side for the other',
    (_, sides, from, to) => {
      const layout = Connector.apply(
        { a: Rect.make(0, 0, 40, 20) },
        [Edge.make({ source: 'a', target: 'a', ...sides })],
        spec,
      )
      const points = pointsOf(layout)
      expect(points?.[0]).toEqual(from)
      expect(points?.at(-1)).toEqual(to)
    },
  )

  test('a route passes through its waypoints', () => {
    const edge = Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3 })
    const layout = Connector.apply(pair, [edge], spec, { edges: [{ via: [{ x: 70, y: 60 }] }] })
    expect(pointsOf(layout)).toEqual([
      [40, 10],
      [70, 10],
      [70, 60],
      [85, 60],
      [85, 10],
      [100, 10],
    ])
  })

  test('a waypoint inside a rect leaves the edge without a route', () => {
    const edge = Edge.make({ source: 'a', target: 'b' })
    const layout = Connector.apply(pair, [edge], spec, { edges: [{ via: [{ x: 120, y: 10 }] }] })
    expect(layout.edges).toEqual([undefined])
  })

  test('an avoided rect turns its own edge aside, and no other', () => {
    const edges = [
      Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3 }),
      Edge.make({
        source: 'a',
        target: 'b',
        sourceSide: 1,
        targetSide: 3,
        sourceAt: 0.75,
        targetAt: 0.75,
      }),
    ]
    const layout = Connector.apply(pair, edges, spec, {
      edges: [{ avoid: [Rect.make(60, 0, 20, 30)] }],
    })
    // The first edge runs along the avoided rect's top.
    expect(pointsOf(layout, 0)).toEqual([
      [40, 10],
      [60, 10],
      [60, 0],
      [80, 0],
      [80, 10],
      [100, 10],
    ])
    expect(pointsOf(layout, 1)).toEqual([
      [40, 15],
      [100, 15],
    ])
  })

  test.each([
    ['clockwise', Connector.turn.clockwise, 10],
    ['counterclockwise', Connector.turn.counterclockwise, 90],
  ])('a %s preference winds around the rect in the way', (_, preference, y) => {
    const rects = {
      a: Rect.make(0, 40, 20, 20),
      m: Rect.make(60, 20, 40, 60),
      b: Rect.make(140, 40, 20, 20),
    }
    const edge = Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3 })
    // A corner against the preference costs as much again as a corner.
    const layout = Connector.apply(rects, [edge], Connector.make({ clearance: 10, bendCost: 50 }), {
      edges: [{ turn: preference }],
    })
    expect(pointsOf(layout)).toEqual([
      [20, 50],
      [50, 50],
      [50, y],
      [110, y],
      [110, 50],
      [140, 50],
    ])
  })

  test('routes that run alongside each other sit a gap apart, nested', () => {
    const rects = { a: Rect.make(0, 0, 40, 40), b: Rect.make(100, 100, 40, 40) }
    const layout = Connector.apply(rects, [across(0.25), across(0.75)], spec)
    expect(pointsOf(layout, 0)).toEqual([
      [40, 10],
      [72, 10],
      [72, 110],
      [100, 110],
    ])
    expect(pointsOf(layout, 1)).toEqual([
      [40, 30],
      [68, 30],
      [68, 130],
      [100, 130],
    ])
  })

  test('the clearance shrinks between rects that are close, so routes still pass', () => {
    const rects = {
      l: Rect.make(0, 45, 20, 20),
      top: Rect.make(60, 0, 40, 50),
      bottom: Rect.make(60, 60, 40, 50),
      r: Rect.make(140, 45, 20, 20),
    }
    const edge = Edge.make({ source: 'l', target: 'r', sourceSide: 1, targetSide: 3 })
    expect(pointsOf(Connector.apply(rects, [edge], Connector.make({ clearance: 20 })))).toEqual([
      [20, 55],
      [140, 55],
    ])
  })

  test('rects that touch leave no seam for a route to slip through', () => {
    // A ring of four touching walls around `a`.
    const rects = {
      a: Rect.make(40, 40, 20, 20),
      b: Rect.make(200, 40, 20, 20),
      top: Rect.make(0, 0, 100, 20),
      bottom: Rect.make(0, 80, 100, 20),
      left: Rect.make(0, 20, 20, 60),
      right: Rect.make(80, 20, 20, 60),
    }
    const edge = Edge.make({ source: 'a', target: 'b' })
    expect(Connector.apply(rects, [edge], Connector.make({ clearance: 5 })).edges).toEqual([
      undefined,
    ])
  })

  test('corners take the radius where their legs have room', () => {
    const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
    const layout = Connector.apply(
      rects,
      [Edge.make({ source: 'a', target: 'b', sourceAt: 0.5, targetAt: 0.5, radius: 25 })],
      spec,
    )
    // The middle leg is 40 long, so each of its corners reaches 20.
    expect(layout.edges[0]?.radii).toEqual([0, 20, 20, 0])
  })

  test('the outer corner of routes that turn together grows to share a center', () => {
    const rects = { a: Rect.make(0, 0, 40, 40), b: Rect.make(100, 100, 40, 40) }
    const layout = Connector.apply(rects, [rightToTop(0.25, 0.75), rightToTop(0.75, 0.25)], spec)
    expect(pointsOf(layout, 0)).toEqual([
      [40, 10],
      [130, 10],
      [130, 100],
    ])
    expect(pointsOf(layout, 1)).toEqual([
      [40, 30],
      [110, 30],
      [110, 100],
    ])
    // The inner corner reaches 30, and the outer one, 20 out and 20 over,
    // reaches 50, about the same center (80, 60).
    expect(layout.edges.map((route) => route?.radii)).toEqual([
      [0, 50, 0],
      [0, 30, 0],
    ])
    // The outer corner reports how far outside the inner one it sits.
    expect(layout.edges.map((route) => route?.outsets)).toEqual([
      [0, 20, 0],
      [0, 0, 0],
    ])
  })

  describe('adornments', () => {
    // A route from the right of `a` to the left of `b`, through a jog:
    // (40, 10), (70, 10), (70, 50), (100, 50), 100 long.
    const jog = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
    const route = (adornments: Array<Adornment.Adornment>, radius = 0, connector = spec) =>
      Connector.apply(
        jog,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            sourceSide: 1,
            targetSide: 3,
            sourceAt: 0.5,
            targetAt: 0.5,
            radius,
            adornments,
          }),
        ],
        connector,
      ).edges[0]

    test('an arrow at the end packs against the target port, its margin trailing', () => {
      const layout = Connector.apply(
        pair,
        [Edge.make({ ...across(0.5).toJSON(), adornments: [arrow(1, Adornment.orient.forward)] })],
        spec,
      )
      expect(layout.edges[0]?.adornments).toEqual([
        { rect: Rect.make(92, 7, 8, 6), angle: 0, along: Interval.make(52, 8) },
      ])
    })

    test('a turned adornment faces along its run', () => {
      const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 60, 40, 20) }
      const layout = Connector.apply(
        rects,
        [
          Edge.make({
            source: 'a',
            target: 'b',
            sourceSide: Edge.side.right,
            targetSide: Edge.side.top,
            adornments: [arrow(1, Adornment.orient.forward)],
          }),
        ],
        spec,
      )
      expect(pointsOf(layout)).toEqual([
        [40, 10],
        [120, 10],
        [120, 60],
      ])
      expect(layout.edges[0]?.adornments).toEqual([
        { rect: Rect.make(116, 53, 8, 6), angle: Math.PI / 2, along: Interval.make(122, 8) },
      ])
    })

    test('a flow adornment at the start keeps the corner after it clear', () => {
      const placed = route([label(0)], 30)
      expect(placed?.adornments).toEqual([
        { rect: Rect.make(40, 5, 20, 10), angle: 0, along: Interval.make(0, 20) },
      ])
      expect(placed?.radii).toEqual([0, 10, 30, 0])
    })

    test('a flow adornment in the middle centers on its run, between corners', () => {
      const placed = route([label(0.5)], 30)
      expect(placed?.adornments).toEqual([
        { rect: Rect.make(60, 25, 20, 10), angle: 0, along: Interval.make(45, 10) },
      ])
      expect(placed?.radii).toEqual([0, 15, 15, 0])
    })

    test('a flow adornment keeps the room for the corners at the ends of its run', () => {
      const placed = route([label(0.5)], 10, spec.pipe(Connector.setJustifyAdornments(0)))
      expect(placed?.adornments[0]?.rect).toEqual(Rect.make(60, 20, 20, 10))
      expect(placed?.radii).toEqual([0, 10, 10, 0])
    })

    test('a run too short for a flow adornment and its corners gives it to a longer one', () => {
      // A jog 24 long has room for the label, 20 long, but not for its
      // corners too. The legs on either side are as near, and the first wins.
      const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(24, 100, 40, 20) }
      const edge = Edge.make({
        source: 'a',
        target: 'b',
        sourceSide: Edge.side.bottom,
        targetSide: Edge.side.top,
        radius: 10,
        adornments: [label(0.5)],
      })
      const layout = Connector.apply(rects, [edge], spec)
      expect(pointsOf(layout)).toEqual([
        [20, 20],
        [20, 60],
        [44, 60],
        [44, 100],
      ])
      expect(layout.edges[0]?.adornments[0]?.rect).toEqual(Rect.make(10, 30, 20, 10))
    })

    // A straight route 60 long, from (40, 10) to (100, 10).
    const straight = (adornments: Array<Adornment.Adornment>, connector = spec) =>
      Connector.apply(
        pair,
        [Edge.make({ ...across(0.5).toJSON(), adornments })],
        connector,
      ).edges[0]?.adornments.map(({ rect }) => rect.x)

    test.each([
      [0, [40]],
      [0.5, [60]],
      [1, [80]],
    ])('a run justifies its flow adornments at %f', (justify, expected) => {
      expect(straight([label(0.5)], spec.pipe(Connector.setJustifyAdornments(justify)))).toEqual(
        expected,
      )
    })

    test('a run spreads its flow adornments, in the order of their `at`', () => {
      const between = spec.pipe(Connector.setJustifyAdornmentsSpace(1))
      expect(straight([label(0.75), label(0.25)], between)).toEqual([80, 40])
      const evenly = between.pipe(Connector.setJustifyAdornmentsSpaceOuter(1))
      const [first, second] = straight([label(0.25), label(0.75)], evenly) ?? []
      expect(first).toBeCloseTo(40 + 20 / 3, 9)
      expect(second).toBeCloseTo(60 + 40 / 3, 9)
    })

    test('flow adornments next to each other sit the adornment gap apart', () => {
      const gapped = spec.pipe(Connector.setAdornmentGap(4))
      expect(straight([label(0.25), label(0.75)], gapped)).toEqual([48, 72])
      // The pack at the target keeps the gap from the others too.
      expect(straight([label(0.5), arrow(1, Adornment.orient.forward)], gapped)).toEqual([53, 92])
    })

    test('a flow adornment moves off a run too short for it, to the nearest with room', () => {
      const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 4, 40, 20) }
      const layout = Connector.apply(
        rects,
        [Edge.make({ ...across(0.5).toJSON(), adornments: [label(0.5)] })],
        spec,
      )
      // The middle falls on the jog, 4 long. The runs on either side are as
      // near, and the first wins. The last run comes within the gap of the
      // label past x 66, so the label sits at the middle of the 26 before.
      expect(pointsOf(layout)).toEqual([
        [40, 10],
        [70, 10],
        [70, 14],
        [100, 14],
      ])
      expect(layout.edges[0]?.adornments).toEqual([
        { rect: Rect.make(43, 5, 20, 10), angle: 0, along: Interval.make(3, 20) },
      ])
    })

    test.each([
      // 5 from the other route, the label on the first run comes within the
      // gap of it, and moves to the clear run down the jog, at its middle.
      [4, Rect.make(110, 55, 20, 10), Interval.make(125, 10)],
      // With no gap, the other route only touches it, and it stays.
      [0, Rect.make(70, 5, 20, 10), Interval.make(30, 20)],
    ])(
      'with a gap of %d, a flow adornment prefers a run no other route comes near',
      (gap, rect, along) => {
        const rects = {
          a: Rect.make(0, 0, 40, 20),
          b: Rect.make(200, 0, 40, 20),
          c: Rect.make(200, 100, 40, 20),
        }
        const right = Edge.side.right
        const left = Edge.side.left
        const layout = Connector.apply(
          rects,
          [
            Edge.make({
              source: 'a',
              target: 'b',
              sourceSide: right,
              targetSide: left,
              sourceAt: 0.25,
              targetAt: 0.25,
            }),
            Edge.make({
              source: 'a',
              target: 'c',
              sourceSide: right,
              targetSide: left,
              sourceAt: 0.5,
              adornments: [label(0.25)],
            }),
          ],
          spec.pipe(Connector.setGap(gap)),
        )
        expect(layout.edges[1]?.points.map((p) => [p.x, p.y])).toEqual([
          [40, 10],
          [120, 10],
          [120, 110],
          [200, 110],
        ])
        expect(layout.edges[1]?.adornments).toEqual([{ rect, angle: 0, along }])
      },
    )

    test('a route that crosses a run takes only the stretch near it', () => {
      const rects = {
        a: Rect.make(0, 0, 40, 20),
        b: Rect.make(300, 0, 40, 20),
        c: Rect.make(150, -100, 20, 20),
        d: Rect.make(150, 100, 20, 20),
      }
      const layout = Connector.apply(
        rects,
        [
          Edge.make({ source: 'a', target: 'b', adornments: [label(0.5)] }),
          Edge.make({ source: 'c', target: 'd' }),
        ],
        spec,
      )
      expect(layout.edges.map((edge) => edge?.points.map((p) => [p.x, p.y]))).toEqual([
        [
          [40, 10],
          [300, 10],
        ],
        [
          [160, -80],
          [160, 100],
        ],
      ])
      // The middle, x 170, is 10 past the crossing. The run is clear from a
      // gap past it, x 164, to b, and the label sits at the middle of that.
      expect(layout.edges[0]?.adornments).toEqual([
        { rect: Rect.make(222, 5, 20, 10), angle: 0, along: Interval.make(182, 20) },
      ])
    })

    test('an absolute adornment lands on the route as drawn, and takes no room', () => {
      const placed = route([label(0.5, Adornment.position.absolute)], 30)
      expect(placed?.radii).toEqual([0, 20, 20, 0])
      // The middle of the drawn route, through the arcs of the corners.
      const { rect, angle, along } = (placed as Connector.ConnectorRoute)
        .adornments[0] as Adornment.AdornmentPlacement
      for (const [actual, expected] of [
        [rect.x, 60],
        [rect.y, 25],
        [rect.width, 20],
        [rect.height, 10],
        [along.start, 45],
        [along.size, 10],
      ] as const) {
        expect(actual).toBeCloseTo(expected, 9)
      }
      expect(angle).toBe(0)
    })

    test('the spec aligns adornments to a side of the line', () => {
      const placed = route([label(0.5)], 0, spec.pipe(Connector.setAlignAdornments(0)))
      expect(placed?.adornments[0]?.rect).toEqual(Rect.make(50, 25, 20, 10))
    })
  })

  test('a rect that others enclose has no route', () => {
    const rects = {
      a: Rect.make(0, 0, 20, 20),
      n: Rect.make(100, 0, 60, 40),
      w: Rect.make(100, 40, 20, 20),
      e: Rect.make(140, 40, 20, 20),
      s: Rect.make(100, 60, 60, 40),
      x: Rect.make(120, 40, 20, 20),
    }
    const layout = Connector.apply(rects, [Edge.make({ source: 'a', target: 'x' })], spec)
    expect(layout.edges).toEqual([undefined])
  })

  test.each(Array.from({ length: 12 }, (_, i) => i + 1))('random diagram %i', (seed) => {
    let state = seed
    const next = (n: number) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return Math.floor((state / 2147483648) * n)
    }
    const rects: Record<string, Rect.Rect> = {}
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        if (next(4) !== 0) {
          rects[`r${i}${j}`] = Rect.make(
            i * 100 + next(30),
            j * 100 + next(30),
            30 + next(30),
            30 + next(30),
          )
        }
      }
    }
    const ids = Object.keys(rects)
    const edges = Array.from({ length: 8 }, () => {
      const pick = () => ids[next(ids.length)] as string
      const side = () => (next(3) === 0 ? next(4) : undefined)
      return Edge.make({ source: pick(), target: pick(), sourceSide: side(), targetSide: side() })
    })
    const layout = Connector.apply(
      rects,
      edges,
      Connector.make({ clearance: 6, gap: 3, bendCost: 20 }),
    )
    const outward = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const
    for (const [k, route] of layout.edges.entries()) {
      if (route === undefined) {
        continue
      }
      const edge = edges[k] as Edge.Edge<string>
      const points = route.points
      expect(route.radii).toHaveLength(points.length)
      expect(route.outsets).toHaveLength(points.length)
      // Each end sits on the boundary of its rect, and the route leaves it
      // straight out from that side.
      for (const [id, a, b] of [
        [edge.source, points[0], points[1]],
        [edge.target, points.at(-1), points.at(-2)],
      ] as const) {
        const r = rects[id] as Rect.Rect
        const onSide = outward.findIndex(([dx, dy]) => {
          const sx = Math.sign((b?.x as number) - (a?.x as number))
          const sy = Math.sign((b?.y as number) - (a?.y as number))
          return sx === dx && sy === dy
        })
        expect(onSide).not.toBe(-1)
        const [px, py] = [a?.x as number, a?.y as number]
        const side = [r.top, r.right, r.bottom, r.left][onSide] as number
        expect(onSide % 2 === 0 ? py : px).toBe(side)
      }
      for (let j = 0; j + 1 < points.length; j++) {
        const p = points[j] as { x: number; y: number }
        const q = points[j + 1] as { x: number; y: number }
        expect(p.x === q.x || p.y === q.y).toBe(true)
        const [mx, my] = [(p.x + q.x) / 2, (p.y + q.y) / 2]
        for (const r of Object.values(rects)) {
          expect(mx > r.left && mx < r.right && my > r.top && my < r.bottom).toBe(false)
        }
      }
    }
  })
})

const pointsAt = (layout: Connector.ConnectorLayout, k: number) =>
  layout.edges[k]?.points.map((p) => [p.x, p.y])

describe('merging', () => {
  // An arrowhead 8 long at the target, and two sources, above and below the
  // target's left side.
  const head = Adornment.make({ width: 8, height: 6, at: 1, orient: 1 })
  const rects = {
    a: Rect.make(0, -40, 40, 20),
    b: Rect.make(0, 60, 40, 20),
    c: Rect.make(0, -100, 40, 20),
    t: Rect.make(200, 0, 40, 40),
  }
  type Id = 'a' | 'b' | 'c' | 't'
  const into = (source: Id, input: Partial<Edge.EdgeInput<Id>> = {}) =>
    Edge.make<Id>({
      source,
      target: 't',
      targetSide: Edge.side.left,
      adornments: [head],
      ...input,
    })
  const merging = (value: number) => spec.pipe(Connector.setMerge(value))

  test('a route that could merge is pulled along the route it could merge with', () => {
    // From b, the top and the left of t cost the same. Pulled along a's
    // route, a tenth cheaper, b comes in on the left too, and merges with
    // it.
    const rects = {
      a: Rect.make(0, 120, 40, 40),
      b: Rect.make(60, 0, 40, 40),
      t: Rect.make(140, 120, 40, 40),
    }
    const edges = [Edge.make({ source: 'a', target: 't' }), Edge.make({ source: 'b', target: 't' })]
    const pulled = Connector.make({ clearance: 10, gap: 4, bendCost: 20, merge: 1 })
    const layout = Connector.apply(rects, edges, pulled)
    expect(pointsOf(layout, 1)).toEqual([
      [80, 40],
      [80, 140],
      [140, 140],
    ])
    expect(layout.edges[1]?.merged).toEqual([-1, 0])
    // With merging off, nothing pulls.
    const apart = Connector.apply(rects, edges, pulled.pipe(Connector.setMerge(0)))
    expect(pointsOf(apart, 1)).toEqual([
      [100, 20],
      [160, 20],
      [160, 120],
    ])
    expect(apart.edges[1]?.merged).toEqual([-1, -1])
  })

  test('the pull reaches only within the span of the route’s own rects', () => {
    // u's route leaves the bottom of s and runs west below it. With no
    // bend cost, t's route would leave with it and dip below s to ride
    // along for a quarter of the length, were the pull not kept within the
    // span of s and t: it stays above s's bottom, and merges with nothing.
    const rects = {
      s: Rect.make(200, 100, 40, 40),
      t: Rect.make(0, 0, 40, 40),
      u: Rect.make(-200, 180, 40, 40),
    }
    const edges = [
      Edge.make({ source: 's', target: 't' }),
      Edge.make({ source: 's', target: 'u', sourceSide: Edge.side.bottom }),
    ]
    const spec = Connector.make({ clearance: 10, gap: 4, bendCost: 0, merge: 1 })
    const layout = Connector.apply(rects, edges, spec)
    expect(layout.edges[0]?.points.every((point) => point.y <= 140)).toBe(true)
    expect(layout.edges[0]?.points).toHaveLength(3)
    expect(layout.edges[0]?.merged).toEqual([-1, -1])
  })

  test('the first round of the side search pulls nothing, so a tie never settles the group', () => {
    // Three routes leave the hub for the workers below it, to the left. On
    // its own, the route to the far worker prefers the hub's left side, one
    // bend against two; the route to the middle worker costs the same from
    // the left, through the slot beside the store, as from the bottom; and
    // the route to the near worker wants the bottom. Were the first route
    // pulled by nothing and the second by it alone, the far route's choice
    // would settle the middle route's tie for the left, and the two would
    // hold each other there. Found alone first, the middle route takes the
    // bottom for its fewer turns, and the long run down from the bottom
    // then draws the far route too: all three leave the bottom together.
    const head = Adornment.make({ width: 8, height: 8, at: 1, orient: 1 })
    const rects = {
      hub: Rect.make(800, 240, 136, 40),
      store: Rect.make(645, 329, 120, 40),
      far: Rect.make(557, 540, 112, 36),
      mid: Rect.make(692, 540, 112, 36),
      near: Rect.make(827, 540, 112, 36),
    }
    const edges = (['far', 'mid', 'near'] as const).map((target) =>
      Edge.make({ source: 'hub', target, radius: 16, adornments: [head] }),
    )
    const layout = Connector.apply(
      rects,
      edges,
      Connector.make({ clearance: 16, gap: 8, merge: 1 }),
    )
    for (const route of layout.edges) {
      expect(route?.points[0]).toEqual(Point.make(868, 280))
      expect(route?.merged).toEqual([0, -1])
    }
    expect(layout.notes).toEqual([])
  })

  test('ends on one side with the same adornments share a port and one arrowhead', () => {
    const layout = Connector.apply(rects, [into('a'), into('b')], merging(Connector.merge.side))
    // The lanes, 4 apart, jog onto the line out of the port right behind
    // the arrowhead, x 192. They part as far back from the merge as they
    // can, the clearance from their sources, so they run together longest.
    expect(pointsAt(layout, 0)).toEqual([
      [40, -30],
      [50, -30],
      [50, 18],
      [192, 18],
      [192, 20],
      [200, 20],
    ])
    expect(pointsAt(layout, 1)).toEqual([
      [40, 70],
      [50, 70],
      [50, 22],
      [192, 22],
      [192, 20],
      [200, 20],
    ])
    // The first edge draws the arrowhead, which lands in one place for both.
    expect(layout.edges.map((edge) => edge?.merged)).toEqual([
      [-1, 0],
      [-1, 0],
    ])
    expect(layout.edges[1]?.adornments).toEqual(layout.edges[0]?.adornments)
  })

  test('with a radius, each lane steps onto the line on arcs of the merge gap', () => {
    const layout = Connector.apply(
      rects,
      [into('a', { radius: 8 }), into('b', { radius: 8 })],
      merging(Connector.merge.side),
    )
    // The lanes, 2 off the line, cross on an S of two arcs of radius 4
    // that ends at the back of the arrowhead, x 192.
    const theta = Math.acos(1 - 2 / 8)
    const reach = 4 * Math.tan(theta / 2)
    for (const [k, lane] of [
      [0, 18],
      [1, 22],
    ] as const) {
      const route = layout.edges[k] as Connector.ConnectorRoute
      const [onLane, onLine, port] = route.points.slice(-3)
      expect(onLane?.y).toBe(lane)
      expect(onLane?.x).toBeCloseTo(192 - reach - 2 * reach * Math.cos(theta), 12)
      expect(onLine?.y).toBe(20)
      expect(onLine?.x).toBeCloseTo(192 - reach, 12)
      expect(port).toEqual(Point.make(200, 20))
      expect(route.radii.slice(-3, -1)).toEqual([reach, reach])
    }
    // A pair that parts leaves no group behind, so both keep their radius.
    for (const k of [0, 1]) {
      const route = layout.edges[k] as Connector.ConnectorRoute
      expect(route.radii.slice(1, 3)).toEqual([8, 8])
    }
  })

  test('a route that leaves a group going on keeps its radius', () => {
    const layout = Connector.apply(
      rects,
      [into('a', { radius: 8 }), into('b', { radius: 8 }), into('c', { radius: 8 })],
      merging(Connector.merge.side),
    )
    // b turns down off the lanes where a and c go on up together: it keeps
    // its radius, and a, turning up around c's corner 4 inside its own,
    // grows to 12 to share its center.
    expect(pointsAt(layout, 1)?.[2]).toEqual([50, 24])
    expect(layout.edges[1]?.radii[2]).toBe(8)
    expect(pointsAt(layout, 0)?.[2]).toEqual([50, 20])
    expect(layout.edges[0]?.radii[2]).toBe(12)
    expect(layout.edges[2]?.radii[2]).toBe(8)
  })

  test('the merge gap sets the lanes apart', () => {
    const layout = Connector.apply(
      rects,
      [into('a'), into('b')],
      merging(Connector.merge.side).pipe(Connector.setMergeGap(2)),
    )
    expect(pointsAt(layout, 0)?.slice(-4)).toEqual([
      [50, 19],
      [192, 19],
      [192, 20],
      [200, 20],
    ])
    expect(pointsAt(layout, 1)?.slice(-4)).toEqual([
      [50, 21],
      [192, 21],
      [192, 20],
      [200, 20],
    ])
  })

  test('the merge gap is between the strokes, and inside the steps', () => {
    const thick = (radius: number) =>
      Connector.apply(
        rects,
        [into('a', { thickness: 2, radius }), into('b', { thickness: 2, radius })],
        merging(Connector.merge.side).pipe(Connector.setMergeGap(2)),
      )
    // Strokes 2 wide and 2 apart: lines 4 apart.
    expect(pointsAt(thick(0), 0)?.slice(-3)).toEqual([
      [192, 18],
      [192, 20],
      [200, 20],
    ])
    expect(pointsAt(thick(0), 1)?.slice(-3)).toEqual([
      [192, 22],
      [192, 20],
      [200, 20],
    ])
    // The steps turn on arcs of radius 2 + 1, which leave 2 inside them.
    const theta = Math.acos(1 - 2 / 6)
    const reach = 3 * Math.tan(theta / 2)
    const route = thick(8).edges[0] as Connector.ConnectorRoute
    expect(route.radii.slice(-3, -1)[0]).toBeCloseTo(reach, 12)
    expect(route.points.at(-2)?.x).toBeCloseTo(192 - reach, 12)
  })

  test('merges that face each other close by leave room to cross between them', () => {
    // Two edges between rects 20 apart and offset, so neither sits in front
    // of the other's lanes, merged at both ends: the lanes stop short of
    // passing each other, so the routes run on without turning back.
    const near = { a: Rect.make(0, 0, 40, 40), b: Rect.make(60, 60, 40, 40) }
    const tail = Adornment.make({ width: 8, height: 6, at: 0 })
    const edges = [0.25, 0.25].map(() =>
      Edge.make<'a' | 'b'>({
        source: 'a',
        target: 'b',
        sourceSide: Edge.side.right,
        targetSide: Edge.side.left,
        sourceAt: 0.25,
        radius: 8,
        adornments: [tail, head],
      }),
    )
    const layout = Connector.apply(near, edges, merging(Connector.merge.side))
    for (const route of layout.edges) {
      const xs = route?.points.map(({ x }) => x) ?? []
      expect(xs.length).toBeGreaterThan(1)
      for (const [k, x] of xs.entries()) {
        expect(x).toBeGreaterThanOrEqual((xs[k - 1] ?? x) - 1e-9)
      }
    }
  })

  test.each([
    ['merging is off', Connector.merge.none, [into('a'), into('b')]],
    ['the adornments differ', Connector.merge.side, [into('a'), into('b', { adornments: [] })]],
    // Out of the port, one route turns up and the other down.
    ['the routes come from opposite ways', Connector.merge.near, [into('a'), into('b')]],
  ])('ends stay apart when %s', (_, value, edges) => {
    const layout = Connector.apply(rects, edges, merging(value))
    expect(layout.edges.map((edge) => edge?.merged)).toEqual([
      [-1, -1],
      [-1, -1],
    ])
    // Their ports spread along the side, a third of the way apart.
    expect(layout.edges[0]?.points.at(-1)?.y).toBeCloseTo(40 / 3, 12)
    expect(layout.edges[1]?.points.at(-1)?.y).toBeCloseTo(80 / 3, 12)
  })

  test('near merges routes that come from the same way, nested', () => {
    const layout = Connector.apply(rects, [into('a'), into('c')], merging(Connector.merge.near))
    expect(layout.edges.map((edge) => edge?.merged)).toEqual([
      [-1, 0],
      [-1, 0],
    ])
    // The route from farther up takes the upper lane and the outer bend.
    expect(pointsAt(layout, 0)).toEqual([
      [40, -30],
      [114, -30],
      [114, 22],
      [192, 22],
      [192, 20],
      [200, 20],
    ])
    expect(pointsAt(layout, 1)).toEqual([
      [40, -90],
      [118, -90],
      [118, 18],
      [192, 18],
      [192, 20],
      [200, 20],
    ])
  })

  test('ends pinned to one spot merge there', () => {
    const layout = Connector.apply(
      rects,
      [into('a', { targetAt: 0.25 }), into('b', { targetAt: 0.25 })],
      merging(Connector.merge.near),
    )
    expect(pointsAt(layout, 0)?.slice(-3)).toEqual([
      [192, 8],
      [192, 10],
      [200, 10],
    ])
    expect(pointsAt(layout, 1)?.slice(-3)).toEqual([
      [192, 12],
      [192, 10],
      [200, 10],
    ])
  })

  test('sources with no adornments merge, and with no room to jog share the port', () => {
    const layout = Connector.apply(
      { s: Rect.make(0, 0, 40, 40), a: Rect.make(200, -40, 40, 20), b: Rect.make(200, 60, 40, 20) },
      [
        Edge.make({ source: 's', target: 'a', sourceSide: Edge.side.right }),
        Edge.make({ source: 's', target: 'b', sourceSide: Edge.side.right }),
      ],
      merging(Connector.merge.side),
    )
    expect(layout.edges.map((edge) => edge?.merged)).toEqual([
      [0, -1],
      [0, -1],
    ])
    expect(layout.edges.map((edge) => [edge?.points[0]?.x, edge?.points[0]?.y])).toEqual([
      [40, 20],
      [40, 20],
    ])
  })

  test('a rect close in front leaves the merge only the shared port', () => {
    // The rects 12 apart leave 6 of room, half of it for the lanes, less
    // than the arrowhead's 8.
    const layout = Connector.apply(
      { ...rects, w: Rect.make(180, 0, 8, 40) },
      [into('a'), into('b')],
      merging(Connector.merge.side),
    )
    expect(pointsAt(layout, 0)?.slice(-2)).toEqual([
      [194, 20],
      [200, 20],
    ])
    expect(pointsAt(layout, 1)?.slice(-2)).toEqual([
      [194, 20],
      [200, 20],
    ])
  })
})

describe('notes', () => {
  test('an edge without a route is noted', () => {
    const rects = {
      a: Rect.make(0, 0, 20, 20),
      n: Rect.make(100, 0, 60, 40),
      w: Rect.make(100, 40, 20, 20),
      e: Rect.make(140, 40, 20, 20),
      s: Rect.make(100, 60, 60, 40),
      x: Rect.make(120, 40, 20, 20),
    }
    const layout = Connector.apply(
      rects,
      [Edge.make({ source: 'a', target: 'n' }), Edge.make({ source: 'a', target: 'x' })],
      spec,
    )
    expect(layout.notes).toEqual([{ kind: Connector.note.unrouted, edge: 1 }])
  })

  test('a channel too narrow for the gaps is noted, with the rects beside it', () => {
    // Three routes through a passage 10 wide between `a` and `b`, with
    // gaps of 6: they need 12.
    const rects = {
      n: Rect.make(30, -100, 30, 20),
      s: Rect.make(30, 100, 30, 20),
      a: Rect.make(0, 0, 40, 40),
      b: Rect.make(50, 0, 40, 40),
    }
    const edges = Array.from({ length: 3 }, () => Edge.make({ source: 'n', target: 's' }))
    const layout = Connector.apply(rects, edges, Connector.make({ gap: 6 }))
    expect(layout.notes).toEqual([
      { kind: Connector.note.crowded, edges: [0, 1, 2], axis: 0, rects: ['a', 'b'], need: 2 },
    ])
    // The routes spread evenly across the passage instead: the x of each
    // where it passes y 20.
    const xs = layout.edges.map((route) => {
      const points = route?.points ?? []
      const k = points.findIndex((p, i) => {
        const q = points[i + 1]
        return (
          q !== undefined && p.x === q.x && Math.min(p.y, q.y) <= 20 && Math.max(p.y, q.y) >= 20
        )
      })
      return points[k]?.x
    })
    expect(xs).toEqual([40, 45, 50])
  })

  test('a merge without room for its lanes is noted', () => {
    const head = Adornment.make({ width: 8, height: 6, at: 1, orient: 1 })
    const rects = {
      a: Rect.make(0, -40, 40, 20),
      b: Rect.make(0, 60, 40, 20),
      t: Rect.make(200, 0, 40, 40),
      w: Rect.make(180, 0, 8, 40),
    }
    const into = (source: 'a' | 'b') =>
      Edge.make({ source, target: 't', targetSide: Edge.side.left, adornments: [head] })
    const layout = Connector.apply(
      rects,
      [into('a'), into('b')],
      spec.pipe(Connector.setMerge(Connector.merge.side)),
    )
    // The rects 12 apart leave 6 of room in front of the side, half of it
    // for the lanes, less than the arrowhead's 8: the merge would need 16.
    // Sharing the port, the two routes then overlap on the line into it,
    // which is crowded too.
    expect(layout.notes).toEqual([
      { kind: Connector.note.crowded, edges: [0, 1], axis: 0, rects: ['t', 'w'], need: 4 },
      { kind: Connector.note.shared, edges: [0, 1], rect: 't', side: Edge.side.left, need: 10 },
    ])
  })

  test('a merge with nothing to fit shares its port without a note', () => {
    const rects = {
      a: Rect.make(0, -40, 40, 20),
      b: Rect.make(0, 60, 40, 20),
      t: Rect.make(200, 0, 40, 40),
    }
    const into = (source: 'a' | 'b') =>
      Edge.make({ source, target: 't', targetSide: Edge.side.left })
    const layout = Connector.apply(
      rects,
      [into('a'), into('b')],
      spec.pipe(Connector.setMerge(Connector.merge.side)),
    )
    expect(layout.notes).toEqual([])
  })

  test('a flow adornment longer than every run is noted', () => {
    const wide = Adornment.make({ width: 100, height: 10, at: 0.5 })
    const layout = Connector.apply(
      pair,
      [
        Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3, adornments: [wide] }),
        Edge.make({
          source: 'a',
          target: 'b',
          sourceSide: 1,
          targetSide: 3,
          adornments: [label(0.5)],
        }),
      ],
      spec,
    )
    expect(layout.notes).toEqual([
      { kind: Connector.note.overflow, edge: 0, adornment: 0, need: 40 },
    ])
  })
})

describe('held runs', () => {
  test('a run that waypoints hold goes around the port leg of another route', () => {
    // The route from c to the top of b passes two waypoints on the line
    // down from a's bottom port, where the route from a to the right side
    // of b runs. Nudging can move neither run, so the first goes around
    // instead of running on up the port leg.
    const rects = {
      a: Rect.make(140, 340, 30, 50),
      b: Rect.make(50, 440, 70, 40),
      c: Rect.make(120, 580, 50, 20),
    }
    const layout = Connector.apply(
      rects,
      [
        Edge.make({
          source: 'a',
          target: 'b',
          sourceSide: 2,
          sourceAt: 0.5,
          targetSide: 1,
          targetAt: 0.5,
        }),
        Edge.make({
          source: 'c',
          target: 'b',
          sourceSide: 0,
          sourceAt: 0.6,
          targetSide: 0,
          targetAt: 0.5,
        }),
      ],
      Connector.make({ clearance: 14, gap: 8, bendCost: 44 }),
      {
        edges: [
          {},
          {
            via: [
              { x: 155, y: 556, arriving: { x: 0, y: -1 } },
              { x: 155, y: 544, arriving: { x: 0, y: -1 } },
            ],
          },
        ],
      },
    )
    expect(pointsOf(layout, 0)).toEqual([
      [155, 390],
      [155, 460],
      [120, 460],
    ])
    expect(pointsOf(layout, 1)).toEqual([
      [150, 580],
      [150, 564],
      [155, 564],
      [155, 495],
      [134, 495],
      [134, 426],
      [85, 426],
      [85, 440],
    ])
  })

  test('a route crosses a port leg rather than lie on it where a wall leaves no room beside', () => {
    // The route from e runs west, then down the leg into m, which passes
    // half a pixel from b's clearance. The route from b to e, above, would
    // run up that leg's line and leave it for the side its neighbors come
    // from, the strip between the leg and b's clearance, where it could
    // never be moved the gap off the leg. It crosses e's route twice
    // instead, and reports no narrow channel.
    const rects = {
      e: Rect.make(798, 238, 136, 40),
      m: Rect.make(557, 540, 112, 36),
      b: Rect.make(476.5, 267, 120, 40),
    }
    const layout = Connector.apply(
      rects,
      [
        Edge.make({
          source: 'e',
          target: 'm',
          sourceSide: 3,
          sourceAt: 0.5,
          targetSide: 0,
          targetAt: 0.5,
        }),
        Edge.make({
          source: 'b',
          target: 'e',
          sourceSide: 1,
          sourceAt: 0.5,
          targetSide: 3,
          targetAt: 0.3,
        }),
      ],
      Connector.make({ clearance: 16, gap: 8, bendCost: 40 }),
    )
    expect(pointsOf(layout, 0)).toEqual([
      [798, 258],
      [613, 258],
      [613, 540],
    ])
    expect(pointsOf(layout, 1)).toEqual([
      [596.5, 287],
      [697.25, 287],
      [697.25, 250],
      [798, 250],
    ])
    expect(layout.notes).toEqual([])
  })
})

describe('jogs', () => {
  test('a jog of a pixel costs a pixel, so a route does not flip over one', () => {
    // From the hub's left, one corner reaches the worker: left along the
    // top, then down the line that clears the block. With the block half a
    // pixel wider, that line enters its clearance, and the route needs a
    // jog of half a pixel to the port, which costs it a sixty-fourth of its
    // two corners rather than both in full, so the left still beats the
    // two corners round the bottom. The port then slides onto the line.
    const route = (width: number) => {
      const rects = {
        hub: Rect.make(0, 0, 136, 40),
        worker: Rect.make(-100, 200, 112, 36),
        block: Rect.make(-100, 116, width, 8),
      }
      const edge = Edge.make({ source: 'hub', target: 'worker', radius: 16 })
      const layout = Connector.apply(rects, [edge], Connector.make({ clearance: 16, gap: 8 }))
      expect(layout.notes).toEqual([])
      return pointsOf(layout)
    }
    expect(route(39.5)).toEqual([
      [0, 20],
      [-44, 20],
      [-44, 200],
    ])
    expect(route(40.5)).toEqual([
      [0, 20],
      [-43.5, 20],
      [-43.5, 200],
    ])
  })
})

// The nodes of `applyTolerant` for rects keyed by id.
const nodesOf = (rects: Readonly<Record<string, Rect.Rect>>) =>
  Object.entries(rects).map(([id, rect]) => ({ id, rect }))

describe('applyTolerant', () => {
  test('routes a clean graph as apply does', () => {
    const rects = {
      a: Rect.make(0, 120, 40, 40),
      b: Rect.make(60, 0, 40, 40),
      t: Rect.make(140, 120, 40, 40),
    }
    const edges = [Edge.make({ source: 'a', target: 't' }), Edge.make({ source: 'b', target: 't' })]
    const pulled = Connector.make({ clearance: 10, gap: 4, bendCost: 20, merge: 1 })
    const layout = Connector.applyTolerant(
      nodesOf(rects),
      edges.map((edge) => ({ edge })),
      pulled,
    )
    expect(layout).toEqual({ ...Connector.apply(rects, edges, pulled), problems: [] })
  })

  test('a node without an id is an obstacle, and no problem', () => {
    const edges = [Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3 })]
    const wall = Rect.make(60, -20, 20, 60)
    const layout = Connector.applyTolerant(
      [...nodesOf(pair), { rect: wall }],
      edges.map((edge) => ({ edge })),
      spec,
    )
    const expected = Connector.apply({ ...pair, w: wall }, edges, spec)
    expect(layout.edges).toEqual(expected.edges)
    expect(layout.problems).toEqual([])
  })

  test('a node whose id an earlier node took is an obstacle, and a problem', () => {
    const edges = [Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3 })]
    const wall = Rect.make(60, -20, 20, 60)
    const layout = Connector.applyTolerant(
      [...nodesOf(pair), { id: 'a', rect: wall }],
      edges.map((edge) => ({ edge })),
      spec,
    )
    // The edge leaves the first `a`, and goes around the second.
    const expected = Connector.apply({ ...pair, w: wall }, edges, spec)
    expect(layout.edges).toEqual(expected.edges)
    expect(layout.edges).not.toEqual(Connector.apply(pair, edges, spec).edges)
    expect(layout.problems).toEqual([{ kind: Connector.problem.duplicate, node: 2, id: 'a' }])
  })

  test('an edge that names an id no node has gets no route, and is a problem', () => {
    const edges = [
      { edge: Edge.make({ source: 'a', target: 'z' }) },
      { edge: Edge.make({ source: 'a', target: 'b' }) },
      { edge: Edge.make({ source: 'y', target: 'b' }) },
    ]
    const layout = Connector.applyTolerant(nodesOf(pair), edges, spec)
    expect(layout.edges[0]).toBeUndefined()
    expect(layout.edges[1]).toEqual(
      Connector.apply(pair, [Edge.make({ source: 'a', target: 'b' })], spec).edges[0],
    )
    expect(layout.edges[2]).toBeUndefined()
    expect(layout.problems).toEqual([
      { kind: Connector.problem.dangling, edge: 0 },
      { kind: Connector.problem.dangling, edge: 2 },
    ])
  })

  test('problems list the nodes, then the edges', () => {
    const layout = Connector.applyTolerant(
      [...nodesOf(pair), { id: 'b', rect: Rect.make(0, 100, 20, 20) }],
      [{ edge: Edge.make({ source: 'x', target: 'b' }) }],
      spec,
    )
    expect(layout.problems).toEqual([
      { kind: Connector.problem.duplicate, node: 2, id: 'b' },
      { kind: Connector.problem.dangling, edge: 0 },
    ])
  })

  test('an edge that no route connects is noted by its index in the input, not a problem', () => {
    const rects = {
      a: Rect.make(0, 0, 20, 20),
      n: Rect.make(100, 0, 60, 40),
      w: Rect.make(100, 40, 20, 20),
      e: Rect.make(140, 40, 20, 20),
      s: Rect.make(100, 60, 60, 40),
      x: Rect.make(120, 40, 20, 20),
    }
    const layout = Connector.applyTolerant(
      nodesOf(rects),
      [
        { edge: Edge.make({ source: 'a', target: 'q' }) },
        { edge: Edge.make({ source: 'a', target: 'n' }) },
        { edge: Edge.make({ source: 'a', target: 'x' }) },
      ],
      spec,
    )
    expect(layout.edges[2]).toBeUndefined()
    expect(layout.notes).toEqual([{ kind: Connector.note.unrouted, edge: 2 }])
    expect(layout.problems).toEqual([{ kind: Connector.problem.dangling, edge: 0 }])
  })

  test('a crowded channel names edges by their index in the input, and only nodes with ids', () => {
    // As in the notes above: three routes through a passage between `a`
    // and an obstacle without an id.
    const layout = Connector.applyTolerant(
      [
        { id: 'n', rect: Rect.make(30, -100, 30, 20) },
        { id: 's', rect: Rect.make(30, 100, 30, 20) },
        { id: 'a', rect: Rect.make(0, 0, 40, 40) },
        { rect: Rect.make(50, 0, 40, 40) },
      ],
      [
        { edge: Edge.make({ source: 'n', target: 'q' }) },
        ...Array.from({ length: 3 }, () => ({ edge: Edge.make({ source: 'n', target: 's' }) })),
      ],
      Connector.make({ gap: 6 }),
    )
    expect(layout.notes).toEqual([
      { kind: Connector.note.crowded, edges: [1, 2, 3], axis: 0, rects: ['a'], need: 2 },
    ])
  })

  test('merged ends name edges by their index in the input', () => {
    const rects = {
      a: Rect.make(0, 120, 40, 40),
      b: Rect.make(60, 0, 40, 40),
      t: Rect.make(140, 120, 40, 40),
    }
    const layout = Connector.applyTolerant(
      nodesOf(rects),
      [
        { edge: Edge.make({ source: 'q', target: 't' }) },
        { edge: Edge.make({ source: 'a', target: 't' }) },
        { edge: Edge.make({ source: 'b', target: 't' }) },
      ],
      Connector.make({ clearance: 10, gap: 4, bendCost: 20, merge: 1 }),
    )
    expect(layout.edges[1]?.merged).toEqual([-1, 1])
    expect(layout.edges[2]?.merged).toEqual([-1, 1])
  })

  test('obstacles take keys that no id has', () => {
    const edges = [Edge.make({ source: 'a', target: '\u00000', sourceSide: 1, targetSide: 3 })]
    const layout = Connector.applyTolerant(
      [{ rect: Rect.make(60, -20, 20, 60) }, ...nodesOf({ a: pair.a, '\u00000': pair.b })],
      edges.map((edge) => ({ edge })),
      spec,
    )
    expect(layout.edges[0]).toEqual(
      Connector.apply({ w: Rect.make(60, -20, 20, 60), a: pair.a, '\u00000': pair.b }, edges, spec)
        .edges[0],
    )
  })

  test('route constraints and shapes reach the routing', () => {
    const edge = Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3 })
    const via = [{ x: 70, y: 60 }]
    const shape = Polygon.make({ phase: 0.5 })
    const layout = Connector.applyTolerant(
      [
        { id: 'a', rect: pair.a },
        { id: 'b', rect: pair.b, shape },
      ],
      [{ edge, options: { via } }],
      spec,
    )
    expect(layout.edges).toEqual(
      Connector.apply(pair, [edge], spec, { edges: [{ via }], shapes: { b: shape } }).edges,
    )
  })
})
