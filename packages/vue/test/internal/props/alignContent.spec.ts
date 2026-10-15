import { describe, expect, test } from 'vitest'
import {
  type AlignContentInput,
  type AlignContentValue,
  keywordResults,
  resolveAlignContent,
} from '../../../src/internal/props/alignContent.ts'

const keywordCases = Object.entries(keywordResults) as Array<
  [keyof typeof keywordResults, AlignContentValue]
>

describe('keywords', () => {
  test.each(keywordCases)('resolveAlignContent(%s)', (keyword, expected) => {
    expect(resolveAlignContent(keyword)).toEqual(expected)
  })
})

describe('numeric and undefined input', () => {
  test('a number sets the place channel and keeps the remaining autos', () => {
    expect(resolveAlignContent(0.25)).toEqual({
      alignContent: 0.25,
      alignContentSpace: 0,
      alignContentSpaceOuter: 0,
      stretchContent: 0,
    })
    // Unlike justifyContent's numeric path, the space and stretch autos
    // flow through here.
    expect(resolveAlignContent(0.25, 0.5, 1, 0.75, 0.5)).toEqual({
      alignContent: 0.25,
      alignContentSpace: 1,
      alignContentSpaceOuter: 0.75,
      stretchContent: 0.5,
    })
  })

  test('undefined resolves to all four autos', () => {
    expect(resolveAlignContent(undefined)).toEqual({
      alignContent: 0,
      alignContentSpace: 0,
      alignContentSpaceOuter: 0,
      stretchContent: 0,
    })
    expect(resolveAlignContent(undefined, 0.5, 1, 0.75, 0.25)).toEqual({
      alignContent: 0.5,
      alignContentSpace: 1,
      alignContentSpaceOuter: 0.75,
      stretchContent: 0.25,
    })
  })
})

describe('channel strings', () => {
  test.each<{ input: AlignContentInput; expected: AlignContentValue }>([
    {
      input: 'place 0.25',
      expected: {
        alignContent: 0.25,
        alignContentSpace: 0,
        alignContentSpaceOuter: 0,
        stretchContent: 0,
      },
    },
    {
      input: 'place 25%',
      expected: {
        alignContent: 0.25,
        alignContentSpace: 0,
        alignContentSpaceOuter: 0,
        stretchContent: 0,
      },
    },
    {
      input: 'stretch 0.5',
      expected: {
        alignContent: 0,
        alignContentSpace: 0,
        alignContentSpaceOuter: 0,
        stretchContent: 0.5,
      },
    },
    {
      input: 'space 0.5',
      expected: {
        alignContent: 0,
        alignContentSpace: 0.5,
        alignContentSpaceOuter: 0,
        stretchContent: 0,
      },
    },
    {
      input: 'space 50% 100%',
      expected: {
        alignContent: 0,
        alignContentSpace: 0.5,
        alignContentSpaceOuter: 1,
        stretchContent: 0,
      },
    },
    {
      input: 'place 0.5 space 1',
      expected: {
        alignContent: 0.5,
        alignContentSpace: 1,
        alignContentSpaceOuter: 0,
        stretchContent: 0,
      },
    },
    {
      input: 'place 0.5 space 1 stretch 0.25',
      expected: {
        alignContent: 0.5,
        alignContentSpace: 1,
        alignContentSpaceOuter: 0,
        stretchContent: 0.25,
      },
    },
  ])('resolveAlignContent($input): $expected', ({ input, expected }) => {
    expect(resolveAlignContent(input)).toEqual(expected)
  })

  test('a parsed string specifies every channel: unset channels are 0, not the autos', () => {
    expect(resolveAlignContent('place 0.25', 0.5, 1, 1, 1)).toEqual({
      alignContent: 0.25,
      alignContentSpace: 0,
      alignContentSpaceOuter: 0,
      stretchContent: 0,
    })
    expect(resolveAlignContent('center', 0.5, 1, 1, 1)).toEqual(keywordResults.center)
  })
})

describe('auto fallback', () => {
  test('invalid input resolves to the autos', () => {
    expect(resolveAlignContent('garbage' as AlignContentInput, 0.5, 1, 0.75, 0.25)).toEqual({
      alignContent: 0.5,
      alignContentSpace: 1,
      alignContentSpaceOuter: 0.75,
      stretchContent: 0.25,
    })
  })
})
