import * as Edge from 'placement/edge'
import { type ParserInput, map, oneOf, parse, someOf } from 'valued'
import { keywords } from 'valued/data/keyword'
import { number } from 'valued/data/number'
import { percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'
import { toNormalized } from './normalize.ts'

// Infinity is the core's auto sentinel for both port fields (see
// `placement/edge`).
export interface PortValue {
  side: number
  at: number
}

const auto: PortValue = {
  side: Number.POSITIVE_INFINITY,
  at: Number.POSITIVE_INFINITY,
}

// A side keyword, a position along the side, or both, in either order:
// `right`, `right 25%`, `25% right`, and `auto 0.5` all parse.
const portParser = map(
  someOf([keywords(['top', 'right', 'bottom', 'left', 'auto']), oneOf([percentage(), number()])]),
  ([side, at]): PortValue => ({
    side: side === null || side.value === 'auto' ? auto.side : Edge.side[side.value],
    at: at === null ? auto.at : toNormalized(at),
  }),
)

export type PortInput = ParserInput<typeof portParser> | undefined

const cache = createCache<string, PortValue>(256)

/** Resolves a port prop. Unset and unparseable input resolves to a fully auto port. */
export function resolvePort(input: PortInput): PortValue {
  if (input === undefined) {
    return auto
  }
  return cache(input, () => {
    const parsed = parse(input, portParser)
    return parsed.valid ? parsed.value : auto
  })
}
