import type { Dimensions } from 'placement/dimensions'
import type { Rect } from 'placement/rect'
import { type ParserInput, parse } from 'valued'
import { lengthPercentage } from 'valued/data/length-percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { toPixels } from './size1d'

const offset = between(lengthPercentage.subset(SIZE_UNITS), {
  minLength: 1,
  maxLength: 4,
})

const positiveOffset = between(
  lengthPercentage.subset(SIZE_UNITS, { minValue: 0 }),
  {
    minLength: 1,
    maxLength: 4,
  },
)

export type Offset = typeof offset

export type OffsetInput = ParserInput<Offset>

export interface OffsetValue {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

const cache = createCache<string, OffsetValue>(512)

export const ZERO_OFFSET: OffsetValue = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

export function parseOffset(
  input: string,
  allowNegative: boolean,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): OffsetValue {
  const key = `${input}:${parent.width}:${parent.height}:${root.width}:${root.height}`

  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, allowNegative ? offset : positiveOffset)

  const result = {
    ...ZERO_OFFSET,
  } as Record<keyof OffsetValue, number>

  if (parsed.valid) {
    const [topValue, rightValue, bottomValue, leftValue] = parsed.value

    result.top =
      topValue == null ? 0 : toPixels(topValue, 'height', 0, parent, root)
    result.right =
      rightValue == null
        ? result.top
        : toPixels(rightValue, 'width', 0, parent, root)
    result.bottom =
      bottomValue == null
        ? result.top
        : toPixels(bottomValue, 'height', 0, parent, root)
    result.left =
      leftValue == null
        ? result.right
        : toPixels(leftValue, 'width', 0, parent, root)
  }

  cache.set(key, result)

  return result
}
