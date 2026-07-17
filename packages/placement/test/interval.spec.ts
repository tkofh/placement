import { describe, expect, test } from 'vitest'
import {
  type Interval,
  alignTo,
  avoid,
  contains,
  equals,
  intersect,
  intersects,
  interval,
  isInterval,
  isIntervalLike,
  join,
  lerp,
  normalize,
  remap,
  scale,
  scaleFrom,
  setEnd,
  setSize,
  setStart,
  translate,
} from '../src/interval.ts'

interface IntervalCase {
  input: Interval
  operation: (interval: Interval) => Interval
  output: Interval
}

function describeIntervalOperation(name: string, cases: ReadonlyArray<IntervalCase>) {
  describe(name, () => {
    test.each(cases)(`${name}($input): $output`, ({ input, operation, output }) => {
      const result = operation(input)
      expect(result).toEqual(output)
    })
  })
}

describe('interval', () => {
  test('zero arguments creates the zero interval', () => {
    expect(interval()).toEqual(interval(0, 0))
    expect(interval().size).toBe(0)
  })

  test('one argument is a size', () => {
    expect(interval(100)).toEqual(interval(0, 100))
  })

  test('two arguments are start and size', () => {
    const result = interval(50, 100)
    expect(result.start).toBe(50)
    expect(result.size).toBe(100)
    expect(result.end).toBe(150)
  })

  test('constructions are exact', () => {
    expect(interval(0.1, 0.2).start).toBe(0.1)
    expect(interval(1e9 + 0.25, 0.5).end).toBe(1e9 + 0.75)
  })

  test('min and max normalize negative sizes', () => {
    const negative = interval(100, -60)
    expect(negative.min).toBe(40)
    expect(negative.max).toBe(100)
  })
})

describe('guards', () => {
  test('isInterval', () => {
    expect(isInterval(interval())).toBe(true)
    expect(isInterval({ start: 0, size: 1 })).toBe(false)
    expect(isInterval(null)).toBe(false)
  })

  test('isIntervalLike', () => {
    expect(isIntervalLike(interval())).toBe(true)
    expect(isIntervalLike({ start: 0, size: 1 })).toBe(true)
    expect(isIntervalLike({ start: 0 })).toBe(false)
    expect(isIntervalLike(null)).toBe(false)
  })
})

describeIntervalOperation('setStart', [
  {
    input: interval(0, 100),
    operation: setStart(50),
    output: interval(50, 100),
  },
  {
    input: interval(0, 100),
    operation: setStart(-50),
    output: interval(-50, 100),
  },
])

describeIntervalOperation('setSize', [
  {
    input: interval(0, 100),
    operation: setSize(50),
    output: interval(0, 50),
  },
  {
    input: interval(0, 100),
    operation: setSize(50, 0.5),
    output: interval(25, 50),
  },
  {
    input: interval(0, 100),
    operation: setSize(50, 1),
    output: interval(50, 50),
  },
])

describeIntervalOperation('setEnd', [
  {
    input: interval(0, 100),
    operation: setEnd(50),
    output: interval(-50, 100),
  },
  {
    input: interval(0, 100),
    operation: setEnd(-50),
    output: interval(-150, 100),
  },
])

describeIntervalOperation('translate', [
  {
    input: interval(0, 100),
    operation: translate(50),
    output: interval(50, 100),
  },
  {
    input: interval(0, 100),
    operation: translate(-50),
    output: interval(-50, 100),
  },
])

describeIntervalOperation('scale', [
  {
    input: interval(0, 100),
    operation: scale(2),
    output: interval(0, 200),
  },
  {
    input: interval(0, 100),
    operation: scale(2, 1),
    output: interval(-100, 200),
  },
])

describeIntervalOperation('scaleFrom', [
  {
    input: interval(100, 100),
    operation: scaleFrom(2, 100),
    output: interval(100, 200),
  },
  {
    input: interval(100, 100),
    operation: scaleFrom(2, 0),
    output: interval(200, 200),
  },
  {
    input: interval(100, 100),
    operation: scaleFrom(2, 200),
    output: interval(0, 200),
  },
])

describeIntervalOperation('lerp', [
  {
    input: interval(0, 100),
    operation: lerp(interval(0, 100), 0),
    output: interval(0, 100),
  },
  {
    input: interval(0, 100),
    operation: lerp(interval(100, 50), 0.5),
    output: interval(50, 75),
  },
  {
    input: interval(0, 100),
    operation: lerp(interval(100, 100), 1),
    output: interval(100, 100),
  },
])

describeIntervalOperation('normalize', [
  {
    input: interval(0, 100),
    operation: normalize(interval(0, 100)),
    output: interval(0, 1),
  },
  {
    input: interval(0, 100),
    operation: normalize(interval(100, 100)),
    output: interval(-1, 1),
  },
  {
    input: interval(25, 50),
    operation: normalize(interval(0, 100)),
    output: interval(0.25, 0.5),
  },
])

describeIntervalOperation('remap', [
  {
    input: interval(0, 100),
    operation: remap(interval(0, 100), interval(100, 100)),
    output: interval(100, 100),
  },
  {
    input: interval(0, 50),
    operation: remap(interval(100, 100), interval(0, 100)),
    output: interval(-100, 50),
  },
])

describe('alignTo', () => {
  test('aligns to a position (regression: this form used to misroute)', () => {
    const result = alignTo(interval(0, 100), 50, 0)
    expect(isInterval(result)).toBe(true)
    expect(result).toEqual(interval(50, 100))
    expect(alignTo(interval(0, 100), 50, 0.5)).toEqual(interval(0, 100))
    expect(alignTo(interval(0, 100), 50, 1)).toEqual(interval(-50, 100))
  })

  test('aligns to an interval by origin', () => {
    expect(alignTo(interval(0, 100), interval(200, 50), 0)).toEqual(interval(200, 100))
    expect(alignTo(interval(0, 100), interval(200, 50), 1)).toEqual(interval(150, 100))
  })

  test('data-last form, with number and interval targets', () => {
    expect(interval(0, 100).pipe(alignTo(50, 1))).toEqual(interval(-50, 100))
    expect(interval(0, 100).pipe(alignTo(interval(200, 50), 0))).toEqual(interval(200, 100))
  })
})

describeIntervalOperation('avoid', [
  {
    input: interval(0, 100),
    operation: avoid(50, 0),
    output: interval(-50, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(60, 0),
    output: interval(-40, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(40, 0),
    output: interval(40, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(10, 10),
    output: interval(20, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(0, 100), 0),
    output: interval(-100, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(0, 50), 0),
    output: interval(50, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(50, 50), 0),
    output: interval(-50, 100),
  },
  {
    input: interval(0, 100),
    operation: avoid(interval(0, 10), 10),
    output: interval(20, 100),
  },
])

describe('avoid partial overlap (regression)', () => {
  test('an interval overlapping the start of the forbidden zone escapes below it', () => {
    // Old implementation returned [-20, 80], still overlapping [0, 100].
    const result = avoid(interval(-60, 100), interval(0, 100), 0)
    expect(result).toEqual(interval(-100, 100))
    expect(result.max <= 0 || result.min >= 100).toBe(true)
  })

  test('an interval overlapping the end of the forbidden zone escapes above it', () => {
    const result = avoid(interval(60, 100), interval(0, 100), 0)
    expect(result).toEqual(interval(100, 100))
  })

  test('non-overlapping intervals are untouched', () => {
    const source = interval(200, 50)
    expect(avoid(source, interval(0, 100), 0)).toBe(source)
  })
})

describe('join', () => {
  test('returns the enclosing hull', () => {
    expect(join(interval(0, 100), interval(150, 50))).toEqual(interval(0, 200))
    expect(join(interval(50, 50), interval(0, 200))).toEqual(interval(0, 200))
  })

  test('data-last form', () => {
    expect(interval(0, 100).pipe(join(interval(-50, 25)))).toEqual(interval(-50, 150))
  })
})

describe('intersect', () => {
  test('returns the overlap', () => {
    expect(intersect(interval(0, 100), interval(50, 100))).toEqual(interval(50, 50))
  })

  test('disjoint intervals collapse to the midpoint of the gap', () => {
    expect(intersect(interval(0, 100), interval(200, 100))).toEqual(interval(150, 0))
  })

  test('data-last form', () => {
    expect(interval(0, 100).pipe(intersect(interval(50, 100)))).toEqual(interval(50, 50))
  })
})

describe('contains', () => {
  test('positions', () => {
    expect(contains(interval(0, 100), 50)).toBe(true)
    expect(contains(interval(0, 100), 0)).toBe(true)
    expect(contains(interval(0, 100), 100)).toBe(true)
    expect(contains(interval(0, 100), -1)).toBe(false)
    expect(contains(interval(0, 100), 101)).toBe(false)
  })

  test('intervals', () => {
    expect(contains(interval(0, 100), interval(25, 50))).toBe(true)
    expect(contains(interval(0, 100), interval(50, 100))).toBe(false)
  })

  test('boundaries are tolerant of rounding noise', () => {
    // 0.1 + 0.2 sits an ulp above 0.3, outside the raw bounds; only the
    // tolerance band admits it.
    expect(contains(interval(0, 0.3), 0.1 + 0.2)).toBe(true)
    // Scale invariance: the same geometry at 1e9 gives the same verdict.
    expect(contains(interval(0, 0.3 * 1e9), (0.1 + 0.2) * 1e9)).toBe(true)
  })

  test('infinite extents do not blow the tolerance band up (regression)', () => {
    // The band used to become Infinity, accepting every position.
    expect(contains(interval(0, Number.POSITIVE_INFINITY), -1)).toBe(false)
    expect(contains(interval(0, Number.POSITIVE_INFINITY), 5)).toBe(true)
  })

  test('data-last form', () => {
    expect(interval(0, 100).pipe(contains(50))).toBe(true)
  })
})

describe('intersects', () => {
  test('detects overlap', () => {
    expect(intersects(interval(0, 100), interval(50, 100))).toBe(true)
    expect(intersects(interval(0, 100), interval(100, 50))).toBe(true)
    expect(intersects(interval(0, 100), interval(150, 50))).toBe(false)
  })

  test('infinite extents do not blow the tolerance band up (regression)', () => {
    // Spans -15..-5, clear of 0..Infinity; the band used to be Infinity.
    expect(intersects(interval(0, Number.POSITIVE_INFINITY), interval(-15, 10))).toBe(false)
    // Spans -5..5, overlapping 0..Infinity.
    expect(intersects(interval(0, Number.POSITIVE_INFINITY), interval(-5, 10))).toBe(true)
  })

  test('data-last form', () => {
    expect(interval(0, 100).pipe(intersects(interval(150, 50)))).toBe(false)
  })
})

describe('equals', () => {
  test('exact equality', () => {
    expect(equals(interval(0, 100), interval(0, 100))).toBe(true)
    expect(equals(interval(0, 100), interval(0, 101))).toBe(false)
  })

  test('tolerant of rounding noise, at any magnitude', () => {
    expect(equals(interval(0.1 + 0.2, 1), interval(0.3, 1))).toBe(true)
    expect(equals(interval((0.1 + 0.2) * 1e9, 1e9), interval(0.3 * 1e9, 1e9))).toBe(true)
  })

  test('non-finite fields compare exactly (regression: verdicts were inverted)', () => {
    // coincident degenerates at Infinity: reflexivity used to fail while
    // infinite-vs-finite passed.
    expect(
      equals(interval(0, Number.POSITIVE_INFINITY), interval(0, Number.POSITIVE_INFINITY)),
    ).toBe(true)
    expect(equals(interval(0, Number.POSITIVE_INFINITY), interval(0, 100))).toBe(false)
    expect(equals(interval(Number.NaN, 1), interval(Number.NaN, 1))).toBe(false)
  })

  test('data-last form', () => {
    expect(interval(0, 100).pipe(equals(interval(0, 100)))).toBe(true)
  })
})

describe('serialization', () => {
  test('toJSON emits start and size', () => {
    expect(JSON.parse(JSON.stringify(interval(5, 10)))).toEqual({ start: 5, size: 10 })
  })
})
