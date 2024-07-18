import { type ParserInput, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { keyword } from 'valued/data/keyword'
import { isRatioValue, ratio } from 'valued/data/ratio'
import { createCache } from '../cache'

const aspectRatio = oneOf([ratio(), keyword('auto')])

export type AspectRatio = typeof aspectRatio

export type AspectRatioInput = ParserInput<AspectRatio>

const cache = createCache<string, number>(512)

export function parseAspectRatio(input: string): number {
  const cached = cache.get(input)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, aspectRatio)
  let value: number = Number.POSITIVE_INFINITY

  if (
    parsed.valid &&
    isRatioValue(parsed.value) &&
    !parsed.value.isDegenerate
  ) {
    value = parsed.value.value
  }

  return value
}
