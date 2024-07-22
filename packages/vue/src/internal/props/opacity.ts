import { type ParserInput, parse } from 'valued'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { someOf } from 'valued/combinators/someOf'
import { type NumberValue, isNumberValue, number } from 'valued/data/number'
import { type PercentageValue, percentage } from 'valued/data/percentage'
import { createCache } from '../cache'

const opacityParser = oneOf([
  number({ min: 0, max: 1 }),
  percentage({ minValue: 0, maxValue: 100 }),
  someOf([
    juxtapose([
      'fill',
      oneOf([
        number({ min: 0, max: 1 }),
        percentage({ minValue: 0, maxValue: 100 }),
      ]),
    ]),
    juxtapose([
      'stroke',
      oneOf([
        number({ min: 0, max: 1 }),
        percentage({ minValue: 0, maxValue: 100 }),
      ]),
    ]),
  ]),
])

type OpacityParser = typeof opacityParser

export type OpacityInput =
  | ParserInput<OpacityParser>
  | number
  | string
  | undefined

export class Opacity {
  constructor(
    readonly fillOpacity: number | undefined = undefined,
    readonly strokeOpacity: number | undefined = undefined,
  ) {}

  static empty = new Opacity()
}

function toOpacityValue(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }

  return input.value / 100
}

const cache = createCache<string, Opacity>(512)

export function resolveOpacity(
  input: OpacityInput,
  auto: Opacity = Opacity.empty,
): Opacity {
  if (typeof input === 'number') {
    return new Opacity(input, input)
  }

  if (input === undefined) {
    return auto
  }

  return cache(
    `${input.toString()}:${auto.fillOpacity}:${auto.strokeOpacity}`,
    () => {
      const parsed = parse(input, opacityParser)

      if (!parsed.valid) {
        return auto
      }

      if (Array.isArray(parsed.value)) {
        const [first, second] = parsed.value
        return new Opacity(
          first !== null ? toOpacityValue(first[0]) : undefined,
          second !== null ? toOpacityValue(second[0]) : undefined,
        )
      }
      const value = toOpacityValue(parsed.value)
      return new Opacity(value, value)
    },
  )
}
