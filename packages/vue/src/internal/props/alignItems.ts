import { type ParserInput, juxtapose, map, oneOf, parse, someOf } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

export interface AlignItemsValue {
  alignItems: number
  stretchItems: number
}

export const keywordResults = {
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

const alignItemsParser = map(
  oneOf([
    keywords(['start', 'end', 'center', 'stretch']),
    someOf([
      juxtapose(['place', oneOf([percentage(), number()])]),
      juxtapose(['stretch', oneOf([percentage(), number()])]),
    ]),
  ]),
  (value): AlignItemsValue => {
    if (isKeywordValue(value)) {
      return keywordResults[value.value]
    }

    const [placeValue, stretchValue] = value

    return {
      alignItems: placeValue !== null ? toNormalized(placeValue[0]) : 0,
      stretchItems: stretchValue !== null ? toNormalized(stretchValue[0]) : 0,
    }
  },
)

export type AlignItems = typeof alignItemsParser

export type AlignItemsInput = ParserInput<AlignItems> | number | undefined

const cache = createCache<string, AlignItemsValue | null>(512)

function parseAlignItems(input: string): AlignItemsValue | null {
  return cache(input, () => {
    const parsed = parse(input, alignItemsParser)
    return parsed.valid ? parsed.value : null
  })
}

export function resolveAlignItems(
  input: AlignItemsInput,
  autoAlign = 0,
  autoStretch = 0,
): AlignItemsValue {
  if (typeof input === 'number' || input === undefined) {
    return {
      alignItems: input ?? autoAlign,
      stretchItems: autoStretch,
    }
  }

  return (
    parseAlignItems(input) ?? {
      alignItems: autoAlign,
      stretchItems: autoStretch,
    }
  )
}
