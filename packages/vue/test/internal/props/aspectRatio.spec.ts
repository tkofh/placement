import { describe, expect, test } from 'vitest'
import {
  type AspectRatioInput,
  resolveAspectRatio,
} from '../../../src/internal/props/aspectRatio.ts'

describe('numbers', () => {
  test.each([
    { input: 1.5, expected: 1.5 },
    { input: 0, expected: 0 },
    { input: -2, expected: -2 },
  ])('number input $input passes through untouched', ({ input, expected }) => {
    expect(resolveAspectRatio(input, 1)).toBe(expected)
  })
})

describe('undefined', () => {
  test('resolves to auto', () => {
    expect(resolveAspectRatio(undefined, 2)).toBe(2)
  })

  test('auto defaults to positive infinity', () => {
    expect(resolveAspectRatio(undefined)).toBe(Number.POSITIVE_INFINITY)
    expect(resolveAspectRatio('auto')).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('strings', () => {
  interface StringCase {
    input: AspectRatioInput
    expected: number
  }

  // The declared ratio template wants spaces around the slash; the runtime
  // tokenizer does not, hence the casts on the compact forms.
  const cases: ReadonlyArray<StringCase> = [
    { input: '3 / 2', expected: 1.5 },
    { input: '3/2' as AspectRatioInput, expected: 1.5 },
    { input: '2', expected: 2 },
    { input: '1.5', expected: 1.5 },
  ]

  test.each(cases)('$input resolves to $expected', ({ input, expected }) => {
    expect(resolveAspectRatio(input, 1)).toBe(expected)
  })

  test('16/9 resolves to the ratio, with or without spaces around the slash', () => {
    expect(resolveAspectRatio('16/9' as AspectRatioInput, 1)).toBeCloseTo(16 / 9, 12)
    expect(resolveAspectRatio('16 / 9', 1)).toBeCloseTo(16 / 9, 12)
  })

  // A zero numerator is degenerate too, not just a zero denominator.
  test.each(['auto', '1/0', '0/5', 'garbage'])('%j falls back to auto', (input) => {
    expect(resolveAspectRatio(input as AspectRatioInput, 4)).toBe(4)
  })
})
