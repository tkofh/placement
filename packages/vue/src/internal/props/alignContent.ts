import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { type NumberValue, isNumberValue, number } from 'valued/data/number'
import { type PercentageValue, percentage } from 'valued/data/percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'

const alignContentParser = oneOf([
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
])

export type AlignContent = typeof alignContentParser

export type AlignContentInput = ParserInput<AlignContent> | number | undefined

export interface AlignContentValue {
  alignContent: number
  alignContentSpace: number
  alignContentSpaceOuter: number
  stretchContent: number
}

const cache = createCache<string, AlignContentValue>(512)

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

function toNormalized(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }
  return input.value / 100
}

function toValue(
  value: ParserValue<typeof alignContentParser>,
): AlignContentValue {
  if (isKeywordValue(value)) {
    return keywordResults[value.value]
  }

  const [placeValue, spaceValue, stretchValue] = value

  let place = 0
  let space = 0
  let spaceOuter = 0
  let stretch = 0

  if (placeValue !== null) {
    place = toNormalized(placeValue[0])
  }

  if (spaceValue !== null) {
    space = toNormalized(spaceValue[0][0])
    spaceOuter = spaceValue[0].length === 1 ? 0 : toNormalized(spaceValue[0][1])
  }

  if (stretchValue !== null) {
    stretch = toNormalized(stretchValue[0])
  }

  return {
    alignContent: place,
    alignContentSpace: space,
    alignContentSpaceOuter: spaceOuter,
    stretchContent: stretch,
  }
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

  return cache(
    `${input}:${autoAlignContent}:${autoAlignContentSpace}:${autoAlignContentSpaceOuter}:${autoStretchContent}`,
    () => {
      const parsed = parse(input, alignContentParser)

      if (!parsed.valid) {
        return {
          alignContent: autoAlignContent,
          alignContentSpace: autoAlignContentSpace,
          alignContentSpaceOuter: autoAlignContentSpaceOuter,
          stretchContent: autoStretchContent,
        }
      }

      return toValue(parsed.value)
    },
  )
}
