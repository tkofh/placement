import { type Dimensions, isDimensions } from 'placement/dimensions'
import { type Offset, offset } from 'placement/offset'
import { type Point, isPoint } from 'placement/point'
import type { Rect } from 'placement/rect'
import { type OffsetInput, parseOffset } from './props/offset'

export function resolveOffset(
  input: OffsetInput | Dimensions | Point | number | undefined,
  allowNegative: boolean,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Offset {
  if (input === undefined) {
    return offset.zero
  }

  if (typeof input === 'number') {
    return offset(input)
  }

  if (isDimensions(input)) {
    return offset.fromDimensions(input)
  }

  if (isPoint(input)) {
    return offset.fromPoint(input)
  }

  return parseOffset(input, allowNegative, parent, root)
}
