import { type ParserInput, parse } from 'valued'
import { juxtapose } from 'valued'
import { oneOf } from 'valued'
import { someOf } from 'valued'
import { between } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

const justifyContentParser = oneOf([
  keywords(['start', 'end', 'center', 'space-between', 'space-around', 'space-evenly']),
  someOf([
    juxtapose(['place', oneOf([percentage(), number()])]),
    juxtapose(['space', between(oneOf([percentage(), number()]), { minLength: 1, maxLength: 2 })]),
  ]),
])

export type JustifyContent = typeof justifyContentParser

export type JustifyContentInput = ParserInput<JustifyContent> | number | undefined

export interface JustifyContentValue {
  justifyContent: number
  justifyContentSpace: number
  justifyContentSpaceOuter: number
}

const cache = createCache<string, JustifyContentValue>(512)

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

  return cache(`${input}:${autoContent}:${autoContentSpace}:${autoContentSpaceOuter}`, () => {
    const parsed = parse(input, justifyContentParser)

    if (!parsed.valid) {
      return {
        justifyContent: autoContent,
        justifyContentSpace: autoContentSpace,
        justifyContentSpaceOuter: autoContentSpaceOuter,
      }
    }

    const value = parsed.value

    if (isKeywordValue(value)) {
      return keywordResults[value.value]
    }

    const [placeValue, spaceValue] = value

    let place = 0
    let space = 0
    let spaceOuter = 0

    if (placeValue !== null) {
      place = toNormalized(placeValue[0])
    }

    if (spaceValue !== null) {
      space = toNormalized(spaceValue[0][0])
      spaceOuter = spaceValue[0].length === 1 ? 0 : toNormalized(spaceValue[0][1])
    }

    return {
      justifyContent: place,
      justifyContentSpace: space,
      justifyContentSpaceOuter: spaceOuter,
    }
  })
}
