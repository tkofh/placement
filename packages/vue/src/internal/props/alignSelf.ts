import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued'
import { oneOf } from 'valued'
import { someOf } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

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
  stretch: number
}

const cache = createCache<string, AlignSelfValue>(512)

export const keywordResults = {
  auto: {
    align: Number.POSITIVE_INFINITY,
    stretch: 0,
  },
  start: {
    align: 0,
    stretch: 0,
  },
  end: {
    align: 1,
    stretch: 0,
  },
  center: {
    align: 0.5,
    stretch: 0,
  },
  stretch: {
    align: 0,
    stretch: 1,
  },
} as const

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
    stretch,
  }
}

export function resolveAlignSelf(
  input: AlignSelfInput,
  autoAlign = Number.POSITIVE_INFINITY,
  autoStretch = 0,
): AlignSelfValue {
  if (typeof input === 'number' || input === undefined) {
    return {
      align: input ?? autoAlign,
      stretch: autoStretch,
    }
  }

  return cache(`${input}:${autoAlign}:${autoStretch}`, () => {
    const parsed = parse(input, alignSelfParser)
    if (!parsed.valid) {
      return {
        align: autoAlign,
        stretch: autoStretch,
      }
    }

    return toValue(parsed.value)
  })
}
