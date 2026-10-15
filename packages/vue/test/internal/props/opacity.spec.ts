import { describe, expect, test } from 'vitest'
import { Opacity, resolveOpacity } from '../../../src/internal/props/opacity.ts'

describe('numeric input', () => {
  test.each([0, 0.25, 0.5, 1])('resolveOpacity(%f) sets both channels', (input) => {
    expect(resolveOpacity(input)).toEqual({ 'fill-opacity': input, 'stroke-opacity': input })
  })

  // The numeric path skips the parser entirely, so out-of-range numbers pass
  // through unclamped while the equivalent strings are rejected (see below).
  test('out-of-range numbers are not validated', () => {
    expect(resolveOpacity(1.5)).toEqual({ 'fill-opacity': 1.5, 'stroke-opacity': 1.5 })
  })
})

describe('string input', () => {
  test.each<{ input: string; expected: Record<string, number> }>([
    { input: '0.5', expected: { 'fill-opacity': 0.5, 'stroke-opacity': 0.5 } },
    { input: '0%', expected: { 'fill-opacity': 0, 'stroke-opacity': 0 } },
    { input: '50%', expected: { 'fill-opacity': 0.5, 'stroke-opacity': 0.5 } },
    { input: '100%', expected: { 'fill-opacity': 1, 'stroke-opacity': 1 } },
    { input: 'fill 0.25', expected: { 'fill-opacity': 0.25 } },
    { input: 'stroke 75%', expected: { 'stroke-opacity': 0.75 } },
    { input: 'fill 25% stroke 0.5', expected: { 'fill-opacity': 0.25, 'stroke-opacity': 0.5 } },
    { input: 'stroke 0.5 fill 25%', expected: { 'fill-opacity': 0.25, 'stroke-opacity': 0.5 } },
  ])('resolveOpacity($input): $expected', ({ input, expected }) => {
    expect(resolveOpacity(input)).toEqual(expected)
  })
})

describe('auto fallback', () => {
  test('undefined resolves to the auto value, Opacity.empty by default', () => {
    expect(resolveOpacity(undefined)).toBe(Opacity.empty)

    const auto = new Opacity(0.25, 0.75)
    expect(resolveOpacity(undefined, auto)).toBe(auto)
  })

  test.each(['garbage', '1.5', '150%', '-0.5', 'fill 1.5'])(
    'invalid input %s falls back to the auto value',
    (input) => {
      expect(resolveOpacity(input)).toBe(Opacity.empty)

      const auto = new Opacity(0.5, 0.5)
      expect(resolveOpacity(input, auto)).toBe(auto)
    },
  )
})
