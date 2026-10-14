import * as Point from 'placement/point'
import { describe, expect, test } from 'vitest'
import { type RadiusInput, resolveRadius } from '../../../src/internal/props/radius.ts'

const auto = Point.make(1, 2)

describe('non-string inputs', () => {
  test('a number fills both components', () => {
    expect(resolveRadius(10, auto, 200, 100)).toEqual(Point.make(10, 10))
  })

  test('a negative number passes through: the number branch precedes validation', () => {
    expect(resolveRadius(-5, auto, 200, 100)).toEqual(Point.make(-5, -5))
  })

  test('a Point passes through by identity', () => {
    const point = Point.make(3, 4)
    expect(resolveRadius(point, auto, 200, 100)).toBe(point)
  })

  test('undefined resolves to auto by identity', () => {
    expect(resolveRadius(undefined, auto, 200, 100)).toBe(auto)
  })
})

describe('strings', () => {
  interface StringCase {
    input: RadiusInput
    expected: Point.Point
  }

  const cases: ReadonlyArray<StringCase> = [
    { input: '10', expected: Point.make(10, 10) },
    { input: '10 20', expected: Point.make(10, 20) },
    { input: '10px 20px', expected: Point.make(10, 20) },
    { input: '50% 25%', expected: Point.make(100, 25) },
    { input: '10px 25%', expected: Point.make(10, 25) },
  ]

  test.each(cases)('$input resolves to $expected', ({ input, expected }) => {
    expect(resolveRadius(input, auto, 200, 100)).toEqual(expected)
  })

  test('a single percentage resolves against the width for both components', () => {
    // y copies the width-resolved x; it is not re-resolved against the height.
    expect(resolveRadius('50%', auto, 200, 100)).toEqual(Point.make(100, 100))
  })

  test('the auto keyword resolves each component with a hardcoded 0, not the auto argument', () => {
    expect(resolveRadius('auto', auto, 200, 100)).toEqual(Point.make(0, 0))
    expect(resolveRadius('auto 10', auto, 200, 100)).toEqual(Point.make(0, 10))
  })

  // The radius grammar clamps at zero in both branches, so negatives are
  // invalid even with a unit (unlike size1d).
  test.each(['garbage', '-5', '-10px', '10 20 30'])('invalid %j falls back to auto', (input) => {
    expect(resolveRadius(input as RadiusInput, auto, 200, 100)).toBe(auto)
  })
})

describe('cache', () => {
  test('the same string resolved against different parents does not collide', () => {
    expect(resolveRadius('50%', auto, 200, 100)).toEqual(Point.make(100, 100))
    expect(resolveRadius('50%', auto, 400, 100)).toEqual(Point.make(200, 200))
  })
})
