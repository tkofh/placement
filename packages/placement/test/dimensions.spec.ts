import { describe, expect, test } from 'vitest'
import * as AspectRatio from '../src/aspectRatio.ts'
import * as Dimensions from '../src/dimensions.ts'

describe('make', () => {
  test('zero arguments creates the zero dimensions', () => {
    expect(Dimensions.make()).toEqual(Dimensions.make(0, 0))
    expect(Dimensions.make().width).toBe(0)
    expect(Dimensions.make().height).toBe(0)
  })

  test('one argument is a square size', () => {
    expect(Dimensions.make(100)).toEqual(Dimensions.make(100, 100))
  })

  test('two arguments are width and height', () => {
    const result = Dimensions.make(100, 50)
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })

  test('negative inputs take their magnitude', () => {
    expect(Dimensions.make(-100)).toEqual(Dimensions.make(100, 100))
    expect(Dimensions.make(-100, -50)).toEqual(Dimensions.make(100, 50))
  })

  test('constructions are exact', () => {
    expect(Dimensions.make(0.1, 0.2).width).toBe(0.1)
    expect(Dimensions.make(1e9 + 0.25, 0.5).width).toBe(1e9 + 0.25)
  })

  test('constants', () => {
    expect(Dimensions.zero).toEqual(Dimensions.make(0, 0))
    expect(Dimensions.infinity.width).toBe(Number.POSITIVE_INFINITY)
    expect(Dimensions.infinity.height).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('guards', () => {
  test('isDimensions', () => {
    expect(Dimensions.isDimensions(Dimensions.make())).toBe(true)
    expect(Dimensions.isDimensions({ width: 0, height: 0 })).toBe(false)
    expect(Dimensions.isDimensions(null)).toBe(false)
  })

  test('isDimensionsLike', () => {
    expect(Dimensions.isDimensionsLike(Dimensions.make())).toBe(true)
    expect(Dimensions.isDimensionsLike({ width: 0, height: 0 })).toBe(true)
    expect(Dimensions.isDimensionsLike({ width: 0 })).toBe(false)
    expect(Dimensions.isDimensionsLike(null)).toBe(false)
  })
})

describe('area and aspectRatio', () => {
  test('exact products and quotients', () => {
    expect(Dimensions.make(100, 50).area).toBe(5000)
    expect(Dimensions.make(100, 50).aspectRatio).toBe(2)
    expect(Dimensions.make(0.1, 0.2).area).toBe(0.1 * 0.2)
  })

  test('degenerate divisions return IEEE results', () => {
    expect(Dimensions.make(0, 0).aspectRatio).toBeNaN()
    expect(Dimensions.make(100, 0).aspectRatio).toBe(Number.POSITIVE_INFINITY)
    expect(Dimensions.make(0, 100).aspectRatio).toBe(0)
    expect(Dimensions.make(100, 0).area).toBe(0)
  })
})

describe('setWidth', () => {
  test('replaces the width', () => {
    expect(Dimensions.setWidth(Dimensions.make(), 100)).toEqual(Dimensions.make(100, 0))
    expect(Dimensions.setWidth(Dimensions.make(100), 200)).toEqual(Dimensions.make(200, 100))
  })

  test('data-last form', () => {
    expect(Dimensions.make(100).pipe(Dimensions.setWidth(200))).toEqual(Dimensions.make(200, 100))
  })
})

describe('setHeight', () => {
  test('replaces the height', () => {
    expect(Dimensions.setHeight(Dimensions.make(), 100)).toEqual(Dimensions.make(0, 100))
    expect(Dimensions.setHeight(Dimensions.make(100), 200)).toEqual(Dimensions.make(100, 200))
  })

  test('data-last form', () => {
    expect(Dimensions.make(100).pipe(Dimensions.setHeight(200))).toEqual(Dimensions.make(100, 200))
  })
})

describe('setAspectRatio', () => {
  test('bias 0 keeps the width', () => {
    expect(Dimensions.setAspectRatio(Dimensions.make(100), 2, 0)).toEqual(Dimensions.make(100, 50))
  })

  test('bias 1 keeps the height', () => {
    expect(Dimensions.setAspectRatio(Dimensions.make(100), 2, 1)).toEqual(Dimensions.make(200, 100))
  })

  test('bias defaults to the midpoint of the candidates', () => {
    expect(Dimensions.setAspectRatio(Dimensions.make(100), 2)).toEqual(Dimensions.make(150, 75))
  })

  test('intermediate biases blend the candidates and keep the ratio', () => {
    expect(Dimensions.setAspectRatio(Dimensions.make(100), 2, 0.75)).toEqual(
      Dimensions.make(175, 87.5),
    )
    expect(Dimensions.setAspectRatio(Dimensions.make(100), 2, 0.25)).toEqual(
      Dimensions.make(125, 62.5),
    )
    expect(Dimensions.setAspectRatio(Dimensions.make(100), 2, 0.25).aspectRatio).toBe(2)
  })

  test('data-last form, with and without bias', () => {
    expect(Dimensions.make(100).pipe(Dimensions.setAspectRatio(2))).toEqual(
      Dimensions.make(150, 75),
    )
    expect(Dimensions.make(100).pipe(Dimensions.setAspectRatio(2, 0))).toEqual(
      Dimensions.make(100, 50),
    )
  })
})

describe('clampWidth', () => {
  test.each([
    [Dimensions.make(50), Dimensions.make(100, 50)],
    [Dimensions.make(100), Dimensions.make(100, 100)],
    [Dimensions.make(150), Dimensions.make(150, 150)],
    [Dimensions.make(200), Dimensions.make(200, 200)],
    [Dimensions.make(250), Dimensions.make(200, 250)],
  ] as const)('clampWidth(%j, 100, 200): %j', (input, output) => {
    expect(Dimensions.clampWidth(input, 100, 200)).toEqual(output)
  })

  test('data-last form', () => {
    expect(Dimensions.make(50).pipe(Dimensions.clampWidth(100, 200))).toEqual(
      Dimensions.make(100, 50),
    )
  })
})

describe('clampHeight', () => {
  test.each([
    [Dimensions.make(50), Dimensions.make(50, 100)],
    [Dimensions.make(100), Dimensions.make(100, 100)],
    [Dimensions.make(150), Dimensions.make(150, 150)],
    [Dimensions.make(200), Dimensions.make(200, 200)],
    [Dimensions.make(250), Dimensions.make(250, 200)],
  ] as const)('clampHeight(%j, 100, 200): %j', (input, output) => {
    expect(Dimensions.clampHeight(input, 100, 200)).toEqual(output)
  })

  test('data-last form', () => {
    expect(Dimensions.make(250).pipe(Dimensions.clampHeight(100, 200))).toEqual(
      Dimensions.make(250, 200),
    )
  })
})

describe('clamp', () => {
  const cases: ReadonlyArray<
    readonly [
      Dimensions.Dimensions,
      Dimensions.Dimensions | number,
      Dimensions.Dimensions | number,
      Dimensions.Dimensions,
    ]
  > = [
    [Dimensions.make(50), 100, 200, Dimensions.make(100, 100)],
    [Dimensions.make(50), 100, Dimensions.make(200, 200), Dimensions.make(100, 100)],
    [Dimensions.make(50), Dimensions.make(100, 100), 200, Dimensions.make(100, 100)],
    [
      Dimensions.make(50),
      Dimensions.make(100, 100),
      Dimensions.make(200, 200),
      Dimensions.make(100, 100),
    ],

    [Dimensions.make(100), 100, 200, Dimensions.make(100, 100)],
    [Dimensions.make(100), 100, Dimensions.make(200, 200), Dimensions.make(100, 100)],
    [Dimensions.make(100), Dimensions.make(100, 100), 200, Dimensions.make(100, 100)],
    [
      Dimensions.make(100),
      Dimensions.make(100, 100),
      Dimensions.make(200, 200),
      Dimensions.make(100, 100),
    ],

    [Dimensions.make(150), 100, 200, Dimensions.make(150, 150)],
    [Dimensions.make(150), 100, Dimensions.make(200, 200), Dimensions.make(150, 150)],
    [Dimensions.make(150), Dimensions.make(100, 100), 200, Dimensions.make(150, 150)],
    [
      Dimensions.make(150),
      Dimensions.make(100, 100),
      Dimensions.make(200, 200),
      Dimensions.make(150, 150),
    ],

    [Dimensions.make(200), 100, 200, Dimensions.make(200, 200)],
    [Dimensions.make(200), 100, Dimensions.make(200, 200), Dimensions.make(200, 200)],
    [Dimensions.make(200), Dimensions.make(100, 100), 200, Dimensions.make(200, 200)],
    [
      Dimensions.make(200),
      Dimensions.make(100, 100),
      Dimensions.make(200, 200),
      Dimensions.make(200, 200),
    ],

    [Dimensions.make(250), 100, 200, Dimensions.make(200, 200)],
    [Dimensions.make(250), 100, Dimensions.make(200, 200), Dimensions.make(200, 200)],
    [Dimensions.make(250), Dimensions.make(100, 100), 200, Dimensions.make(200, 200)],
    [
      Dimensions.make(250),
      Dimensions.make(100, 100),
      Dimensions.make(200, 200),
      Dimensions.make(200, 200),
    ],
  ]

  test.each(cases)('clamp(%j, %j, %j): %j', (input, min, max, output) => {
    expect(Dimensions.clamp(input, min, max)).toEqual(output)
  })

  test('the minimum wins when the bounds cross', () => {
    expect(Dimensions.clamp(Dimensions.make(150), 200, 100)).toEqual(Dimensions.make(200, 200))
  })

  test('data-last form', () => {
    expect(Dimensions.make(250).pipe(Dimensions.clamp(100, 200))).toEqual(Dimensions.make(200, 200))
    expect(
      Dimensions.make(50).pipe(
        Dimensions.clamp(Dimensions.make(100, 100), Dimensions.make(200, 200)),
      ),
    ).toEqual(Dimensions.make(100, 100))
  })
})

describe('scale', () => {
  test('a uniform factor scales both dimensions', () => {
    expect(Dimensions.scale(Dimensions.make(100), 2)).toEqual(Dimensions.make(200, 200))
  })

  test('separate x and y factors', () => {
    expect(Dimensions.scale(Dimensions.make(100), 2, 0.5)).toEqual(Dimensions.make(200, 50))
  })

  test('negative factors take their magnitude', () => {
    expect(Dimensions.scale(Dimensions.make(100), -2)).toEqual(Dimensions.make(200, 200))
    expect(Dimensions.scale(Dimensions.make(100), -1)).toEqual(Dimensions.make(100, 100))
  })

  test('data-last form, with one and two factors', () => {
    expect(Dimensions.make(100).pipe(Dimensions.scale(2))).toEqual(Dimensions.make(200, 200))
    expect(Dimensions.make(100).pipe(Dimensions.scale(2, 0.5))).toEqual(Dimensions.make(200, 50))
  })
})

describe('scaleTo', () => {
  test('scales to the target area, preserving the aspect ratio', () => {
    expect(Dimensions.scaleTo(Dimensions.make(100), 40000)).toEqual(Dimensions.make(200, 200))

    const result = Dimensions.scaleTo(Dimensions.make(75, 100), 300)
    expect(result.width).toBeCloseTo(15)
    expect(result.height).toBeCloseTo(20)
    expect(result.area).toBeCloseTo(300)
  })

  test('zero-area inputs produce IEEE results (the old guard is gone)', () => {
    // sqrt(area / 0) is Infinity, and 0 * Infinity is NaN.
    expect(Dimensions.scaleTo(Dimensions.make(0, 0), 256)).toEqual(
      Dimensions.make(Number.NaN, Number.NaN),
    )
    expect(Dimensions.scaleTo(Dimensions.make(0, 100), 256)).toEqual(
      Dimensions.make(Number.NaN, Number.POSITIVE_INFINITY),
    )
  })

  test('data-last form', () => {
    expect(Dimensions.make(100).pipe(Dimensions.scaleTo(40000))).toEqual(Dimensions.make(200, 200))
  })
})

describe('scaleToWidth', () => {
  test('scales proportionally to the target width', () => {
    expect(Dimensions.scaleToWidth(Dimensions.make(100, 50), 200)).toEqual(
      Dimensions.make(200, 100),
    )
    expect(Dimensions.scaleToWidth(Dimensions.make(100, 50), 150)).toEqual(Dimensions.make(150, 75))
  })

  test('zero-width inputs produce IEEE results (no guard)', () => {
    expect(Dimensions.scaleToWidth(Dimensions.make(0, 50), 200)).toEqual(
      Dimensions.make(200, Number.POSITIVE_INFINITY),
    )
    expect(Dimensions.scaleToWidth(Dimensions.make(0, 0), 200)).toEqual(
      Dimensions.make(200, Number.NaN),
    )
  })

  test('data-last form', () => {
    expect(Dimensions.make(100, 50).pipe(Dimensions.scaleToWidth(200))).toEqual(
      Dimensions.make(200, 100),
    )
  })
})

describe('scaleToHeight', () => {
  test('scales proportionally to the target height', () => {
    expect(Dimensions.scaleToHeight(Dimensions.make(100, 50), 200)).toEqual(
      Dimensions.make(400, 200),
    )
    expect(Dimensions.scaleToHeight(Dimensions.make(100, 50), 150)).toEqual(
      Dimensions.make(300, 150),
    )
  })

  test('zero-height inputs produce IEEE results (no guard)', () => {
    expect(Dimensions.scaleToHeight(Dimensions.make(100, 0), 200)).toEqual(
      Dimensions.make(Number.POSITIVE_INFINITY, 200),
    )
    expect(Dimensions.scaleToHeight(Dimensions.make(0, 0), 200)).toEqual(
      Dimensions.make(Number.NaN, 200),
    )
  })

  test('data-last form', () => {
    expect(Dimensions.make(100, 50).pipe(Dimensions.scaleToHeight(200))).toEqual(
      Dimensions.make(400, 200),
    )
  })
})

describe('contain', () => {
  test('square inputs', () => {
    expect(Dimensions.contain(Dimensions.make(100), 2)).toEqual(Dimensions.make(100, 50))
    expect(Dimensions.contain(Dimensions.make(100), 0.5)).toEqual(Dimensions.make(50, 100))
  })

  test('non-square inputs', () => {
    // A ratio wider than the input fits against the width, and a narrower
    // one fits against the height.
    expect(Dimensions.contain(Dimensions.make(100, 50), 4)).toEqual(Dimensions.make(100, 25))
    expect(Dimensions.contain(Dimensions.make(100, 50), 1)).toEqual(Dimensions.make(50, 50))
  })

  test('a coincident ratio keeps the exact extents', () => {
    expect(Dimensions.contain(Dimensions.make(100, 50), 2)).toEqual(Dimensions.make(100, 50))
  })

  test('non-dyadic ratio', () => {
    const result = Dimensions.contain(Dimensions.make(100), 16 / 9)
    expect(result.width).toBe(100)
    expect(result.height).toBeCloseTo(56.25)
  })

  test('zero-extent inputs collapse to zero (regression)', () => {
    // The coincident shortcut used to fire on an Infinity aspect ratio and
    // return the input extents for any finite ratio.
    expect(Dimensions.contain(Dimensions.make(100, 0), 2)).toEqual(Dimensions.make(0, 0))
    expect(Dimensions.contain(Dimensions.make(0, 100), 2)).toEqual(Dimensions.make(0, 0))
    expect(Dimensions.contain(Dimensions.make(0, 0), 2)).toEqual(Dimensions.make(0, 0))
  })

  test('a degenerate ratio identical to the aspect ratio keeps the extents', () => {
    expect(Dimensions.contain(Dimensions.make(100, 0), Number.POSITIVE_INFINITY)).toEqual(
      Dimensions.make(100, 0),
    )
  })

  test('data-last form', () => {
    expect(Dimensions.make(100).pipe(Dimensions.contain(2))).toEqual(Dimensions.make(100, 50))
  })
})

describe('cover', () => {
  test('square inputs', () => {
    expect(Dimensions.cover(Dimensions.make(100), 2)).toEqual(Dimensions.make(200, 100))
    expect(Dimensions.cover(Dimensions.make(100), 0.5)).toEqual(Dimensions.make(100, 200))
  })

  test('wider ratio on a non-square input (regression)', () => {
    // The old implementation returned (400, 100): it multiplied the width by
    // the ratio instead of producing the smallest covering dimensions.
    const result = Dimensions.cover(Dimensions.make(100, 50), 4)
    expect(result).toEqual(Dimensions.make(200, 50))
    expect(result.width).toBeGreaterThanOrEqual(100)
    expect(result.height).toBeGreaterThanOrEqual(50)
    expect(result.aspectRatio).toBe(4)
  })

  test('narrower ratio on a non-square input', () => {
    expect(Dimensions.cover(Dimensions.make(100, 50), 1)).toEqual(Dimensions.make(100, 100))
  })

  test('a coincident ratio keeps the exact extents', () => {
    expect(Dimensions.cover(Dimensions.make(100, 50), 2)).toEqual(Dimensions.make(100, 50))
  })

  test('non-dyadic ratio', () => {
    const result = Dimensions.cover(Dimensions.make(100), 16 / 9)
    expect(result.width).toBeCloseTo(1600 / 9)
    expect(result.height).toBe(100)
  })

  test('zero-extent inputs derive the smallest covering extents (regression)', () => {
    // The coincident shortcut used to fire on an Infinity aspect ratio, so
    // Dimensions.cover(Dimensions.make(100, 0), 2) returned 100x0.
    expect(Dimensions.cover(Dimensions.make(100, 0), 2)).toEqual(Dimensions.make(100, 50))
    expect(Dimensions.cover(Dimensions.make(0, 100), 2)).toEqual(Dimensions.make(200, 100))
    expect(Dimensions.cover(Dimensions.make(0, 0), 2)).toEqual(Dimensions.make(0, 0))
  })

  test('data-last form', () => {
    expect(Dimensions.make(100).pipe(Dimensions.cover(2))).toEqual(Dimensions.make(200, 100))
  })
})

describe('lerp', () => {
  test('interpolates both dimensions', () => {
    expect(Dimensions.lerp(Dimensions.make(100, 100), Dimensions.make(200, 200), 0)).toEqual(
      Dimensions.make(100, 100),
    )
    expect(Dimensions.lerp(Dimensions.make(100, 100), Dimensions.make(200, 200), 0.5)).toEqual(
      Dimensions.make(150, 150),
    )
    expect(Dimensions.lerp(Dimensions.make(100, 100), Dimensions.make(200, 200), 1)).toEqual(
      Dimensions.make(200, 200),
    )
    expect(Dimensions.lerp(Dimensions.make(100, 50), Dimensions.make(200, 150), 0.25)).toEqual(
      Dimensions.make(125, 75),
    )
  })

  test('data-last form', () => {
    expect(Dimensions.make(100).pipe(Dimensions.lerp(Dimensions.make(200, 200), 0.5))).toEqual(
      Dimensions.make(150, 150),
    )
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(Dimensions.equals(Dimensions.make(100, 50), Dimensions.make(100, 50))).toBe(true)
    expect(Dimensions.equals(Dimensions.make(100, 50), Dimensions.make(100, 51))).toBe(false)
  })

  test('accepts any DimensionsLike', () => {
    expect(Dimensions.equals(Dimensions.make(100, 50), { width: 100, height: 50 })).toBe(true)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(Dimensions.equals(Dimensions.make(0.1 + 0.2, 1), Dimensions.make(0.3, 1))).toBe(true)
    expect(
      Dimensions.equals(Dimensions.make((0.1 + 0.2) * 1e9, 1e9), Dimensions.make(0.3 * 1e9, 1e9)),
    ).toBe(true)
  })

  test('non-finite extents compare exactly (regression: verdicts were inverted)', () => {
    // coincident degenerates at Infinity: Dimensions.infinity used to fail
    // reflexivity while comparing equal to any finite dimensions.
    expect(Dimensions.equals(Dimensions.infinity, Dimensions.infinity)).toBe(true)
    expect(Dimensions.equals(Dimensions.infinity, Dimensions.make(100))).toBe(false)
    expect(Dimensions.equals(Dimensions.make(Number.NaN, 1), Dimensions.make(Number.NaN, 1))).toBe(
      false,
    )
  })

  test('data-last form', () => {
    expect(Dimensions.make(100, 50).pipe(Dimensions.equals(Dimensions.make(100, 50)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits width and height', () => {
    expect(JSON.parse(JSON.stringify(Dimensions.make(5, 10)))).toEqual({ width: 5, height: 10 })
  })
})

describe('aspect ratio pairs', () => {
  const r169 = AspectRatio.make(16, 9)

  test.each([
    {
      name: 'contain keeps the width',
      self: Dimensions.make(160, 100),
      expected: Dimensions.make(160, 90),
    },
    {
      name: 'contain keeps the height',
      self: Dimensions.make(400, 7),
      expected: Dimensions.make(112 / 9, 7),
    },
  ])('$name', ({ self, expected }) => {
    expect(Dimensions.contain(self, r169)).toEqual(expected)
    expect(self.pipe(Dimensions.contain(r169))).toEqual(expected)
  })

  test.each([
    {
      name: 'cover grows the width',
      self: Dimensions.make(1, 7),
      expected: Dimensions.make(112 / 9, 7),
    },
    {
      name: 'cover grows the height',
      self: Dimensions.make(160, 1),
      expected: Dimensions.make(160, 90),
    },
  ])('$name', ({ self, expected }) => {
    expect(Dimensions.cover(self, r169)).toEqual(expected)
    expect(self.pipe(Dimensions.cover(r169))).toEqual(expected)
  })

  test('setAspectRatio takes a pair in both forms', () => {
    expect(Dimensions.setAspectRatio(Dimensions.make(160, 7), r169, 0)).toEqual(
      Dimensions.make(160, 90),
    )
    expect(Dimensions.make(160, 7).pipe(Dimensions.setAspectRatio(r169, 1))).toEqual(
      Dimensions.make(112 / 9, 7),
    )
  })

  test('a ratio over 1 behaves as its number', () => {
    const self = Dimensions.make(100, 7)
    for (const ratio of [16 / 9, 0.3, 30]) {
      const pair = AspectRatio.make(ratio)
      expect(Dimensions.contain(self, pair)).toEqual(Dimensions.contain(self, ratio))
      expect(Dimensions.cover(self, pair)).toEqual(Dimensions.cover(self, ratio))
      expect(Dimensions.setAspectRatio(self, pair)).toEqual(Dimensions.setAspectRatio(self, ratio))
    }
  })
})
