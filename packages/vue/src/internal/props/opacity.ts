import { type ParserInput, parse } from 'valued'
import { juxtapose } from 'valued'
import { oneOf } from 'valued'
import { someOf } from 'valued'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

const opacityParser = oneOf([
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
])

type OpacityParser = typeof opacityParser

export type OpacityInput = ParserInput<OpacityParser> | number | string | undefined

export class Opacity {
  readonly fillOpacity: number | undefined
  readonly strokeOpacity: number | undefined

  constructor(
    fillOpacity: number | undefined = undefined,
    strokeOpacity: number | undefined = undefined,
  ) {
    this.fillOpacity = fillOpacity
    this.strokeOpacity = strokeOpacity
  }

  static empty = new Opacity()
}

const cache = createCache<string, Opacity>(512)

export function resolveOpacity(input: OpacityInput, auto: Opacity = Opacity.empty): Opacity {
  if (typeof input === 'number') {
    return new Opacity(input, input)
  }

  if (input === undefined) {
    return auto
  }

  return cache(`${input.toString()}:${auto.fillOpacity}:${auto.strokeOpacity}`, () => {
    const parsed = parse(input, opacityParser)

    if (!parsed.valid) {
      return auto
    }

    if (Array.isArray(parsed.value)) {
      const [first, second] = parsed.value
      return new Opacity(
        first !== null ? toNormalized(first[0]) : undefined,
        second !== null ? toNormalized(second[0]) : undefined,
      )
    }
    const value = toNormalized(parsed.value)
    return new Opacity(value, value)
  })
}
