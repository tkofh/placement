import { describe, expect, test } from 'vitest'
import * as Interval from '../src/interval.ts'

interface IntervalCase {
  input: Interval.Interval
  operation: (self: Interval.Interval) => Interval.Interval
  output: Interval.Interval
}

function describeIntervalOperation(name: string, cases: ReadonlyArray<IntervalCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('make', () => {
  test('zero arguments creates the zero interval', () => {
    expect(Interval.make()).toEqual(Interval.make(0, 0))
    expect(Interval.make().size).toBe(0)
  })

  test('one argument is a size', () => {
    expect(Interval.make(100)).toEqual(Interval.make(0, 100))
  })

  test('two arguments are start and size', () => {
    const result = Interval.make(50, 100)
    expect(result.start).toBe(50)
    expect(result.size).toBe(100)
    expect(result.end).toBe(150)
  })

  test('constructions are exact', () => {
    expect(Interval.make(0.1, 0.2).start).toBe(0.1)
    expect(Interval.make(1e9 + 0.25, 0.5).end).toBe(1e9 + 0.75)
  })

  test('min and max normalize negative sizes', () => {
    const negative = Interval.make(100, -60)
    expect(negative.min).toBe(40)
    expect(negative.max).toBe(100)
  })
})

describe('guards', () => {
  test('isInterval', () => {
    expect(Interval.isInterval(Interval.make())).toBe(true)
    expect(Interval.isInterval({ start: 0, size: 1 })).toBe(false)
    expect(Interval.isInterval(null)).toBe(false)
  })

  test('isIntervalLike', () => {
    expect(Interval.isIntervalLike(Interval.make())).toBe(true)
    expect(Interval.isIntervalLike({ start: 0, size: 1 })).toBe(true)
    expect(Interval.isIntervalLike({ start: 0 })).toBe(false)
    expect(Interval.isIntervalLike(null)).toBe(false)
  })
})

describeIntervalOperation('setStart', [
  {
    input: Interval.make(0, 100),
    operation: Interval.setStart(50),
    output: Interval.make(50, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.setStart(-50),
    output: Interval.make(-50, 100),
  },
])

describeIntervalOperation('setSize', [
  {
    input: Interval.make(0, 100),
    operation: Interval.setSize(50),
    output: Interval.make(0, 50),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.setSize(50, 0.5),
    output: Interval.make(25, 50),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.setSize(50, 1),
    output: Interval.make(50, 50),
  },
])

describeIntervalOperation('setEnd', [
  {
    input: Interval.make(0, 100),
    operation: Interval.setEnd(50),
    output: Interval.make(-50, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.setEnd(-50),
    output: Interval.make(-150, 100),
  },
])

describeIntervalOperation('translate', [
  {
    input: Interval.make(0, 100),
    operation: Interval.translate(50),
    output: Interval.make(50, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.translate(-50),
    output: Interval.make(-50, 100),
  },
])

describeIntervalOperation('scale', [
  {
    input: Interval.make(0, 100),
    operation: Interval.scale(2),
    output: Interval.make(0, 200),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.scale(2, 1),
    output: Interval.make(-100, 200),
  },
])

describeIntervalOperation('scaleFrom', [
  {
    input: Interval.make(100, 100),
    operation: Interval.scaleFrom(2, 100),
    output: Interval.make(100, 200),
  },
  {
    input: Interval.make(100, 100),
    operation: Interval.scaleFrom(2, 0),
    output: Interval.make(200, 200),
  },
  {
    input: Interval.make(100, 100),
    operation: Interval.scaleFrom(2, 200),
    output: Interval.make(0, 200),
  },
])

describeIntervalOperation('lerp', [
  {
    input: Interval.make(0, 100),
    operation: Interval.lerp(Interval.make(0, 100), 0),
    output: Interval.make(0, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.lerp(Interval.make(100, 50), 0.5),
    output: Interval.make(50, 75),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.lerp(Interval.make(100, 100), 1),
    output: Interval.make(100, 100),
  },
])

describeIntervalOperation('normalize', [
  {
    input: Interval.make(0, 100),
    operation: Interval.normalize(Interval.make(0, 100)),
    output: Interval.make(0, 1),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.normalize(Interval.make(100, 100)),
    output: Interval.make(-1, 1),
  },
  {
    input: Interval.make(25, 50),
    operation: Interval.normalize(Interval.make(0, 100)),
    output: Interval.make(0.25, 0.5),
  },
])

describeIntervalOperation('remap', [
  {
    input: Interval.make(0, 100),
    operation: Interval.remap(Interval.make(0, 100), Interval.make(100, 100)),
    output: Interval.make(100, 100),
  },
  {
    input: Interval.make(0, 50),
    operation: Interval.remap(Interval.make(100, 100), Interval.make(0, 100)),
    output: Interval.make(-100, 50),
  },
])

describe('alignTo', () => {
  test('aligns to a position (regression: this form used to misroute)', () => {
    const result = Interval.alignTo(Interval.make(0, 100), 50, 0)
    expect(Interval.isInterval(result)).toBe(true)
    expect(result).toEqual(Interval.make(50, 100))
    expect(Interval.alignTo(Interval.make(0, 100), 50, 0.5)).toEqual(Interval.make(0, 100))
    expect(Interval.alignTo(Interval.make(0, 100), 50, 1)).toEqual(Interval.make(-50, 100))
  })

  test('aligns to an interval by origin', () => {
    expect(Interval.alignTo(Interval.make(0, 100), Interval.make(200, 50), 0)).toEqual(
      Interval.make(200, 100),
    )
    expect(Interval.alignTo(Interval.make(0, 100), Interval.make(200, 50), 1)).toEqual(
      Interval.make(150, 100),
    )
  })

  test('data-last form, with number and interval targets', () => {
    expect(Interval.make(0, 100).pipe(Interval.alignTo(50, 1))).toEqual(Interval.make(-50, 100))
    expect(Interval.make(0, 100).pipe(Interval.alignTo(Interval.make(200, 50), 0))).toEqual(
      Interval.make(200, 100),
    )
  })
})

describeIntervalOperation('avoid', [
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(50, 0),
    output: Interval.make(-50, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(60, 0),
    output: Interval.make(-40, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(40, 0),
    output: Interval.make(40, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(10, 10),
    output: Interval.make(20, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(Interval.make(0, 100), 0),
    output: Interval.make(-100, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(Interval.make(0, 50), 0),
    output: Interval.make(50, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(Interval.make(50, 50), 0),
    output: Interval.make(-50, 100),
  },
  {
    input: Interval.make(0, 100),
    operation: Interval.avoid(Interval.make(0, 10), 10),
    output: Interval.make(20, 100),
  },
])

describe('avoid partial overlap (regression)', () => {
  test('an interval overlapping the start of the forbidden zone escapes below it', () => {
    // Old implementation returned [-20, 80], still overlapping [0, 100].
    const result = Interval.avoid(Interval.make(-60, 100), Interval.make(0, 100), 0)
    expect(result).toEqual(Interval.make(-100, 100))
    expect(result.max <= 0 || result.min >= 100).toBe(true)
  })

  test('an interval overlapping the end of the forbidden zone escapes above it', () => {
    const result = Interval.avoid(Interval.make(60, 100), Interval.make(0, 100), 0)
    expect(result).toEqual(Interval.make(100, 100))
  })

  test('non-overlapping intervals are untouched', () => {
    const source = Interval.make(200, 50)
    expect(Interval.avoid(source, Interval.make(0, 100), 0)).toBe(source)
  })
})

describe('join', () => {
  test('returns the enclosing hull', () => {
    expect(Interval.join(Interval.make(0, 100), Interval.make(150, 50))).toEqual(
      Interval.make(0, 200),
    )
    expect(Interval.join(Interval.make(50, 50), Interval.make(0, 200))).toEqual(
      Interval.make(0, 200),
    )
  })

  test('data-last form', () => {
    expect(Interval.make(0, 100).pipe(Interval.join(Interval.make(-50, 25)))).toEqual(
      Interval.make(-50, 150),
    )
  })
})

describe('intersect', () => {
  test('returns the overlap', () => {
    expect(Interval.intersect(Interval.make(0, 100), Interval.make(50, 100))).toEqual(
      Interval.make(50, 50),
    )
  })

  test('disjoint intervals collapse to the midpoint of the gap', () => {
    expect(Interval.intersect(Interval.make(0, 100), Interval.make(200, 100))).toEqual(
      Interval.make(150, 0),
    )
  })

  test('data-last form', () => {
    expect(Interval.make(0, 100).pipe(Interval.intersect(Interval.make(50, 100)))).toEqual(
      Interval.make(50, 50),
    )
  })
})

describe('contains', () => {
  test('positions', () => {
    expect(Interval.contains(Interval.make(0, 100), 50)).toBe(true)
    expect(Interval.contains(Interval.make(0, 100), 0)).toBe(true)
    expect(Interval.contains(Interval.make(0, 100), 100)).toBe(true)
    expect(Interval.contains(Interval.make(0, 100), -1)).toBe(false)
    expect(Interval.contains(Interval.make(0, 100), 101)).toBe(false)
  })

  test('intervals', () => {
    expect(Interval.contains(Interval.make(0, 100), Interval.make(25, 50))).toBe(true)
    expect(Interval.contains(Interval.make(0, 100), Interval.make(50, 100))).toBe(false)
  })

  test('boundaries are tolerant of rounding noise', () => {
    // 0.1 + 0.2 sits an ulp above 0.3, outside the raw bounds; only the
    // tolerance band admits it.
    expect(Interval.contains(Interval.make(0, 0.3), 0.1 + 0.2)).toBe(true)
    // Scale invariance: the same geometry at 1e9 gives the same verdict.
    expect(Interval.contains(Interval.make(0, 0.3 * 1e9), (0.1 + 0.2) * 1e9)).toBe(true)
  })

  test('infinite extents do not blow the tolerance band up (regression)', () => {
    // The band used to become Infinity, accepting every position.
    expect(Interval.contains(Interval.make(0, Number.POSITIVE_INFINITY), -1)).toBe(false)
    expect(Interval.contains(Interval.make(0, Number.POSITIVE_INFINITY), 5)).toBe(true)
  })

  test('data-last form', () => {
    expect(Interval.make(0, 100).pipe(Interval.contains(50))).toBe(true)
  })
})

describe('intersects', () => {
  test('detects overlap', () => {
    expect(Interval.intersects(Interval.make(0, 100), Interval.make(50, 100))).toBe(true)
    expect(Interval.intersects(Interval.make(0, 100), Interval.make(100, 50))).toBe(true)
    expect(Interval.intersects(Interval.make(0, 100), Interval.make(150, 50))).toBe(false)
  })

  test('infinite extents do not blow the tolerance band up (regression)', () => {
    // Spans -15..-5, clear of 0..Infinity; the band used to be Infinity.
    expect(
      Interval.intersects(Interval.make(0, Number.POSITIVE_INFINITY), Interval.make(-15, 10)),
    ).toBe(false)
    // Spans -5..5, overlapping 0..Infinity.
    expect(
      Interval.intersects(Interval.make(0, Number.POSITIVE_INFINITY), Interval.make(-5, 10)),
    ).toBe(true)
  })

  test('data-last form', () => {
    expect(Interval.make(0, 100).pipe(Interval.intersects(Interval.make(150, 50)))).toBe(false)
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(Interval.equals(Interval.make(0, 100), Interval.make(0, 100))).toBe(true)
    expect(Interval.equals(Interval.make(0, 100), Interval.make(0, 101))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(Interval.equals(Interval.make(0.1 + 0.2, 1), Interval.make(0.3, 1))).toBe(true)
    expect(
      Interval.equals(Interval.make((0.1 + 0.2) * 1e9, 1e9), Interval.make(0.3 * 1e9, 1e9)),
    ).toBe(true)
  })

  test('non-finite fields compare exactly (regression: verdicts were inverted)', () => {
    // coincident degenerates at Infinity: reflexivity used to fail while
    // infinite-vs-finite passed.
    expect(
      Interval.equals(
        Interval.make(0, Number.POSITIVE_INFINITY),
        Interval.make(0, Number.POSITIVE_INFINITY),
      ),
    ).toBe(true)
    expect(Interval.equals(Interval.make(0, Number.POSITIVE_INFINITY), Interval.make(0, 100))).toBe(
      false,
    )
    expect(Interval.equals(Interval.make(Number.NaN, 1), Interval.make(Number.NaN, 1))).toBe(false)
  })

  test('data-last form', () => {
    expect(Interval.make(0, 100).pipe(Interval.equals(Interval.make(0, 100)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits start and size', () => {
    expect(JSON.parse(JSON.stringify(Interval.make(5, 10)))).toEqual({ start: 5, size: 10 })
  })
})
