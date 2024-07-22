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
  | undefined

export class Fill {
  constructor(
    readonly fill: string | undefined = undefined,
    readonly fillRule: string | undefined = undefined,
  ) {}

  static empty = new Fill()
}

const cache = createCache<string, Fill>(512)

export function resolveFill(input: FillInput, auto = Fill.empty): Fill {
  if (input === undefined) {
    return auto
  }

  return cache(`${input}:${auto.fill}:${auto.fillRule}`, () => {
    const parsed = parse(input, fillParser)

    if (!parsed.valid) {
      return auto
    }

    if (Array.isArray(parsed.value)) {
      const [fillColor, fillRule] = parsed.value
      return new Fill(fillColor?.serialize('color'), fillRule?.value)
    }
    if (isKeywordValue(parsed.value)) {
      return new Fill('transparent')
    }
    return new Fill(parsed.value.serialize('color'))
  })
}
