import { parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { color } from 'valued/data/color'
import { isKeywordValue, keyword, keywords } from 'valued/data/keyword'
import { optional } from 'valued/multipliers/optional'
import { createCache } from '../cache'

const fillParser = oneOf([
  keyword('none'),
  color(),
  someOf([color(), optional(keywords(['evenodd', 'nonzero']))]),
])

export type FillInput =
  | `${'evenodd' | 'nonzero'} ${string}`
  | `${string} ${'evenodd' | 'nonzero'}`
  | (string & {})

export class Fill {
  constructor(
    readonly fill: string | undefined = undefined,
    readonly fillRule: string | undefined = undefined,
  ) {}

  static empty = new Fill()
}

const cache = createCache<string, Fill>(512)
export function parseFill(input: string): Fill {
  const cached = cache.get(input)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, fillParser)

  let fill = Fill.empty

  if (parsed.valid) {
    if (Array.isArray(parsed.value)) {
      const [fillColor, fillRule] = parsed.value
      fill = new Fill(fillColor?.serialize('color'), fillRule?.value)
    } else if (isKeywordValue(parsed.value)) {
      fill = new Fill('transparent')
    } else {
      fill = new Fill(parsed.value.serialize('color'))
    }
  }

  cache.set(input, fill)

  return fill
}
