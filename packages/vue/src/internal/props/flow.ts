import { type FlexDirection, type FlexWrap, direction, wrap } from 'placement/flexbox'
import { type ParserInput, parse } from 'valued'
import { someOf } from 'valued'
import { keywords } from 'valued/data/keyword'

const flow = someOf([
  keywords(['row', 'row-reverse', 'column', 'column-reverse']),
  keywords(['wrap', 'nowrap', 'wrap-reverse']),
])

export type Flow = typeof flow

export type FlowInput = ParserInput<Flow> | undefined

export interface FlowValue {
  readonly direction: FlexDirection
  readonly wrap: FlexWrap
}

export function resolveFlow(
  input: string | undefined,
  autoDirection: FlexDirection = 0,
  autoWrap: FlexWrap = 0,
): FlowValue {
  if (input == null) {
    return {
      direction: autoDirection,
      wrap: autoWrap,
    }
  }

  const result = parse(input, flow)

  let directionResult: FlexDirection = autoDirection
  let wrapResult: FlexWrap = autoWrap

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
