import * as Point from 'placement/point'
import { type ParserInput, parse } from 'valued'
import { oneOf } from 'valued'
import { between } from 'valued'
import { keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { number } from 'valued/data/number'
import { createCache } from '../cache.ts'
import { SIZE_UNITS } from './constants.ts'
import { resolveSize1D } from './size1d.ts'

const radius = between(
  oneOf([
    lengthPercentage.subset(SIZE_UNITS, { minValue: 0 }),
    number({ min: 0 }),
    keywords(['auto']),
  ]),
  { minLength: 1, maxLength: 2 },
)

export type Radius = typeof radius

export type RadiusInput = ParserInput<Radius> | Point.Point | number | undefined

const cache = createCache<string, Point.Point>(512)

export function resolveRadius(
  input: RadiusInput,
  auto: Point.Point,
  parentWidth: number,
  parentHeight: number,
): Point.Point {
  if (typeof input === 'number') {
    return Point.make(input, input)
  }

  if (Point.isPoint(input)) {
    return input
  }

  if (input === undefined) {
    return auto
  }

  return cache(`${input}:${auto.x}:${auto.y}:${parentWidth}:${parentHeight}`, () => {
    const value = parse(input, radius)

    if (!value.valid) {
      return auto
    }

    const [rx, ry] = value.value

    const x = resolveSize1D(rx, 0, parentWidth)

    return Point.make(x, ry != null ? resolveSize1D(ry, 0, parentHeight) : x)
  })
}
