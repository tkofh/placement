import { type ParserInput, between, juxtapose, map, oneOf, parse, someOf } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

export interface JustifyContentValue {
  justifyContent: number
  justifyContentSpace: number
  justifyContentSpaceOuter: number
}

export const keywordResults = {
  start: {
    justifyContent: 0,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
  },
  end: {
    justifyContent: 1,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
  },
  center: {
    justifyContent: 0.5,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
  },
  'space-between': {
    justifyContent: 0,
    justifyContentSpace: 1,
    justifyContentSpaceOuter: 0,
  },
  'space-around': {
    justifyContent: 0,
    justifyContentSpace: 1,
    justifyContentSpaceOuter: 0.5,
  },
  'space-evenly': {
    justifyContent: 0,
    justifyContentSpace: 1,
    justifyContentSpaceOuter: 1,
  },
} as const

const justifyContentParser = map(
  oneOf([
    keywords(['start', 'end', 'center', 'space-between', 'space-around', 'space-evenly']),
    someOf([
      juxtapose(['place', oneOf([percentage(), number()])]),
      juxtapose([
        'space',
        between(oneOf([percentage(), number()]), { minLength: 1, maxLength: 2 }),
      ]),
    ]),
  ]),
  (value): JustifyContentValue => {
    if (isKeywordValue(value)) {
      return keywordResults[value.value]
    }

    const [placeValue, spaceValue] = value

    let space = 0
    let spaceOuter = 0

    if (spaceValue !== null) {
      space = toNormalized(spaceValue[0][0])
      spaceOuter = spaceValue[0].length === 1 ? 0 : toNormalized(spaceValue[0][1])
    }

    return {
      justifyContent: placeValue !== null ? toNormalized(placeValue[0]) : 0,
      justifyContentSpace: space,
      justifyContentSpaceOuter: spaceOuter,
    }
  },
)

export type JustifyContent = typeof justifyContentParser

export type JustifyContentInput = ParserInput<JustifyContent> | number | undefined

const cache = createCache<string, JustifyContentValue | null>(512)

function parseJustifyContent(input: string): JustifyContentValue | null {
  return cache(input, () => {
    const parsed = parse(input, justifyContentParser)
    return parsed.valid ? parsed.value : null
  })
}

export function resolveJustifyContent(
  input: JustifyContentInput,
  autoContent = 0,
  autoContentSpace = 0,
  autoContentSpaceOuter = 0,
): JustifyContentValue {
  if (typeof input === 'number') {
    return {
      ...keywordResults.start,
      justifyContent: input,
    }
  }

  if (input === undefined) {
    return {
      justifyContent: autoContent,
      justifyContentSpace: autoContentSpace,
      justifyContentSpaceOuter: autoContentSpaceOuter,
    }
  }

  return (
    parseJustifyContent(input) ?? {
      justifyContent: autoContent,
      justifyContentSpace: autoContentSpace,
      justifyContentSpaceOuter: autoContentSpaceOuter,
    }
  )
}
