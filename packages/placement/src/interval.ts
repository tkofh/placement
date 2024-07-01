import { inspect } from './internal/inspectable'
import { Pipeable } from './internal/pipeable'
import { dual } from './utils/function'
import { roundTo } from './utils/math'

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
    return `Interval [${this.start}, ${this.end}]`
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
  (span: Interval, size: number): Interval
  (size: number): (span: Interval) => Interval
} = dual(2, (span: Interval, size: number) => new Interval(span.start, size))

export const setEnd: {
  (span: Interval, end: number): Interval
  (end: number): (span: Interval) => Interval
} = dual(
  2,
  (span: Interval, end: number) => new Interval(end - span.size, span.size),
)
