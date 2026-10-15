import { describe, expect, test } from 'vitest'
import { auto } from '../src/unstable/utils.ts'

const { POSITIVE_INFINITY: inf, NEGATIVE_INFINITY: ninf, NaN: nan } = Number

describe('auto', () => {
  test.each([
    { candidates: [10], expected: 10 },
    { candidates: [inf], expected: inf },
    { candidates: [10, 5], expected: 10 },
    { candidates: [inf, 5], expected: 5 },
    { candidates: [nan, inf], expected: inf },
    { candidates: [inf, ninf, 3], expected: 3 },
    { candidates: [inf, nan, ninf], expected: ninf },
    { candidates: [inf, inf, inf, 0.5, 7], expected: 0.5 },
    { candidates: [inf, inf, inf, inf, nan], expected: nan },
  ])('auto($candidates) is $expected', ({ candidates, expected }) => {
    const [a, ...rest] = candidates as [number, ...Array<number>]
    expect(auto(a, ...rest)).toBe(expected)
  })

  test('an explicit undefined candidate is skipped', () => {
    expect(auto(inf, undefined, 4)).toBe(4)
    expect(auto(inf, undefined)).toBe(inf)
  })
})
