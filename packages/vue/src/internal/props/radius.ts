import type { Dimensions } from 'placement/dimensions'
import { type Point, point } from 'placement/point'
import type { Rect } from 'placement/rect'
import { type ParserInput, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { toPixels } from './size1d'

const radius = between(
  oneOf([lengthPercentage.subset(SIZE_UNITS), keywords(['auto'])]),
  { minLength: 1, maxLength: 2 },
)

export type Radius = typeof radius

export type RadiusInput = ParserInput<Radius>

const cache = createCache<string, Point>(512)

export function parseRadius(
  input: string,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Point {
  const key = `${input}:${parent.width}:${parent.height}:${root.width}:${root.height}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const value = parse(input, radius)

  let x = 0
  let y = 0

  if (value.valid) {
    const [rx, ry] = value.value

    x = toPixels(rx, 'width', 0, parent, root)
    y = ry != null ? toPixels(ry, 'height', 0, parent, root) : x
  }

  const result = point(x, y)
  cache.set(key, result)

  return result
}
