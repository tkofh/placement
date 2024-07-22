import { type ParserInput, type ParserValue, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'

const size1d = oneOf([lengthPercentage.subset(SIZE_UNITS), keywords(['auto'])])

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

// export function toPixels(
//   value: Size1DValue,
//   basis: 'width' | 'height',
//   auto: number,
//   parentWidth: number,
//   parentHeight: number,
//   rootWidth: number,
//   rootHeight: number,
// ): number {
//   if (isKeywordValue(value)) {
//     return auto
//   }
//
//   const normalized = value.value / 100
//
//   switch (value.unit) {
//     case '%':
//       return basis === 'width'
//         ? parentWidth * normalized
//         : parentHeight * normalized
//     case 'px':
//       return value.value
//     case 'vw':
//       return rootWidth * normalized
//     case 'vh':
//       return rootHeight * normalized
//     case 'vmin':
//       return Math.min(rootWidth, rootHeight) * normalized
//     case 'vmax':
//       return Math.max(rootWidth, rootHeight) * normalized
//     // case 'cqw':
//     //   return parentWidth * normalized
//     // case 'cqh':
//     //   return parentHeight * normalized
//     // case 'cqmin':
//     //   return Math.min(parentWidth, parentHeight) * normalized
//     // case 'cqmax':
//     //   return Math.max(parentWidth, parentHeight) * normalized
//   }
// }
//
// export const BASIS_WIDTH = 0
// export const BASIS_HEIGHT = 1

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
//
// export function parseSize1D(
//   input: string,
//   basis: typeof BASIS_WIDTH | typeof BASIS_HEIGHT,
//   auto: number,
//   parentWidth: number,
//   parentHeight: number,
//   rootWidth: number,
//   rootHeight: number,
// ): number {
//   const key = `${input}:${basis}:${auto}:${parentWidth}:${parentHeight}:${rootWidth}:${rootHeight}`
//   const cached = cache.get(key)
//   if (cached !== undefined) {
//     return cached
//   }
//
//   const parsed = parse(input, size1d)
//   let value: number = Number.POSITIVE_INFINITY
//
//   if (parsed.valid) {
//     value = toPixels(
//       parsed.value,
//       basis,
//       auto,
//       parentWidth,
//       parentHeight,
//       rootWidth,
//       rootHeight,
//     )
//   }
//
//   cache.set(key, value)
//
//   return value
// }
