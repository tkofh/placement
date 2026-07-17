import * as Flexbox from 'placement/flexbox'
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
  readonly direction: Flexbox.FlexDirection
  readonly wrap: Flexbox.FlexWrap
}

export function resolveFlow(
  input: string | undefined,
  autoDirection: Flexbox.FlexDirection = 0,
  autoWrap: Flexbox.FlexWrap = 0,
): FlowValue {
  if (input == null) {
    return {
      direction: autoDirection,
      wrap: autoWrap,
    }
  }

  const result = parse(input, flow)

  let directionResult: Flexbox.FlexDirection = autoDirection
  let wrapResult: Flexbox.FlexWrap = autoWrap

  if (result.valid) {
    const [directionValue, wrapValue] = result.value

    switch (directionValue?.value) {
      case 'row':
        directionResult = Flexbox.direction.row
        break
      case 'row-reverse':
        directionResult = Flexbox.direction.rowReverse
        break
      case 'column':
        directionResult = Flexbox.direction.column
        break
      case 'column-reverse':
        directionResult = Flexbox.direction.columnReverse
        break
    }

    switch (wrapValue?.value) {
      case 'wrap':
        wrapResult = Flexbox.wrap.wrap
        break
      case 'nowrap':
        wrapResult = Flexbox.wrap.nowrap
        break
      case 'wrap-reverse':
        wrapResult = Flexbox.wrap.wrapReverse
        break
    }
  }

  return {
    direction: directionResult,
    wrap: wrapResult,
  }
}
