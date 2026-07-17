import { describe, expect, test } from 'vitest'
import { dimensions } from '../src/dimensions.ts'
import {
  type Offset,
  absolute,
  add,
  equals,
  isOffset,
  isOffsetLike,
  lerp,
  negate,
  offset,
  scale,
  setBottom,
  setLeft,
  setRight,
  setTop,
  setX,
  setY,
  subtract,
} from '../src/offset.ts'
import { point } from '../src/point.ts'

interface OffsetCase {
  input: Offset
  operation: (offset: Offset) => Offset
  output: Offset
}

function describeOffsetOperation(name: string, cases: ReadonlyArray<OffsetCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('offset', () => {
  test('one value fills all four sides', () => {
    const result = offset(10)
    expect(result.top).toBe(10)
    expect(result.right).toBe(10)
    expect(result.bottom).toBe(10)
    expect(result.left).toBe(10)
  })

  test('constructions are exact', () => {
    // Regression: the old constructor rounded every field to 8 decimals.
    expect(offset(0.1 + 0.2).top).toBe(0.30000000000000004)
    expect(offset(1e9 + 0.25).left).toBe(1e9 + 0.25)
  })

  test('xy assigns x to the sides and y to the ends', () => {
    expect(offset.xy(10, 20)).toEqual(offset.trbl(20, 10, 20, 10))
  })

  test('trbl falls back in CSS shorthand order', () => {
    expect(offset.trbl(1)).toEqual(offset(1))
    expect(offset.trbl(1, 2)).toEqual(offset.trbl(1, 2, 1, 2))
    expect(offset.trbl(1, 2, 3)).toEqual(offset.trbl(1, 2, 3, 2))
    const result = offset.trbl(1, 2, 3, 4)
    expect(result.top).toBe(1)
    expect(result.right).toBe(2)
    expect(result.bottom).toBe(3)
    expect(result.left).toBe(4)
  })

  test('fromPoint mirrors x and y onto opposing sides', () => {
    expect(offset.fromPoint(point(10, 20))).toEqual(offset.xy(10, 20))
  })

  test('fromDimensions takes half of each dimension', () => {
    expect(offset.fromDimensions(dimensions(100, 50))).toEqual(offset.xy(50, 25))
  })

  test('zero and infinity statics', () => {
    expect(offset.zero).toEqual(offset(0))
    expect(offset.infinity).toEqual(offset(Number.POSITIVE_INFINITY))
  })
})

describe('guards', () => {
  test('isOffset', () => {
    expect(isOffset(offset(0))).toBe(true)
    expect(isOffset({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(false)
    expect(isOffset(null)).toBe(false)
  })

  test('isOffsetLike', () => {
    expect(isOffsetLike(offset(0))).toBe(true)
    expect(isOffsetLike({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(true)
    expect(isOffsetLike({ top: 0, right: 0, bottom: 0 })).toBe(false)
    expect(isOffsetLike({ top: 0, right: 0, bottom: 0, left: 'a' })).toBe(false)
    expect(isOffsetLike(null)).toBe(false)
  })
})

describeOffsetOperation('setTop', [
  {
    input: offset(1),
    operation: setTop(5),
    output: offset.trbl(5, 1, 1, 1),
  },
  {
    input: offset(1),
    operation: (self) => setTop(self, -5),
    output: offset.trbl(-5, 1, 1, 1),
  },
])

describeOffsetOperation('setRight', [
  {
    input: offset(1),
    operation: setRight(5),
    output: offset.trbl(1, 5, 1, 1),
  },
  {
    input: offset(1),
    operation: (self) => setRight(self, -5),
    output: offset.trbl(1, -5, 1, 1),
  },
])

describeOffsetOperation('setBottom', [
  {
    input: offset(1),
    operation: setBottom(5),
    output: offset.trbl(1, 1, 5, 1),
  },
  {
    input: offset(1),
    operation: (self) => setBottom(self, -5),
    output: offset.trbl(1, 1, -5, 1),
  },
])

describeOffsetOperation('setLeft', [
  {
    input: offset(1),
    operation: setLeft(5),
    output: offset.trbl(1, 1, 1, 5),
  },
  {
    input: offset(1),
    operation: (self) => setLeft(self, -5),
    output: offset.trbl(1, 1, 1, -5),
  },
])

describeOffsetOperation('setX', [
  {
    input: offset(1),
    operation: setX(5),
    output: offset.trbl(1, 5, 1, 5),
  },
  {
    input: offset(1),
    operation: (self) => setX(self, -5),
    output: offset.trbl(1, -5, 1, -5),
  },
])

describeOffsetOperation('setY', [
  {
    input: offset(1),
    operation: setY(5),
    output: offset.trbl(5, 1, 5, 1),
  },
  {
    input: offset(1),
    operation: (self) => setY(self, -5),
    output: offset.trbl(-5, 1, -5, 1),
  },
])

describe('add', () => {
  test('a number adds to every side', () => {
    expect(add(offset.trbl(1, 2, 3, 4), 10)).toEqual(offset.trbl(11, 12, 13, 14))
  })

  test('an offset adds per side', () => {
    expect(add(offset.trbl(1, 2, 3, 4), offset.trbl(10, 20, 30, 40))).toEqual(
      offset.trbl(11, 22, 33, 44),
    )
  })

  test('data-last form, with number and offset operands', () => {
    expect(offset(1).pipe(add(10))).toEqual(offset(11))
    expect(offset(1).pipe(add(offset.trbl(10, 20, 30, 40)))).toEqual(offset.trbl(11, 21, 31, 41))
  })
})

describe('subtract', () => {
  test('a number subtracts from every side', () => {
    expect(subtract(offset.trbl(11, 12, 13, 14), 10)).toEqual(offset.trbl(1, 2, 3, 4))
  })

  test('an offset subtracts per side', () => {
    expect(subtract(offset.trbl(11, 22, 33, 44), offset.trbl(10, 20, 30, 40))).toEqual(
      offset.trbl(1, 2, 3, 4),
    )
  })

  test('data-last form, with number and offset operands', () => {
    expect(offset(11).pipe(subtract(10))).toEqual(offset(1))
    expect(offset(11).pipe(subtract(offset.trbl(1, 2, 3, 4)))).toEqual(offset.trbl(10, 9, 8, 7))
  })
})

describe('scale', () => {
  test('multiplies every side', () => {
    expect(scale(offset.trbl(1, 2, 3, 4), 2)).toEqual(offset.trbl(2, 4, 6, 8))
    expect(scale(offset.trbl(1, 2, 3, 4), -1)).toEqual(offset.trbl(-1, -2, -3, -4))
  })

  test('data-last form', () => {
    expect(offset.trbl(1, 2, 3, 4).pipe(scale(0.5))).toEqual(offset.trbl(0.5, 1, 1.5, 2))
  })
})

describe('negate', () => {
  test('flips the sign of every side', () => {
    expect(negate(offset.trbl(1, -2, 3, -4))).toEqual(offset.trbl(-1, 2, -3, 4))
  })

  test('pipe form', () => {
    expect(offset.trbl(1, -2, 3, -4).pipe(negate)).toEqual(offset.trbl(-1, 2, -3, 4))
  })
})

describe('absolute', () => {
  test('takes the magnitude of every side', () => {
    expect(absolute(offset.trbl(1, -2, 3, -4))).toEqual(offset.trbl(1, 2, 3, 4))
  })

  test('pipe form', () => {
    expect(offset.trbl(-1, -2, -3, -4).pipe(absolute)).toEqual(offset.trbl(1, 2, 3, 4))
  })
})

describeOffsetOperation('lerp', [
  {
    input: offset(0),
    operation: lerp(offset.trbl(10, 20, 30, 40), 0),
    output: offset(0),
  },
  {
    input: offset(0),
    operation: lerp(offset.trbl(10, 20, 30, 40), 0.5),
    output: offset.trbl(5, 10, 15, 20),
  },
  {
    input: offset(0),
    operation: (self) => lerp(self, offset.trbl(10, 20, 30, 40), 1),
    output: offset.trbl(10, 20, 30, 40),
  },
])

describe('equals', () => {
  test('exact equality', () => {
    expect(equals(offset.trbl(1, 2, 3, 4), offset.trbl(1, 2, 3, 4))).toBe(true)
    expect(equals(offset.trbl(1, 2, 3, 4), offset.trbl(1, 2, 3, 5))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(equals(offset(0.1 + 0.2), offset(0.3))).toBe(true)
    expect(equals(offset((0.1 + 0.2) * 1e9), offset(0.3 * 1e9))).toBe(true)
  })

  test('non-finite sides compare exactly (regression: verdicts were inverted)', () => {
    expect(equals(offset.infinity, offset.infinity)).toBe(true)
    expect(equals(offset.infinity, offset(100))).toBe(false)
    expect(equals(offset(Number.NaN), offset(Number.NaN))).toBe(false)
  })

  test('data-last form', () => {
    expect(offset(1).pipe(equals(offset(1)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits the four sides', () => {
    expect(JSON.parse(JSON.stringify(offset.trbl(1, 2, 3, 4)))).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    })
  })
})
