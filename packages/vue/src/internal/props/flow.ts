import * as Flexbox from 'placement/flexbox'
import { type ParserInput, map, parse, someOf } from 'valued'
import { keywords } from 'valued/data/keyword'

const directions = {
  row: Flexbox.direction.row,
  'row-reverse': Flexbox.direction.rowReverse,
  column: Flexbox.direction.column,
  'column-reverse': Flexbox.direction.columnReverse,
} as const

const wraps = {
  wrap: Flexbox.wrap.wrap,
  nowrap: Flexbox.wrap.nowrap,
  'wrap-reverse': Flexbox.wrap.wrapReverse,
} as const

const flow = map(
  someOf([
    keywords(['row', 'row-reverse', 'column', 'column-reverse']),
    keywords(['wrap', 'nowrap', 'wrap-reverse']),
  ]),
  ([direction, wrap]) => ({
    direction: direction !== null ? directions[direction.value] : undefined,
    wrap: wrap !== null ? wraps[wrap.value] : undefined,
  }),
)

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

  const parsed = parse(input, flow)

  if (!parsed.valid) {
    return {
      direction: autoDirection,
      wrap: autoWrap,
    }
  }

  return {
    direction: parsed.value.direction ?? autoDirection,
    wrap: parsed.value.wrap ?? autoWrap,
  }
}
