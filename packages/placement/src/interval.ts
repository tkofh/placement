import { PRECISION } from './constants'
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
import { isRecord } from './utils/object'

const TypeBrand: unique symbol = Symbol('placement/interval')
type TypeBrand = typeof TypeBrand

export interface IntervalLike {
  readonly start: number
  readonly size: number
  readonly end: number
}

class Interval extends Pipeable implements IntervalLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly start: number
  readonly size: number

  constructor(start: number, size: number) {
    super()

    this.start = roundTo(start, PRECISION)
    this.size = roundTo(size, PRECISION)
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
export const isIntervalLike = (value: unknown): value is IntervalLike => {
  return isRecord(value) && 'start' in value && 'size' in value
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

export const translate: {
  (interval: Interval, amount: number): Interval
  (amount: number): (interval: Interval) => Interval
} = dual(
  2,
  (interval: Interval, amount: number) =>
    new Interval(interval.start + amount, interval.size),
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
  (interval: Interval, target: Interval, amount: number): Interval
  (target: Interval, amount: number): (interval: Interval) => Interval
} = dual(
  3,
  (interval: Interval, target: Interval, amount: number) =>
    new Interval(
      lerpNumber(amount, interval.start, target.start),
      lerpNumber(amount, interval.size, target.size),
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

export const alignTo: {
  (interval: Interval, target: number | Interval, origin?: number): Interval
  (target: number | Interval, origin?: number): (interval: Interval) => Interval
} = dual(
  (args) =>
    isInterval(args[0]) &&
    (isInterval(args[1]) || (typeof args[1] === 'number' && args.length >= 3)),
  (interval: Interval, target: number, origin = 0) =>
    new Interval(target - interval.size * origin, interval.size),
)

export const avoid: {
  (interval: IntervalLike, target: number | IntervalLike, gap: number): Interval
  (
    target: number | IntervalLike,
    gap: number,
  ): (interval: IntervalLike) => Interval
} = dual(
  3,
  (source: IntervalLike, target: number | IntervalLike, gap: number) => {
    const targetIsIntervalLike = isIntervalLike(target)

    const start = (targetIsIntervalLike ? target.start : target) - gap
    const end = (targetIsIntervalLike ? target.end : target) + gap

    if (source.start > end || source.end < start) {
      return source
    }

    if (
      (source.start >= start && source.end <= end) ||
      (source.start <= start && source.end >= end)
    ) {
      const deltaStart = source.start - start
      const deltaEnd = end - source.end

      const offset =
        (Math.min(deltaStart, deltaEnd) + source.size) *
        (deltaStart > deltaEnd ? 1 : -1)

      return new Interval(source.start + offset, source.size)
    }

    const offset =
      Math.min(source.end, end) -
      Math.max(source.start, start) * (source.start < start ? -1 : 1)
    return new Interval(source.start + offset, source.size)
  },
)
//
// export const proportionalOrigin: {
//   (interval: IntervalLike, target: IntervalLike): number
//   (target: IntervalLike): (interval: IntervalLike) => number
// } = dual(2, (source: IntervalLike, target: IntervalLike): number => {
//   if (source.size > target.size) {
//     return proportionalOrigin(target, source)
//   }
//
//   if (source.start >= target.start && source.end <= target.end) {
//     const ratio = (target.size - source.size) / target.size
//     const absolute = lerpNumber(ratio, target.start, target.end)
//     return normalizeNumber(absolute, target.start, target.end)
//   }
//
//   if (source.end === target.start) {
//     return 1
//   }
//
//   if (source.start === target.end) {
//     return 0
//   }
//
//   if (source.end < target.start) {
//     return remapNumber(
//       lerpNumber(0.5, source.end, target.start),
//       source.start,
//       source.end,
//       0,
//       1,
//     )
//   }
//
//   if (source.start > target.end) {
//     return remapNumber(
//       lerpNumber(0.5, source.start, target.end),
//       source.start,
//       source.end,
//       0,
//       1,
//     )
//   }
//
//   if (source.start < target.start) {
//     return normalizeNumber(target.start, source.start, source.end)
//   }
//
//   return normalizeNumber(target.end, source.start, source.end)
// })
