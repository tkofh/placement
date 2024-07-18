import { type Dimensions, isDimensions } from 'placement/dimensions'
import { type Point, isPoint } from 'placement/point'
import type { Rect } from 'placement/rect'
import {
  type OffsetInput,
  type OffsetValue,
  ZERO_OFFSET,
  parseOffset,
} from './props/offset'

export function resolveOffset(
  input: OffsetInput | Dimensions | Point | number | undefined,
  allowNegative: boolean,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): OffsetValue {
  if (input === undefined) {
    return ZERO_OFFSET
  }

  if (typeof input === 'number') {
    return {
      top: input,
      right: input,
      bottom: input,
      left: input,
    }
  }

  if (isDimensions(input)) {
    return {
      top: input.height * 0.5,
      right: input.width * 0.5,
      bottom: input.height * 0.5,
      left: input.width * 0.5,
    }
  }

  if (isPoint(input)) {
    return {
      top: input.y,
      right: input.x,
      bottom: input.y,
      left: input.x,
    }
  }

  return parseOffset(input, allowNegative, parent, root)
}
