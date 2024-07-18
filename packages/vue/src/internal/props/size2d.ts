import {
  type Dimensions,
  contain,
  cover,
  dimensions,
} from 'placement/dimensions'
import type { Rect } from 'placement/rect'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { isRatioValue, ratio } from 'valued/data/ratio'
import { between } from 'valued/multipliers/between'
import { SIZE_UNITS } from './constants'
import { type Size1DValue, toPixels } from './size1d'

const size2d = oneOf([
  between(lengthPercentage.subset(SIZE_UNITS), { minLength: 1, maxLength: 2 }),
  juxtapose([
    ratio(),
    keywords(['width', 'height']),
    lengthPercentage.subset(SIZE_UNITS),
  ]),
  keywords(['fill']),
  juxtapose([keywords(['cover', 'contain']), ratio()]),
])

export type Size2D = typeof size2d

export type Size2DInput = ParserInput<Size2D>

export type Size2DValue = ParserValue<Size2D>

const cache = new Map<string, Dimensions>()
const infinity = dimensions(Number.POSITIVE_INFINITY)

function toDimensions(
  value: Size2DValue,
  auto: number,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Dimensions {
  if (isKeywordValue(value)) {
    return dimensions(parent.width, parent.height)
  }

  if (value.length === 3) {
    const [ratio, dimension, length] = value

    if (ratio.isDegenerate) {
      return infinity
    }

    const pixels = toPixels(
      length,
      dimension.value,
      Number.POSITIVE_INFINITY,
      parent,
      root,
    )

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

    if (a.value === 'cover') {
      return cover(parent, b.value)
    }

    return contain(parent, b.value)
  }

  const width = toPixels(a as Size1DValue, 'width', auto, parent, root)
  const height =
    b === undefined
      ? width
      : toPixels(b as Size1DValue, 'height', auto, parent, root)

  return dimensions(width, height)
}

export function parseSize2D(
  input: string,
  auto: number,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Dimensions {
  const key = `${input}:${String(auto)}:${String(parent.width)}:${String(parent.height)}:${String(root.width)}:${String(root.height)}`
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, size2d)
  let value: Dimensions = infinity

  if (parsed.valid) {
    value = toDimensions(parsed.value, auto, parent, root)
  }

  cache.set(key, value)

  return value
}
