import { EPSILON, RELATIVE_TOLERANCE, coincident, lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import { isRecord } from './utils/object.ts'

const TypeBrand: unique symbol = Symbol('placement/point')
type TypeBrand = typeof TypeBrand

export interface PointLike {
  readonly x: number
  readonly y: number
}

class Point extends Pipeable implements PointLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly x: number
  readonly y: number

  constructor(x: number, y: number) {
    super()

    this.x = x
    this.y = y
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Point (${this.x}, ${this.y})`
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
    }
  }
}

export type { Point }

export const point: {
  (): Point
  (xy: number): Point
  (x: number, y: number): Point
  readonly zero: Point
  readonly half: Point
  readonly one: Point
  readonly infinity: Point
} = Object.assign((x?: number, y?: number) => new Point(x ?? 0, y ?? x ?? 0), {
  zero: new Point(0, 0),
  half: new Point(0.5, 0.5),
  one: new Point(1, 1),
  infinity: new Point(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
})

export const isPoint = (value: unknown): value is Point => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const isPointLike = (value: unknown): value is PointLike => {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
}

// Angles are radians throughout, atan2 convention: 0 along +x, positive
// counterclockwise, unbounded input (no revolution normalization).
export const fromPolar = (magnitude: number, angle: number): Point =>
  new Point(magnitude * Math.cos(angle), magnitude * Math.sin(angle))

export const magnitude = (self: Point): number => Math.hypot(self.x, self.y)

export const angle = (self: Point): number => Math.atan2(self.y, self.x)

export const center = (points: Iterable<PointLike>): Point => {
  let x = 0
  let y = 0
  let count = 0

  for (const point of points) {
    x += point.x
    y += point.y
    count++
  }

  return count === 0 ? new Point(0, 0) : new Point(x / count, y / count)
}

export const setX: {
  (self: Point, x: number): Point
  (x: number): (self: Point) => Point
} = dual(2, (self: Point, x: number) => new Point(x, self.y))

export const setY: {
  (self: Point, y: number): Point
  (y: number): (self: Point) => Point
} = dual(2, (self: Point, y: number) => new Point(self.x, y))

export const translate: {
  (self: Point, x: number, y: number): Point
  (x: number, y: number): (self: Point) => Point
} = dual(3, (self: Point, x: number, y: number) => new Point(self.x + x, self.y + y))

export const translateX: {
  (self: Point, x: number): Point
  (x: number): (self: Point) => Point
} = dual(2, (self: Point, x: number) => new Point(self.x + x, self.y))

export const translateY: {
  (self: Point, y: number): Point
  (y: number): (self: Point) => Point
} = dual(2, (self: Point, y: number) => new Point(self.x, self.y + y))

export const add: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(2, (self: Point, other: PointLike) => new Point(self.x + other.x, self.y + other.y))

export const subtract: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(2, (self: Point, other: PointLike) => new Point(self.x - other.x, self.y - other.y))

export const scale: {
  (self: Point, factor: number): Point
  (factor: number): (self: Point) => Point
} = dual(2, (self: Point, factor: number) => new Point(self.x * factor, self.y * factor))

export const lerp: {
  (self: Point, target: PointLike, amount: number): Point
  (target: PointLike, amount: number): (self: Point) => Point
} = dual(
  3,
  (self: Point, target: PointLike, amount: number) =>
    new Point(lerpNumber(amount, self.x, target.x), lerpNumber(amount, self.y, target.y)),
)

export const min: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(
  2,
  (self: Point, other: PointLike) =>
    new Point(Math.min(self.x, other.x), Math.min(self.y, other.y)),
)

export const max: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(
  2,
  (self: Point, other: PointLike) =>
    new Point(Math.max(self.x, other.x), Math.max(self.y, other.y)),
)

export const orbit: {
  (self: Point, center: PointLike, angle: number): Point
  (center: PointLike, angle: number): (self: Point) => Point
} = dual(3, (self: Point, center: PointLike, angle: number) => {
  const deltaX = self.x - center.x
  const deltaY = self.y - center.y

  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  return new Point(center.x + deltaX * cos - deltaY * sin, center.y + deltaX * sin + deltaY * cos)
})

// avoid takes a fixed arity: its target may itself be a Point, so a trailing
// optional gap would make 2-argument calls ambiguous between the data-first
// and data-last forms.
export const avoid: {
  (self: Point, target: PointLike, gap: number): Point
  (target: PointLike, gap: number): (self: Point) => Point
} = dual(3, (self: Point, target: PointLike, gap: number) => {
  const deltaX = self.x - target.x
  const deltaY = self.y - target.y
  const distance = Math.hypot(deltaX, deltaY)

  // Tolerance for the boundary decision, scaled to the magnitudes that enter
  // the question (see PRECISION.md).
  const tolerance = EPSILON + RELATIVE_TOLERANCE * Math.max(distance, Math.abs(gap))

  if (distance >= gap - tolerance) {
    return self
  }

  if (distance === 0) {
    // Coincident points have no escape direction: push along self's own ray
    // from the origin, or along +x when self is the origin.
    const selfMagnitude = Math.hypot(self.x, self.y)
    if (selfMagnitude === 0) {
      return new Point(gap, 0)
    }
    return new Point(
      self.x + (self.x / selfMagnitude) * gap,
      self.y + (self.y / selfMagnitude) * gap,
    )
  }

  return new Point(
    self.x + (deltaX / distance) * (gap - distance),
    self.y + (deltaY / distance) * (gap - distance),
  )
})

export const normalize = (self: Point): Point => {
  const selfMagnitude = Math.hypot(self.x, self.y)
  return new Point(self.x / selfMagnitude, self.y / selfMagnitude)
}

export const distance: {
  (self: Point, target: PointLike): number
  (target: PointLike): (self: Point) => number
} = dual(2, (self: Point, target: PointLike) => Math.hypot(target.x - self.x, target.y - self.y))

export const dot: {
  (self: Point, target: PointLike): number
  (target: PointLike): (self: Point) => number
} = dual(2, (self: Point, target: PointLike) => self.x * target.x + self.y * target.y)

export const cross: {
  (self: Point, target: PointLike): number
  (target: PointLike): (self: Point) => number
} = dual(2, (self: Point, target: PointLike) => self.x * target.y - self.y * target.x)

export const equals: {
  (self: Point, other: PointLike): boolean
  (other: PointLike): (self: Point) => boolean
} = dual(
  2,
  (self: Point, other: PointLike) => coincident(self.x, other.x) && coincident(self.y, other.y),
)
