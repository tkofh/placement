import * as Length from 'placement/length'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { oneOf } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { isNumberValue, number } from 'valued/data/number'
import { createCache } from '../cache.ts'
import { SIZE_UNITS } from './constants.ts'

const size1d = oneOf([lengthPercentage.subset(SIZE_UNITS), number({ min: 0 }), keywords(['auto'])])

export type Size1D = typeof size1d

export type Size1DValue = ParserValue<Size1D>

export type Size1DInput = ParserInput<Size1D> | Size1DValue | number | undefined

const parseCache = createCache<string, Size1DValue | null>(512)

function parseSize1DInput(input: string): Size1DValue | null {
  return parseCache(input, () => {
    const parsed = parse(input, size1d)
    return parsed.valid ? parsed.value : null
  })
}

/**
 * Parses a size input into what the core length fields take: a number of
 * pixels, or a percentage `Length` that the core resolves against its
 * basis. Unset, `auto`, and unparsable inputs give `auto`.
 *
 * @param input - The prop value.
 * @param auto - The value for unset, `auto`, and unparsable inputs.
 * @returns The pixels, or the percentage left unresolved.
 */
export function toLength(input: Size1DInput, auto: number): Length.LengthInput {
  if (typeof input === 'number') {
    return input
  }

  if (input == null) {
    return auto
  }

  const parsed: Size1DValue | null = typeof input === 'string' ? parseSize1DInput(input) : input

  if (parsed === null || isKeywordValue(parsed)) {
    return auto
  }

  if (isNumberValue(parsed)) {
    return parsed.value
  }

  return parsed.unit === '%' ? Length.percent(parsed.value) : parsed.value
}

export function resolveSize1D(input: Size1DInput, auto: number, percentBasis: number): number {
  return Length.resolve(toLength(input, auto), percentBasis)
}
