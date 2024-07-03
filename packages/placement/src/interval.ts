import { inspect } from './internal/inspectable'
import { Pipeable } from './internal/pipeable'
import { dual } from './utils/function'
import {
  lerp as lerpNumber,
  minMax,
  normalize as normalizeNumber,
  remap as remapNumber,
  roundTo,
} from './utils/math'

const TypeBrand: unique symbol = Symbol('placement/interval')
type TypeBrand = typeof TypeBrand

class Interval extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly start: number
  readonly size: number

  constructor(start: number, size: number) {
    super()

    this.start = roundTo(start, 4)
    this.size = roundTo(size, 4)
  }

  get end(): number {
    return this.start + this.size
  }

  [inspect]() {
    const { min, max } = minMax(this.start, this.end)
    return `Interval [${min}, ${max}]`
  }
}

export type { Interval }

export const interval: {
  (): Interval
  (size: number): Interval
  (start: number, size: number): Interval
} = (a?: number, b?: number) => {
  return new Interval(b === undefined ? 0 : (a as number), b ?? (a as number))
}

export const isInterval = (value: unknown): value is Interval => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const setStart: {
  (span: Interval, start: number): Interval
  (start: number): (span: Interval) => Interval
} = dual(2, (span: Interval, start: number) => new Interval(start, span.size))

export const setSize: {
  (span: Interval, size: number, origin?: number): Interval
  (size: number, origin?: number): (span: Interval) => Interval
} = dual(
  (args) => isInterval(args[0]),
  (span: Interval, size: number, origin = 0) =>
    new Interval(span.start + (span.size - size) * origin, size),
)

export const setEnd: {
  (span: Interval, end: number): Interval
  (end: number): (span: Interval) => Interval
} = dual(
  2,
  (span: Interval, end: number) => new Interval(end - span.size, span.size),
)

export const scale: {
  (interval: Interval, scale: number, origin?: number): Interval
  (scale: number, origin?: number): (interval: Interval) => Interval
} = dual(
  (args) => isInterval(args[0]),
  (interval: Interval, scale: number, origin = 0) =>
    new Interval(
      interval.start + (interval.size - interval.size * scale) * origin,
      interval.size * scale,
    ),
)

export const scaleFrom: {
  (interval: Interval, scale: number, position: number): Interval
  (scale: number, position: number): (interval: Interval) => Interval
} = dual(
  3,
  (interval: Interval, scale: number, position: number) =>
    new Interval(
      position + (interval.start - position) * scale,
      interval.size * scale,
    ),
)

export const lerp: {
  (interval: Interval, target: Interval): Interval
  (target: Interval): (interval: Interval) => Interval
} = dual(
  2,
  (interval: Interval, target: Interval) =>
    new Interval(
      lerpNumber(interval.start, target.start, target.end),
      lerpNumber(interval.size, 0, target.size),
    ),
)

export const normalize: {
  (interval: Interval, target: Interval): Interval
  (target: Interval): (interval: Interval) => Interval
} = dual(
  2,
  (interval: Interval, target: Interval) =>
    new Interval(
      normalizeNumber(interval.start, target.start, target.end),
      interval.size / target.size,
    ),
)

export const remap: {
  (interval: Interval, source: Interval, target: Interval): Interval
  (source: Interval, target: Interval): (interval: Interval) => Interval
} = dual(
  3,
  (interval: Interval, source: Interval, target: Interval) =>
    new Interval(
      remapNumber(
        interval.start,
        source.start,
        source.end,
        target.start,
        target.end,
      ),
      remapNumber(interval.size, 0, source.size, 0, target.size),
    ),
)
