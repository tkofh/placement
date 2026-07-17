import {
  EPSILON,
  RELATIVE_TOLERANCE,
  coincident,
  lerp as lerpNumber,
  minMax,
  normalize as normalizeNumber,
  remap as remapNumber,
} from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import { isRecord } from './utils/object.ts'

const TypeBrand: unique symbol = Symbol('placement/interval')
type TypeBrand = typeof TypeBrand

export interface IntervalLike {
  readonly start: number
  readonly size: number
}

class Interval extends Pipeable implements IntervalLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly start: number
  readonly size: number

  constructor(start: number, size: number) {
    super()

    this.start = start
    this.size = size
  }

  get end(): number {
    return this.start + this.size
  }

  get min(): number {
    return Math.min(this.start, this.end)
  }

  get max(): number {
    return Math.max(this.start, this.end)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Interval [${this.min}, ${this.max}]`
  }

  toJSON() {
    return {
      start: this.start,
      size: this.size,
    }
  }
}

export type { Interval }

export const interval: {
  (): Interval
  (size: number): Interval
  (start: number, size: number): Interval
} = (a?: number, b?: number) => {
  return b === undefined ? new Interval(0, a ?? 0) : new Interval(a as number, b)
}

export const isInterval = (value: unknown): value is Interval => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const isIntervalLike = (value: unknown): value is IntervalLike => {
  return isRecord(value) && typeof value.start === 'number' && typeof value.size === 'number'
}

// Tolerance for boundary decisions, scaled to the magnitudes that enter the
// question (see PRECISION.md).
const boundsTolerance = (min: number, max: number): number =>
  EPSILON + RELATIVE_TOLERANCE * Math.max(Math.abs(min), Math.abs(max))

const targetBounds = (target: number | IntervalLike, gap: number): [number, number] => {
  if (typeof target === 'number') {
    return [target - gap, target + gap]
  }
  const [min, max] = minMax(target.start, target.start + target.size)
  return [min - gap, max + gap]
}

export const setStart: {
  (self: Interval, start: number): Interval
  (start: number): (self: Interval) => Interval
} = dual(2, (self: Interval, start: number) => new Interval(start, self.size))

export const setSize: {
  (self: Interval, size: number, origin?: number): Interval
  (size: number, origin?: number): (self: Interval) => Interval
} = dual(
  (args) => isInterval(args[0]),
  (self: Interval, size: number, origin = 0) =>
    new Interval(self.start + (self.size - size) * origin, size),
)

export const setEnd: {
  (self: Interval, end: number): Interval
  (end: number): (self: Interval) => Interval
} = dual(2, (self: Interval, end: number) => new Interval(end - self.size, self.size))

export const translate: {
  (self: Interval, amount: number): Interval
  (amount: number): (self: Interval) => Interval
} = dual(2, (self: Interval, amount: number) => new Interval(self.start + amount, self.size))

export const scale: {
  (self: Interval, factor: number, origin?: number): Interval
  (factor: number, origin?: number): (self: Interval) => Interval
} = dual(
  (args) => isInterval(args[0]),
  (self: Interval, factor: number, origin = 0) =>
    new Interval(self.start + (self.size - self.size * factor) * origin, self.size * factor),
)

export const scaleFrom: {
  (self: Interval, factor: number, position: number): Interval
  (factor: number, position: number): (self: Interval) => Interval
} = dual(
  3,
  (self: Interval, factor: number, position: number) =>
    new Interval(position + (self.start - position) * factor, self.size * factor),
)

export const lerp: {
  (self: Interval, target: Interval, amount: number): Interval
  (target: Interval, amount: number): (self: Interval) => Interval
} = dual(
  3,
  (self: Interval, target: Interval, amount: number) =>
    new Interval(
      lerpNumber(amount, self.start, target.start),
      lerpNumber(amount, self.size, target.size),
    ),
)

export const normalize: {
  (self: Interval, target: Interval): Interval
  (target: Interval): (self: Interval) => Interval
} = dual(
  2,
  (self: Interval, target: Interval) =>
    new Interval(normalizeNumber(self.start, target.start, target.end), self.size / target.size),
)

export const remap: {
  (self: Interval, source: Interval, target: Interval): Interval
  (source: Interval, target: Interval): (self: Interval) => Interval
} = dual(
  3,
  (self: Interval, source: Interval, target: Interval) =>
    new Interval(
      remapNumber(self.start, source.start, source.end, target.start, target.end),
      remapNumber(self.size, 0, source.size, 0, target.size),
    ),
)

// alignTo and avoid take fixed arities: their target may itself be an
// Interval, so a trailing optional would make 2-argument calls ambiguous
// between the data-first and data-last forms.
export const alignTo: {
  (self: Interval, target: number | IntervalLike, origin: number): Interval
  (target: number | IntervalLike, origin: number): (self: Interval) => Interval
} = dual(3, (self: Interval, target: number | IntervalLike, origin: number) => {
  const position = typeof target === 'number' ? target : target.start + target.size * origin
  return new Interval(position - self.size * origin, self.size)
})

export const avoid: {
  (self: Interval, target: number | IntervalLike, gap: number): Interval
  (target: number | IntervalLike, gap: number): (self: Interval) => Interval
} = dual(3, (self: Interval, target: number | IntervalLike, gap: number) => {
  const [lo, hi] = targetBounds(target, gap)
  const tolerance = boundsTolerance(Math.min(lo, self.min), Math.max(hi, self.max))

  if (self.max <= lo + tolerance || self.min >= hi - tolerance) {
    return self
  }

  // Escape by the smaller shift; ties resolve toward the start.
  const shiftDown = self.max - lo
  const shiftUp = hi - self.min
  return new Interval(self.start + (shiftDown <= shiftUp ? -shiftDown : shiftUp), self.size)
})

export const join: {
  (self: Interval, other: IntervalLike): Interval
  (other: IntervalLike): (self: Interval) => Interval
} = dual(2, (self: Interval, other: IntervalLike) => {
  const [otherMin, otherMax] = minMax(other.start, other.start + other.size)
  const min = Math.min(self.min, otherMin)
  const max = Math.max(self.max, otherMax)
  return new Interval(min, max - min)
})

export const intersect: {
  (self: Interval, other: IntervalLike): Interval
  (other: IntervalLike): (self: Interval) => Interval
} = dual(2, (self: Interval, other: IntervalLike) => {
  const [otherMin, otherMax] = minMax(other.start, other.start + other.size)
  const min = Math.max(self.min, otherMin)
  const max = Math.min(self.max, otherMax)

  if (min > max) {
    // Disjoint: zero-size interval at the midpoint of the gap between the
    // nearest edges (parity with rect.intersect).
    return new Interval((min + max) / 2, 0)
  }

  return new Interval(min, max - min)
})

export const contains: {
  (self: Interval, target: number | IntervalLike): boolean
  (target: number | IntervalLike): (self: Interval) => boolean
} = dual(2, (self: Interval, target: number | IntervalLike) => {
  const tolerance = boundsTolerance(self.min, self.max)

  if (typeof target === 'number') {
    return target >= self.min - tolerance && target <= self.max + tolerance
  }

  const [targetMin, targetMax] = minMax(target.start, target.start + target.size)
  return targetMin >= self.min - tolerance && targetMax <= self.max + tolerance
})

export const intersects: {
  (self: Interval, other: IntervalLike): boolean
  (other: IntervalLike): (self: Interval) => boolean
} = dual(2, (self: Interval, other: IntervalLike) => {
  const [otherMin, otherMax] = minMax(other.start, other.start + other.size)
  const tolerance = boundsTolerance(Math.min(self.min, otherMin), Math.max(self.max, otherMax))
  return self.min <= otherMax + tolerance && self.max >= otherMin - tolerance
})

export const equals: {
  (self: Interval, other: IntervalLike): boolean
  (other: IntervalLike): (self: Interval) => boolean
} = dual(
  2,
  (self: Interval, other: IntervalLike) =>
    coincident(self.start, other.start) && coincident(self.size, other.size),
)
