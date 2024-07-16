import type { DimensionsLike } from 'placement/dimensions'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { oneOf } from 'valued/combinators'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'

const size1d = oneOf([lengthPercentage.subset(SIZE_UNITS), keywords(['auto'])])

export type Size1D = typeof size1d

export type Size1DInput = ParserInput<Size1D>

export type Size1DValue = ParserValue<Size1D>

const cache = createCache<string, number>(512)

export function toPixels(
  value: Size1DValue,
  basis: 'width' | 'height',
  auto: number,
  parent: DimensionsLike,
  root: DimensionsLike,
): number {
  if (isKeywordValue(value)) {
    return auto
  }

  const normalized = value.value / 100

  switch (value.unit) {
    case '%':
      return basis === 'width'
        ? parent.width * normalized
        : parent.height * normalized
    case 'px':
      return value.value
    case 'vw':
      return root.width * normalized
    case 'vh':
      return root.height * normalized
    case 'vmin':
      return Math.min(root.width, root.height) * normalized
    case 'vmax':
      return Math.max(root.width, root.height) * normalized
    case 'cqw':
      return parent.width * normalized
    case 'cqh':
      return parent.height * normalized
    case 'cqmin':
      return Math.min(parent.width, parent.height) * normalized
    case 'cqmax':
      return Math.max(parent.width, parent.height) * normalized
  }
}

export function parseSize1D(
  input: string,
  basis: 'width' | 'height',
  auto: number,
  root: DimensionsLike,
  parent: DimensionsLike,
): number {
  const key = `${basis}:${input}:${root.width}:${root.height}:${parent.width}:${parent.height}`
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, size1d)
  let value: number = Number.POSITIVE_INFINITY

  if (parsed.valid) {
    value = toPixels(parsed.value, basis, auto, parent, root)
  }

  cache.set(key, value)

  return value
}
