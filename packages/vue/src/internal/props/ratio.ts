import { type ParserInput, map, oneOf, parse } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

// A position along a span as a fraction: `start` is 0, `center` is 0.5, and
// `end` is 1. Numbers and percentages give the fraction directly.
const ratioParser = map(
  oneOf([keywords(['start', 'center', 'end']), percentage(), number()]),
  (value): number => {
    if (isKeywordValue(value)) {
      return value.value === 'start' ? 0 : value.value === 'end' ? 1 : 0.5
    }
    return toNormalized(value)
  },
)

export type RatioInput = ParserInput<typeof ratioParser> | number | undefined

const cache = createCache<string, number | null>(256)

/** Resolves a ratio prop. Unset and unparseable input resolves to `fallback`. */
export function resolveRatio(input: RatioInput, fallback: number): number {
  if (typeof input === 'number') {
    return input
  }
  if (input === undefined) {
    return fallback
  }
  return (
    cache(input, () => {
      const parsed = parse(input, ratioParser)
      return parsed.valid ? parsed.value : null
    }) ?? fallback
  )
}
