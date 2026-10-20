import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import { route } from '../src/internal/connector/canonical.ts'
import { normalize } from '../src/internal/connector/problem.ts'
import {
  UNROUTED_BENDS,
  UNROUTED_LAPS,
  crossingsOf,
  scoreLayout,
} from '../src/internal/connector/score.ts'
import type { XY } from '../src/internal/orient.ts'
import * as Point from '../src/point.ts'
import * as Rect from '../src/rect.ts'

// A bend costs 48 at a clearance of 16 and a gap of 8, and a crossing two
// fifths of that. Routes come in by hand, so the rects only set the costs
// and the bounding box.
const rects = {
  a: Rect.make(0, 0, 40, 20),
  b: Rect.make(200, 100, 40, 20),
  c: Rect.make(0, 100, 40, 20),
  d: Rect.make(200, 0, 40, 20),
}
const spec = Connector.make({ clearance: 16, gap: 8 })
const BEND = 48

type Id = keyof typeof rects
const problemOf = (
  edges: ReadonlyArray<readonly [Id, Id]>,
  input: Partial<Edge.EdgeInput<Id>> = {},
) =>
  normalize(
    rects,
    edges.map(([source, target]) => Edge.make({ source, target, radius: 16, ...input })),
    spec,
  )

// A route through `points`, with each corner reaching `reach`.
const routeOf = (points: ReadonlyArray<XY>, reach = 16): Connector.ConnectorRoute => ({
  points: points.map(([x, y]) => Point.make(x, y)),
  radii: points.map((_, k) => (k === 0 || k === points.length - 1 ? 0 : reach)),
  outsets: points.map(() => 0),
  adornments: [],
  merged: [-1, -1],
})

const layoutOf = (
  routes: ReadonlyArray<Connector.ConnectorRoute | undefined>,
  notes: ReadonlyArray<Connector.ConnectorNote> = [],
): Connector.ConnectorLayout => ({ edges: routes, notes })

const sum = (values: Float64Array) => values.reduce((total, value) => total + value, 0)

describe('scoreLayout', () => {
  test('a route that turns a right angle costs its length and a bend', () => {
    const score = scoreLayout(
      problemOf([['a', 'b']]),
      layoutOf([
        routeOf([
          [40, 10],
          [100, 10],
          [100, 100],
        ]),
      ]),
    )
    expect(score.terms).toEqual({
      length: 150,
      turning: BEND,
      tight: 0,
      crossings: 0,
      squeeze: 0,
      crowding: 0,
      unrouted: 0,
    })
    expect(score.total).toBe(150 + BEND)
    expect([...score.byEdge]).toEqual([150 + BEND])
  })

  test('length takes no weight from the edge', () => {
    const route = routeOf([
      [40, 10],
      [200, 10],
    ])
    expect(scoreLayout(problemOf([['a', 'd']], { weight: 2.5 }), layoutOf([route])).total).toBe(160)
  })

  test('a slant costs what its two gentle turns turn', () => {
    // A jog 6 across over 8 along: each corner turns atan(3 / 4), with
    // corners that reach 8 drawing arcs of radius 24, wider than 16.
    const score = scoreLayout(
      problemOf([['a', 'd']]),
      layoutOf([
        routeOf(
          [
            [40, 10],
            [100, 10],
            [108, 16],
            [200, 16],
          ],
          8,
        ),
      ]),
    )
    expect(score.terms.length).toBe(60 + 10 + 92)
    expect(score.terms.turning).toBeCloseTo((2 * BEND * Math.atan(3 / 4)) / (Math.PI / 2), 12)
    expect(score.terms.tight).toBe(0)
  })

  test.each([
    ['at its radius', 16, 0],
    ['at half its radius', 8, BEND],
    ['as a sharp corner', 0, 2 * BEND],
    // A corner a nest grew is no tighter for it.
    ['larger than its radius', 24, 0],
  ])('a right angle drawn %s is tight by its share of the radius it lacks', (_, reach, tight) => {
    const score = scoreLayout(
      problemOf([['a', 'b']]),
      layoutOf([
        routeOf(
          [
            [40, 10],
            [100, 10],
            [100, 100],
          ],
          reach,
        ),
      ]),
    )
    expect(score.terms.tight).toBe(tight)
    expect(score.terms.turning).toBe(BEND)
  })

  test('an edge without a corner radius has no tight corners', () => {
    const score = scoreLayout(
      problemOf([['a', 'b']], { radius: 0 }),
      layoutOf([
        routeOf(
          [
            [40, 10],
            [100, 10],
            [100, 100],
          ],
          0,
        ),
      ]),
    )
    expect(score.terms.tight).toBe(0)
  })

  test('two routes that cross once share the crossing evenly', () => {
    const problem = problemOf([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const score = scoreLayout(
      problem,
      layoutOf([
        routeOf([
          [40, 10],
          [100, 10],
          [100, 100],
        ]),
        routeOf([
          [40, 110],
          [60, 110],
          [60, 50],
          [200, 50],
        ]),
      ]),
    )
    expect(score.terms.crossings).toBe(problem.crossingCost)
    expect(score.byEdge[0]).toBe(150 + BEND + problem.crossingCost / 2)
    expect(score.byEdge[1]).toBe(220 + 2 * BEND + problem.crossingCost / 2)
    expect(sum(score.byEdge)).toBe(score.total)
  })

  test('a note of merged ends or an adornment without room costs a bend for each gap and stroke it lacks', () => {
    // The strokes are 1.75 thick, so one more route takes 9.75. A crowded
    // note costs nothing: the squeeze it reports is read from the routes.
    const problem = problemOf(
      [
        ['a', 'd'],
        ['c', 'b'],
      ],
      { thickness: 1.75 },
    )
    const routes = [
      routeOf([
        [40, 10],
        [200, 10],
      ]),
      routeOf([
        [40, 110],
        [200, 110],
      ]),
    ]
    const notes: Array<Connector.ConnectorNote> = [
      { kind: 1, edges: [0, 1], axis: 1, rects: ['a', 'c'], need: 9.75 },
      { kind: 2, edges: [1], rect: 'b', side: 3, need: 19.5 },
      { kind: 3, edge: 0, adornment: 0, need: 4.875 },
    ]
    const score = scoreLayout(problem, layoutOf(routes, notes))
    expect(score.terms.crowding).toBe(2 * BEND + BEND / 2)
    expect(score.terms.squeeze).toBe(0)
    expect([...score.byEdge]).toEqual([160 + BEND / 2, 160 + 2 * BEND])
    expect(sum(score.byEdge)).toBe(score.total)
  })

  // Two routes from a and c that run along y = 10 + offset between x = 40
  // and 200 and x = 80 and 200: 120 alongside each other, and a gap of 8
  // with no stroke, so a squeeze of `offset` lacks `8 - offset` of 8.
  test.each([
    ['on one line', 0, 15 * BEND],
    ['half the gap apart', 4, (15 * BEND) / 2],
    ['the gap apart', 8, 0],
    ['farther apart', 12, 0],
  ])('two routes drawn %s squeeze by the room they lack and how long', (_, offset, squeeze) => {
    const score = scoreLayout(
      problemOf([
        ['a', 'd'],
        ['c', 'b'],
      ]),
      layoutOf([
        routeOf([
          [40, 10],
          [200, 10],
        ]),
        routeOf([
          [80, 10 + offset],
          [200, 10 + offset],
        ]),
      ]),
    )
    expect(score.terms.squeeze).toBe(squeeze)
    expect([...score.byEdge]).toEqual([160 + squeeze / 2, 120 + squeeze / 2])
  })

  test('routes that cross or meet end to end squeeze nothing', () => {
    const score = scoreLayout(
      problemOf([
        ['a', 'd'],
        ['c', 'b'],
      ]),
      layoutOf([
        routeOf([
          [40, 10],
          [120, 10],
        ]),
        routeOf([
          [120, 10],
          [200, 10],
          [200, 100],
        ]),
      ]),
    )
    expect(score.terms.squeeze).toBe(0)
  })

  test('partners of a group squeeze only closer than the merge gap', () => {
    // Two edges into the left of b with one arrow merge there, their
    // strokes 2 apart with a merge gap of 2 and a gap of 8.
    const arrow = Adornment.make({ frame: Frame.make({ width: 4, height: 4 }), at: 1 })
    const merging = Connector.make({
      clearance: 16,
      gap: 8,
      merge: Connector.merge.side,
      mergeGap: 2,
    })
    const problem = normalize(
      rects,
      [
        Edge.make({ source: 'a', target: 'b', adornments: [arrow] }),
        Edge.make({ source: 'c', target: 'b', adornments: [arrow] }),
      ],
      merging,
    )
    const into = (y: number) =>
      routeOf([
        [150, y],
        [200, y],
      ])
    expect(scoreLayout(problem, layoutOf([into(108), into(110)])).terms.squeeze).toBe(0)
    // On one line for 50, a full merge gap short.
    expect(scoreLayout(problem, layoutOf([into(110), into(110)])).terms.squeeze).toBe(
      (BEND * 50) / 8,
    )
  })

  test('an edge without a route costs more than any route it could have had', () => {
    const problem = problemOf([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const score = scoreLayout(
      problem,
      layoutOf(
        [
          routeOf([
            [40, 10],
            [100, 10],
            [100, 100],
          ]),
          undefined,
        ],
        [{ kind: 0, edge: 1 }],
      ),
    )
    // The rects span 240 by 120.
    const unrouted = UNROUTED_LAPS * 2 * (240 + 120) + UNROUTED_BENDS * BEND
    expect(score.terms.unrouted).toBe(unrouted)
    expect([...score.byEdge]).toEqual([150 + BEND, unrouted])
  })

  test('the score is the same whatever the order of the edges', () => {
    const scene = {
      gateway: Rect.make(160, 120, 120, 40),
      auth: Rect.make(40, 260, 100, 40),
      orders: Rect.make(320, 20, 100, 40),
      billing: Rect.make(320, 220, 100, 40),
      db: Rect.make(520, 270, 100, 40),
      events: Rect.make(520, 60, 100, 40),
    }
    const arrow = Adornment.make({
      frame: Frame.make({ width: 9, height: 8, offsetLeft: 4 }),
      at: 1,
      orient: Adornment.orient.forward,
    })
    const label = Adornment.make({ frame: Frame.make({ width: 40, height: 16 }), at: 0.5 })
    const link = (source: keyof typeof scene, target: keyof typeof scene, labelled = false) =>
      Edge.make({
        source,
        target,
        radius: 16,
        thickness: 1.75,
        adornments: labelled ? [arrow, label] : [arrow],
      })
    const edges = [
      link('gateway', 'auth', true),
      link('gateway', 'orders'),
      link('gateway', 'billing'),
      link('auth', 'db', true),
      link('orders', 'events'),
      link('billing', 'events'),
      link('orders', 'db'),
      link('billing', 'db'),
      link('events', 'auth'),
    ]
    const settings = Connector.make({ clearance: 16, gap: 8, merge: 1, mergeGap: 4, jogSlant: 2 })
    const scoreOf = (order: ReadonlyArray<number>) => {
      const listed = order.map((i) => edges[i] as Edge.Edge<string>)
      return scoreLayout(normalize(scene, listed, settings), route(scene, listed, settings))
    }
    const given = scoreOf(edges.map((_, i) => i))
    // The scene crosses and turns, so a reordered sum would show.
    expect(given.terms.crossings).toBeGreaterThan(0)
    expect(given.terms.turning).toBeGreaterThan(0)
    for (const order of [
      [8, 7, 6, 5, 4, 3, 2, 1, 0],
      [3, 0, 7, 1, 5, 8, 2, 6, 4],
      [6, 2, 8, 4, 0, 5, 1, 7, 3],
    ]) {
      const shuffled = scoreOf(order)
      expect(shuffled.total).toBe(given.total)
      expect(shuffled.terms).toEqual(given.terms)
      expect([...shuffled.byEdge]).toEqual(order.map((i) => given.byEdge[i]))
    }
    expect(sum(given.byEdge)).toBeCloseTo(given.total, 9)
  })
})

describe('crossingsOf', () => {
  // A horizontal line from (0, 0) to (100, 0), against each second route.
  test.each<[string, ReadonlyArray<XY>, number]>([
    [
      'a line straight across',
      [
        [50, -10],
        [50, 10],
      ],
      1,
    ],
    [
      'a slant across',
      [
        [40, -10],
        [60, 10],
      ],
      1,
    ],
    [
      'a line across and back',
      [
        [20, -10],
        [20, 10],
        [80, 10],
        [80, -10],
      ],
      2,
    ],
    [
      'a corner on the line, across it',
      [
        [30, -10],
        [50, 0],
        [70, 10],
      ],
      1,
    ],
    [
      'a corner on the line, back the way it came',
      [
        [30, -10],
        [50, 0],
        [70, -10],
      ],
      0,
    ],
    [
      'an end on the line',
      [
        [50, -10],
        [50, 0],
      ],
      0,
    ],
    [
      'an end at the end of the line',
      [
        [100, 0],
        [100, 10],
      ],
      0,
    ],
    [
      'a run along the line',
      [
        [20, -10],
        [20, 0],
        [80, 0],
        [80, 10],
      ],
      0,
    ],
    [
      'a line that stops short',
      [
        [50, -10],
        [50, -1],
      ],
      0,
    ],
    [
      'a line past the end',
      [
        [110, -10],
        [110, 10],
      ],
      0,
    ],
  ])('%s', (_, other, count) => {
    const line: ReadonlyArray<XY> = [
      [0, 0],
      [100, 0],
    ]
    expect(crossingsOf(line, other)).toBe(count)
    expect(crossingsOf(other, line)).toBe(count)
  })

  test('a crossing near the end of a line, within rounding, is not one', () => {
    // The line ends at 0.30000000000000004, a hair past the other's 0.3.
    const line: ReadonlyArray<XY> = [
      [0, 0],
      [0.1 + 0.2, 0],
    ]
    expect(
      crossingsOf(line, [
        [0.3, -1],
        [0.3, 1],
      ]),
    ).toBe(0)
  })
})
