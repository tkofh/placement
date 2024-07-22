import { type ParserInput, parse } from 'valued'
import { lengthPercentage } from 'valued/data/length-percentage'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { resolveSize1D } from './size1d'

const gap = between(lengthPercentage.subset(SIZE_UNITS), {
  minLength: 1,
  maxLength: 2,
})

export type Gap = typeof gap

export type GapInput = ParserInput<Gap> | number | undefined

export interface GapValue {
  readonly rowGap: number
  readonly columnGap: number
}

const cache = createCache<string, GapValue>(512)

export function resolveGap(
  input: GapInput,
  auto: number,
  parentWidth: number,
  parentHeight: number,
  rootWidth: number,
  rootHeight: number,
): GapValue {
  if (typeof input === 'number' || input === undefined) {
    return {
      rowGap: input ?? auto,
      columnGap: input ?? auto,
    }
  }

  return cache(
    `${input}:${auto}:${parentWidth}:${parentHeight}:${rootWidth}:${rootHeight}`,
    () => {
      const parsed = parse(input, gap)
      if (!parsed.valid) {
        return {
          rowGap: auto,
          columnGap: auto,
        }
      }

      const [row, column] = parsed.value
      const rowGap = resolveSize1D(
        row,
        auto,
        parentHeight,
        rootWidth,
        rootHeight,
      )
      const columnGap =
        column === undefined
          ? rowGap
          : resolveSize1D(column, auto, parentWidth, rootWidth, rootHeight)

      return {
        rowGap,
        columnGap,
      }
    },
  )
}
