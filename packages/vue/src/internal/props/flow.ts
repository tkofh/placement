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

export interface ParsedFlow {
  readonly direction: (typeof direction)[keyof typeof direction]
  readonly wrap: (typeof wrap)[keyof typeof wrap]
}

export function parseFlow(input: string): ParsedFlow {
  const result = parse(input, flow)

  let directionResult: ParsedFlow['direction'] = direction.row
  let wrapResult: ParsedFlow['wrap'] = wrap.nowrap

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
