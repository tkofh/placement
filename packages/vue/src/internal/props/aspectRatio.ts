import { type ParserInput, parse } from 'valued'
import { oneOf } from 'valued/combinators/oneOf'
import { keyword } from 'valued/data/keyword'
import { isRatioValue, ratio } from 'valued/data/ratio'
import { createCache } from '../cache'

const aspectRatio = oneOf([ratio(), keyword('auto')])

export type AspectRatio = typeof aspectRatio

export type AspectRatioInput = ParserInput<AspectRatio> | number | undefined

const cache = createCache<string, number>(512)

export function resolveAspectRatio(
  input: AspectRatioInput,
  auto = Number.POSITIVE_INFINITY,
): number {
  if (typeof input === 'number' || input === undefined) {
    return input ?? auto
  }

  return cache(`${input}:${auto}`, () => {
    const parsed = parse(input, aspectRatio)

    if (!parsed.valid) {
      return auto
    }

    const value = parsed.value

    if (isRatioValue(value) && !value.isDegenerate) {
      return value.value
    }

    return auto
  })
}
