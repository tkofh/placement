import type { Dimensions } from 'placement/dimensions'
import type { Rect } from 'placement/rect'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { color } from 'valued/data/color'
import { keyword, keywords } from 'valued/data/keyword'
import { lengthPercentage } from 'valued/data/length-percentage'
import { number } from 'valued/data/number'
import { oneOrMore } from 'valued/multipliers/oneOrMore'
import { optional } from 'valued/multipliers/optional'
import { createCache } from '../cache'
import { SIZE_UNITS } from './constants'
import { toPixels } from './size1d'

const strokeParser = someOf([
  color(),
  lengthPercentage.subset(SIZE_UNITS),
  juxtapose([
    'join',
    keywords(['arcs', 'bevel', 'miter', 'miter-clip', 'round']),
    optional(number({ min: 1 })),
  ]),
  juxtapose(['cap', keywords(['butt', 'round', 'square'])]),
  oneOf([
    keyword('solid'),
    juxtapose([
      'dashed',
      oneOrMore(number()),
      optional(juxtapose(['offset', number()])),
    ]),
  ]),
])

type StrokeParser = typeof strokeParser

export type StrokeInput = ParserInput<StrokeParser>

type StrokeValue = ParserValue<StrokeParser>

export class Stroke {
  readonly stroke: string | undefined = undefined
  readonly 'stroke-width': string | undefined = undefined
  readonly 'stroke-dasharray': string | undefined = undefined
  readonly 'stroke-dashoffset': string | undefined = undefined
  readonly 'stroke-linecap': string | undefined = undefined
  readonly 'stroke-linejoin': string | undefined = undefined
  readonly 'stroke-miterlimit': string | undefined = undefined
  constructor(
    stroke: string | undefined = undefined,
    strokeWidth: string | undefined = undefined,
    strokeDasharray: string | undefined = undefined,
    strokeDashoffset: string | undefined = undefined,
    strokeLinecap: string | undefined = undefined,
    strokeLinejoin: string | undefined = undefined,
    strokeMiterlimit: string | undefined = undefined,
  ) {
    this.stroke = stroke
    this['stroke-width'] = strokeWidth
    this['stroke-dasharray'] = strokeDasharray
    this['stroke-dashoffset'] = strokeDashoffset
    this['stroke-linecap'] = strokeLinecap
    this['stroke-linejoin'] = strokeLinejoin
    this['stroke-miterlimit'] = strokeMiterlimit
  }

  static empty = new Stroke()
}

const cache = createCache<string, Stroke>(512)

function normalizeStroke(
  value: StrokeValue,
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
) {
  let result = Stroke.empty

  const [a, b, c, d, e] = value
  const stroke = a?.serialize('color')

  if (stroke != null) {
    let strokeDasharray: string | undefined
    let strokeDashoffset: string | undefined

    if (Array.isArray(e)) {
      const [dashArray, dashOffset] = e
      strokeDashoffset = dashOffset?.[0].value.toString()
      strokeDasharray = ''
      for (const value of dashArray) {
        strokeDasharray += ` ${value.value.toString()}`
      }
      strokeDasharray = strokeDasharray.slice(1)
    }

    result = new Stroke(
      stroke,
      b ? `${toPixels(b, 'width', 0, parent, root)}px` : undefined,
      strokeDasharray,
      strokeDashoffset,
      d?.[0].value,
      c !== null ? c[0].value : undefined,
      c !== null ? c[1]?.value.toString() : undefined,
    )
  }

  return result
}

export function parseStroke(
  input: string,
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
): Stroke {
  const key = `${input}:${parent.width}:${parent.height}:${root.width}:${root.height}`
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parsed = parse(input, strokeParser)

  let result = Stroke.empty

  if (parsed.valid) {
    result = normalizeStroke(parsed.value, parent, root)
  }

  cache.set(key, result)

  return result
}
