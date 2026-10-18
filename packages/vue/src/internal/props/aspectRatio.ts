import * as AspectRatio from 'placement/aspectRatio'
import { type ParserInput, map, oneOf, parse } from 'valued'
import { keyword } from 'valued/data/keyword'
import { isRatioValue, ratio } from 'valued/data/ratio'
import { createCache } from '../cache.ts'

// `null` marks the values that fall back to the caller's `auto`: the keyword
// itself, and degenerate ratios (`1/0`). A ratio keeps its two parts as a
// `[width, height]` pair, and a bare number parses over `1`.
const aspectRatio = map(
  oneOf([ratio(), keyword('auto')]),
  (value): AspectRatio.AspectRatio | null =>
    isRatioValue(value) && !value.isDegenerate ? [value.numerator, value.denominator] : null,
)

export type AspectRatioParser = typeof aspectRatio

export type AspectRatioInput = ParserInput<AspectRatioParser> | number | undefined

const cache = createCache<string, AspectRatio.AspectRatio | null>(512)

function parseAspectRatio(input: string): AspectRatio.AspectRatio | null {
  return cache(input, () => {
    const parsed = parse(input, aspectRatio)
    return parsed.valid ? parsed.value : null
  })
}

/**
 * Parses a ratio prop into what the core ratio fields take: a number, or a
 * `[width, height]` pair, so that the core derives extents from `16 / 9`
 * with one rounding (see `placement/aspectRatio`).
 *
 * @param input - The prop value.
 * @param auto - The value for unset, `auto`, degenerate, and unparsable inputs.
 * @returns The ratio input.
 */
export function toAspectRatio(
  input: AspectRatioInput,
  auto = Number.POSITIVE_INFINITY,
): AspectRatio.AspectRatio {
  if (typeof input === 'number' || input === undefined) {
    return input ?? auto
  }

  return parseAspectRatio(input) ?? auto
}

export function resolveAspectRatio(
  input: AspectRatioInput,
  auto = Number.POSITIVE_INFINITY,
): number {
  return AspectRatio.toNumber(toAspectRatio(input, auto))
}
