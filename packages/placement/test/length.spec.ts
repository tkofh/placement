import { describe, expect, test } from 'vitest'
import * as Length from '../src/length.ts'

describe('constructors', () => {
  test('make defaults to pixels', () => {
    expect(Length.make(10)).toEqual(Length.px(10))
    expect(Length.make(10).unit).toBe('px')
    expect(Length.make(50, '%')).toEqual(Length.percent(50))
  })

  test('make rejects an unknown unit', () => {
    expect(() => Length.make(10, 'em' as Length.Unit)).toThrow(RangeError)
  })

  test('percent keeps the number before the percent sign', () => {
    expect(Length.percent(50).value).toBe(50)
    expect(Length.percent(50).unit).toBe('%')
  })

  test('zero is zero pixels', () => {
    expect(Length.zero).toEqual(Length.px(0))
  })

  test('toString and toJSON', () => {
    expect(Length.px(10).toString()).toBe('10px')
    expect(Length.percent(12.5).toString()).toBe('12.5%')
    expect(JSON.parse(JSON.stringify(Length.percent(50)))).toEqual({ value: 50, unit: '%' })
  })
})

describe('guards', () => {
  test.each([
    { value: Length.px(1), expected: true },
    { value: Length.percent(1), expected: true },
    { value: 1, expected: false },
    { value: { value: 1, unit: 'px' }, expected: false },
    { value: null, expected: false },
  ])('isLength($value) is $expected', ({ value, expected }) => {
    expect(Length.isLength(value)).toBe(expected)
  })

  test.each([
    { input: Length.percent(50), expected: true },
    { input: Length.px(50), expected: false },
    { input: 50, expected: false },
  ])('isPercent($input) is $expected', ({ input, expected }) => {
    expect(Length.isPercent(input)).toBe(expected)
  })
})

describe('resolve', () => {
  test.each([
    { input: 10, basis: 200, expected: 10 },
    { input: -10, basis: 200, expected: -10 },
    { input: Length.px(10), basis: 200, expected: 10 },
    { input: Length.percent(50), basis: 200, expected: 100 },
    { input: Length.percent(25), basis: 8, expected: 2 },
    { input: Length.percent(12.5), basis: 64, expected: 8 },
    { input: Length.percent(150), basis: 4, expected: 6 },
    { input: Length.percent(-50), basis: 200, expected: -100 },
    { input: Length.percent(0), basis: 200, expected: 0 },
  ])('$input of $basis is $expected', ({ input, basis, expected }) => {
    expect(Length.resolve(input, basis)).toBe(expected)
    expect(Length.resolve(basis)(input)).toBe(expected)
  })

  test('the pipe form resolves a length', () => {
    expect(Length.percent(50).pipe(Length.resolve(300))).toBe(150)
  })

  test('an absolute length does not read its basis', () => {
    expect(Length.resolve(10, Number.NaN)).toBe(10)
    expect(Length.resolve(Length.px(10), Number.NaN)).toBe(10)
  })

  test('non-finite bases propagate through a percentage', () => {
    expect(Length.resolve(Length.percent(50), Number.NaN)).toBeNaN()
    expect(Length.resolve(Length.percent(50), Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    )
    expect(Length.resolve(Length.percent(0), Number.POSITIVE_INFINITY)).toBeNaN()
  })

  test('integer inputs give the correctly rounded quotient', () => {
    // basis * 7 is exact, so the one rounding is the division's.
    expect(Length.resolve(Length.percent(7), 1)).toBe(0.07)
    expect(Length.resolve(Length.percent(33), 10)).toBe(3.3)
  })

  test('non-dyadic percentages land close to the exact value', () => {
    expect(Length.resolve(Length.percent(10), 0.3)).toBeCloseTo(0.03, 15)
  })
})

describe('equals', () => {
  test.each([
    { a: Length.px(10), b: Length.px(10), expected: true },
    { a: Length.percent(50), b: Length.percent(50), expected: true },
    { a: Length.px(0.1 + 0.2), b: Length.px(0.3), expected: true },
    { a: Length.px(50), b: Length.percent(50), expected: false },
    { a: Length.px(10), b: Length.px(11), expected: false },
    { a: Length.px(Number.NaN), b: Length.px(Number.NaN), expected: false },
    {
      a: Length.px(Number.POSITIVE_INFINITY),
      b: Length.px(Number.POSITIVE_INFINITY),
      expected: true,
    },
  ])('$a equals $b is $expected', ({ a, b, expected }) => {
    expect(Length.equals(a, b)).toBe(expected)
    expect(a.pipe(Length.equals(b))).toBe(expected)
  })
})
