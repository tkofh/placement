import { direction, wrap } from 'placement/flexbox'
import { type ParserInput, parse } from 'valued'
import { someOf } from 'valued/combinators/someOf'
import { keywords } from 'valued/data/keyword'

const flow = someOf([
  keywords(['row', 'row-reverse', 'column', 'column-reverse']),
  keywords(['wrap', 'nowrap', 'wrap-reverse']),
])

export type Flow = typeof flow

export type FlowInput = ParserInput<Flow>

type Direction = (typeof direction)[keyof typeof direction]
type Wrap = (typeof wrap)[keyof typeof wrap]

export interface ParsedFlow {
  readonly direction: Direction
  readonly wrap: Wrap
}

export function resolveFlow(
  input: string | undefined,
  autoDirection: Direction = 0,
  autoWrap: Wrap = 0,
): ParsedFlow {
  if (input == null) {
    return {
      direction: autoDirection,
      wrap: autoWrap,
    }
  }

  const result = parse(input, flow)

  let directionResult: Direction = autoDirection
  let wrapResult: Wrap = autoWrap

  if (result.valid) {
    const [directionValue, wrapValue] = result.value

    switch (directionValue?.value) {
      case 'row':
        directionResult = direction.row
        break
      case 'row-reverse':
        directionResult = direction.rowReverse
        break
      case 'column':
        directionResult = direction.column
        break
      case 'column-reverse':
        directionResult = direction.columnReverse
        break
    }

    switch (wrapValue?.value) {
      case 'wrap':
        wrapResult = wrap.wrap
        break
      case 'nowrap':
        wrapResult = wrap.nowrap
        break
      case 'wrap-reverse':
        wrapResult = wrap.wrapReverse
        break
    }
  }

  return {
    direction: directionResult,
    wrap: wrapResult,
  }
}
