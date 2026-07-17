import { type ParserInput, map, oneOf, parse } from 'valued'
import { keyword } from 'valued/data/keyword'
import { isRatioValue, ratio } from 'valued/data/ratio'
import { createCache } from '../cache.ts'

// `null` marks the values that fall back to the caller's `auto`: the keyword
// itself, and degenerate ratios (`1/0`).
const aspectRatio = map(oneOf([ratio(), keyword('auto')]), (value): number | null =>
  isRatioValue(value) && !value.isDegenerate ? value.value : null,
)

export type AspectRatio = typeof aspectRatio

export type AspectRatioInput = ParserInput<AspectRatio> | number | undefined

const cache = createCache<string, number | null>(512)

function parseAspectRatio(input: string): number | null {
  return cache(input, () => {
    const parsed = parse(input, aspectRatio)
    return parsed.valid ? parsed.value : null
  })
}

export function resolveAspectRatio(
  input: AspectRatioInput,
  auto = Number.POSITIVE_INFINITY,
): number {
  if (typeof input === 'number' || input === undefined) {
    return input ?? auto
  }

  return parseAspectRatio(input) ?? auto
}
