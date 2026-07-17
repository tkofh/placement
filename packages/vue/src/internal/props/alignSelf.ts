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

// `Number.POSITIVE_INFINITY` is the core's inherit sentinel (see
// `placement/frame`): an infinite `align` inherits the container's
// `alignItems`, an infinite `stretch` inherits its `stretchItems`.
export interface AlignSelfValue {
  align: number
  stretch: number
}

const cache = createCache<string, AlignSelfValue>(512)

export const keywordResults = {
  // 'auto' inherits both channels from the container.
  auto: {
    align: Number.POSITIVE_INFINITY,
    stretch: Number.POSITIVE_INFINITY,
  },
  // The placement keywords are complete specifications: like CSS
  // `align-self`, an explicit placement defeats an inherited stretch.
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

  // A channel the input leaves unset stays at the inherit sentinel.
  let place = Number.POSITIVE_INFINITY
  let stretch = Number.POSITIVE_INFINITY

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
  autoStretch = Number.POSITIVE_INFINITY,
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
