import type { Dimensions } from 'placement/dimensions'
import { type Offset, offset } from 'placement/offset'
import type { Rect } from 'placement/rect'
import { type ParserInput, parse } from 'valued'
import { lengthPercentage } from 'valued/data/length-percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { toPixels } from './size1d'

const offsetParser = between(lengthPercentage.subset(SIZE_UNITS), {
  minLength: 1,
  maxLength: 4,
})

const positiveOffsetParser = between(
  lengthPercentage.subset(SIZE_UNITS, { minValue: 0 }),
  {
    minLength: 1,
    maxLength: 4,
  },
)

type OffsetParser = typeof offsetParser

export type OffsetInput = ParserInput<OffsetParser>

const cache = createCache<string, Offset>(512)

export function parseOffset(
  input: string,
  allowNegative: boolean,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Offset {
  const key = `${input}:${parent.width}:${parent.height}:${root.width}:${root.height}`

  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(
    input,
    allowNegative ? offsetParser : positiveOffsetParser,
  )

  let result = offset.zero

  if (parsed.valid) {
    const [a, b, c, d] = parsed.value

    const top = toPixels(a, 'height', 0, parent, root)
    const right = b !== undefined ? toPixels(b, 'width', 0, parent, root) : top
    const bottom =
      c !== undefined ? toPixels(c, 'height', 0, parent, root) : top
    const left = d !== undefined ? toPixels(d, 'width', 0, parent, root) : right
    result = offset.trbl(top, right, bottom, left)
  }

  cache.set(key, result)

  return result
}
