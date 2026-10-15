import { describe, expect, test } from 'vitest'
import { type Size1DInput, resolveSize1D } from '../../../src/internal/props/size1d.ts'

describe('numbers', () => {
  test.each([
    { input: 42, expected: 42 },
    { input: 0.5, expected: 0.5 },
    { input: 0, expected: 0 },
    { input: -12, expected: -12 },
  ])('number input $input passes through untouched', ({ input, expected }) => {
    expect(resolveSize1D(input, 7, 100)).toBe(expected)
  })
})

describe('undefined', () => {
  test('resolves to auto', () => {
    expect(resolveSize1D(undefined, 7, 100)).toBe(7)
  })
})

describe('strings', () => {
  interface StringCase {
    input: Size1DInput
    basis: number
    expected: number
  }

  const cases: ReadonlyArray<StringCase> = [
    { input: 'auto', basis: 100, expected: 7 },
    { input: '10px', basis: 100, expected: 10 },
    { input: '-10px', basis: 100, expected: -10 },
    { input: '50%', basis: 200, expected: 100 },
    { input: '25%', basis: 8, expected: 2 },
    { input: '0%', basis: 100, expected: 0 },
    { input: '12', basis: 100, expected: 12 },
    { input: '0.5', basis: 100, expected: 0.5 },
  ]

  test.each(cases)('$input (basis $basis) resolves to $expected', ({ input, basis, expected }) => {
    expect(resolveSize1D(input, 7, basis)).toBe(expected)
  })

  // Bare numbers parse with `min: 0`, so a negative needs a unit ('-10px'
  // above) to survive. The cast is deliberate. The declared input type
  // excludes malformed strings, but the runtime must absorb them.
  test.each(['-12', 'garbage', '10em', '10 20', ''])(
    'invalid input %j falls back to auto',
    (input) => {
      expect(resolveSize1D(input as Size1DInput, 7, 100)).toBe(7)
    },
  )
})

describe('normalization cache', () => {
  test('the same string resolved against different bases does not collide', () => {
    expect(resolveSize1D('50%', 0, 200)).toBe(100)
    expect(resolveSize1D('50%', 0, 100)).toBe(50)
    expect(resolveSize1D('50%', 0, 200)).toBe(100)
  })

  test('the same string resolved with different autos does not collide', () => {
    expect(resolveSize1D('auto', 3, 100)).toBe(3)
    expect(resolveSize1D('auto', 5, 100)).toBe(5)
    expect(resolveSize1D('auto', 3, 100)).toBe(3)
  })
})
