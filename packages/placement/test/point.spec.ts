import { describe, expect, test } from 'vitest'
import {
  type Point,
  add,
  angle,
  avoid,
  center,
  cross,
  distance,
  dot,
  equals,
  fromPolar,
  isPoint,
  isPointLike,
  lerp,
  magnitude,
  max,
  min,
  normalize,
  orbit,
  point,
  scale,
  setX,
  setY,
  subtract,
  translate,
  translateX,
  translateY,
} from '../src/point.ts'

interface PointCase {
  input: Point
  operation: (point: Point) => Point
  output: Point
}

function describePointOperation(name: string, cases: ReadonlyArray<PointCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('point', () => {
  test('zero arguments creates the origin', () => {
    expect(point()).toEqual(point(0, 0))
    expect(point().x).toBe(0)
    expect(point().y).toBe(0)
  })

  test('one argument applies to both components', () => {
    expect(point(100)).toEqual(point(100, 100))
  })

  test('two arguments are x and y', () => {
    const result = point(50, 100)
    expect(result.x).toBe(50)
    expect(result.y).toBe(100)
  })

  test('constructions are exact', () => {
    expect(point(0.1, 0.2).x).toBe(0.1)
    expect(point(0.1, 0.2).y).toBe(0.2)
    expect(point(1e9 + 0.25, 0.5).x).toBe(1e9 + 0.25)
  })

  test('statics', () => {
    expect(point.zero).toEqual(point(0, 0))
    expect(point.half).toEqual(point(0.5, 0.5))
    expect(point.one).toEqual(point(1, 1))
    expect(point.infinity.x).toBe(Number.POSITIVE_INFINITY)
    expect(point.infinity.y).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('guards', () => {
  test('isPoint', () => {
    expect(isPoint(point())).toBe(true)
    expect(isPoint({ x: 0, y: 0 })).toBe(false)
    expect(isPoint(null)).toBe(false)
  })

  test('isPointLike', () => {
    expect(isPointLike(point())).toBe(true)
    expect(isPointLike({ x: 0, y: 0 })).toBe(true)
    expect(isPointLike({ x: 0 })).toBe(false)
    expect(isPointLike(null)).toBe(false)
  })
})

describe('fromPolar', () => {
  test('zero magnitude and angle are exact', () => {
    expect(fromPolar(0, 0)).toEqual(point(0, 0))
    expect(fromPolar(100, 0)).toEqual(point(100, 0))
  })

  test('angles are radians, atan2 convention', () => {
    const quarter = fromPolar(100, Math.PI / 2)
    expect(quarter.x).toBeCloseTo(0)
    expect(quarter.y).toBeCloseTo(100)

    const half = fromPolar(100, Math.PI)
    expect(half.x).toBeCloseTo(-100)
    expect(half.y).toBeCloseTo(0)

    const negativeQuarter = fromPolar(100, -Math.PI / 2)
    expect(negativeQuarter.x).toBeCloseTo(0)
    expect(negativeQuarter.y).toBeCloseTo(-100)
  })

  test('negative revolutions are not normalized (regression)', () => {
    // The old implementation folded angles into [0, 2pi) with an abs that
    // flipped the sign of negative multi-revolution angles.
    const result = fromPolar(100, -1.75 * 2 * Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(100)
  })

  test('positive revolutions wrap through trig periodicity', () => {
    const result = fromPolar(100, 2.25 * 2 * Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(100)
  })
})

describe('magnitude', () => {
  test('euclidean length', () => {
    expect(magnitude(point(3, 4))).toBe(5)
    expect(magnitude(point(-3, -4))).toBe(5)
    expect(magnitude(point())).toBe(0)
  })
})

describe('angle', () => {
  test('radians from the positive x axis', () => {
    expect(angle(point(100, 0))).toBe(0)
    expect(angle(point(0, 100))).toBe(Math.PI / 2)
    expect(angle(point(-100, 0))).toBe(Math.PI)
    expect(angle(point(0, -100))).toBe(-Math.PI / 2)
    expect(angle(point(100, 100))).toBeCloseTo(Math.PI / 4, 15)
  })
})

describe('center', () => {
  test('averages the points', () => {
    expect(center([point(0, 100), point(100, 0), point(0, -100), point(-100, 0)])).toEqual(
      point(0, 0),
    )
    expect(center([point(0, 0), point(100, 50)])).toEqual(point(50, 25))
  })

  test('accepts plain PointLikes', () => {
    expect(
      center([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]),
    ).toEqual(point(20, 30))
  })

  test('no points centers on the origin', () => {
    expect(center([])).toEqual(point(0, 0))
  })
})

describePointOperation('setX', [
  {
    input: point(),
    operation: setX(100),
    output: point(100, 0),
  },
  {
    input: point(100),
    operation: setX(200),
    output: point(200, 100),
  },
])

describePointOperation('setY', [
  {
    input: point(),
    operation: setY(100),
    output: point(0, 100),
  },
  {
    input: point(100),
    operation: setY(200),
    output: point(100, 200),
  },
])

describePointOperation('translate', [
  {
    input: point(),
    operation: translate(100, 200),
    output: point(100, 200),
  },
  {
    input: point(100, 100),
    operation: translate(200, 300),
    output: point(300, 400),
  },
])

describePointOperation('translateX', [
  {
    input: point(),
    operation: translateX(100),
    output: point(100, 0),
  },
  {
    input: point(100),
    operation: translateX(200),
    output: point(300, 100),
  },
])

describePointOperation('translateY', [
  {
    input: point(),
    operation: translateY(100),
    output: point(0, 100),
  },
  {
    input: point(100),
    operation: translateY(200),
    output: point(100, 300),
  },
])

describePointOperation('add', [
  {
    input: point(0, 100),
    operation: add(point(100, 0)),
    output: point(100, 100),
  },
  {
    input: point(-50, 25),
    operation: add(point(100, 75)),
    output: point(50, 100),
  },
])

describePointOperation('subtract', [
  {
    input: point(0, 100),
    operation: subtract(point(100, 0)),
    output: point(-100, 100),
  },
  {
    input: point(),
    operation: subtract(point(100, 0)),
    output: point(-100, 0),
  },
])

describePointOperation('scale', [
  {
    input: point(2, -3),
    operation: scale(2),
    output: point(4, -6),
  },
  {
    input: point(100, 50),
    operation: scale(0.5),
    output: point(50, 25),
  },
  {
    input: point(100, 50),
    operation: scale(-1),
    output: point(-100, -50),
  },
])

describePointOperation('lerp', [
  {
    input: point(),
    operation: lerp(point(100, 100), 0.5),
    output: point(50, 50),
  },
  {
    input: point(100, 100),
    operation: lerp(point(200, 200), 0),
    output: point(100, 100),
  },
  {
    input: point(100, 100),
    operation: lerp(point(200, 200), 0.5),
    output: point(150, 150),
  },
  {
    input: point(100, 100),
    operation: lerp(point(200, 200), 1),
    output: point(200, 200),
  },
])

describePointOperation('min', [
  {
    input: point(0, 100),
    operation: min(point(100, 0)),
    output: point(0, 0),
  },
  {
    input: point(-100, 50),
    operation: min(point(100, -50)),
    output: point(-100, -50),
  },
])

describePointOperation('max', [
  {
    input: point(0, 100),
    operation: max(point(100, 0)),
    output: point(100, 100),
  },
  {
    input: point(-100, 50),
    operation: max(point(100, -50)),
    output: point(100, 50),
  },
])

describe('data-first forms', () => {
  test('every dual accepts the point as its first argument', () => {
    expect(setX(point(0, 100), 50)).toEqual(point(50, 100))
    expect(setY(point(100, 0), 50)).toEqual(point(100, 50))
    expect(translate(point(1, 2), 10, 20)).toEqual(point(11, 22))
    expect(translateX(point(1, 2), 10)).toEqual(point(11, 2))
    expect(translateY(point(1, 2), 20)).toEqual(point(1, 22))
    expect(add(point(1, 2), point(3, 4))).toEqual(point(4, 6))
    expect(subtract(point(1, 2), point(3, 4))).toEqual(point(-2, -2))
    expect(scale(point(1, 2), 2)).toEqual(point(2, 4))
    expect(lerp(point(0, 0), point(100, 100), 0.5)).toEqual(point(50, 50))
    expect(min(point(0, 100), point(100, 0))).toEqual(point(0, 0))
    expect(max(point(0, 100), point(100, 0))).toEqual(point(100, 100))
  })
})

describe('orbit', () => {
  test('rotates about the center in radians', () => {
    const half = orbit(point(0, 100), point(0, 0), Math.PI)
    expect(half.x).toBeCloseTo(0)
    expect(half.y).toBeCloseTo(-100)

    const quarter = orbit(point(0, 100), point(100, 0), Math.PI / 2)
    expect(quarter.x).toBeCloseTo(0)
    expect(quarter.y).toBeCloseTo(-100)
  })

  test('multi-revolution angles wrap through trig periodicity', () => {
    const result = orbit(point(0, 100), point(100, 0), 2.5 * Math.PI)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(-100)
  })

  test('zero rotation is exact', () => {
    expect(orbit(point(3, 4), point(100, 0), 0)).toEqual(point(3, 4))
  })

  test('data-last form', () => {
    const result = point(0, 100).pipe(orbit(point(0, 0), Math.PI))
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(-100)
  })
})

describePointOperation('avoid', [
  {
    input: point(5, 0),
    operation: avoid(point(0, 0), 10),
    output: point(10, 0),
  },
  {
    input: point(-5, 0),
    operation: avoid(point(0, 0), 10),
    output: point(-10, 0),
  },
  {
    input: point(0, 0),
    operation: avoid(point(0, 0), 10),
    output: point(10, 0),
  },
  {
    input: point(3, 4),
    operation: avoid(point(3, 4), 5),
    output: point(6, 8),
  },
])

describe('avoid semantics', () => {
  test('escapes along the delta direction to exactly the gap distance', () => {
    expect(avoid(point(3, 4), point(0, 0), 10)).toEqual(point(6, 8))
  })

  test('coincident points escape along the ray from the origin', () => {
    const result = avoid(fromPolar(10, Math.PI / 4), fromPolar(10, Math.PI / 4), 10)
    const expected = fromPolar(20, Math.PI / 4)
    expect(result.x).toBeCloseTo(expected.x)
    expect(result.y).toBeCloseTo(expected.y)
  })

  test('points already at least the gap away are untouched', () => {
    const outside = point(20, 0)
    expect(avoid(outside, point(0, 0), 10)).toBe(outside)

    const boundary = point(10, 0)
    expect(avoid(boundary, point(0, 0), 10)).toBe(boundary)
  })

  test('the boundary decision is tolerant of rounding noise, at any magnitude', () => {
    // 0.1 + 0.2 sits an ulp above 0.3; a raw comparison would nudge the point.
    const noisy = point(0.3, 0)
    expect(avoid(noisy, point(0, 0), 0.1 + 0.2)).toBe(noisy)
    // Scale invariance: the same geometry at 1e9 gives the same verdict.
    const large = point(0.3 * 1e9, 0)
    expect(avoid(large, point(0, 0), (0.1 + 0.2) * 1e9)).toBe(large)
  })

  test('data-last form', () => {
    expect(point(5, 0).pipe(avoid(point(0, 0), 10))).toEqual(point(10, 0))
  })
})

describe('normalize', () => {
  test('returns the unit vector', () => {
    expect(normalize(point(100, 0))).toEqual(point(1, 0))
    expect(normalize(point(0, 100))).toEqual(point(0, 1))
    expect(normalize(point(3, 4))).toEqual(point(0.6, 0.8))
  })

  test('the diagonal unit vector', () => {
    const result = normalize(point(100, 100))
    expect(result.x).toBeCloseTo(Math.SQRT1_2, 15)
    expect(result.y).toBeCloseTo(Math.SQRT1_2, 15)
  })

  test('the zero vector has no direction (IEEE 0/0)', () => {
    const result = normalize(point(0, 0))
    expect(result.x).toBeNaN()
    expect(result.y).toBeNaN()
  })
})

describe('distance', () => {
  test('euclidean distance', () => {
    expect(distance(point(0, 0), point(100, 0))).toBe(100)
    expect(distance(point(0, 0), point(0, 100))).toBe(100)
    expect(distance(point(0, 0), point(100, 100))).toBe(Math.hypot(100, 100))
  })

  test('data-last form', () => {
    expect(point(0, 0).pipe(distance(point(100, 0)))).toBe(100)
  })
})

describe('dot', () => {
  test('dot product', () => {
    expect(dot(point(3, 4), point(1, 2))).toBe(11)
    expect(dot(point(5, 0), point(0, 5))).toBe(0)
    expect(dot(point(2, 2), point(1, -1))).toBe(0)
    expect(dot(point(3, 4), point(4, -3))).toBe(0)
  })

  test('data-last form', () => {
    expect(point(3, 4).pipe(dot(point(1, 2)))).toBe(11)
  })
})

describe('cross', () => {
  test('cross product z component', () => {
    expect(cross(point(3, 4), point(1, 2))).toBe(2)
    expect(cross(point(5, 0), point(0, 5))).toBe(25)
    expect(cross(point(2, 2), point(1, -1))).toBe(-4)
    expect(cross(point(3, 4), point(4, -3))).toBe(-25)
  })

  test('data-last form', () => {
    expect(point(3, 4).pipe(cross(point(1, 2)))).toBe(2)
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(equals(point(1, 2), point(1, 2))).toBe(true)
    expect(equals(point(1, 2), point(1, 3))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(equals(point(0.1 + 0.2, 1), point(0.3, 1))).toBe(true)
    expect(equals(point((0.1 + 0.2) * 1e9, 1), point(0.3 * 1e9, 1))).toBe(true)
  })

  test('non-finite coordinates compare exactly (regression: verdicts were inverted)', () => {
    expect(equals(point.infinity, point.infinity)).toBe(true)
    expect(equals(point.infinity, point(100, 100))).toBe(false)
    expect(equals(point(Number.NaN, 1), point(Number.NaN, 1))).toBe(false)
  })

  test('data-last form', () => {
    expect(point(1, 2).pipe(equals(point(1, 2)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits x and y', () => {
    expect(JSON.parse(JSON.stringify(point(5, 10)))).toEqual({ x: 5, y: 10 })
  })
})
