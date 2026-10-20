import { type ParserInput, juxtapose, map, oneOf, parse, someOf } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

// `Number.POSITIVE_INFINITY` is the core's inherit sentinel (`inherit` in
// `placement/alignment`). An infinite `align` inherits the container's
// `alignItems`, and an infinite `stretch` inherits its `stretchItems`.
export interface AlignSelfValue {
  align: number
  stretch: number
}

export const keywordResults = {
  // 'auto' inherits both channels from the container.
  auto: {
    align: Number.POSITIVE_INFINITY,
    stretch: Number.POSITIVE_INFINITY,
  },
  // The placement keywords are complete specifications. Like CSS
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

const alignSelfParser = map(
  oneOf([
    keywords(['auto', 'start', 'end', 'center', 'stretch']),
    someOf([
      juxtapose(['place', oneOf([percentage(), number()])]),
      juxtapose(['stretch', oneOf([percentage(), number()])]),
    ]),
  ]),
  (value): AlignSelfValue => {
    if (isKeywordValue(value)) {
      return keywordResults[value.value]
    }

    const [placeValue, stretchValue] = value

    // A channel the input leaves unset stays at the inherit sentinel.
    return {
      align: placeValue !== null ? toNormalized(placeValue[0]) : Number.POSITIVE_INFINITY,
      stretch: stretchValue !== null ? toNormalized(stretchValue[0]) : Number.POSITIVE_INFINITY,
    }
  },
)

export type AlignSelf = typeof alignSelfParser

export type AlignSelfInput = ParserInput<AlignSelf> | number | undefined

const cache = createCache<string, AlignSelfValue | null>(512)

function parseAlignSelf(input: string): AlignSelfValue | null {
  return cache(input, () => {
    const parsed = parse(input, alignSelfParser)
    return parsed.valid ? parsed.value : null
  })
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

  return (
    parseAlignSelf(input) ?? {
      align: autoAlign,
      stretch: autoStretch,
    }
  )
}
