import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { type NumberValue, isNumberValue, number } from 'valued/data/number'
import { type PercentageValue, percentage } from 'valued/data/percentage'
import { createCache } from '../cache'

const justifySelfParser = oneOf([
  keywords(['start', 'end', 'center']),
  juxtapose(['place', oneOf([percentage(), number()])]),
])

export type JustifySelf = typeof justifySelfParser

export type JustifySelfInput = ParserInput<JustifySelf>

export type JustifySelfValue = number

const cache = createCache<string, JustifySelfValue>(512)

const keywordResults = {
  start: 0,
  end: 1,
  center: 0.5,
} as const

function toNormalized(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }
  return input.value / 100
}

function toValue(
  value: ParserValue<typeof justifySelfParser>,
): JustifySelfValue {
  if (isKeywordValue(value)) {
    return keywordResults[value.value]
  }

  const [placeValue] = value

  let place = 0

  if (placeValue !== null) {
    place = toNormalized(placeValue)
  }

  return place
}

export function parseJustifySelf(input: string): JustifySelfValue {
  const cached = cache.get(input)
  if (cached !== undefined) {
    return cached
  }

  const value = parse(input, justifySelfParser)
  let result: JustifySelfValue = keywordResults.start
  if (value.valid) {
    result = toValue(value.value)
  }
  cache.set(input, result)

  return result
}
