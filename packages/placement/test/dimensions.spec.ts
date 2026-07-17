import { describe, expect, test } from 'vitest'
import {
  type Dimensions,
  clamp,
  clampHeight,
  clampWidth,
  contain,
  cover,
  dimensions,
  equals,
  isDimensions,
  isDimensionsLike,
  lerp,
  scale,
  scaleTo,
  scaleToHeight,
  scaleToWidth,
  setAspectRatio,
  setHeight,
  setWidth,
} from '../src/dimensions.ts'

describe('dimensions', () => {
  test('zero arguments creates the zero dimensions', () => {
    expect(dimensions()).toEqual(dimensions(0, 0))
    expect(dimensions().width).toBe(0)
    expect(dimensions().height).toBe(0)
  })

  test('one argument is a square size', () => {
    expect(dimensions(100)).toEqual(dimensions(100, 100))
  })

  test('two arguments are width and height', () => {
    const result = dimensions(100, 50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('negative inputs take their magnitude', () => {
    expect(dimensions(-100)).toEqual(dimensions(100, 100))
    expect(dimensions(-100, -50)).toEqual(dimensions(100, 50))
  })

  test('constructions are exact', () => {
    expect(dimensions(0.1, 0.2).width).toBe(0.1)
    expect(dimensions(1e9 + 0.25, 0.5).width).toBe(1e9 + 0.25)
  })

  test('statics', () => {
    expect(dimensions.zero).toEqual(dimensions(0, 0))
    expect(dimensions.infinity.width).toBe(Number.POSITIVE_INFINITY)
    expect(dimensions.infinity.height).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('guards', () => {
  test('isDimensions', () => {
    expect(isDimensions(dimensions())).toBe(true)
    expect(isDimensions({ width: 0, height: 0 })).toBe(false)
    expect(isDimensions(null)).toBe(false)
  })

  test('isDimensionsLike', () => {
    expect(isDimensionsLike(dimensions())).toBe(true)
    expect(isDimensionsLike({ width: 0, height: 0 })).toBe(true)
    expect(isDimensionsLike({ width: 0 })).toBe(false)
    expect(isDimensionsLike(null)).toBe(false)
  })
})

describe('area and aspectRatio', () => {
  test('exact products and quotients', () => {
    expect(dimensions(100, 50).area).toBe(5000)
    expect(dimensions(100, 50).aspectRatio).toBe(2)
    expect(dimensions(0.1, 0.2).area).toBe(0.1 * 0.2)
  })

  test('degenerate divisions return IEEE results', () => {
    expect(dimensions(0, 0).aspectRatio).toBeNaN()
    expect(dimensions(100, 0).aspectRatio).toBe(Number.POSITIVE_INFINITY)
    expect(dimensions(0, 100).aspectRatio).toBe(0)
    expect(dimensions(100, 0).area).toBe(0)
  })
})

describe('setWidth', () => {
  test('replaces the width', () => {
    expect(setWidth(dimensions(), 100)).toEqual(dimensions(100, 0))
    expect(setWidth(dimensions(100), 200)).toEqual(dimensions(200, 100))
  })

  test('data-last form', () => {
    expect(dimensions(100).pipe(setWidth(200))).toEqual(dimensions(200, 100))
  })
})

describe('setHeight', () => {
  test('replaces the height', () => {
    expect(setHeight(dimensions(), 100)).toEqual(dimensions(0, 100))
    expect(setHeight(dimensions(100), 200)).toEqual(dimensions(100, 200))
  })

  test('data-last form', () => {
    expect(dimensions(100).pipe(setHeight(200))).toEqual(dimensions(100, 200))
  })
})

describe('setAspectRatio', () => {
  test('bias 0 keeps the width', () => {
    expect(setAspectRatio(dimensions(100), 2, 0)).toEqual(dimensions(100, 50))
  })

  test('bias 1 keeps the height', () => {
    expect(setAspectRatio(dimensions(100), 2, 1)).toEqual(dimensions(200, 100))
  })

  test('bias defaults to the midpoint of the candidates', () => {
    expect(setAspectRatio(dimensions(100), 2)).toEqual(dimensions(150, 75))
  })

  test('intermediate biases blend the candidates and keep the ratio', () => {
    expect(setAspectRatio(dimensions(100), 2, 0.75)).toEqual(dimensions(175, 87.5))
    expect(setAspectRatio(dimensions(100), 2, 0.25)).toEqual(dimensions(125, 62.5))
    expect(setAspectRatio(dimensions(100), 2, 0.25).aspectRatio).toBe(2)
  })

  test('data-last form, with and without bias', () => {
    expect(dimensions(100).pipe(setAspectRatio(2))).toEqual(dimensions(150, 75))
    expect(dimensions(100).pipe(setAspectRatio(2, 0))).toEqual(dimensions(100, 50))
  })
})

describe('clampWidth', () => {
  test.each([
    [dimensions(50), dimensions(100, 50)],
    [dimensions(100), dimensions(100, 100)],
    [dimensions(150), dimensions(150, 150)],
    [dimensions(200), dimensions(200, 200)],
    [dimensions(250), dimensions(200, 250)],
  ] as const)('clampWidth(%j, 100, 200): %j', (input, output) => {
    expect(clampWidth(input, 100, 200)).toEqual(output)
  })

  test('data-last form', () => {
    expect(dimensions(50).pipe(clampWidth(100, 200))).toEqual(dimensions(100, 50))
  })
})

describe('clampHeight', () => {
  test.each([
    [dimensions(50), dimensions(50, 100)],
    [dimensions(100), dimensions(100, 100)],
    [dimensions(150), dimensions(150, 150)],
    [dimensions(200), dimensions(200, 200)],
    [dimensions(250), dimensions(250, 200)],
  ] as const)('clampHeight(%j, 100, 200): %j', (input, output) => {
    expect(clampHeight(input, 100, 200)).toEqual(output)
  })

  test('data-last form', () => {
    expect(dimensions(250).pipe(clampHeight(100, 200))).toEqual(dimensions(250, 200))
  })
})

describe('clamp', () => {
  const cases: ReadonlyArray<
    readonly [Dimensions, Dimensions | number, Dimensions | number, Dimensions]
  > = [
    [dimensions(50), 100, 200, dimensions(100, 100)],
    [dimensions(50), 100, dimensions(200, 200), dimensions(100, 100)],
    [dimensions(50), dimensions(100, 100), 200, dimensions(100, 100)],
    [dimensions(50), dimensions(100, 100), dimensions(200, 200), dimensions(100, 100)],

    [dimensions(100), 100, 200, dimensions(100, 100)],
    [dimensions(100), 100, dimensions(200, 200), dimensions(100, 100)],
    [dimensions(100), dimensions(100, 100), 200, dimensions(100, 100)],
    [dimensions(100), dimensions(100, 100), dimensions(200, 200), dimensions(100, 100)],

    [dimensions(150), 100, 200, dimensions(150, 150)],
    [dimensions(150), 100, dimensions(200, 200), dimensions(150, 150)],
    [dimensions(150), dimensions(100, 100), 200, dimensions(150, 150)],
    [dimensions(150), dimensions(100, 100), dimensions(200, 200), dimensions(150, 150)],

    [dimensions(200), 100, 200, dimensions(200, 200)],
    [dimensions(200), 100, dimensions(200, 200), dimensions(200, 200)],
    [dimensions(200), dimensions(100, 100), 200, dimensions(200, 200)],
    [dimensions(200), dimensions(100, 100), dimensions(200, 200), dimensions(200, 200)],

    [dimensions(250), 100, 200, dimensions(200, 200)],
    [dimensions(250), 100, dimensions(200, 200), dimensions(200, 200)],
    [dimensions(250), dimensions(100, 100), 200, dimensions(200, 200)],
    [dimensions(250), dimensions(100, 100), dimensions(200, 200), dimensions(200, 200)],
  ]

  test.each(cases)('clamp(%j, %j, %j): %j', (input, min, max, output) => {
    expect(clamp(input, min, max)).toEqual(output)
  })

  test('the minimum wins when the bounds cross', () => {
    expect(clamp(dimensions(150), 200, 100)).toEqual(dimensions(200, 200))
  })

  test('data-last form', () => {
    expect(dimensions(250).pipe(clamp(100, 200))).toEqual(dimensions(200, 200))
    expect(dimensions(50).pipe(clamp(dimensions(100, 100), dimensions(200, 200)))).toEqual(
      dimensions(100, 100),
    )
  })
})

describe('scale', () => {
  test('a uniform factor scales both dimensions', () => {
    expect(scale(dimensions(100), 2)).toEqual(dimensions(200, 200))
  })

  test('separate x and y factors', () => {
    expect(scale(dimensions(100), 2, 0.5)).toEqual(dimensions(200, 50))
  })

  test('negative factors take their magnitude', () => {
    expect(scale(dimensions(100), -2)).toEqual(dimensions(200, 200))
    expect(scale(dimensions(100), -1)).toEqual(dimensions(100, 100))
  })

  test('data-last form, with one and two factors', () => {
    expect(dimensions(100).pipe(scale(2))).toEqual(dimensions(200, 200))
    expect(dimensions(100).pipe(scale(2, 0.5))).toEqual(dimensions(200, 50))
  })
})

describe('scaleTo', () => {
  test('scales to the target area, preserving the aspect ratio', () => {
    expect(scaleTo(dimensions(100), 40000)).toEqual(dimensions(200, 200))

    const result = scaleTo(dimensions(75, 100), 300)
    expect(result.width).toBeCloseTo(15)
    expect(result.height).toBeCloseTo(20)
    expect(result.area).toBeCloseTo(300)
  })

  test('zero-area inputs produce IEEE results (the old guard is gone)', () => {
    // sqrt(area / 0) is Infinity, and 0 * Infinity is NaN.
    expect(scaleTo(dimensions(0, 0), 256)).toEqual(dimensions(Number.NaN, Number.NaN))
    expect(scaleTo(dimensions(0, 100), 256)).toEqual(
      dimensions(Number.NaN, Number.POSITIVE_INFINITY),
    )
  })

  test('data-last form', () => {
    expect(dimensions(100).pipe(scaleTo(40000))).toEqual(dimensions(200, 200))
  })
})

describe('scaleToWidth', () => {
  test('scales proportionally to the target width', () => {
    expect(scaleToWidth(dimensions(100, 50), 200)).toEqual(dimensions(200, 100))
    expect(scaleToWidth(dimensions(100, 50), 150)).toEqual(dimensions(150, 75))
  })

  test('zero-width inputs produce IEEE results (no guard)', () => {
    expect(scaleToWidth(dimensions(0, 50), 200)).toEqual(dimensions(200, Number.POSITIVE_INFINITY))
    expect(scaleToWidth(dimensions(0, 0), 200)).toEqual(dimensions(200, Number.NaN))
  })

  test('data-last form', () => {
    expect(dimensions(100, 50).pipe(scaleToWidth(200))).toEqual(dimensions(200, 100))
  })
})

describe('scaleToHeight', () => {
  test('scales proportionally to the target height', () => {
    expect(scaleToHeight(dimensions(100, 50), 200)).toEqual(dimensions(400, 200))
    expect(scaleToHeight(dimensions(100, 50), 150)).toEqual(dimensions(300, 150))
  })

  test('zero-height inputs produce IEEE results (no guard)', () => {
    expect(scaleToHeight(dimensions(100, 0), 200)).toEqual(
      dimensions(Number.POSITIVE_INFINITY, 200),
    )
    expect(scaleToHeight(dimensions(0, 0), 200)).toEqual(dimensions(Number.NaN, 200))
  })

  test('data-last form', () => {
    expect(dimensions(100, 50).pipe(scaleToHeight(200))).toEqual(dimensions(400, 200))
  })
})

describe('contain', () => {
  test('square inputs', () => {
    expect(contain(dimensions(100), 2)).toEqual(dimensions(100, 50))
    expect(contain(dimensions(100), 0.5)).toEqual(dimensions(50, 100))
  })

  test('non-square inputs', () => {
    // A ratio wider than the input fits against the width, narrower fits
    // against the height.
    expect(contain(dimensions(100, 50), 4)).toEqual(dimensions(100, 25))
    expect(contain(dimensions(100, 50), 1)).toEqual(dimensions(50, 50))
  })

  test('a coincident ratio keeps the exact extents', () => {
    expect(contain(dimensions(100, 50), 2)).toEqual(dimensions(100, 50))
  })

  test('non-dyadic ratio', () => {
    const result = contain(dimensions(100), 16 / 9)
    expect(result.width).toBe(100)
    expect(result.height).toBeCloseTo(56.25)
  })

  test('data-last form', () => {
    expect(dimensions(100).pipe(contain(2))).toEqual(dimensions(100, 50))
  })
})

describe('cover', () => {
  test('square inputs', () => {
    expect(cover(dimensions(100), 2)).toEqual(dimensions(200, 100))
    expect(cover(dimensions(100), 0.5)).toEqual(dimensions(100, 200))
  })

  test('wider ratio on a non-square input (regression)', () => {
    // The old implementation returned (400, 100): it multiplied the width by
    // the ratio instead of producing the smallest covering dimensions.
    const result = cover(dimensions(100, 50), 4)
    expect(result).toEqual(dimensions(200, 50))
    expect(result.width).toBeGreaterThanOrEqual(100)
    expect(result.height).toBeGreaterThanOrEqual(50)
    expect(result.aspectRatio).toBe(4)
  })

  test('narrower ratio on a non-square input', () => {
    expect(cover(dimensions(100, 50), 1)).toEqual(dimensions(100, 100))
  })

  test('a coincident ratio keeps the exact extents', () => {
    expect(cover(dimensions(100, 50), 2)).toEqual(dimensions(100, 50))
  })

  test('non-dyadic ratio', () => {
    const result = cover(dimensions(100), 16 / 9)
    expect(result.width).toBeCloseTo(1600 / 9)
    expect(result.height).toBe(100)
  })

  test('data-last form', () => {
    expect(dimensions(100).pipe(cover(2))).toEqual(dimensions(200, 100))
  })
})

describe('lerp', () => {
  test('interpolates both dimensions', () => {
    expect(lerp(dimensions(100, 100), dimensions(200, 200), 0)).toEqual(dimensions(100, 100))
    expect(lerp(dimensions(100, 100), dimensions(200, 200), 0.5)).toEqual(dimensions(150, 150))
    expect(lerp(dimensions(100, 100), dimensions(200, 200), 1)).toEqual(dimensions(200, 200))
    expect(lerp(dimensions(100, 50), dimensions(200, 150), 0.25)).toEqual(dimensions(125, 75))
  })

  test('data-last form', () => {
    expect(dimensions(100).pipe(lerp(dimensions(200, 200), 0.5))).toEqual(dimensions(150, 150))
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(equals(dimensions(100, 50), dimensions(100, 50))).toBe(true)
    expect(equals(dimensions(100, 50), dimensions(100, 51))).toBe(false)
  })

  test('accepts any DimensionsLike', () => {
    expect(equals(dimensions(100, 50), { width: 100, height: 50 })).toBe(true)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(equals(dimensions(0.1 + 0.2, 1), dimensions(0.3, 1))).toBe(true)
    expect(equals(dimensions((0.1 + 0.2) * 1e9, 1e9), dimensions(0.3 * 1e9, 1e9))).toBe(true)
  })

  test('data-last form', () => {
    expect(dimensions(100, 50).pipe(equals(dimensions(100, 50)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits width and height', () => {
    expect(JSON.parse(JSON.stringify(dimensions(5, 10)))).toEqual({ width: 5, height: 10 })
  })
})
