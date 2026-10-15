import { describe, expect, test } from 'vitest'
import {
  type AlignSelfInput,
  type AlignSelfValue,
  keywordResults,
  resolveAlignSelf,
} from '../../../src/internal/props/alignSelf.ts'

// Number.POSITIVE_INFINITY is the core's inherit sentinel: an infinite
// channel inherits the container's alignItems/stretchItems.
const inherit = Number.POSITIVE_INFINITY

const keywordCases = Object.entries(keywordResults) as Array<
  [keyof typeof keywordResults, AlignSelfValue]
>

describe('keywords', () => {
  test.each(keywordCases)('resolveAlignSelf(%s)', (keyword, expected) => {
    expect(resolveAlignSelf(keyword)).toEqual(expected)
  })

  test('auto inherits both channels', () => {
    expect(resolveAlignSelf('auto')).toEqual({ align: inherit, stretch: inherit })
  })

  // Like CSS align-self, an explicit placement defeats an inherited stretch.
  test.each(['start', 'end', 'center'] as const)('%s zeroes the stretch channel', (keyword) => {
    expect(resolveAlignSelf(keyword).stretch).toBe(0)
  })
})

describe('numeric and undefined input', () => {
  test('a number sets align and keeps the stretch auto, inherit by default', () => {
    expect(resolveAlignSelf(0.25)).toEqual({ align: 0.25, stretch: inherit })
    expect(resolveAlignSelf(0)).toEqual({ align: 0, stretch: inherit })
    expect(resolveAlignSelf(0.25, 0.5, 0.75)).toEqual({ align: 0.25, stretch: 0.75 })
  })

  test('undefined resolves to the autos, inherit on both by default', () => {
    expect(resolveAlignSelf(undefined)).toEqual({ align: inherit, stretch: inherit })
    expect(resolveAlignSelf(undefined, 0.25, 0.75)).toEqual({ align: 0.25, stretch: 0.75 })
  })
})

describe('channel strings', () => {
  test.each<{ input: AlignSelfInput; expected: AlignSelfValue }>([
    { input: 'place 0.5', expected: { align: 0.5, stretch: inherit } },
    { input: 'place 50%', expected: { align: 0.5, stretch: inherit } },
    { input: 'stretch 0.5', expected: { align: inherit, stretch: 0.5 } },
    { input: 'place 1 stretch 0', expected: { align: 1, stretch: 0 } },
  ])('resolveAlignSelf($input): $expected', ({ input, expected }) => {
    expect(resolveAlignSelf(input)).toEqual(expected)
  })

  test('a channel the string leaves unset stays at the inherit sentinel, not the autos', () => {
    expect(resolveAlignSelf('place 0.5', 0.25, 0.75)).toEqual({ align: 0.5, stretch: inherit })
    expect(resolveAlignSelf('stretch 0.5', 0.25, 0.75)).toEqual({ align: inherit, stretch: 0.5 })
  })
})

describe('auto fallback', () => {
  test('invalid input resolves to the autos', () => {
    expect(resolveAlignSelf('garbage' as AlignSelfInput)).toEqual({
      align: inherit,
      stretch: inherit,
    })
    expect(resolveAlignSelf('garbage' as AlignSelfInput, 0.25, 0.75)).toEqual({
      align: 0.25,
      stretch: 0.75,
    })
  })
})
