import { describe, expect, test } from 'vitest'
import { type SmoothingInput, resolveSmoothing } from '../../../src/internal/props/smoothing.ts'

describe('resolveSmoothing', () => {
  test.each([
    [undefined, 0],
    [0.6, 0.6],
    ['0.6', 0.6],
    ['60%', 0.6],
    [2, 1],
    ['-1', 0],
    ['150%', 1],
    [Number.NaN, 0],
  ] as const)('%s resolves to %s', (input, expected) => {
    expect(resolveSmoothing(input)).toBe(expected)
  })

  test('unparseable input resolves to 0', () => {
    expect(resolveSmoothing('soft' as SmoothingInput)).toBe(0)
  })
})
