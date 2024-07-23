import { type ParserInput, type ParserValue, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { isNumberValue, number } from 'valued/data/number'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'

const size1d = oneOf([
  lengthPercentage.subset(SIZE_UNITS),
  number({ min: 0 }),
  keywords(['auto']),
])

export type Size1D = typeof size1d

export type Size1DValue = ParserValue<Size1D>

export type Size1DInput = ParserInput<Size1D> | Size1DValue | number | undefined

const parseCache = createCache<string, Size1DValue | null>(512)
const normalizationCache = createCache<string, number>(1024)

function parseSize1DInput(input: string): Size1DValue | null {
  return parseCache(input, () => {
    const parsed = parse(input, size1d)
    return parsed.valid ? parsed.value : null
  })
}

export function normalizeSize1DValue(
  value: Size1DValue,
  auto: number,
  percentBasis: number,
  rootWidth: number,
  rootHeight: number,
): number {
  return normalizationCache(
    `${auto}:${percentBasis}:${rootWidth}:${rootHeight}:${value.toString()}`,
    () => {
      if (value === null || isKeywordValue(value)) {
        return auto
      }

      if (isNumberValue(value)) {
        return value.value
      }

      switch (value.unit) {
        case 'px':
          return value.value
        case '%':
          return percentBasis * value.value * 0.01
        case 'vw':
          return rootWidth * value.value * 0.01
        case 'vh':
          return rootHeight * value.value * 0.01
        case 'vmin':
          return Math.min(rootWidth, rootHeight) * value.value * 0.01
        case 'vmax':
          return Math.max(rootWidth, rootHeight) * value.value * 0.01
      }
    },
  )
}

export function resolveSize1D(
  input: Size1DInput,
  auto: number,
  percentBasis: number,
  rootWidth: number,
  rootHeight: number,
) {
  if (typeof input === 'number') {
    return input
  }

  if (input == null) {
    return auto
  }

  const parsed: Size1DValue | null =
    typeof input === 'string' ? parseSize1DInput(input) : input

  if (parsed === null) {
    return auto
  }

  return normalizeSize1DValue(parsed, auto, percentBasis, rootWidth, rootHeight)
}
