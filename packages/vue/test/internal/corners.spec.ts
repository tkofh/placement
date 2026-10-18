import { CubicCurve2d } from 'curvy/curve'
import { CubicPath2d } from 'curvy/path'
import { describe, expect, test } from 'vitest'
import { roundPolyline, roundRect } from '../../src/internal/corners.ts'

type Curve = CubicCurve2d.CubicCurve2d

const start = (c: Curve) => [c.x.c0, c.y.c0] as const
const end = (c: Curve) =>
  [c.x.c0 + c.x.c1 + c.x.c2 + c.x.c3, c.y.c0 + c.y.c1 + c.y.c2 + c.y.c3] as const
const startTangent = (c: Curve) => [c.x.c1, c.y.c1] as const
const endTangent = (c: Curve) =>
  [c.x.c1 + 2 * c.x.c2 + 3 * c.x.c3, c.y.c1 + 2 * c.y.c2 + 3 * c.y.c3] as const
const pointAt = (c: Curve, t: number) =>
  [
    c.x.c0 + t * (c.x.c1 + t * (c.x.c2 + t * c.x.c3)),
    c.y.c0 + t * (c.y.c1 + t * (c.y.c2 + t * c.y.c3)),
  ] as const
const curvature = (c: Curve, t: number) => Math.abs(CubicCurve2d.curvature(c, t))

function curvesOf(path: CubicPath2d.CubicPath2d | undefined): Array<Curve> {
  expect(path).toBeDefined()
  return [...path!]
}

function expectPoint(actual: readonly [number, number], x: number, y: number, digits = 9) {
  expect(actual[0]).toBeCloseTo(x, digits)
  expect(actual[1]).toBeCloseTo(y, digits)
}

// Every join is continuous in position and direction.
function expectSmoothJoins(curves: ReadonlyArray<Curve>) {
  for (let i = 1; i < curves.length; i++) {
    const a = curves[i - 1]!
    const b = curves[i]!
    expectPoint(end(a), ...start(b))
    const ta = endTangent(a)
    const tb = startTangent(b)
    const cross = (ta[0] * tb[1] - ta[1] * tb[0]) / (Math.hypot(...ta) * Math.hypot(...tb))
    expect(cross).toBeCloseTo(0, 9)
    expect(ta[0] * tb[0] + ta[1] * tb[1]).toBeGreaterThan(0)
  }
}

const SQRT1_2 = Math.SQRT1_2

// Turns of 90, 45, and 135 degrees, the last two off the axes.
const turns = [
  ['90 degrees', [0, 0], [100, 0], [100, 100], Math.PI / 2],
  ['45 degrees', [0, 0], [100, 0], [100 + 100 * SQRT1_2, 100 * SQRT1_2], Math.PI / 4],
  ['135 degrees', [0, 0], [100, 0], [100 - 100 * SQRT1_2, 100 * SQRT1_2], (3 * Math.PI) / 4],
] as const

const point = ([x, y]: readonly [number, number]) => ({ x, y })

describe('roundPolyline', () => {
  test('a circular fillet replaces a right angle', () => {
    const curves = curvesOf(
      roundPolyline([point([0, 0]), point([100, 0]), point([100, 100])], 10, 0),
    )

    expect(curves).toHaveLength(3)
    expectPoint(start(curves[0]!), 0, 0)
    expectPoint(start(curves[1]!), 90, 0)
    expectPoint(end(curves[1]!), 100, 10)
    expectPoint(end(curves[2]!), 100, 100)
    // The arc stays within 0.2% of the circle about (90, 10), and its ends
    // have the circle's curvature.
    for (const t of [0.25, 0.5, 0.75]) {
      const at = CubicCurve2d.solve(curves[1]!, t)
      expect(Math.abs(Math.hypot(at.x - 90, at.y - 10) - 10)).toBeLessThan(0.02)
    }
    expect(curvature(curves[1]!, 0) * 10).toBeCloseTo(1, 9)
    expect(curvature(curves[1]!, 1) * 10).toBeCloseTo(1, 9)
    expectSmoothJoins(curves)
  })

  describe.each(turns)('a turn of %s', (_, a, vertex, b, theta) => {
    const r = 10

    test.each([0.25, 0.6, 1])('smoothing %s eases the curvature in and out', (smoothing) => {
      const curves = curvesOf(roundPolyline([point(a), point(vertex), point(b)], r, smoothing))
      expectSmoothJoins(curves)

      // line, transition, arc piece(s), transition, line
      const first = curves[1]!
      const last = curves.at(-2)!
      expect(curvature(first, 0)).toBeCloseTo(0, 9)
      expect(curvature(first, 1) * r).toBeCloseTo(1, 9)
      expect(curvature(last, 0) * r).toBeCloseTo(1, 9)
      expect(curvature(last, 1)).toBeCloseTo(0, 9)
      if (smoothing < 1) {
        expect(curvature(curves[2]!, 0) * r).toBeCloseTo(1, 9)
        expect(curvature(curves[curves.length - 3]!, 1) * r).toBeCloseTo(1, 9)
      }
    })

    test.each([0, 0.5, 1])('smoothing %s reaches (1 + smoothing) tangent lengths', (smoothing) => {
      const curves = curvesOf(roundPolyline([point(a), point(vertex), point(b)], r, smoothing))
      const reach = (1 + smoothing) * r * Math.tan(theta / 2)
      const [x, y] = start(curves[1]!)
      expect(Math.hypot(vertex[0] - x, vertex[1] - y)).toBeCloseTo(reach, 9)
      const [ex, ey] = end(curves.at(-2)!)
      expect(Math.hypot(ex - vertex[0], ey - vertex[1])).toBeCloseTo(reach, 9)
    })
  })

  test('corners on a short shared leg lose smoothing first', () => {
    // Each corner wants 8 of the 10-long leg, so each gets 5: smoothing 0.25.
    const curves = curvesOf(
      roundPolyline([point([0, 0]), point([100, 0]), point([100, 10]), point([0, 10])], 4, 1),
    )
    expectSmoothJoins(curves)
    const meeting = curves.findIndex((curve) => {
      const [x, y] = end(curve)
      return Math.abs(x - 100) < 1e-9 && Math.abs(y - 5) < 1e-9
    })
    expect(meeting).toBeGreaterThan(0)
    // The corners meet without a line between them, still at radius 4.
    expect(curvature(curves[meeting]!, 1)).toBeCloseTo(0, 9)
    expect(Math.max(...curves.map((c) => curvature(c, 0.5)))).toBeLessThan(1 / 4 + 1e-6)
  })

  test('corners on a very short leg lose radius after smoothing', () => {
    // Each corner wants 30 and gets 5, below the fillet's own 20.
    const curves = curvesOf(
      roundPolyline([point([0, 0]), point([100, 0]), point([100, 10]), point([0, 10])], 20, 0.5),
    )
    expectSmoothJoins(curves)
    expectPoint(start(curves[1]!), 95, 0)
    expectPoint(end(curves[1]!), 100, 5)
    expect(curvature(curves[1]!, 0) * 5).toBeCloseTo(1, 9)
  })

  test('the radius of an end leg is limited by its whole length', () => {
    const curves = curvesOf(roundPolyline([point([0, 0]), point([4, 0]), point([4, 100])], 10, 0))
    expectPoint(start(curves[0]!), 0, 0)
    expectPoint(end(curves[0]!), 4, 4)
  })

  test('straight and reversing vertices stay sharp', () => {
    const straight = curvesOf(
      roundPolyline([point([0, 0]), point([50, 0]), point([100, 0])], 10, 1),
    )
    expect(straight.map(end)).toEqual([
      [50, 0],
      [100, 0],
    ])

    const back = curvesOf(roundPolyline([point([0, 0]), point([100, 0]), point([50, 0])], 10, 1))
    expect(back).toHaveLength(2)
    expectPoint(end(back[0]!), 100, 0)
  })

  test('radius 0 keeps the polyline', () => {
    const curves = curvesOf(roundPolyline([point([0, 0]), point([10, 0]), point([10, 10])], 0, 1))
    expect(curves.map(end)).toEqual([
      [10, 0],
      [10, 10],
    ])
  })

  test('repeated points are dropped, and one point is no path', () => {
    const curves = curvesOf(
      roundPolyline([point([0, 0]), point([0, 0]), point([10, 0]), point([10, 0])], 5, 0),
    )
    expect(curves).toHaveLength(1)
    expect(roundPolyline([point([3, 3]), point([3, 3])], 5, 0)).toBeUndefined()
    expect(roundPolyline([], 5, 0)).toBeUndefined()
  })

  test('a closed polyline rounds every vertex', () => {
    const diamond = [point([50, 0]), point([100, 50]), point([50, 100]), point([0, 50])]
    const path = roundPolyline(diamond, 8, 0.6, true)
    const curves = curvesOf(path)
    expectSmoothJoins([...curves, curves[0]!])
    expectPoint(start(curves[0]!), 75, 25)
    expectPoint(end(curves.at(-1)!), 75, 25)
    // Every vertex is rounded, so the path stays inside the diamond's box.
    const box = CubicPath2d.boundingBox(path!)
    expect(box.y.start).toBeGreaterThan(0)
    expect(box.x.start).toBeGreaterThan(0)
    // A repeated closing point changes nothing.
    const repeated = roundPolyline([...diamond, point([50, 0])], 8, 0.6, true)
    expect(CubicPath2d.toPathData(repeated!)).toBe(CubicPath2d.toPathData(path!))
  })

  test('smoothing outside [0, 1] clamps', () => {
    const over = roundPolyline([point([0, 0]), point([100, 0]), point([100, 100])], 10, 3)
    const one = roundPolyline([point([0, 0]), point([100, 0]), point([100, 100])], 10, 1)
    expect(CubicPath2d.toPathData(over!)).toBe(CubicPath2d.toPathData(one!))
  })

  test('rooms cap each corner, smoothing giving way first', () => {
    const ell = [point([0, 0]), point([100, 0]), point([100, 100])]
    // Where the corner begins along the first leg.
    const begins = (rooms: Array<number>) =>
      curvesOf(roundPolyline(ell, 10, 0.5, false, rooms))[1]!.x.c0
    // It fits: (1 + 0.5) * 10.
    expect(begins([0, 15, 0])).toBe(85)
    // Smoothing gives way, and the radius stays.
    expect(begins([0, 10, 0])).toBeCloseTo(90, 9)
    // Then the radius shrinks too.
    expect(begins([0, 4, 0])).toBeCloseTo(96, 9)
  })

  test('a nested corner is its outermost corner moved in by its inset', () => {
    // Two L's 4 apart, with corners on the line x + y = 100. The outer one
    // reaches (1 + 0.6) * 10 = 16, and the inner one 4 less.
    const outer = [point([0, 0]), point([100, 0]), point([100, 100])]
    const inner = [point([0, 4]), point([96, 4]), point([96, 100])]
    // Where a corner crosses the line through both corners.
    const apex = (curves: Array<Curve>) => {
      const side = (c: Curve, t: number) => pointAt(c, t)[0] + pointAt(c, t)[1] - 100
      const c = curves.find((curve) => side(curve, 0) * side(curve, 1) <= 0)!
      let [lo, hi] = [0, 1]
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2
        ;[lo, hi] = side(c, lo) * side(c, mid) <= 0 ? [lo, mid] : [mid, hi]
      }
      return pointAt(c, lo)
    }
    const a = apex(curvesOf(roundPolyline(outer, 10, 0.6, false, [0, 16, 0])))
    const b = apex(curvesOf(roundPolyline(inner, 10, 0.6, false, [0, 12, 0], [0, 4, 0])))
    // The apexes sit the inset apart, so the two share a center there, to
    // within the cubics that draw a smoothed corner.
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeCloseTo(4, 3)
    // It fills its room: radius 6, smoothing 1.
    expect(curvesOf(roundPolyline(inner, 10, 0.6, false, [0, 12, 0], [0, 4, 0]))[1]!.x.c0).toBe(84)
    // Without the inset it keeps the radius and loses smoothing, so it bulges.
    const c = apex(curvesOf(roundPolyline(inner, 10, 0.6, false, [0, 12, 0])))
    expect(Math.hypot(a[0] - c[0], a[1] - c[1])).toBeGreaterThan(4.5)
  })

  test('a corner nested past its outermost radius fills its room smoothly', () => {
    const inner = [point([0, 12]), point([88, 12]), point([88, 100])]
    // Room 4, inset 12 inside a corner of radius 10: radius 2, smoothing 1.
    const curves = curvesOf(roundPolyline(inner, 10, 0.6, false, [0, 4, 0], [0, 12, 0]))
    expect(curves[1]!.x.c0).toBeCloseTo(84, 9)
  })

  test('a room past what the radius reaches grows the corner to fill it', () => {
    // A slanted jog: two corners that turn atan(4 / 3) each way and meet
    // halfway, (30, 4), with no straight between them.
    const ess = [point([0, 0]), point([27, 0]), point([33, 8]), point([60, 8])]
    const curves = curvesOf(roundPolyline(ess, 2, 0, false, [0, 5, 5, 0]))
    expect(curves[1]!.x.c0).toBeCloseTo(22, 9)
    const join = curves.findIndex((curve) => Math.abs(curve.x.c0 - 30) < 1e-9)
    expect(join).toBeGreaterThan(1)
    expect(curves[join]!.y.c0).toBeCloseTo(4, 9)
    // An open polyline without rooms keeps its radius.
    expect(curvesOf(roundPolyline(ess, 2, 0))[1]!.x.c0).toBeCloseTo(26, 9)
  })
})

describe('roundRect', () => {
  test('the path is closed and bounded by the rect', () => {
    for (const smoothing of [0, 0.6, 1]) {
      const path = roundRect(10, 20, 100, 50, 12, 12, smoothing)
      const curves = [...path]
      expectSmoothJoins([...curves, curves[0]!])
      const box = CubicPath2d.boundingBox(path)
      expect(box.x.start).toBeCloseTo(10, 9)
      expect(box.x.end).toBeCloseTo(110, 9)
      expect(box.y.start).toBeCloseTo(20, 9)
      expect(box.y.end).toBeCloseTo(70, 9)
    }
  })

  test('a smoothed corner reaches (1 + smoothing) radii along each side', () => {
    const curves = [...roundRect(0, 0, 100, 50, 10, 5, 0.6)]
    expectPoint(start(curves[0]!), 84, 0)
    const corner = curves.findIndex((curve) => Math.abs(end(curve)[0] - 100) < 1e-9)
    expectPoint(end(curves[corner]!), 100, 8)
  })

  test('radii larger than the room lose smoothing, then size', () => {
    // 20 * (1 + s) must fit in half the height, 25: s drops to 0.25.
    const reduced = [...roundRect(0, 0, 100, 50, 20, 20, 1)]
    expectPoint(start(reduced[0]!), 75, 0)

    // As with SVG's rx/ry, each axis clamps on its own: ry 40 does not fit
    // in 25, so the corner is 40 by 25 with no smoothing.
    const shrunk = [...roundRect(0, 0, 100, 50, 40, 40, 0.5)]
    expectPoint(start(shrunk[0]!), 60, 0)
    expectPoint(end(shrunk[0]!), 100, 25)
  })
})
