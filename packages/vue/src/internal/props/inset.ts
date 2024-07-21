import type { Dimensions } from 'placement/dimensions'
import { type Offset, offset, set } from 'placement/offset'
import type { Rect } from 'placement/rect'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { allOf } from 'valued/combinators/allOf'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { keywords } from 'valued/data/keyword'
import {
  type LengthPercentageValue,
  lengthPercentage,
} from 'valued/data/length-percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { toPixels } from './size1d'

const inset = oneOf([
  between(lengthPercentage.subset(SIZE_UNITS), {
    minLength: 1,
    maxLength: 4,
  }),
  allOf([
    juxtapose([
      keywords(['top', 'bottom']),
      lengthPercentage.subset(SIZE_UNITS),
    ]),
    juxtapose([
      keywords(['left', 'right']),
      lengthPercentage.subset(SIZE_UNITS),
    ]),
  ]),
])

export type Inset = typeof inset

export type InsetInput = ParserInput<Inset>

type InsetValue = ParserValue<Inset>

const cache = createCache<string, Offset>(512)

function toOffset(
  value: InsetValue,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Offset {
  const [a, b, c, d] = value

  if (Array.isArray(a) && Array.isArray(b)) {
    const [yEdge, yValue] = a
    const [xEdge, xValue] = b

    return offset.infinity.pipe(
      set(yEdge.value, toPixels(yValue, 'height', 0, parent, root)),
      set(xEdge.value, toPixels(xValue, 'width', 0, parent, root)),
    )
  }

  const top = toPixels(
    a as LengthPercentageValue<(typeof SIZE_UNITS)[number]>,
    'height',
    0,
    parent,
    root,
  )
  const right = toPixels(
    (b ?? a) as LengthPercentageValue<(typeof SIZE_UNITS)[number]>,
    'width',
    0,
    parent,
    root,
  )
  if (b === undefined) {
    return offset.xy(right, top)
  }

  return offset.trbl(
    top,
    right,
    c === undefined ? top : toPixels(c, 'height', 0, parent, root),
    d === undefined ? right : toPixels(d, 'width', 0, parent, root),
  )
}

export function parseInset(
  input: string,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Offset {
  const key = `${input}:${parent.width}:${parent.height}:${root.width}:${root.height}`

  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, inset)

  let result = offset.zero

  if (parsed.valid) {
    result = toOffset(parsed.value, parent, root)
  }

  cache.set(key, result)

  return result
}
