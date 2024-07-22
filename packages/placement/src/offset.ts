import { PRECISION } from './constants'
import type { Dimensions } from './dimensions'
import { Pipeable } from './internal/pipeable'
import type { Point } from './point'
import { dual } from './utils/function'
import { roundTo } from './utils/math'
import { hasProperty, isRecord } from './utils/object'

const TypeBrand: unique symbol = Symbol('placement/offset')
type TypeBrand = typeof TypeBrand

export interface OffsetLike {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

class Offset extends Pipeable implements OffsetLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number

  constructor(
    top: number,
    right: number,
    bottom: number,
    left: number,
    readonly precision: number,
  ) {
    super()

    this.top = roundTo(top, precision)
    this.right = roundTo(right, precision)
    this.bottom = roundTo(bottom, precision)
    this.left = roundTo(left, precision)
  }
}

export type { Offset }

type OffsetConstructor = {
  (offset: number, precision?: number): Offset

  xy(x: number, y: number, precision?: number): Offset
  trbl(
    top: number,
    right?: number,
    bottom?: number,
    left?: number,
    precision?: number,
  ): Offset
  fromPoint(point: Point, precision?: number): Offset
  fromDimensions(dimensions: Dimensions, precision?: number): Offset
  zero: Offset
  infinity: Offset
}

const offset = ((offset: number, precision = PRECISION): Offset =>
  new Offset(offset, offset, offset, offset, precision)) as OffsetConstructor

offset.xy = (x: number, y: number, precision = PRECISION) =>
  new Offset(y, x, y, x, precision)

offset.trbl = (
  top: number,
  right?: number,
  bottom?: number,
  left?: number,
  precision = PRECISION,
) =>
  new Offset(top, right ?? top, bottom ?? top, left ?? right ?? top, precision)

offset.fromPoint = (point: Point, precision = point.precision) =>
  new Offset(point.y, point.x, point.y, point.x, precision)

offset.fromDimensions = (
  dimensions: Dimensions,
  precision = dimensions.precision,
) =>
  new Offset(
    dimensions.height * 0.5,
    dimensions.width * 0.5,
    dimensions.height * 0.5,
    dimensions.width * 0.5,
    precision,
  )

offset.zero = new Offset(0, 0, 0, 0, PRECISION)
offset.infinity = new Offset(
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  PRECISION,
)

export { offset }

export function isOffset(value: unknown): value is Offset {
  return isRecord(value) && TypeBrand in value
}

export function isOffsetLike(value: unknown): value is OffsetLike {
  return (
    isRecord(value) &&
    hasProperty(value, 'top') &&
    hasProperty(value, 'right') &&
    hasProperty(value, 'bottom') &&
    hasProperty(value, 'left')
  )
}

export const top: {
  (offset: Offset, top: number): Offset
  (top: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, top: number) =>
    new Offset(top, offset.right, offset.bottom, offset.left, offset.precision),
)

export const right: {
  (offset: Offset, right: number): Offset
  (right: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, right: number) =>
    new Offset(offset.top, right, offset.bottom, offset.left, offset.precision),
)

export const bottom: {
  (offset: Offset, bottom: number): Offset
  (bottom: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, bottom: number) =>
    new Offset(offset.top, offset.right, bottom, offset.left, offset.precision),
)

export const left: {
  (offset: Offset, left: number): Offset
  (left: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, left: number) =>
    new Offset(offset.top, offset.right, offset.bottom, left, offset.precision),
)

export const precision: {
  (offset: Offset, precision: number): Offset
  (precision: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, precision: number) =>
    new Offset(offset.top, offset.right, offset.bottom, offset.left, precision),
)

export const x: {
  (offset: Offset, x: number): Offset
  (x: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, x: number) =>
    new Offset(offset.top, x, offset.bottom, x, offset.precision),
)

export const y: {
  (offset: Offset, y: number): Offset
  (y: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, y: number) =>
    new Offset(y, offset.right, y, offset.left, offset.precision),
)

export const set: {
  (
    offset: Offset,
    property: 'top' | 'right' | 'bottom' | 'left' | 'x' | 'y' | 'precision',
    value: number,
  ): Offset
  (
    property: 'top' | 'right' | 'bottom' | 'left' | 'x' | 'y' | 'precision',
    value: number,
  ): (offset: Offset) => Offset
} = dual(
  3,
  (
    offset: Offset,
    property: 'top' | 'right' | 'bottom' | 'left' | 'x' | 'y' | 'precision',
    value: number,
  ) => {
    switch (property) {
      case 'top':
        return new Offset(
          value,
          offset.right,
          offset.bottom,
          offset.left,
          offset.precision,
        )
      case 'right':
        return new Offset(
          offset.top,
          value,
          offset.bottom,
          offset.left,
          offset.precision,
        )
      case 'bottom':
        return new Offset(
          offset.top,
          offset.right,
          value,
          offset.left,
          offset.precision,
        )
      case 'left':
        return new Offset(
          offset.top,
          offset.right,
          offset.bottom,
          value,
          offset.precision,
        )
      case 'x':
        return new Offset(
          offset.top,
          value,
          offset.bottom,
          value,
          offset.precision,
        )
      case 'y':
        return new Offset(
          value,
          offset.right,
          value,
          offset.left,
          offset.precision,
        )
      case 'precision':
        return new Offset(
          offset.top,
          offset.right,
          offset.bottom,
          offset.left,
          value,
        )
    }
  },
)

export const minTop: {
  (offset: Offset, top: number): Offset
  (top: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, top: number) =>
    new Offset(
      Math.max(offset.top, top),
      offset.right,
      offset.bottom,
      offset.left,
      offset.precision,
    ),
)

export const minRight: {
  (offset: Offset, right: number): Offset
  (right: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, right: number) =>
    new Offset(
      offset.top,
      Math.max(offset.right, right),
      offset.bottom,
      offset.left,
      offset.precision,
    ),
)

export const minBottom: {
  (offset: Offset, bottom: number): Offset
  (bottom: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, bottom: number) =>
    new Offset(
      offset.top,
      offset.right,
      Math.max(offset.bottom, bottom),
      offset.left,
      offset.precision,
    ),
)

export const minLeft: {
  (offset: Offset, left: number): Offset
  (left: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, left: number) =>
    new Offset(
      offset.top,
      offset.right,
      offset.bottom,
      Math.max(offset.left, left),
      offset.precision,
    ),
)

export const maxTop: {
  (offset: Offset, top: number): Offset
  (top: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, top: number) =>
    new Offset(
      Math.min(offset.top, top),
      offset.right,
      offset.bottom,
      offset.left,
      offset.precision,
    ),
)

export const maxRight: {
  (offset: Offset, right: number): Offset
  (right: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, right: number) =>
    new Offset(
      offset.top,
      Math.min(offset.right, right),
      offset.bottom,
      offset.left,
      offset.precision,
    ),
)

export const maxBottom: {
  (offset: Offset, bottom: number): Offset
  (bottom: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, bottom: number) =>
    new Offset(
      offset.top,
      offset.right,
      Math.min(offset.bottom, bottom),
      offset.left,
      offset.precision,
    ),
)

export const maxLeft: {
  (offset: Offset, left: number): Offset
  (left: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, left: number) =>
    new Offset(
      offset.top,
      offset.right,
      offset.bottom,
      Math.min(offset.left, left),
      offset.precision,
    ),
)

export const add: {
  (offset: Offset, value: number | Offset): Offset
  (value: number | Offset): (offset: Offset) => Offset
} = dual(2, (offset: Offset, value: number | Offset) =>
  isOffset(value)
    ? new Offset(
        offset.top + value.top,
        offset.right + value.right,
        offset.bottom + value.bottom,
        offset.left + value.left,
        offset.precision,
      )
    : new Offset(
        offset.top + value,
        offset.right + value,
        offset.bottom + value,
        offset.left + value,
        offset.precision,
      ),
)

export const subtract: {
  (offset: Offset, value: number | Offset): Offset
  (value: number | Offset): (offset: Offset) => Offset
} = dual(2, (offset: Offset, value: number | Offset) =>
  isOffset(value)
    ? new Offset(
        offset.top - value.top,
        offset.right - value.right,
        offset.bottom - value.bottom,
        offset.left - value.left,
        offset.precision,
      )
    : new Offset(
        offset.top - value,
        offset.right - value,
        offset.bottom - value,
        offset.left - value,
        offset.precision,
      ),
)

export const scale: {
  (offset: Offset, value: number): Offset
  (value: number): (offset: Offset) => Offset
} = dual(
  2,
  (offset: Offset, value: number) =>
    new Offset(
      offset.top * value,
      offset.right * value,
      offset.bottom * value,
      offset.left * value,
      offset.precision,
    ),
)

export const absolute = (offset: Offset): Offset =>
  new Offset(
    Math.abs(offset.top),
    Math.abs(offset.right),
    Math.abs(offset.bottom),
    Math.abs(offset.left),
    offset.precision,
  )

export const invert = (offset: Offset): Offset =>
  new Offset(
    -offset.top,
    -offset.right,
    -offset.bottom,
    -offset.left,
    offset.precision,
  )
