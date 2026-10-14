import { describe, expect, test } from 'vitest'
import {
  type AlignItemsInput,
  type AlignItemsValue,
  keywordResults,
  resolveAlignItems,
} from '../../../src/internal/props/alignItems.ts'

const keywordCases = Object.entries(keywordResults) as Array<
  [keyof typeof keywordResults, AlignItemsValue]
>

describe('keywords', () => {
  test.each(keywordCases)('resolveAlignItems(%s)', (keyword, expected) => {
    expect(resolveAlignItems(keyword)).toEqual(expected)
  })
})

describe('numeric and undefined input', () => {
  test('a number sets the place channel and keeps the stretch auto', () => {
    expect(resolveAlignItems(0.25)).toEqual({ alignItems: 0.25, stretchItems: 0 })
    expect(resolveAlignItems(0.25, 0.5, 0.75)).toEqual({ alignItems: 0.25, stretchItems: 0.75 })
    expect(resolveAlignItems(0, 0.5, 0.75)).toEqual({ alignItems: 0, stretchItems: 0.75 })
  })

  test('undefined resolves to both autos', () => {
    expect(resolveAlignItems(undefined)).toEqual({ alignItems: 0, stretchItems: 0 })
    expect(resolveAlignItems(undefined, 0.5, 0.75)).toEqual({
      alignItems: 0.5,
      stretchItems: 0.75,
    })
  })
})

describe('channel strings', () => {
  test.each<{ input: AlignItemsInput; expected: AlignItemsValue }>([
    { input: 'place 0.75', expected: { alignItems: 0.75, stretchItems: 0 } },
    { input: 'place 75%', expected: { alignItems: 0.75, stretchItems: 0 } },
    { input: 'stretch 0.5', expected: { alignItems: 0, stretchItems: 0.5 } },
    { input: 'stretch 50%', expected: { alignItems: 0, stretchItems: 0.5 } },
    { input: 'place 1 stretch 0.5', expected: { alignItems: 1, stretchItems: 0.5 } },
  ])('resolveAlignItems($input): $expected', ({ input, expected }) => {
    expect(resolveAlignItems(input)).toEqual(expected)
  })

  test('a parsed string specifies both channels: unset channels are 0, not the autos', () => {
    expect(resolveAlignItems('place 0.75', 0.5, 1)).toEqual({ alignItems: 0.75, stretchItems: 0 })
    expect(resolveAlignItems('stretch', 0.5, 0.75)).toEqual(keywordResults.stretch)
  })
})

describe('auto fallback', () => {
  test('invalid input resolves to the autos', () => {
    expect(resolveAlignItems('garbage' as AlignItemsInput, 0.5, 0.75)).toEqual({
      alignItems: 0.5,
      stretchItems: 0.75,
    })
  })
})
