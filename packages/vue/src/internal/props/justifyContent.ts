import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { type NumberValue, isNumberValue, number } from 'valued/data/number'
import { type PercentageValue, percentage } from 'valued/data/percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'

const justifyContentParser = oneOf([
  keywords([
    'start',
    'end',
    'center',
    'space-between',
    'space-around',
    'space-evenly',
  ]),
  someOf([
    juxtapose(['place', oneOf([percentage(), number()])]),
    juxtapose([
      'space',
      between(oneOf([percentage(), number()]), { minLength: 1, maxLength: 2 }),
    ]),
  ]),
])

export type JustifyContent = typeof justifyContentParser

export type JustifyContentInput = ParserInput<JustifyContent>

export interface JustifyContentValue {
  justifyContent: number
  justifyContentSpace: number
  justifyContentSpaceOuter: number
}

const cache = createCache<string, JustifyContentValue>(512)

const keywordResults = {
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

function toNormalized(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }
  return input.value / 100
}

function toValue(
  value: ParserValue<typeof justifyContentParser>,
): JustifyContentValue {
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
}

export function parseJustifyContent(
  input: JustifyContentInput,
): JustifyContentValue {
  const cached = cache.get(input)
  if (cached !== undefined) {
    return cached
  }

  const value = parse(input, justifyContentParser)
  let result: JustifyContentValue = keywordResults.start
  if (value.valid) {
    result = toValue(value.value)
  }
  cache.set(input, result)

  return result
}
