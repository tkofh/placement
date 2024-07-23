import { type Offset, offset } from 'placement/offset'
import { type Point, isPoint } from 'placement/point'
import { type ParserInput, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { lengthPercentage } from 'valued/data/length-percentage'
import { number } from 'valued/data/number'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { resolveSize1D } from './size1d'

const offsetParser = between(
  oneOf([lengthPercentage.subset(SIZE_UNITS), number()]),
  {
    minLength: 1,
    maxLength: 4,
  },
)

const positiveOffsetParser = between(
  oneOf([
    lengthPercentage.subset(SIZE_UNITS, { minValue: 0 }),
    number({ min: 0 }),
  ]),
  {
    minLength: 1,
    maxLength: 4,
  },
)

type OffsetParser = typeof offsetParser

export type OffsetInput = ParserInput<OffsetParser> | Point | number | undefined

const cache = createCache<string, Offset>(512)

export function resolveOffset(
  input: OffsetInput,
  auto: Offset,
  allowNegative: boolean,
  parentWidth: number,
  parentHeight: number,
  rootWidth: number,
  rootHeight: number,
): Offset {
  if (input === undefined) {
    return auto
  }

  if (typeof input === 'number') {
    return offset(input)
  }

  if (isPoint(input)) {
    return offset.xy(input.x, input.y)
  }

  return cache(
    `${input.toString()}:${auto.top}:${auto.right}:${auto.bottom}:${auto.left}:${parentWidth}:${parentHeight}:${rootWidth}:${rootHeight}`,
    () => {
      const parsed = parse(
        input,
        allowNegative ? offsetParser : positiveOffsetParser,
      )
      if (!parsed.valid) {
        return auto
      }

      const [a, b, c, d] = parsed.value

      const top = resolveSize1D(a, 0, parentHeight, rootWidth, rootHeight)
      const right =
        b !== undefined
          ? resolveSize1D(b, 0, parentWidth, rootWidth, rootHeight)
          : top
      const bottom =
        c !== undefined
          ? resolveSize1D(c, 0, parentHeight, rootWidth, rootHeight)
          : top
      const left =
        d !== undefined
          ? resolveSize1D(d, 0, parentWidth, rootWidth, rootHeight)
          : right
      return offset.trbl(top, right, bottom, left)
    },
  )
}
