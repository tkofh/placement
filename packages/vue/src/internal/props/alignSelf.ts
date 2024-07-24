import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { type NumberValue, isNumberValue, number } from 'valued/data/number'
import { type PercentageValue, percentage } from 'valued/data/percentage'
import { createCache } from '../cache'

const alignSelfParser = oneOf([
  keywords(['auto', 'start', 'end', 'center', 'stretch']),
  someOf([
    juxtapose(['place', oneOf([percentage(), number()])]),
    juxtapose(['stretch', oneOf([percentage(), number()])]),
  ]),
])

export type AlignSelf = typeof alignSelfParser

export type AlignSelfInput = ParserInput<AlignSelf> | number | undefined

export interface AlignSelfValue {
  align: number
  stretchCross: number
}

const cache = createCache<string, AlignSelfValue>(512)

export const keywordResults = {
  auto: {
    align: Number.POSITIVE_INFINITY,
    stretchCross: 0,
  },
  start: {
    align: 0,
    stretchCross: 0,
  },
  end: {
    align: 1,
    stretchCross: 0,
  },
  center: {
    align: 0.5,
    stretchCross: 0,
  },
  stretch: {
    align: 0,
    stretchCross: 1,
  },
} as const

function toNormalized(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }
  return input.value / 100
}

function toValue(value: ParserValue<typeof alignSelfParser>): AlignSelfValue {
  if (isKeywordValue(value)) {
    return keywordResults[value.value]
  }

  const [placeValue, stretchValue] = value

  let place = Number.POSITIVE_INFINITY
  let stretch = 0

  if (placeValue !== null) {
    place = toNormalized(placeValue[0])
  }

  if (stretchValue !== null) {
    stretch = toNormalized(stretchValue[0])
  }

  return {
    align: place,
    stretchCross: stretch,
  }
}

export function resolveAlignSelf(
  input: AlignSelfInput,
  autoAlign = Number.POSITIVE_INFINITY,
  autoStretchCross = 0,
): AlignSelfValue {
  if (typeof input === 'number' || input === undefined) {
    return {
      align: input ?? autoAlign,
      stretchCross: autoStretchCross,
    }
  }

  return cache(`${input}:${autoAlign}:${autoStretchCross}`, () => {
    const parsed = parse(input, alignSelfParser)
    if (!parsed.valid) {
      return {
        align: autoAlign,
        stretchCross: autoStretchCross,
      }
    }

    return toValue(parsed.value)
  })
}
