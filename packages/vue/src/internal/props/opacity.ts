import { type ParserInput, juxtapose, map, oneOf, parse, someOf } from 'valued'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

// Property names are the kebab-case SVG presentation attribute names, so that
// an instance can spread verbatim onto the attrs of an SVG element. Browsers
// ignore unknown camelCase attributes like `fillOpacity`.
export class Opacity {
  readonly 'fill-opacity': number | undefined
  readonly 'stroke-opacity': number | undefined

  constructor(
    fillOpacity: number | undefined = undefined,
    strokeOpacity: number | undefined = undefined,
  ) {
    this['fill-opacity'] = fillOpacity
    this['stroke-opacity'] = strokeOpacity
  }

  static empty = new Opacity()
}

const opacityParser = map(
  oneOf([
    number({ min: 0, max: 1 }),
    percentage({ minValue: 0, maxValue: 100 }),
    someOf([
      juxtapose([
        'fill',
        oneOf([number({ min: 0, max: 1 }), percentage({ minValue: 0, maxValue: 100 })]),
      ]),
      juxtapose([
        'stroke',
        oneOf([number({ min: 0, max: 1 }), percentage({ minValue: 0, maxValue: 100 })]),
      ]),
    ]),
  ]),
  (value): Opacity => {
    if (Array.isArray(value)) {
      const [fillValue, strokeValue] = value
      return new Opacity(
        fillValue !== null ? toNormalized(fillValue[0]) : undefined,
        strokeValue !== null ? toNormalized(strokeValue[0]) : undefined,
      )
    }

    const both = toNormalized(value)
    return new Opacity(both, both)
  },
)

type OpacityParser = typeof opacityParser

export type OpacityInput = ParserInput<OpacityParser> | number | string | undefined

const cache = createCache<string, Opacity | null>(512)

function parseOpacity(input: string): Opacity | null {
  return cache(input, () => {
    const parsed = parse(input, opacityParser)
    return parsed.valid ? parsed.value : null
  })
}

export function resolveOpacity(input: OpacityInput, auto: Opacity = Opacity.empty): Opacity {
  if (typeof input === 'number') {
    return new Opacity(input, input)
  }

  if (input === undefined) {
    return auto
  }

  return parseOpacity(input) ?? auto
}
