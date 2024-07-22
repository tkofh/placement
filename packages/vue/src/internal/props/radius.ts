import { type Point, isPoint, point } from 'placement/point'
import { type ParserInput, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { resolveSize1D } from './size1d'

const radius = between(
  oneOf([lengthPercentage.subset(SIZE_UNITS), keywords(['auto'])]),
  { minLength: 1, maxLength: 2 },
)

export type Radius = typeof radius

export type RadiusInput = ParserInput<Radius> | Point | number | undefined

const cache = createCache<string, Point>(512)

export function resolveRadius(
  input: RadiusInput,
  auto: Point,
  parentWidth: number,
  parentHeight: number,
  rootWidth: number,
  rootHeight: number,
): Point {
  if (typeof input === 'number') {
    return point(input, input)
  }

  if (isPoint(input)) {
    return input
  }

  if (input === undefined) {
    return auto
  }

  return cache(
    `${input}:${parentWidth}:${parentHeight}:${rootWidth}:${rootHeight}`,
    () => {
      const value = parse(input, radius)

      if (!value.valid) {
        return auto
      }

      const [rx, ry] = value.value

      const x = resolveSize1D(rx, 0, parentWidth, rootWidth, rootHeight)

      return point(
        x,
        ry != null
          ? resolveSize1D(ry, 0, parentHeight, rootWidth, rootHeight)
          : x,
      )
    },
  )
}
