import { describe, expect, test } from 'vitest'
import * as Point from '../src/point.ts'

interface PointCase {
  input: Point.Point
  operation: (point: Point.Point) => Point.Point
  output: Point.Point
}

function describePointOperation(name: string, cases: ReadonlyArray<PointCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('make', () => {
  test('zero arguments creates the origin', () => {
    expect(Point.make()).toEqual(Point.make(0, 0))
    expect(Point.make().x).toBe(0)
    expect(Point.make().y).toBe(0)
  })

  test('one argument applies to both components', () => {
    expect(Point.make(100)).toEqual(Point.make(100, 100))
  })

  test('two arguments are x and y', () => {
    const result = Point.make(50, 100)
    expect(result.x).toBe(50)
    expect(result.y).toBe(100)
  })

  test('constructions are exact', () => {
    expect(Point.make(0.1, 0.2).x).toBe(0.1)
    expect(Point.make(0.1, 0.2).y).toBe(0.2)
    expect(Point.make(1e9 + 0.25, 0.5).x).toBe(1e9 + 0.25)
  })
})

describe('constants', () => {
  test('shared points', () => {
    expect(Point.zero).toEqual(Point.make(0, 0))
    expect(Point.half).toEqual(Point.make(0.5, 0.5))
    expect(Point.one).toEqual(Point.make(1, 1))
    expect(Point.infinity.x).toBe(Number.POSITIVE_INFINITY)
    expect(Point.infinity.y).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('guards', () => {
  test('isPoint', () => {
    expect(Point.isPoint(Point.make())).toBe(true)
    expect(Point.isPoint({ x: 0, y: 0 })).toBe(false)
    expect(Point.isPoint(null)).toBe(false)
  })

  test('isPointLike', () => {
    expect(Point.isPointLike(Point.make())).toBe(true)
    expect(Point.isPointLike({ x: 0, y: 0 })).toBe(true)
    expect(Point.isPointLike({ x: 0 })).toBe(false)
    expect(Point.isPointLike(null)).toBe(false)
  })
})

describe('fromPolar', () => {
  test('zero magnitude and angle are exact', () => {
    expect(Point.fromPolar(0, 0)).toEqual(Point.make(0, 0))
    expect(Point.fromPolar(100, 0)).toEqual(Point.make(100, 0))
  })

  test('angles are radians, atan2 convention', () => {
    const quarter = Point.fromPolar(100, Math.PI / 2)
    expect(quarter.x).toBeCloseTo(0)
    expect(quarter.y).toBeCloseTo(100)

    const half = Point.fromPolar(100, Math.PI)
    expect(half.x).toBeCloseTo(-100)
    expect(half.y).toBeCloseTo(0)

    const negativeQuarter = Point.fromPolar(100, -Math.PI / 2)
    expect(negativeQuarter.x).toBeCloseTo(0)
    expect(negativeQuarter.y).toBeCloseTo(-100)
  })

  test('negative revolutions are not normalized (regression)', () => {
    // The old implementation folded angles into [0, 2pi) with an abs that
    // flipped the sign of negative multi-revolution angles.
    const result = Point.fromPolar(100, -1.75 * 2 * Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(100)
  })

  test('positive revolutions wrap through trig periodicity', () => {
    const result = Point.fromPolar(100, 2.25 * 2 * Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(100)
  })
})

describe('magnitude', () => {
  test('euclidean length', () => {
    expect(Point.magnitude(Point.make(3, 4))).toBe(5)
    expect(Point.magnitude(Point.make(-3, -4))).toBe(5)
    expect(Point.magnitude(Point.make())).toBe(0)
  })
})

describe('angle', () => {
  test('radians from the positive x axis', () => {
    expect(Point.angle(Point.make(100, 0))).toBe(0)
    expect(Point.angle(Point.make(0, 100))).toBe(Math.PI / 2)
    expect(Point.angle(Point.make(-100, 0))).toBe(Math.PI)
    expect(Point.angle(Point.make(0, -100))).toBe(-Math.PI / 2)
    expect(Point.angle(Point.make(100, 100))).toBeCloseTo(Math.PI / 4, 15)
  })
})

describe('center', () => {
  test('averages the points', () => {
    expect(
      Point.center([
        Point.make(0, 100),
        Point.make(100, 0),
        Point.make(0, -100),
        Point.make(-100, 0),
      ]),
    ).toEqual(Point.make(0, 0))
    expect(Point.center([Point.make(0, 0), Point.make(100, 50)])).toEqual(Point.make(50, 25))
  })

  test('accepts plain PointLikes', () => {
    expect(
      Point.center([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]),
    ).toEqual(Point.make(20, 30))
  })

  test('no points centers on the origin', () => {
    expect(Point.center([])).toEqual(Point.make(0, 0))
  })
})

describePointOperation('setX', [
  {
    input: Point.make(),
    operation: Point.setX(100),
    output: Point.make(100, 0),
  },
  {
    input: Point.make(100),
    operation: Point.setX(200),
    output: Point.make(200, 100),
  },
])

describePointOperation('setY', [
  {
    input: Point.make(),
    operation: Point.setY(100),
    output: Point.make(0, 100),
  },
  {
    input: Point.make(100),
    operation: Point.setY(200),
    output: Point.make(100, 200),
  },
])

describePointOperation('translate', [
  {
    input: Point.make(),
    operation: Point.translate(100, 200),
    output: Point.make(100, 200),
  },
  {
    input: Point.make(100, 100),
    operation: Point.translate(200, 300),
    output: Point.make(300, 400),
  },
])

describePointOperation('translateX', [
  {
    input: Point.make(),
    operation: Point.translateX(100),
    output: Point.make(100, 0),
  },
  {
    input: Point.make(100),
    operation: Point.translateX(200),
    output: Point.make(300, 100),
  },
])

describePointOperation('translateY', [
  {
    input: Point.make(),
    operation: Point.translateY(100),
    output: Point.make(0, 100),
  },
  {
    input: Point.make(100),
    operation: Point.translateY(200),
    output: Point.make(100, 300),
  },
])

describePointOperation('add', [
  {
    input: Point.make(0, 100),
    operation: Point.add(Point.make(100, 0)),
    output: Point.make(100, 100),
  },
  {
    input: Point.make(-50, 25),
    operation: Point.add(Point.make(100, 75)),
    output: Point.make(50, 100),
  },
])

describePointOperation('subtract', [
  {
    input: Point.make(0, 100),
    operation: Point.subtract(Point.make(100, 0)),
    output: Point.make(-100, 100),
  },
  {
    input: Point.make(),
    operation: Point.subtract(Point.make(100, 0)),
    output: Point.make(-100, 0),
  },
])

describePointOperation('scale', [
  {
    input: Point.make(2, -3),
    operation: Point.scale(2),
    output: Point.make(4, -6),
  },
  {
    input: Point.make(100, 50),
    operation: Point.scale(0.5),
    output: Point.make(50, 25),
  },
  {
    input: Point.make(100, 50),
    operation: Point.scale(-1),
    output: Point.make(-100, -50),
  },
])

describePointOperation('lerp', [
  {
    input: Point.make(),
    operation: Point.lerp(Point.make(100, 100), 0.5),
    output: Point.make(50, 50),
  },
  {
    input: Point.make(100, 100),
    operation: Point.lerp(Point.make(200, 200), 0),
    output: Point.make(100, 100),
  },
  {
    input: Point.make(100, 100),
    operation: Point.lerp(Point.make(200, 200), 0.5),
    output: Point.make(150, 150),
  },
  {
    input: Point.make(100, 100),
    operation: Point.lerp(Point.make(200, 200), 1),
    output: Point.make(200, 200),
  },
])

describePointOperation('min', [
  {
    input: Point.make(0, 100),
    operation: Point.min(Point.make(100, 0)),
    output: Point.make(0, 0),
  },
  {
    input: Point.make(-100, 50),
    operation: Point.min(Point.make(100, -50)),
    output: Point.make(-100, -50),
  },
])

describePointOperation('max', [
  {
    input: Point.make(0, 100),
    operation: Point.max(Point.make(100, 0)),
    output: Point.make(100, 100),
  },
  {
    input: Point.make(-100, 50),
    operation: Point.max(Point.make(100, -50)),
    output: Point.make(100, 50),
  },
])

describe('data-first forms', () => {
  test('every dual accepts the point as its first argument', () => {
    expect(Point.setX(Point.make(0, 100), 50)).toEqual(Point.make(50, 100))
    expect(Point.setY(Point.make(100, 0), 50)).toEqual(Point.make(100, 50))
    expect(Point.translate(Point.make(1, 2), 10, 20)).toEqual(Point.make(11, 22))
    expect(Point.translateX(Point.make(1, 2), 10)).toEqual(Point.make(11, 2))
    expect(Point.translateY(Point.make(1, 2), 20)).toEqual(Point.make(1, 22))
    expect(Point.add(Point.make(1, 2), Point.make(3, 4))).toEqual(Point.make(4, 6))
    expect(Point.subtract(Point.make(1, 2), Point.make(3, 4))).toEqual(Point.make(-2, -2))
    expect(Point.scale(Point.make(1, 2), 2)).toEqual(Point.make(2, 4))
    expect(Point.lerp(Point.make(0, 0), Point.make(100, 100), 0.5)).toEqual(Point.make(50, 50))
    expect(Point.min(Point.make(0, 100), Point.make(100, 0))).toEqual(Point.make(0, 0))
    expect(Point.max(Point.make(0, 100), Point.make(100, 0))).toEqual(Point.make(100, 100))
  })
})

describe('orbit', () => {
  test('rotates about the center in radians', () => {
    const half = Point.orbit(Point.make(0, 100), Point.make(0, 0), Math.PI)
    expect(half.x).toBeCloseTo(0)
    expect(half.y).toBeCloseTo(-100)

    const quarter = Point.orbit(Point.make(0, 100), Point.make(100, 0), Math.PI / 2)
    expect(quarter.x).toBeCloseTo(0)
    expect(quarter.y).toBeCloseTo(-100)
  })

  test('multi-revolution angles wrap through trig periodicity', () => {
    const result = Point.orbit(Point.make(0, 100), Point.make(100, 0), 2.5 * Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(-100)
  })

  test('zero rotation is exact', () => {
    expect(Point.orbit(Point.make(3, 4), Point.make(100, 0), 0)).toEqual(Point.make(3, 4))
  })

  test('data-last form', () => {
    const result = Point.make(0, 100).pipe(Point.orbit(Point.make(0, 0), Math.PI))
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(-100)
  })
})

describePointOperation('avoid', [
  {
    input: Point.make(5, 0),
    operation: Point.avoid(Point.make(0, 0), 10),
    output: Point.make(10, 0),
  },
  {
    input: Point.make(-5, 0),
    operation: Point.avoid(Point.make(0, 0), 10),
    output: Point.make(-10, 0),
  },
  {
    input: Point.make(0, 0),
    operation: Point.avoid(Point.make(0, 0), 10),
    output: Point.make(10, 0),
  },
  {
    input: Point.make(3, 4),
    operation: Point.avoid(Point.make(3, 4), 5),
    output: Point.make(6, 8),
  },
])

describe('avoid semantics', () => {
  test('escapes along the delta direction to exactly the gap distance', () => {
    expect(Point.avoid(Point.make(3, 4), Point.make(0, 0), 10)).toEqual(Point.make(6, 8))
  })

  test('coincident points escape along the ray from the origin', () => {
    const result = Point.avoid(
      Point.fromPolar(10, Math.PI / 4),
      Point.fromPolar(10, Math.PI / 4),
      10,
    )
    const expected = Point.fromPolar(20, Math.PI / 4)
    expect(result.x).toBeCloseTo(expected.x)
    expect(result.y).toBeCloseTo(expected.y)
  })

  test('points already at least the gap away are untouched', () => {
    const outside = Point.make(20, 0)
    expect(Point.avoid(outside, Point.make(0, 0), 10)).toBe(outside)

    const boundary = Point.make(10, 0)
    expect(Point.avoid(boundary, Point.make(0, 0), 10)).toBe(boundary)
  })

  test('the boundary decision is tolerant of rounding noise, at any magnitude', () => {
    // 0.1 + 0.2 is an ulp above 0.3. Without tolerance, the comparison nudges the point.
    const noisy = Point.make(0.3, 0)
    expect(Point.avoid(noisy, Point.make(0, 0), 0.1 + 0.2)).toBe(noisy)
    // Scale invariance: the same geometry at 1e9 gives the same verdict.
    const large = Point.make(0.3 * 1e9, 0)
    expect(Point.avoid(large, Point.make(0, 0), (0.1 + 0.2) * 1e9)).toBe(large)
  })

  test('data-last form', () => {
    expect(Point.make(5, 0).pipe(Point.avoid(Point.make(0, 0), 10))).toEqual(Point.make(10, 0))
  })
})

describe('normalize', () => {
  test('returns the unit vector', () => {
    expect(Point.normalize(Point.make(100, 0))).toEqual(Point.make(1, 0))
    expect(Point.normalize(Point.make(0, 100))).toEqual(Point.make(0, 1))
    expect(Point.normalize(Point.make(3, 4))).toEqual(Point.make(0.6, 0.8))
  })

  test('the diagonal unit vector', () => {
    const result = Point.normalize(Point.make(100, 100))
    expect(result.x).toBeCloseTo(Math.SQRT1_2, 15)
    expect(result.y).toBeCloseTo(Math.SQRT1_2, 15)
  })

  test('the zero vector has no direction (IEEE 0/0)', () => {
    const result = Point.normalize(Point.make(0, 0))
    expect(result.x).toBeNaN()
    expect(result.y).toBeNaN()
  })
})

describe('distance', () => {
  test('euclidean distance', () => {
    expect(Point.distance(Point.make(0, 0), Point.make(100, 0))).toBe(100)
    expect(Point.distance(Point.make(0, 0), Point.make(0, 100))).toBe(100)
    expect(Point.distance(Point.make(0, 0), Point.make(100, 100))).toBe(Math.hypot(100, 100))
  })

  test('data-last form', () => {
    expect(Point.make(0, 0).pipe(Point.distance(Point.make(100, 0)))).toBe(100)
  })
})

describe('dot', () => {
  test('dot product', () => {
    expect(Point.dot(Point.make(3, 4), Point.make(1, 2))).toBe(11)
    expect(Point.dot(Point.make(5, 0), Point.make(0, 5))).toBe(0)
    expect(Point.dot(Point.make(2, 2), Point.make(1, -1))).toBe(0)
    expect(Point.dot(Point.make(3, 4), Point.make(4, -3))).toBe(0)
  })

  test('data-last form', () => {
    expect(Point.make(3, 4).pipe(Point.dot(Point.make(1, 2)))).toBe(11)
  })
})

describe('cross', () => {
  test('cross product z component', () => {
    expect(Point.cross(Point.make(3, 4), Point.make(1, 2))).toBe(2)
    expect(Point.cross(Point.make(5, 0), Point.make(0, 5))).toBe(25)
    expect(Point.cross(Point.make(2, 2), Point.make(1, -1))).toBe(-4)
    expect(Point.cross(Point.make(3, 4), Point.make(4, -3))).toBe(-25)
  })

  test('data-last form', () => {
    expect(Point.make(3, 4).pipe(Point.cross(Point.make(1, 2)))).toBe(2)
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(Point.equals(Point.make(1, 2), Point.make(1, 2))).toBe(true)
    expect(Point.equals(Point.make(1, 2), Point.make(1, 3))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(Point.equals(Point.make(0.1 + 0.2, 1), Point.make(0.3, 1))).toBe(true)
    expect(Point.equals(Point.make((0.1 + 0.2) * 1e9, 1), Point.make(0.3 * 1e9, 1))).toBe(true)
  })

  test('non-finite coordinates compare exactly (regression: verdicts were inverted)', () => {
    expect(Point.equals(Point.infinity, Point.infinity)).toBe(true)
    expect(Point.equals(Point.infinity, Point.make(100, 100))).toBe(false)
    expect(Point.equals(Point.make(Number.NaN, 1), Point.make(Number.NaN, 1))).toBe(false)
  })

  test('data-last form', () => {
    expect(Point.make(1, 2).pipe(Point.equals(Point.make(1, 2)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits x and y', () => {
    expect(JSON.parse(JSON.stringify(Point.make(5, 10)))).toEqual({ x: 5, y: 10 })
  })
})
