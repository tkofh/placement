import { describe, expect, test } from 'vitest'
import { boolProp } from '../../src/internal/utils.ts'

describe('boolProp', () => {
  test.each([
    { value: true, expected: true },
    { value: false, expected: false },
    { value: undefined, expected: false },
    // '' is the bare-attribute form (`<GraphicRect absolute />`): presence.
    { value: '', expected: true },
    { value: 'false', expected: false },
    { value: 'true', expected: true },
    { value: 'anything-else', expected: true },
  ])('boolProp($value) -> $expected', ({ value, expected }) => {
    expect(boolProp(value)).toBe(expected)
  })
})
