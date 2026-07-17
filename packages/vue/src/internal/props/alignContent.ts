import { type ParserInput, between, juxtapose, map, oneOf, parse, someOf } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

export interface AlignContentValue {
  alignContent: number
  alignContentSpace: number
  alignContentSpaceOuter: number
  stretchContent: number
}

export const keywordResults = {
  start: {
    alignContent: 0,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
  },
  end: {
    alignContent: 1,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
  },
  center: {
    alignContent: 0.5,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
  },
  'space-between': {
    alignContent: 0,
    alignContentSpace: 1,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
  },
  'space-around': {
    alignContent: 0,
    alignContentSpace: 1,
    alignContentSpaceOuter: 0.5,
    stretchContent: 0,
  },
  'space-evenly': {
    alignContent: 0,
    alignContentSpace: 1,
    alignContentSpaceOuter: 1,
    stretchContent: 0,
  },
  stretch: {
    alignContent: 0,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 1,
  },
} as const

const alignContentParser = map(
  oneOf([
    keywords([
      'start',
      'end',
      'center',
      'space-between',
      'space-around',
      'space-evenly',
      'stretch',
    ]),
    someOf([
      juxtapose(['place', oneOf([percentage(), number()])]),
      juxtapose([
        'space',
        between(oneOf([percentage(), number()]), { minLength: 1, maxLength: 2 }),
      ]),
      juxtapose(['stretch', oneOf([percentage(), number()])]),
    ]),
  ]),
  (value): AlignContentValue => {
    if (isKeywordValue(value)) {
      return keywordResults[value.value]
    }

    const [placeValue, spaceValue, stretchValue] = value

    let space = 0
    let spaceOuter = 0

    if (spaceValue !== null) {
      space = toNormalized(spaceValue[0][0])
      spaceOuter = spaceValue[0].length === 1 ? 0 : toNormalized(spaceValue[0][1])
    }

    return {
      alignContent: placeValue !== null ? toNormalized(placeValue[0]) : 0,
      alignContentSpace: space,
      alignContentSpaceOuter: spaceOuter,
      stretchContent: stretchValue !== null ? toNormalized(stretchValue[0]) : 0,
    }
  },
)

export type AlignContent = typeof alignContentParser

export type AlignContentInput = ParserInput<AlignContent> | number | undefined

const cache = createCache<string, AlignContentValue | null>(512)

function parseAlignContent(input: string): AlignContentValue | null {
  return cache(input, () => {
    const parsed = parse(input, alignContentParser)
    return parsed.valid ? parsed.value : null
  })
}

export function resolveAlignContent(
  input: AlignContentInput,
  autoAlignContent = 0,
  autoAlignContentSpace = 0,
  autoAlignContentSpaceOuter = 0,
  autoStretchContent = 0,
): AlignContentValue {
  if (typeof input === 'number' || input === undefined) {
    return {
      alignContent: input ?? autoAlignContent,
      alignContentSpace: autoAlignContentSpace,
      alignContentSpaceOuter: autoAlignContentSpaceOuter,
      stretchContent: autoStretchContent,
    }
  }

  return (
    parseAlignContent(input) ?? {
      alignContent: autoAlignContent,
      alignContentSpace: autoAlignContentSpace,
      alignContentSpaceOuter: autoAlignContentSpaceOuter,
      stretchContent: autoStretchContent,
    }
  )
}
