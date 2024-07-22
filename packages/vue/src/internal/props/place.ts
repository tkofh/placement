import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { type NumberValue, isNumberValue, number } from 'valued/data/number'
import { type PercentageValue, percentage } from 'valued/data/percentage'
import { between } from 'valued/multipliers/between'
import { optional } from 'valued/multipliers/optional'
import { createCache } from '../cache'

const placeParser = oneOf([
  keywords([
    'start',
    'end',
    'center',
    'space-between',
    'space-around',
    'space-evenly',
    'stretch',
  ]),
  juxtapose([
    optional(keywords(['content', 'items'])),
    someOf([
      juxtapose(['place', oneOf([percentage(), number()])]),
      juxtapose([
        'space',
        between(oneOf([percentage(), number()]), {
          minLength: 1,
          maxLength: 2,
        }),
      ]),
      juxtapose(['stretch', oneOf([percentage(), number()])]),
    ]),
  ]),
])

export type Place = typeof placeParser

export type PlaceInput = ParserInput<Place> | undefined

export interface PlaceValue {
  justifyContent: number
  justifyContentSpace: number
  justifyContentSpaceOuter: number
  alignItems: number
  stretchItems: number
  alignContent: number
  alignContentSpace: number
  alignContentSpaceOuter: number
  stretchContent: number
}

const cache = createCache<string, PlaceValue>(512)

const keywordResults = {
  start: {
    justifyContent: 0,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
    alignItems: 0,
    alignContent: 0,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
    stretchItems: 0,
  },
  end: {
    justifyContent: 1,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
    alignItems: 1,
    alignContent: 1,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
    stretchItems: 0,
  },
  center: {
    justifyContent: 0.5,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
    alignItems: 0.5,
    alignContent: 0.5,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
    stretchItems: 0,
  },
  'space-between': {
    justifyContent: 0,
    justifyContentSpace: 1,
    justifyContentSpaceOuter: 0,
    alignItems: 0,
    alignContent: 0,
    alignContentSpace: 1,
    alignContentSpaceOuter: 0,
    stretchContent: 0,
    stretchItems: 0,
  },
  'space-around': {
    justifyContent: 0,
    justifyContentSpace: 1,
    justifyContentSpaceOuter: 0.5,
    alignItems: 0,
    alignContent: 0,
    alignContentSpace: 1,
    alignContentSpaceOuter: 0.5,
    stretchContent: 0,
    stretchItems: 0,
  },
  'space-evenly': {
    justifyContent: 0,
    justifyContentSpace: 1,
    justifyContentSpaceOuter: 1,
    alignItems: 0,
    alignContent: 0,
    alignContentSpace: 1,
    alignContentSpaceOuter: 1,
    stretchContent: 0,
    stretchItems: 0,
  },
  stretch: {
    justifyContent: 0,
    justifyContentSpace: 0,
    justifyContentSpaceOuter: 0,
    alignItems: 0,
    alignContent: 0,
    alignContentSpace: 0,
    alignContentSpaceOuter: 0,
    stretchContent: 1,
    stretchItems: 1,
  },
} as const

function toNormalized(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }
  return input.value / 100
}

function toValue(value: ParserValue<typeof placeParser>): PlaceValue {
  if (isKeywordValue(value)) {
    return keywordResults[value.value]
  }

  const [axisValue, configValue] = value

  const [placeValue, spaceValue, stretchValue] = configValue

  const normalizedPlaceValue =
    placeValue !== null ? toNormalized(placeValue[0]) : 0
  const normalizedSpaceValue =
    spaceValue !== null ? toNormalized(spaceValue[0][0]) : 0
  const normalizedSpaceOuterValue =
    spaceValue !== null && spaceValue[0].length === 2
      ? toNormalized(spaceValue[0][1])
      : 0
  const normalizedStretchValue =
    stretchValue !== null ? toNormalized(stretchValue[0]) : 0

  let justifyContent = 0
  let justifyContentSpace = 0
  let justifyContentSpaceOuter = 0
  let alignItems = 0
  let stretchItems = 0

  const axis = axisValue === null ? 0 : axisValue.value === 'content' ? 1 : 2

  if (axis < 2) {
    justifyContent = normalizedPlaceValue
    justifyContentSpace = normalizedSpaceValue
    justifyContentSpaceOuter = normalizedSpaceOuterValue
  }

  if (axis > 0) {
    alignItems = normalizedPlaceValue
    stretchItems = normalizedStretchValue
  }

  return {
    justifyContent,
    justifyContentSpace,
    justifyContentSpaceOuter,
    alignItems,
    stretchItems,
    alignContent: normalizedPlaceValue,
    alignContentSpace: normalizedSpaceValue,
    alignContentSpaceOuter: normalizedSpaceOuterValue,
    stretchContent: normalizedStretchValue,
  }
}

export function resolvePlace(input: PlaceInput): PlaceValue {
  if (input === undefined) {
    return keywordResults.start
  }

  return cache(input, () => {
    const value = parse(input, placeParser)
    let result: PlaceValue = keywordResults.start
    if (value.valid) {
      result = toValue(value.value)
    }

    return result
  })
}
