import { parse } from 'valued'
import { oneOf } from 'valued'
import { someOf } from 'valued'
import { optional } from 'valued'
import { color } from 'valued/data/color'
import { isKeywordValue, keyword, keywords } from 'valued/data/keyword'
import { createCache } from '../cache.ts'

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

// Property names are the kebab-case SVG presentation attribute names so an
// instance can be spread verbatim onto an SVG element's attrs: browsers
// ignore unknown camelCase attributes like `fillRule`.
export class Fill {
  readonly fill: string | undefined
  readonly 'fill-rule': string | undefined

  constructor(fill: string | undefined = undefined, fillRule: string | undefined = undefined) {
    this.fill = fill
    this['fill-rule'] = fillRule
  }

  static empty = new Fill()
}

const cache = createCache<string, Fill>(512)

export function resolveFill(input: FillInput, auto = Fill.empty): Fill {
  if (input === undefined) {
    return auto
  }

  return cache(`${input}:${auto.fill}:${auto['fill-rule']}`, () => {
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
