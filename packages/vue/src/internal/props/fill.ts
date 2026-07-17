import { map, oneOf, optional, parse, someOf } from 'valued'
import { color } from 'valued/data/color'
import { isKeywordValue, keyword, keywords } from 'valued/data/keyword'
import { createCache } from '../cache.ts'

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

const fillParser = map(
  oneOf([keyword('none'), color(), someOf([color(), optional(keywords(['evenodd', 'nonzero']))])]),
  (value): Fill => {
    if (Array.isArray(value)) {
      const [fillColor, fillRule] = value
      return new Fill(fillColor?.serialize('color'), fillRule?.value)
    }
    if (isKeywordValue(value)) {
      return new Fill('transparent')
    }
    return new Fill(value.serialize('color'))
  },
)

const cache = createCache<string, Fill | null>(512)

function parseFill(input: string): Fill | null {
  return cache(input, () => {
    const parsed = parse(input, fillParser)
    return parsed.valid ? parsed.value : null
  })
}

export function resolveFill(input: FillInput, auto = Fill.empty): Fill {
  if (input === undefined) {
    return auto
  }

  return parseFill(input) ?? auto
}
