import { type ParserInput, map, oneOf, parse } from 'valued'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

// How much of each rounded corner eases its curvature in, from 0 (circular
// fillets) to 1 (fully smoothed). Out-of-range input clamps.
const smoothingParser = map(oneOf([percentage(), number()]), toNormalized)

export type SmoothingInput = ParserInput<typeof smoothingParser> | number | undefined

const cache = createCache<string, number>(128)

const clamp = (value: number) => Math.min(Math.max(value, 0), 1)

/** Resolves a smoothing prop to `[0, 1]`. Unset and unparseable input is `0`. */
export function resolveSmoothing(input: SmoothingInput): number {
  if (typeof input === 'number') {
    return Number.isNaN(input) ? 0 : clamp(input)
  }
  if (input === undefined) {
    return 0
  }
  return cache(input, () => {
    const parsed = parse(input, smoothingParser)
    return parsed.valid ? clamp(parsed.value) : 0
  })
}
