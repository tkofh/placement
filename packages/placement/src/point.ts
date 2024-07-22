import { PRECISION } from './constants'
import { Pipeable } from './internal/pipeable'
import { dual } from './utils/function'
import { lerp, normalizeZero, roundTo } from './utils/math'

const TypeBrand: unique symbol = Symbol('placement/point')
type TypeBrand = typeof TypeBrand

// export interface CartesianPointLike {
//   readonly x: number
//   readonly y: number
// }
//
// export interface PolarPointLike {
//   readonly r: number
//   readonly theta: number
// }
//
// export type PointLike = CartesianPointLike | PolarPointLike

export interface PointLike {
  readonly x: number
  readonly y: number
}

const twoPi = Math.PI * 2
const inverseTwoPi = 1 / twoPi

const radians = (radians: number) => Math.abs((radians + twoPi) % twoPi)
const turns = (turns: number) => Math.abs((turns + 1) % 1)

const turnsToRadians = (turns: number) => radians(turns * twoPi)
const radiansToTurns = (radians: number) => turns(radians * inverseTwoPi)

export const r = (x: number, y: number) => Math.hypot(x, y)
export const theta = (x: number, y: number) => radiansToTurns(Math.atan2(y, x))
export const x = (r: number, turns: number) =>
  r * Math.cos(turnsToRadians(turns))
export const y = (r: number, turns: number) =>
  r * Math.sin(turnsToRadians(turns))

class Point extends Pipeable implements PointLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand
  readonly x: number
  readonly y: number

  private _r: number | undefined
  private _theta: number | undefined
  private _arcLength: number | undefined

  constructor(
    x: number,
    y: number,
    readonly precision: number,
  ) {
    super()

    this.x = normalizeZero(roundTo(x, this.precision))
    this.y = normalizeZero(roundTo(y, this.precision))
  }

  get r() {
    this._r ||= r(this.x, this.y)
    return this._r
  }

  get theta() {
    this._theta ||= theta(this.x, this.y)
    return this._theta
  }

  get arcLength() {
    this._arcLength ||= Math.abs(turnsToRadians(this.theta) * this.r)
    return this._arcLength
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Point (${this.x}, ${this.y})`
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      precision: this.precision,
    }
  }
}

export type { Point }

type PointConstructor = {
  (x: number, y?: number, precision?: number): Point

  readonly zero: Point
  readonly infinity: Point
}

const point = ((a?: number, b?: number, precision?: number) => {
  return new Point(a ?? 0, b ?? a ?? 0, precision ?? PRECISION)
}) as PointConstructor
;(point as { zero: Point }).zero = new Point(0, 0, PRECISION)
;(point as { infinity: Point }).infinity = new Point(
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  PRECISION,
)

export { point }

export const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' && value !== null && TypeBrand in value

export const fromPolar = (r: number, theta: number, precision = PRECISION) => {
  return new Point(x(r, theta), y(r, theta), precision)
}

export const center = (points: Iterable<PointLike>, precision = PRECISION) => {
  let x = 0
  let y = 0
  let count = 0

  for (const point of points) {
    x += point.x
    y += point.y
    count++
  }

  return count === 0
    ? new Point(0, 0, precision)
    : new Point(x / count, y / count, precision)
}

export const leftCorner: {
  (a: Point, b: Point): Point
  (target: Point): (self: Point) => Point
} = dual(2, (a: Point, b: Point) => {
  if (a.x === b.x) {
    return new Point(a.x, lerp(0.5, a.y, b.y), a.precision)
  }

  const x = a.x < b.x ? a.x : b.x

  return new Point(x, x === a.x ? b.y : a.y, a.precision)
})

export const rightCorner: {
  (a: Point, b: Point): Point
  (target: Point): (self: Point) => Point
} = dual(2, (a: Point, b: Point) => {
  if (a.x === b.x) {
    return new Point(a.x, lerp(0.5, a.y, b.y), a.precision)
  }
  const x = a.x > b.x ? a.x : b.x

  return new Point(x, x === a.x ? b.y : a.y, a.precision)
})

export const topCorner: {
  (a: Point, b: Point): Point
  (target: Point): (self: Point) => Point
} = dual(2, (a: Point, b: Point) => {
  if (a.y === b.y) {
    return new Point(lerp(0.5, a.x, b.x), a.y, a.precision)
  }

  const y = Math.max(a.y, b.y)
  const x = y === a.y ? b.x : a.x

  return new Point(x, y, a.precision)
})

export const bottomCorner: {
  (a: Point, b: Point): Point
  (target: Point): (self: Point) => Point
} = dual(2, (a: Point, b: Point) => {
  if (a.y === b.y) {
    return new Point(lerp(0.5, a.x, b.x), a.y, a.precision)
  }

  const y = Math.min(a.y, b.y)
  const x = y === a.y ? b.x : a.x

  return new Point(x, y, a.precision)
})

export const setX: {
  (self: Point, x: number): Point
  (x: number): (self: Point) => Point
} = dual(2, (self: Point, x: number) => new Point(x, self.y, self.precision))

export const setY: {
  (self: Point, y: number): Point
  (y: number): (self: Point) => Point
} = dual(2, (self: Point, y: number) => new Point(self.x, y, self.precision))

export const setR: {
  (self: Point, r: number): Point
  (r: number): (self: Point) => Point
} = dual(
  2,
  (self: Point, r: number) =>
    new Point(x(r, self.theta), y(r, self.theta), self.precision),
)

export const setTheta: {
  (self: Point, theta: number): Point
  (theta: number): (self: Point) => Point
} = dual(
  2,
  (self: Point, theta: number) =>
    new Point(x(self.r, theta), y(self.r, theta), self.precision),
)

export const translateX: {
  (self: Point, x: number): Point
  (x: number): (self: Point) => Point
} = dual(
  2,
  (self: Point, x: number) => new Point(self.x + x, self.y, self.precision),
)

export const translateY: {
  (self: Point, y: number): Point
  (y: number): (self: Point) => Point
} = dual(
  2,
  (self: Point, y: number) => new Point(self.x, self.y + y, self.precision),
)

export const translateR: {
  (self: Point, r: number): Point
  (r: number): (self: Point) => Point
} = dual(
  2,
  (self: Point, r: number) =>
    new Point(
      x(self.r + r, self.theta),
      y(self.r + r, self.theta),
      self.precision,
    ),
)

export const translateTheta: {
  (self: Point, theta: number): Point
  (theta: number): (self: Point) => Point
} = dual(
  2,
  (self: Point, theta: number) =>
    new Point(
      x(self.r, self.theta + theta),
      y(self.r, self.theta + theta),
      self.precision,
    ),
)

export const translate: {
  (self: Point, x: number, y: number): Point
  (x: number, y: number): (self: Point) => Point
} = dual(
  3,
  (self: Point, x: number, y: number) =>
    new Point(self.x + x, self.y + y, self.precision),
)

export const mix: {
  (self: Point, other: Point, amount: number): Point
  (other: Point, amount: number): (self: Point) => Point
} = dual(
  3,
  (self: Point, other: Point, amount = 0.5) =>
    new Point(
      lerp(amount, self.x, other.x),
      lerp(amount, self.y, other.y),
      self.precision,
    ),
)

export const polarMix: {
  (
    self: Point,
    other: Point,
    amount: number,
    origin?: Point,
    favorLonger?: boolean,
  ): Point
  (
    other: Point,
    amount: number,
    origin?: Point,
    favorLonger?: boolean,
  ): (self: Point) => Point
} = dual(
  (args) => isPoint(args[1]),
  (
    self: Point,
    other: Point,
    amount: number,
    origin = leftCorner(self, other),
    _favorLonger = false,
  ) => {
    const selfX = self.x - origin.x
    const selfY = self.y - origin.y
    const otherX = other.x - origin.x
    const otherY = other.y - origin.y

    const selfR = Math.hypot(selfX, selfY)
    const otherR = Math.hypot(otherX, otherY)

    const selfRadians = Math.atan2(selfY, selfX)
    const otherRadians = Math.atan2(otherY, otherX)

    const r = lerp(amount, selfR, otherR)
    const radians = lerp(amount, selfRadians, otherRadians)

    return new Point(
      r * Math.cos(radians),
      r * Math.sin(radians),
      self.precision,
    )
  },
)

export const delta: {
  (self: Point, other: Point): Point
  (other: Point): (self: Point) => Point
} = dual(
  2,
  (self: Point, other: Point) =>
    new Point(self.x - other.x, self.y - other.y, self.precision),
)

export const orbit: {
  (self: Point, other: Point, amount: number): Point
  (other: Point, amount: number): (self: Point) => Point
} = dual(3, (self: Point, other: Point, amount: number) => {
  const radians = turnsToRadians(amount)

  const deltaX = self.x - other.x
  const deltaY = self.y - other.y

  const rotatedX = deltaX * Math.cos(radians) - deltaY * Math.sin(radians)
  const rotatedY = deltaX * Math.sin(radians) + deltaY * Math.cos(radians)

  return new Point(other.x + rotatedX, other.y + rotatedY, self.precision)
})

export const avoid: {
  (self: Point, target: Point, gap: number): Point
  (target: Point, gap: number): (self: Point) => Point
} = dual(3, (self: Point, target: Point, gap: number) => {
  const dx = self.x - target.x
  const dy = self.y - target.y

  const distance = Math.hypot(dx, dy)

  if (distance === 0) {
    if (self.x === 0 && self.y === 0) {
      return new Point(gap, 0, self.precision)
    }

    const radians = turnsToRadians(self.theta)
    return new Point(
      (self.r + gap) * Math.cos(radians),
      (self.r + gap) * Math.sin(radians),
      self.precision,
    )
  }

  if (distance < gap) {
    return new Point(
      self.x + (dx / distance) * (gap - distance),
      self.y + (dy / distance) * (gap - distance),
      self.precision,
    )
  }

  return self
})

export const normalize = (self: Point) =>
  new Point(x(1, self.theta), y(1, self.theta), self.precision)

export const distance: {
  (self: Point, target: Point): number
  (target: Point): (self: Point) => number
} = dual(2, (self: Point, target: Point) => {
  return Math.hypot(target.x - self.x, target.y - self.y)
})

export const dot: {
  (self: Point, target: Point): number
  (target: Point): (self: Point) => number
} = dual(2, (self: Point, target: Point) => {
  return self.x * target.x + self.y * target.y
})

export const cross: {
  (self: Point, target: Point): number
  (target: Point): (self: Point) => number
} = dual(2, (self: Point, target: Point) => {
  return self.x * target.y - self.y * target.x
})
