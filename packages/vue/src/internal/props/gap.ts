import { type ParserInput, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { lengthPercentage } from 'valued/data/length-percentage'
import { number } from 'valued/data/number'
import { between } from 'valued/multipliers/between'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { resolveSize1D } from './size1d'

const gap = between(oneOf([lengthPercentage.subset(SIZE_UNITS), number()]), {
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
  autoRow: number,
  autoColumn: number,
  parentWidth: number,
  parentHeight: number,
): GapValue {
  if (typeof input === 'number' || input === undefined) {
    return {
      rowGap: input ?? autoRow,
      columnGap: input ?? autoColumn,
    }
  }

  return cache(
    `${input}:${autoRow}:${autoColumn}:${parentWidth}:${parentHeight}`,
    () => {
      const parsed = parse(input, gap)
      if (!parsed.valid) {
        return {
          rowGap: autoRow,
          columnGap: autoColumn,
        }
      }

      const [row, column] = parsed.value
      const rowGap = resolveSize1D(row, autoRow, parentHeight)
      const columnGap =
        column === undefined
          ? rowGap
          : resolveSize1D(column, autoColumn, parentWidth)

      return {
        rowGap,
        columnGap,
      }
    },
  )
}
