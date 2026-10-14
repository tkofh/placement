import { describe, expect, test } from 'vitest'
import { type GapInput, type GapValue, resolveGap } from '../../../src/internal/props/gap.ts'

describe('non-string inputs', () => {
  test('a number fills both gaps', () => {
    expect(resolveGap(10, 1, 2, 400, 200)).toEqual({ rowGap: 10, columnGap: 10 })
  })

  test('undefined resolves to the per-axis autos', () => {
    expect(resolveGap(undefined, 1, 2, 400, 200)).toEqual({ rowGap: 1, columnGap: 2 })
  })
})

describe('strings', () => {
  interface StringCase {
    input: GapInput
    expected: GapValue
  }

  const cases: ReadonlyArray<StringCase> = [
    { input: '10', expected: { rowGap: 10, columnGap: 10 } },
    { input: '10 20', expected: { rowGap: 10, columnGap: 20 } },
    { input: '10px 20px', expected: { rowGap: 10, columnGap: 20 } },
    // row resolves against the height, column against the width (CSS gap).
    { input: '10% 20%', expected: { rowGap: 20, columnGap: 80 } },
    // Gap values are unbounded in both grammar branches, unlike size1d's
    // `min: 0` bare numbers and radius's fully clamped grammar.
    { input: '-10', expected: { rowGap: -10, columnGap: -10 } },
    { input: '-10px', expected: { rowGap: -10, columnGap: -10 } },
  ]

  test.each(cases)('$input resolves to $expected', ({ input, expected }) => {
    expect(resolveGap(input, 1, 2, 400, 200)).toEqual(expected)
  })

  test('a single percentage resolves against the height for both gaps', () => {
    // columnGap copies the height-resolved rowGap; it never sees the width.
    expect(resolveGap('50%', 1, 2, 400, 200)).toEqual({ rowGap: 100, columnGap: 100 })
  })

  // 'auto' is not in the gap grammar.
  test.each(['garbage', 'auto', '10 20 30', ''])('invalid %j falls back to the autos', (input) => {
    expect(resolveGap(input as GapInput, 1, 2, 400, 200)).toEqual({ rowGap: 1, columnGap: 2 })
  })
})
