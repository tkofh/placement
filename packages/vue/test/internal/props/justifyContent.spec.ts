import { describe, expect, test } from 'vitest'
import {
  type JustifyContentInput,
  type JustifyContentValue,
  keywordResults,
  resolveJustifyContent,
} from '../../../src/internal/props/justifyContent.ts'

const keywordCases = Object.entries(keywordResults) as Array<
  [keyof typeof keywordResults, JustifyContentValue]
>

describe('keywords', () => {
  test.each(keywordCases)('resolveJustifyContent(%s)', (keyword, expected) => {
    expect(resolveJustifyContent(keyword)).toEqual(expected)
  })
})

describe('numeric and undefined input', () => {
  // The numeric path spreads keywordResults.start, so the space channels are
  // forced to 0 even when the auto arguments say otherwise -- unlike
  // alignContent, whose numeric path keeps its space autos.
  test('a number zeroes the space channels regardless of the autos', () => {
    expect(resolveJustifyContent(0.25)).toEqual({
      justifyContent: 0.25,
      justifyContentSpace: 0,
      justifyContentSpaceOuter: 0,
    })
    expect(resolveJustifyContent(0.25, 0.5, 1, 0.75)).toEqual({
      justifyContent: 0.25,
      justifyContentSpace: 0,
      justifyContentSpaceOuter: 0,
    })
  })

  test('undefined resolves to all three autos', () => {
    expect(resolveJustifyContent(undefined)).toEqual({
      justifyContent: 0,
      justifyContentSpace: 0,
      justifyContentSpaceOuter: 0,
    })
    expect(resolveJustifyContent(undefined, 0.5, 1, 0.75)).toEqual({
      justifyContent: 0.5,
      justifyContentSpace: 1,
      justifyContentSpaceOuter: 0.75,
    })
  })
})

describe('channel strings', () => {
  test.each<{ input: JustifyContentInput; expected: JustifyContentValue }>([
    {
      input: 'place 0.25',
      expected: { justifyContent: 0.25, justifyContentSpace: 0, justifyContentSpaceOuter: 0 },
    },
    {
      input: 'place 25%',
      expected: { justifyContent: 0.25, justifyContentSpace: 0, justifyContentSpaceOuter: 0 },
    },
    {
      input: 'space 0.5',
      expected: { justifyContent: 0, justifyContentSpace: 0.5, justifyContentSpaceOuter: 0 },
    },
    {
      input: 'space 50% 100%',
      expected: { justifyContent: 0, justifyContentSpace: 0.5, justifyContentSpaceOuter: 1 },
    },
    {
      input: 'place 0.5 space 1',
      expected: { justifyContent: 0.5, justifyContentSpace: 1, justifyContentSpaceOuter: 0 },
    },
  ])('resolveJustifyContent($input): $expected', ({ input, expected }) => {
    expect(resolveJustifyContent(input)).toEqual(expected)
  })

  test('a parsed string specifies every channel: unset channels are 0, not the autos', () => {
    expect(resolveJustifyContent('place 0.25', 0.5, 1, 1)).toEqual({
      justifyContent: 0.25,
      justifyContentSpace: 0,
      justifyContentSpaceOuter: 0,
    })
    expect(resolveJustifyContent('center', 0.5, 1, 1)).toEqual(keywordResults.center)
  })
})

describe('auto fallback', () => {
  test('invalid input resolves to the autos', () => {
    expect(resolveJustifyContent('garbage' as JustifyContentInput, 0.5, 1, 0.75)).toEqual({
      justifyContent: 0.5,
      justifyContentSpace: 1,
      justifyContentSpaceOuter: 0.75,
    })
  })
})
