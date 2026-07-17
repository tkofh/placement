import { coincident, lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Dimensions } from './dimensions.ts'
import type { Point } from './point.ts'
import { isRecord } from './utils/object.ts'

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

  constructor(top: number, right: number, bottom: number, left: number) {
    super()

    this.top = top
    this.right = right
    this.bottom = bottom
    this.left = left
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Offset [${this.top} ${this.right} ${this.bottom} ${this.left}]`
  }

  toJSON() {
    return {
      top: this.top,
      right: this.right,
      bottom: this.bottom,
      left: this.left,
    }
  }
}

export type { Offset }

type OffsetConstructor = {
  (value: number): Offset

  xy(x: number, y: number): Offset
  trbl(top: number, right?: number, bottom?: number, left?: number): Offset
  fromPoint(point: Point): Offset
  fromDimensions(dimensions: Dimensions): Offset
  zero: Offset
  infinity: Offset
}

const offset = ((value: number): Offset =>
  new Offset(value, value, value, value)) as OffsetConstructor

offset.xy = (x: number, y: number) => new Offset(y, x, y, x)

// CSS shorthand fallbacks: bottom mirrors top, left mirrors right.
offset.trbl = (top: number, right?: number, bottom?: number, left?: number) =>
  new Offset(top, right ?? top, bottom ?? top, left ?? right ?? top)

offset.fromPoint = (point: Point) => new Offset(point.y, point.x, point.y, point.x)

offset.fromDimensions = (dimensions: Dimensions) =>
  new Offset(
    dimensions.height * 0.5,
    dimensions.width * 0.5,
    dimensions.height * 0.5,
    dimensions.width * 0.5,
  )

offset.zero = new Offset(0, 0, 0, 0)
offset.infinity = new Offset(
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
)

export { offset }

export const isOffset = (value: unknown): value is Offset => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const isOffsetLike = (value: unknown): value is OffsetLike => {
  return (
    isRecord(value) &&
    typeof value.top === 'number' &&
    typeof value.right === 'number' &&
    typeof value.bottom === 'number' &&
    typeof value.left === 'number'
  )
}

export const setTop: {
  (self: Offset, top: number): Offset
  (top: number): (self: Offset) => Offset
} = dual(2, (self: Offset, top: number) => new Offset(top, self.right, self.bottom, self.left))

export const setRight: {
  (self: Offset, right: number): Offset
  (right: number): (self: Offset) => Offset
} = dual(2, (self: Offset, right: number) => new Offset(self.top, right, self.bottom, self.left))

export const setBottom: {
  (self: Offset, bottom: number): Offset
  (bottom: number): (self: Offset) => Offset
} = dual(2, (self: Offset, bottom: number) => new Offset(self.top, self.right, bottom, self.left))

export const setLeft: {
  (self: Offset, left: number): Offset
  (left: number): (self: Offset) => Offset
} = dual(2, (self: Offset, left: number) => new Offset(self.top, self.right, self.bottom, left))

export const setX: {
  (self: Offset, x: number): Offset
  (x: number): (self: Offset) => Offset
} = dual(2, (self: Offset, x: number) => new Offset(self.top, x, self.bottom, x))

export const setY: {
  (self: Offset, y: number): Offset
  (y: number): (self: Offset) => Offset
} = dual(2, (self: Offset, y: number) => new Offset(y, self.right, y, self.left))

export const add: {
  (self: Offset, value: number | Offset): Offset
  (value: number | Offset): (self: Offset) => Offset
} = dual(2, (self: Offset, value: number | Offset) =>
  isOffset(value)
    ? new Offset(
        self.top + value.top,
        self.right + value.right,
        self.bottom + value.bottom,
        self.left + value.left,
      )
    : new Offset(self.top + value, self.right + value, self.bottom + value, self.left + value),
)

export const subtract: {
  (self: Offset, value: number | Offset): Offset
  (value: number | Offset): (self: Offset) => Offset
} = dual(2, (self: Offset, value: number | Offset) =>
  isOffset(value)
    ? new Offset(
        self.top - value.top,
        self.right - value.right,
        self.bottom - value.bottom,
        self.left - value.left,
      )
    : new Offset(self.top - value, self.right - value, self.bottom - value, self.left - value),
)

export const scale: {
  (self: Offset, factor: number): Offset
  (factor: number): (self: Offset) => Offset
} = dual(
  2,
  (self: Offset, factor: number) =>
    new Offset(self.top * factor, self.right * factor, self.bottom * factor, self.left * factor),
)

export const negate = (self: Offset): Offset =>
  new Offset(-self.top, -self.right, -self.bottom, -self.left)

export const absolute = (self: Offset): Offset =>
  new Offset(Math.abs(self.top), Math.abs(self.right), Math.abs(self.bottom), Math.abs(self.left))

export const lerp: {
  (self: Offset, target: Offset, amount: number): Offset
  (target: Offset, amount: number): (self: Offset) => Offset
} = dual(
  3,
  (self: Offset, target: Offset, amount: number) =>
    new Offset(
      lerpNumber(amount, self.top, target.top),
      lerpNumber(amount, self.right, target.right),
      lerpNumber(amount, self.bottom, target.bottom),
      lerpNumber(amount, self.left, target.left),
    ),
)

export const equals: {
  (self: Offset, other: OffsetLike): boolean
  (other: OffsetLike): (self: Offset) => boolean
} = dual(
  2,
  (self: Offset, other: OffsetLike) =>
    coincident(self.top, other.top) &&
    coincident(self.right, other.right) &&
    coincident(self.bottom, other.bottom) &&
    coincident(self.left, other.left),
)
