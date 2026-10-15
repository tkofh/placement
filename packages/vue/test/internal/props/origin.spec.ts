import * as Point from 'placement/point'
import { describe, expect, test } from 'vitest'
import { type OriginInput, resolveOrigin } from '../../../src/internal/props/origin.ts'

describe('non-string inputs', () => {
  test('a Point passes through by identity', () => {
    const point = Point.make(0.25, 0.75)
    expect(resolveOrigin(point)).toBe(point)
  })

  test('a number fills both components', () => {
    expect(resolveOrigin(0.25)).toEqual(Point.make(0.25, 0.25))
  })

  test('undefined resolves to auto, defaulting to Point.zero', () => {
    expect(resolveOrigin(undefined)).toBe(Point.zero)
    const auto = Point.make(0.5, 0.25)
    expect(resolveOrigin(undefined, auto)).toBe(auto)
  })
})

interface StringCase {
  input: OriginInput
  expected: Point.Point
}

describe('single keywords', () => {
  const cases: ReadonlyArray<StringCase> = [
    { input: 'center', expected: Point.make(0.5, 0.5) },
    { input: 'left', expected: Point.make(0, 0.5) },
    { input: 'right', expected: Point.make(1, 0.5) },
    { input: 'top', expected: Point.make(0.5, 0) },
    { input: 'bottom', expected: Point.make(0.5, 1) },
  ]

  test.each(cases)('$input resolves to $expected', ({ input, expected }) => {
    expect(resolveOrigin(input)).toEqual(expected)
  })
})

describe('single values', () => {
  const cases: ReadonlyArray<StringCase> = [
    { input: '25%', expected: Point.make(0.25, 0.25) },
    { input: '0.25', expected: Point.make(0.25, 0.25) },
  ]

  test.each(cases)('$input fills both components', ({ input, expected }) => {
    expect(resolveOrigin(input)).toEqual(expected)
  })
})

describe('pairs', () => {
  const cases: ReadonlyArray<StringCase> = [
    { input: 'left top', expected: Point.make(0, 0) },
    { input: 'top left', expected: Point.make(0, 0) },
    { input: 'right bottom', expected: Point.make(1, 1) },
    { input: 'center bottom', expected: Point.make(0.5, 1) },
    { input: '25% 75%', expected: Point.make(0.25, 0.75) },
    { input: '0.25 0.75', expected: Point.make(0.25, 0.75) },
    { input: 'left 0.25', expected: Point.make(0, 0.25) },
    { input: 'left 25%', expected: Point.make(0, 0.25) },
    { input: '25% bottom', expected: Point.make(0.25, 1) },
  ]

  test.each(cases)('$input resolves to $expected', ({ input, expected }) => {
    expect(resolveOrigin(input)).toEqual(expected)
  })
})

describe('edge offsets', () => {
  test('left/top offsets measure from the near edges', () => {
    expect(resolveOrigin('left 20% top 30%')).toEqual(Point.make(0.2, 0.3))
  })

  test('right/bottom offsets measure from the far edges', () => {
    expect(resolveOrigin('right 20% bottom 30%')).toEqual(Point.make(0.8, 0.7))
  })

  test('the axes may come in either order', () => {
    expect(resolveOrigin('top 30% left 20%')).toEqual(Point.make(0.2, 0.3))
  })
})

describe('invalid input', () => {
  test.each(['garbage', 'left left', 'left 20% top', ''])('%j falls back to auto', (input) => {
    const auto = Point.make(0.125, 0.375)
    expect(resolveOrigin(input as OriginInput, auto)).toBe(auto)
  })
})
