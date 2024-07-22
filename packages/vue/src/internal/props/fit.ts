import { type ParserInput, parse } from 'valued'
import { keywords } from 'valued/data/keyword'

const fitParser = keywords(['contain', 'cover', 'crop'])

type FitParser = typeof fitParser

export type FitInput = ParserInput<FitParser>

export const fit = {
  contain: 0,
  cover: 1,
  crop: 2,
  fill: 3,
} as const

export type Fit = (typeof fit)[keyof typeof fit]

export function resolveFit(input: string | undefined, auto: Fit): Fit {
  if (input === undefined) {
    return auto
  }

  const parsed = parse(input, fitParser)

  if (parsed.valid) {
    return fit[parsed.value.value]
  }

  return fit.crop
}
