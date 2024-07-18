import type { Dimensions } from 'placement/dimensions'
import type { Rect } from 'placement/rect'
import { type ParserInput, parse } from 'valued'
import { lengthPercentage } from 'valued/data/length-percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { toPixels } from './size1d'

const gap = between(lengthPercentage.subset(SIZE_UNITS), {
  minLength: 1,
  maxLength: 2,
})

export type Gap = typeof gap

export type GapInput = ParserInput<Gap>

export interface GapValue {
  readonly rowGap: number
  readonly columnGap: number
}

const cache = createCache<string, GapValue>(512)

export function parseGap(
  input: string,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): GapValue {
  const key = `${input}:${parent.width}:${parent.height}:${root.width}:${root.height}`
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, gap)

  let rowGap = 0
  let columnGap = 0

  if (parsed.valid) {
    const [row, column] = parsed.value
    rowGap = toPixels(row, 'height', 0, parent, root)
    columnGap =
      column === undefined ? rowGap : toPixels(column, 'width', 0, parent, root)
  }

  const result = {
    rowGap,
    columnGap,
  }
  cache.set(key, result)

  return result
}
