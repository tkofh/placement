import {
  type Dimensions,
  contain,
  cover,
  dimensions,
  isDimensions,
} from 'placement/dimensions'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { number } from 'valued/data/number'
import { isRatioValue, ratio } from 'valued/data/ratio'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { type Size1DValue, resolveSize1D } from './size1d'

const size2d = oneOf([
  keywords(['fill', 'auto']),
  between(oneOf([lengthPercentage.subset(SIZE_UNITS), number({ min: 0 })]), {
    minLength: 1,
    maxLength: 2,
  }),
  juxtapose([
    ratio(),
    keywords(['width', 'height']),
    oneOf([lengthPercentage.subset(SIZE_UNITS), number({ min: 0 })]),
  ]),
  juxtapose([keywords(['cover', 'contain']), ratio()]),
])

export type Size2D = typeof size2d

export type Size2DInput = ParserInput<Size2D> | Dimensions | number | undefined

export type Size2DValue = ParserValue<Size2D>

const infinity = dimensions(Number.POSITIVE_INFINITY)

const parseCache = createCache<string, Size2DValue | null>(5000)
const normalizationCache = createCache<string, Dimensions>(5000)

function parseSize2D(input: string): Size2DValue | null {
  return parseCache(input, () => {
    const parsed = parse(input, size2d)
    return parsed.valid ? parsed.value : null
  })
}

function normalizeSize2DValue(
  value: Size2DValue,
  auto: Dimensions,
  parentWidth: number,
  parentHeight: number,
): Dimensions {
  return normalizationCache(
    `${auto.width}:${auto.height}:${parentWidth}:${parentHeight}:${value.toString()}`,
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: it is what it is
    () => {
      if (isKeywordValue(value)) {
        return value.value === 'auto'
          ? auto
          : dimensions(parentWidth, parentHeight)
      }

      if (value.length === 3) {
        const [ratio, dimension, length] = value

        if (ratio.isDegenerate) {
          return infinity
        }

        const percentBasis =
          dimension.value === 'width' ? parentWidth : parentHeight

        const pixels = resolveSize1D(length, 0, percentBasis)

        return dimensions(
          dimension.value === 'width' ? pixels : ratio.heightToWidth(pixels),
          dimension.value === 'height' ? pixels : ratio.widthToHeight(pixels),
        )
      }

      const [a, b] = value

      if (isKeywordValue(a) && isRatioValue(b)) {
        if (b.isDegenerate) {
          return infinity
        }

        const parent = dimensions(parentWidth, parentHeight)

        if (a.value === 'cover') {
          return cover(parent, b.value)
        }

        return contain(parent, b.value)
      }

      return dimensions(
        resolveSize1D(a as Size1DValue, 0, parentWidth),
        resolveSize1D(
          (b === undefined ? a : b) as Size1DValue,
          0,
          parentHeight,
        ),
      )
    },
  )
}

export function resolveSize2D(
  input: Size2DInput,
  auto: Dimensions,
  parentWidth: number,
  parentHeight: number,
) {
  if (isDimensions(input)) {
    return input
  }

  if (typeof input === 'number') {
    return dimensions(input, input)
  }

  if (input == null) {
    return auto
  }

  const parsed = parseSize2D(input)

  if (parsed === null) {
    return auto
  }

  return normalizeSize2DValue(parsed, auto, parentWidth, parentHeight)
}
