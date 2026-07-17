import { describe, expect, test } from 'vitest'
import * as Dimensions from '../src/dimensions.ts'
import * as Offset from '../src/offset.ts'
import * as Point from '../src/point.ts'

interface OffsetCase {
  input: Offset.Offset
  operation: (offset: Offset.Offset) => Offset.Offset
  output: Offset.Offset
}

function describeOffsetOperation(name: string, cases: ReadonlyArray<OffsetCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('constructors', () => {
  test('make fills all four sides with one value', () => {
    const result = Offset.make(10)
    expect(result.top).toBe(10)
    expect(result.right).toBe(10)
    expect(result.bottom).toBe(10)
    expect(result.left).toBe(10)
  })

  test('constructions are exact', () => {
    // Regression: the old constructor rounded every field to 8 decimals.
    expect(Offset.make(0.1 + 0.2).top).toBe(0.30000000000000004)
    expect(Offset.make(1e9 + 0.25).left).toBe(1e9 + 0.25)
  })

  test('xy assigns x to the sides and y to the ends', () => {
    expect(Offset.xy(10, 20)).toEqual(Offset.trbl(20, 10, 20, 10))
  })

  test('trbl falls back in CSS shorthand order', () => {
    expect(Offset.trbl(1)).toEqual(Offset.make(1))
    expect(Offset.trbl(1, 2)).toEqual(Offset.trbl(1, 2, 1, 2))
    expect(Offset.trbl(1, 2, 3)).toEqual(Offset.trbl(1, 2, 3, 2))
    const result = Offset.trbl(1, 2, 3, 4)
    expect(result.top).toBe(1)
    expect(result.right).toBe(2)
    expect(result.bottom).toBe(3)
    expect(result.left).toBe(4)
  })

  test('fromPoint mirrors x and y onto opposing sides', () => {
    expect(Offset.fromPoint(Point.make(10, 20))).toEqual(Offset.xy(10, 20))
  })

  test('fromDimensions takes half of each dimension', () => {
    expect(Offset.fromDimensions(Dimensions.make(100, 50))).toEqual(Offset.xy(50, 25))
  })

  test('zero and infinity constants', () => {
    expect(Offset.zero).toEqual(Offset.make(0))
    expect(Offset.infinity).toEqual(Offset.make(Number.POSITIVE_INFINITY))
  })
})

describe('guards', () => {
  test('isOffset', () => {
    expect(Offset.isOffset(Offset.make(0))).toBe(true)
    expect(Offset.isOffset({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(false)
    expect(Offset.isOffset(null)).toBe(false)
  })

  test('isOffsetLike', () => {
    expect(Offset.isOffsetLike(Offset.make(0))).toBe(true)
    expect(Offset.isOffsetLike({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(true)
    expect(Offset.isOffsetLike({ top: 0, right: 0, bottom: 0 })).toBe(false)
    expect(Offset.isOffsetLike({ top: 0, right: 0, bottom: 0, left: 'a' })).toBe(false)
    expect(Offset.isOffsetLike(null)).toBe(false)
  })
})

describeOffsetOperation('setTop', [
  {
    input: Offset.make(1),
    operation: Offset.setTop(5),
    output: Offset.trbl(5, 1, 1, 1),
  },
  {
    input: Offset.make(1),
    operation: (self) => Offset.setTop(self, -5),
    output: Offset.trbl(-5, 1, 1, 1),
  },
])

describeOffsetOperation('setRight', [
  {
    input: Offset.make(1),
    operation: Offset.setRight(5),
    output: Offset.trbl(1, 5, 1, 1),
  },
  {
    input: Offset.make(1),
    operation: (self) => Offset.setRight(self, -5),
    output: Offset.trbl(1, -5, 1, 1),
  },
])

describeOffsetOperation('setBottom', [
  {
    input: Offset.make(1),
    operation: Offset.setBottom(5),
    output: Offset.trbl(1, 1, 5, 1),
  },
  {
    input: Offset.make(1),
    operation: (self) => Offset.setBottom(self, -5),
    output: Offset.trbl(1, 1, -5, 1),
  },
])

describeOffsetOperation('setLeft', [
  {
    input: Offset.make(1),
    operation: Offset.setLeft(5),
    output: Offset.trbl(1, 1, 1, 5),
  },
  {
    input: Offset.make(1),
    operation: (self) => Offset.setLeft(self, -5),
    output: Offset.trbl(1, 1, 1, -5),
  },
])

describeOffsetOperation('setX', [
  {
    input: Offset.make(1),
    operation: Offset.setX(5),
    output: Offset.trbl(1, 5, 1, 5),
  },
  {
    input: Offset.make(1),
    operation: (self) => Offset.setX(self, -5),
    output: Offset.trbl(1, -5, 1, -5),
  },
])

describeOffsetOperation('setY', [
  {
    input: Offset.make(1),
    operation: Offset.setY(5),
    output: Offset.trbl(5, 1, 5, 1),
  },
  {
    input: Offset.make(1),
    operation: (self) => Offset.setY(self, -5),
    output: Offset.trbl(-5, 1, -5, 1),
  },
])

describe('add', () => {
  test('a number adds to every side', () => {
    expect(Offset.add(Offset.trbl(1, 2, 3, 4), 10)).toEqual(Offset.trbl(11, 12, 13, 14))
  })

  test('an offset adds per side', () => {
    expect(Offset.add(Offset.trbl(1, 2, 3, 4), Offset.trbl(10, 20, 30, 40))).toEqual(
      Offset.trbl(11, 22, 33, 44),
    )
  })

  test('data-last form, with number and offset operands', () => {
    expect(Offset.make(1).pipe(Offset.add(10))).toEqual(Offset.make(11))
    expect(Offset.make(1).pipe(Offset.add(Offset.trbl(10, 20, 30, 40)))).toEqual(
      Offset.trbl(11, 21, 31, 41),
    )
  })
})

describe('subtract', () => {
  test('a number subtracts from every side', () => {
    expect(Offset.subtract(Offset.trbl(11, 12, 13, 14), 10)).toEqual(Offset.trbl(1, 2, 3, 4))
  })

  test('an offset subtracts per side', () => {
    expect(Offset.subtract(Offset.trbl(11, 22, 33, 44), Offset.trbl(10, 20, 30, 40))).toEqual(
      Offset.trbl(1, 2, 3, 4),
    )
  })

  test('data-last form, with number and offset operands', () => {
    expect(Offset.make(11).pipe(Offset.subtract(10))).toEqual(Offset.make(1))
    expect(Offset.make(11).pipe(Offset.subtract(Offset.trbl(1, 2, 3, 4)))).toEqual(
      Offset.trbl(10, 9, 8, 7),
    )
  })
})

describe('scale', () => {
  test('multiplies every side', () => {
    expect(Offset.scale(Offset.trbl(1, 2, 3, 4), 2)).toEqual(Offset.trbl(2, 4, 6, 8))
    expect(Offset.scale(Offset.trbl(1, 2, 3, 4), -1)).toEqual(Offset.trbl(-1, -2, -3, -4))
  })

  test('data-last form', () => {
    expect(Offset.trbl(1, 2, 3, 4).pipe(Offset.scale(0.5))).toEqual(Offset.trbl(0.5, 1, 1.5, 2))
  })
})

describe('negate', () => {
  test('flips the sign of every side', () => {
    expect(Offset.negate(Offset.trbl(1, -2, 3, -4))).toEqual(Offset.trbl(-1, 2, -3, 4))
  })

  test('pipe form', () => {
    expect(Offset.trbl(1, -2, 3, -4).pipe(Offset.negate)).toEqual(Offset.trbl(-1, 2, -3, 4))
  })
})

describe('absolute', () => {
  test('takes the magnitude of every side', () => {
    expect(Offset.absolute(Offset.trbl(1, -2, 3, -4))).toEqual(Offset.trbl(1, 2, 3, 4))
  })

  test('pipe form', () => {
    expect(Offset.trbl(-1, -2, -3, -4).pipe(Offset.absolute)).toEqual(Offset.trbl(1, 2, 3, 4))
  })
})

describeOffsetOperation('lerp', [
  {
    input: Offset.make(0),
    operation: Offset.lerp(Offset.trbl(10, 20, 30, 40), 0),
    output: Offset.make(0),
  },
  {
    input: Offset.make(0),
    operation: Offset.lerp(Offset.trbl(10, 20, 30, 40), 0.5),
    output: Offset.trbl(5, 10, 15, 20),
  },
  {
    input: Offset.make(0),
    operation: (self) => Offset.lerp(self, Offset.trbl(10, 20, 30, 40), 1),
    output: Offset.trbl(10, 20, 30, 40),
  },
])

describe('equals', () => {
  test('exact equality', () => {
    expect(Offset.equals(Offset.trbl(1, 2, 3, 4), Offset.trbl(1, 2, 3, 4))).toBe(true)
    expect(Offset.equals(Offset.trbl(1, 2, 3, 4), Offset.trbl(1, 2, 3, 5))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(Offset.equals(Offset.make(0.1 + 0.2), Offset.make(0.3))).toBe(true)
    expect(Offset.equals(Offset.make((0.1 + 0.2) * 1e9), Offset.make(0.3 * 1e9))).toBe(true)
  })

  test('non-finite sides compare exactly (regression: verdicts were inverted)', () => {
    expect(Offset.equals(Offset.infinity, Offset.infinity)).toBe(true)
    expect(Offset.equals(Offset.infinity, Offset.make(100))).toBe(false)
    expect(Offset.equals(Offset.make(Number.NaN), Offset.make(Number.NaN))).toBe(false)
  })

  test('data-last form', () => {
    expect(Offset.make(1).pipe(Offset.equals(Offset.make(1)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits the four sides', () => {
    expect(JSON.parse(JSON.stringify(Offset.trbl(1, 2, 3, 4)))).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    })
  })
})
