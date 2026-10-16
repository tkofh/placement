import { describe, expect, test } from 'vitest'
import { type RatioInput, resolveRatio } from '../../../src/internal/props/ratio.ts'

describe('resolveRatio', () => {
  test.each([
    [undefined, 0.5],
    ['start', 0],
    ['center', 0.5],
    ['end', 1],
    ['25%', 0.25],
    ['0.75', 0.75],
    [0.125, 0.125],
  ] as const)('%s resolves to %s', (input, expected) => {
    expect(resolveRatio(input, 0.5)).toBe(expected)
  })

  test('unset input resolves to the fallback', () => {
    expect(resolveRatio(undefined, 1)).toBe(1)
    expect(resolveRatio('middle' as RatioInput, 0)).toBe(0)
  })
})
