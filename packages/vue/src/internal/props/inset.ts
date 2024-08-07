import { type Offset, isOffset, offset, set } from 'placement/offset'
import { type Point, isPoint } from 'placement/point'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { allOf } from 'valued/combinators/allOf'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { keywords } from 'valued/data/keyword'
import {
  type LengthPercentageValue,
  lengthPercentage,
} from 'valued/data/length-percentage'
import { number } from 'valued/data/number'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { resolveSize1D } from './size1d'

const inset = oneOf([
  between(oneOf([lengthPercentage.subset(SIZE_UNITS), number()]), {
    minLength: 1,
    maxLength: 4,
  }),
  allOf([
    juxtapose([
      keywords(['top', 'bottom']),
      oneOf([lengthPercentage.subset(SIZE_UNITS), number()]),
    ]),
    juxtapose([
      keywords(['left', 'right']),
      oneOf([lengthPercentage.subset(SIZE_UNITS), number()]),
    ]),
  ]),
])

export type Inset = typeof inset

export type InsetInput =
  | ParserInput<Inset>
  | Offset
  | Point
  | number
  | undefined

type InsetValue = ParserValue<Inset>

const cache = createCache<string, Offset>(512)

function toOffset(
  value: InsetValue,
  parentWidth: number,
  parentHeight: number,
): Offset {
  const [a, b, c, d] = value

  if (Array.isArray(a) && Array.isArray(b)) {
    const [yEdge, yValue] = a
    const [xEdge, xValue] = b

    return offset.infinity.pipe(
      set(yEdge.value, resolveSize1D(yValue, 0, parentHeight)),
      set(xEdge.value, resolveSize1D(xValue, 0, parentWidth)),
    )
  }

  const top = resolveSize1D(
    a as LengthPercentageValue<(typeof SIZE_UNITS)[number]>,
    0,
    parentHeight,
  )
  const right = resolveSize1D(
    (b ?? a) as LengthPercentageValue<(typeof SIZE_UNITS)[number]>,
    0,
    parentWidth,
  )
  if (b === undefined) {
    return offset.xy(right, top)
  }

  return offset.trbl(
    top,
    right,
    c === undefined ? top : resolveSize1D(c, 0, parentHeight),
    d === undefined ? right : resolveSize1D(d, 0, parentWidth),
  )
}

export function resolveInset(
  input: InsetInput,
  auto: Offset,
  parentWidth: number,
  parentHeight: number,
): Offset {
  if (input == null) {
    return auto
  }

  if (typeof input === 'number') {
    return offset(input)
  }

  if (isOffset(input)) {
    return input
  }

  if (isPoint(input)) {
    return offset.xy(input.x, input.y)
  }

  return cache(
    `${input}:${auto.top}:${auto.right}:${auto.bottom}:${auto.left}:${parentWidth}:${parentHeight}`,
    () => {
      const parsed = parse(input, inset)
      if (!parsed.valid) {
        return auto
      }

      const value = parsed.value
      return toOffset(value, parentWidth, parentHeight)
    },
  )
}
