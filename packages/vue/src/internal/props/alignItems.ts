import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { type NumberValue, isNumberValue, number } from 'valued/data/number'
import { type PercentageValue, percentage } from 'valued/data/percentage'
import { createCache } from '../cache'

const alignItemsParser = oneOf([
  keywords(['start', 'end', 'center', 'stretch']),
  someOf([
    juxtapose(['place', oneOf([percentage(), number()])]),
    juxtapose(['stretch', oneOf([percentage(), number()])]),
  ]),
])

export type AlignItems = typeof alignItemsParser

export type AlignItemsInput = ParserInput<AlignItems>

export interface AlignItemsValue {
  alignItems: number
  stretchItems: number
}

const cache = createCache<string, AlignItemsValue>(512)

const keywordResults = {
  start: {
    alignItems: 0,
    stretchItems: 0,
  },
  end: {
    alignItems: 1,
    stretchItems: 0,
  },
  center: {
    alignItems: 0.5,
    stretchItems: 0,
  },
  stretch: {
    alignItems: 0,
    stretchItems: 1,
  },
} as const

function toNormalized(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }
  return input.value / 100
}

function toValue(value: ParserValue<typeof alignItemsParser>): AlignItemsValue {
  if (isKeywordValue(value)) {
    return keywordResults[value.value]
  }

  const [placeValue, stretchValue] = value

  let place = 0
  let stretch = 0

  if (placeValue !== null) {
    place = toNormalized(placeValue[0])
  }

  if (stretchValue !== null) {
    stretch = toNormalized(stretchValue[0])
  }

  return {
    alignItems: place,
    stretchItems: stretch,
  }
}

export function parseAlignItems(input: AlignItemsInput): AlignItemsValue {
  const cached = cache.get(input)
  if (cached !== undefined) {
    return cached
  }

  const value = parse(input, alignItemsParser)
  let result: AlignItemsValue = keywordResults.start
  if (value.valid) {
    result = toValue(value.value)
  }
  cache.set(input, result)

  return result
}
