import { Pipeable } from './pipeable'
import { dual } from './utils/function'

const TypeBrand: unique symbol = Symbol('placement/interval')
type TypeBrand = typeof TypeBrand

class Interval extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand
  constructor(
    readonly start: number,
    readonly size: number,
  ) {
    super()
  }

  get end(): number {
    return this.start + this.size
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
