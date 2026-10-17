import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import * as Interval from '../src/interval.ts'
import * as Rect from '../src/rect.ts'

const pointsOf = (layout: Connector.ConnectorLayout, i = 0) =>
  layout.edges[i]?.points.map(({ x, y }) => [x, y])

const spec = Connector.make({ clearance: 10, gap: 4 })

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
  Adornment.make({ frame: Frame.make({ width: 8, height: 6, offsetLeft: 2 }), at, orient })

// An upright label, 20 by 10.
const label = (at: number, position: number = Adornment.position.flow) =>
  Adornment.make({ frame: Frame.make({ width: 20, height: 10 }), at, position })

describe('make', () => {
  const defaults = {
    clearance: 0,
    gap: 0,
    bendCost: 0,
    turnCost: 0,
    alignAdornments: 0.5,
    justifyAdornments: 0.5,
    justifyAdornmentsSpace: 0,
    justifyAdornmentsSpaceOuter: 0,
    adornmentGap: 0,
    jogAt: 0.5,
    jogSlant: 1,
  }

  test('lengths and costs default to zero, and adornments to the middle', () => {
    expect(Connector.make().toJSON()).toEqual(defaults)
  })

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('%f acts as the default', (value) => {
    expect(
      Connector.make({
        clearance: value,
        gap: value,
        bendCost: value,
        turnCost: value,
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

  test('a finite adornment alignment stays as given', () => {
    expect(Connector.make({ alignAdornments: -1 }).alignAdornments).toBe(-1)
  })

  test('the jog position clamps to the run', () => {
    expect(Connector.make({ jogAt: -1 }).jogAt).toBe(0)
    expect(Connector.make({ jogAt: 2 }).jogAt).toBe(1)
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
    ['setTurnCost', Connector.setTurnCost, 'turnCost'],
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
    const edges = [Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3, radius: 8 })]
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
    const layout = Connector.apply(rects, [edge], Connector.make({ clearance: 10, turnCost: 50 }), {
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
      [Edge.make({ source: 'a', target: 'b', radius: 25 })],
      spec,
    )
    // The middle leg is 40 long, so each of its corners reaches 20.
    expect(layout.edges[0]?.radii).toEqual([0, 20, 20, 0])
  })

  test('the inner corner of routes that turn together shrinks to share a center', () => {
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
    // The outer corner reaches 30, and the inner one, 20 in and 20 over,
    // reaches 10, about the same center (100, 40).
    expect(layout.edges.map((route) => route?.radii)).toEqual([
      [0, 30, 0],
      [0, 10, 0],
    ])
  })

  describe('adornments', () => {
    // A route from the right of `a` to the left of `b`, through a jog:
    // (40, 10), (70, 10), (70, 50), (100, 50), 100 long.
    const jog = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
    const route = (adornments: Array<Adornment.Adornment>, radius = 0, connector = spec) =>
      Connector.apply(
        jog,
        [Edge.make({ source: 'a', target: 'b', sourceSide: 1, targetSide: 3, radius, adornments })],
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
      // near, and the first wins, with the label at its middle.
      expect(pointsOf(layout)).toEqual([
        [40, 10],
        [70, 10],
        [70, 14],
        [100, 14],
      ])
      expect(layout.edges[0]?.adornments).toEqual([
        { rect: Rect.make(45, 5, 20, 10), angle: 0, along: Interval.make(5, 20) },
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
