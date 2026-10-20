import { describe, expect, test } from 'vitest'
import { type XY, cornerArcs, onArc } from '../src/internal/polygon.ts'
import * as Point from '../src/point.ts'
import * as Polygon from '../src/polygon.ts'
import * as Rect from '../src/rect.ts'

const rect = Rect.make(0, 0, 80, 40)

const corners = (layout: Polygon.PolygonLayout) =>
  layout.outlines.map((outline) => outline.map(({ x, y }) => [x, y]))

// The bounds of a placed polygon as rounded: its arcs' tangent points and
// the points where its arcs run along an axis, or its sharp corners.
function roundedBounds(layout: Polygon.PolygonLayout): [number, number, number, number] {
  const xs: Array<number> = []
  const ys: Array<number> = []
  for (const outline of layout.outlines) {
    const loop = outline.map(({ x, y }): XY => [x, y])
    const arcs = cornerArcs(loop, layout.radius)
    for (const [i, corner] of loop.entries()) {
      const arc = arcs[i]
      const points: Array<XY> =
        arc === undefined
          ? [corner]
          : [
              arc.start,
              arc.end,
              ...(
                [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                ] as const
              )
                .map(
                  ([dx, dy]): XY => [
                    arc.center[0] + dx * arc.radius,
                    arc.center[1] + dy * arc.radius,
                  ],
                )
                .filter((point) => onArc(arc, point)),
            ]
      for (const [x, y] of points) {
        xs.push(x)
        ys.push(y)
      }
    }
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

describe('make', () => {
  test('empty input is a sharp rect', () => {
    expect(Polygon.make().toJSON()).toEqual({ sides: 4, loops: 1, phase: 0, radius: 0 })
  })

  test('input is kept raw', () => {
    expect(Polygon.make({ sides: 5.5, loops: 2, phase: 1.25, radius: -1 }).toJSON()).toEqual({
      sides: 5.5,
      loops: 2,
      phase: 1.25,
      radius: -1,
    })
  })

  test('isPolygon', () => {
    expect(Polygon.isPolygon(Polygon.make())).toBe(true)
    expect(Polygon.isPolygon({ sides: 4 })).toBe(false)
    expect(Polygon.isPolygon(null)).toBe(false)
  })
})

describe('setters', () => {
  const base = Polygon.make()

  test.each([
    ['setSides', Polygon.setSides, 'sides'],
    ['setLoops', Polygon.setLoops, 'loops'],
    ['setPhase', Polygon.setPhase, 'phase'],
    ['setRadius', Polygon.setRadius, 'radius'],
  ] as const)('%s, data-first and data-last', (_, set, key) => {
    expect(set(base, 3)[key]).toBe(3)
    expect(base.pipe(set(3))[key]).toBe(3)
    expect(base[key]).not.toBe(3)
  })
})

describe('apply', () => {
  test.each([
    [
      'a rect',
      {},
      [
        [
          [0, 0],
          [80, 0],
          [80, 40],
          [0, 40],
        ],
      ],
    ],
    [
      'a diamond, at a phase of one half',
      { phase: 0.5 },
      [
        [
          [40, 0],
          [80, 20],
          [40, 40],
          [0, 20],
        ],
      ],
    ],
    [
      'a triangle with a flat top',
      { sides: 3 },
      [
        [
          [0, 0],
          [80, 0],
          [40, 40],
        ],
      ],
    ],
    [
      'a triangle pointing up',
      { sides: 3, phase: 0.5 },
      [
        [
          [40, 0],
          [80, 40],
          [0, 40],
        ],
      ],
    ],
  ])('%s fills the rect', (_, input, expected) => {
    expect(corners(Polygon.apply(Polygon.make(input), rect))).toEqual(expected)
  })

  test.each([
    [
      'right',
      1 / 3,
      [
        [0, 0],
        [9, 4],
        [0, 8],
      ],
    ],
    [
      'left',
      2 / 3,
      [
        [9, 0],
        [9, 8],
        [0, 4],
      ],
    ],
  ])('a triangle points %s at a phase of %f', (_, phase, expected) => {
    const [outline] = Polygon.apply(
      Polygon.make({ sides: 3, phase }),
      Rect.make(0, 0, 9, 8),
    ).outlines
    for (const [i, [x, y]] of expected.entries()) {
      expect(outline?.[i]?.x).toBeCloseTo(x as number, 12)
      expect(outline?.[i]?.y).toBeCloseTo(y as number, 12)
    }
  })

  test('the data-last form', () => {
    expect(Polygon.make({ phase: 0.5 }).pipe(Polygon.apply(rect))).toEqual(
      Polygon.apply(Polygon.make({ phase: 0.5 }), rect),
    )
  })

  test('a hexagon has a flat top a quarter of the way in', () => {
    const [outline] = corners(Polygon.apply(Polygon.make({ sides: 6 }), rect))
    const expected = [
      [20, 0],
      [60, 0],
      [80, 20],
      [60, 40],
      [20, 40],
      [0, 20],
    ]
    for (const [i, [x, y]] of expected.entries()) {
      expect(outline?.[i]?.[0]).toBeCloseTo(x as number, 12)
      expect(outline?.[i]?.[1]).toBeCloseTo(y as number, 12)
    }
  })

  test('mirrored corners have mirrored coordinates', () => {
    for (const sides of [5, 6, 7, 8, 9]) {
      for (const phase of [0, 0.5]) {
        const [outline] = Polygon.apply(Polygon.make({ sides, phase }), rect).outlines
        const xs = (outline ?? []).map(({ x }) => x).toSorted((a, b) => a - b)
        const mirrored = xs.map((x) => 80 - x).toSorted((a, b) => a - b)
        for (const [i, x] of xs.entries()) {
          expect(x).toBeCloseTo(mirrored[i] as number, 12)
        }
        expect(xs[0]).toBe(0)
        expect(xs.at(-1)).toBe(80)
      }
    }
  })

  test('a pentagram joins every second corner', () => {
    const star = Polygon.apply(Polygon.make({ sides: 5, loops: 2, phase: 0.5 }), rect)
    const pentagon = Polygon.apply(Polygon.make({ sides: 5, phase: 0.5 }), rect)
    const [p0, p1, p2, p3, p4] = pentagon.outlines[0] ?? []
    expect(star.outlines).toEqual([[p0, p2, p4, p1, p3]])
  })

  test('a hexagram is two triangles', () => {
    const star = Polygon.apply(Polygon.make({ sides: 6, loops: 2 }), rect)
    const hexagon = Polygon.apply(Polygon.make({ sides: 6 }), rect)
    const [p0, p1, p2, p3, p4, p5] = hexagon.outlines[0] ?? []
    expect(star.outlines).toEqual([
      [p0, p2, p4],
      [p1, p3, p5],
    ])
  })

  test.each([
    ['fractional sides truncate', { sides: 5.9 }, { sides: 5 }],
    ['sides below 3 are 3', { sides: 1 }, { sides: 3 }],
    ['non-finite sides are 4', { sides: Number.NaN }, {}],
    ['loops past half the sides clamp', { sides: 5, loops: 7 }, { sides: 5, loops: 2 }],
    ['loops below 1 are 1', { sides: 5, loops: -2 }, { sides: 5 }],
    ['a square has one loop', { loops: 3 }, {}],
    ['phases wrap', { phase: -0.5 }, { phase: 0.5 }],
    ['a phase of 1 is 0', { phase: 1 }, {}],
    ['non-finite phases are 0', { phase: Number.POSITIVE_INFINITY }, {}],
    ['negative radii are sharp', { radius: -3 }, {}],
    ['non-finite radii are sharp', { radius: Number.NaN }, {}],
  ])('%s', (_, input, same) => {
    expect(Polygon.apply(Polygon.make(input), rect)).toEqual(
      Polygon.apply(Polygon.make(same), rect),
    )
  })

  test('a rounded rect keeps its corners and takes the radius', () => {
    const layout = Polygon.apply(Polygon.make({ radius: 10 }), rect)
    expect(corners(layout)).toEqual(corners(Polygon.apply(Polygon.make(), rect)))
    expect(layout.radius).toBe(10)
  })

  test('a rect rounds at most to a pill', () => {
    expect(Polygon.apply(Polygon.make({ radius: 100 }), rect).radius).toBe(20)
  })

  test.each([
    ['diamond', { phase: 0.5, radius: 8 }],
    ['very round diamond', { phase: 0.5, radius: 1000 }],
    ['triangle', { sides: 3, phase: 0.5, radius: 6 }],
    ['hexagon', { sides: 6, radius: 5 }],
    ['pentagram', { sides: 5, loops: 2, phase: 0.5, radius: 3 }],
    ['hexagram', { sides: 6, loops: 2, radius: 3 }],
  ])('a rounded %s grows until its rounded outline fills the rect', (_, input) => {
    const layout = Polygon.apply(Polygon.make(input), Rect.make(10, 20, 80, 40))
    const [left, top, right, bottom] = roundedBounds(layout)
    expect(left).toBeCloseTo(10, 9)
    expect(top).toBeCloseTo(20, 9)
    expect(right).toBeCloseTo(90, 9)
    expect(bottom).toBeCloseTo(60, 9)
    // Every corner fits the radius whole.
    expect(layout.radius).toBeGreaterThan(0)
    expect(layout.radius).toBeLessThanOrEqual(input.radius)
    for (const outline of layout.outlines) {
      const arcs = cornerArcs(
        outline.map(({ x, y }): XY => [x, y]),
        layout.radius,
      )
      for (const arc of arcs) {
        expect(arc?.radius).toBeCloseTo(layout.radius, 9)
      }
    }
  })

  test('a rounded diamond reaches past the rect at its tips', () => {
    const [outline] = Polygon.apply(Polygon.make({ phase: 0.5, radius: 8 }), rect).outlines
    const [top, right] = outline ?? []
    expect(top?.x).toBeCloseTo(40, 12)
    expect(top?.y).toBeLessThan(0)
    expect(right?.x).toBeGreaterThan(80)
  })

  test('an empty rect does not grow', () => {
    const layout = Polygon.apply(Polygon.make({ phase: 0.5, radius: 8 }), Rect.make(5, 5, 0, 0))
    expect(corners(layout)).toEqual([
      [
        [5, 5],
        [5, 5],
        [5, 5],
        [5, 5],
      ],
    ])
    expect(layout.radius).toBe(0)
  })
})

describe('cornerArcs', () => {
  const square: ReadonlyArray<XY> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]

  test('round each corner within its sides', () => {
    const [first] = cornerArcs(square, 2)
    expect(first).toEqual({
      start: [0, 2],
      end: [2, 0],
      center: [2, 2],
      radius: 2,
      toward: [expect.closeTo(-Math.SQRT1_2, 15), expect.closeTo(-Math.SQRT1_2, 15)],
      limit: expect.closeTo(Math.SQRT2, 12),
    })
  })

  test('split a short side in proportion', () => {
    for (const arc of cornerArcs(square, 100)) {
      expect(arc?.radius).toBe(5)
    }
  })

  test('only the part of the circle past the tangent points is the arc', () => {
    const arc = cornerArcs(square, 2)[1]
    expect(arc?.center).toEqual([8, 2])
    expect(onArc(arc!, [10, 2])).toBe(true)
    expect(onArc(arc!, [8, 0])).toBe(true)
    expect(onArc(arc!, [8 + Math.SQRT2, 2 - Math.SQRT2])).toBe(true)
    expect(onArc(arc!, [6, 2])).toBe(false)
    expect(onArc(arc!, [8, 4])).toBe(false)
  })

  test('straight corners stay sharp', () => {
    expect(
      cornerArcs(
        [
          [0, 0],
          [5, 0],
          [10, 0],
          [10, 10],
        ],
        2,
      )[1],
    ).toBeUndefined()
  })
})

describe('Point import', () => {
  test('outlines hold points', () => {
    expect(Polygon.apply(Polygon.make(), rect).outlines[0]?.[0]).toEqual(Point.make(0, 0))
  })
})
