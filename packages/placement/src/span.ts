import { Pipeable } from './pipeable'
import { dual } from './utils/function'

const TypeBrand: unique symbol = Symbol('placement/span')
type TypeBrand = typeof TypeBrand

interface SpanOptions {
  start?: number
  end?: number
  size?: number
  minSize?: number
  maxSize?: number
  grow?: number
  shrink?: number
  stretch?: number
  place?: number
}

function absoluteOffset(offset: number) {
  return offset === Number.POSITIVE_INFINITY ? 0 : offset
}
function autoOffset(offset: number) {
  return offset === Number.POSITIVE_INFINITY ? 1 : 0
}

class Span extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand
  readonly start: number
  readonly end: number
  readonly size: number
  readonly minSize: number
  readonly maxSize: number
  readonly grow: number
  readonly shrink: number
  readonly stretch: number
  readonly place: number

  constructor(options: SpanOptions) {
    super()

    this.start =
      'start' in options && options.start !== undefined ? options.start : 0
    this.end = 'end' in options && options.end !== undefined ? options.end : 0
    this.size = options.size ?? 0
    this.minSize = options.minSize ?? 0
    this.maxSize = options.maxSize ?? Number.POSITIVE_INFINITY
    this.grow = options.grow ?? 0
    this.shrink = options.shrink ?? 0
    this.stretch = options.stretch ?? 0
    this.place = options.place ?? 0
  }

  get autoStart(): number {
    return autoOffset(this.start)
  }
  get autoEnd(): number {
    return autoOffset(this.end)
  }

  get absoluteStart(): number {
    return absoluteOffset(this.start)
  }
  get absoluteEnd(): number {
    return absoluteOffset(this.end)
  }

  get constrainedSize(): number {
    return Math.max(Math.min(this.size, this.maxSize), this.minSize)
  }

  get definiteOuterSize(): number {
    return this.constrainedSize + this.absoluteStart + this.absoluteEnd
  }

  get definiteOuterSizeMin(): number {
    return this.minSize + this.absoluteStart + this.absoluteEnd
  }

  get definiteOuterSizeMax(): number {
    return this.maxSize + this.absoluteStart + this.absoluteEnd
  }

  get auto(): number {
    return this.autoStart + this.autoEnd
  }
}

export type { Span }

export const span: {
  (): Span
  (options?: SpanOptions): Span
} = (options?: SpanOptions) => {
  return new Span(options ?? {})
}

export const isSpan = (value: unknown): value is Span => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const start: {
  (span: Span, start: number): Span
  (start: number): (span: Span) => Span
} = dual(2, (span: Span, start: number) => new Span({ ...span, start }))

export const end: {
  (span: Span, end: number): Span
  (end: number): (span: Span) => Span
} = dual(2, (span: Span, end: number) => new Span({ ...span, end }))

export const offset: {
  (span: Span, offset: number): Span
  (span: Span, start: number, end: number): Span
  (offset: number): (span: Span) => Span
  (start: number, end: number): (span: Span) => Span
} = dual(
  (args) => isSpan(args[0]),
  (span: Span, start: number, end: number = start) =>
    new Span({ ...span, start, end }),
)

export const size: {
  <S extends Span>(span: S, size: number): S
  <S extends Span>(size: number): (span: S) => S
} = dual(2, (span: Span, size: number) => new Span({ ...span, size }))

export const minSize: {
  (span: Span, minSize: number): Span
  (minSize: number): (span: Span) => Span
} = dual(2, (span: Span, minSize: number) => new Span({ ...span, minSize }))

export const maxSize: {
  (span: Span, maxSize: number): Span
  (maxSize: number): (span: Span) => Span
} = dual(2, (span: Span, maxSize: number) => new Span({ ...span, maxSize }))

export const grow: {
  (span: Span, grow: number): Span
  (grow: number): (span: Span) => Span
} = dual(2, (span: Span, grow: number) => new Span({ ...span, grow }))

export const shrink: {
  (span: Span, shrink: number): Span
  (shrink: number): (span: Span) => Span
} = dual(2, (span: Span, shrink: number) => new Span({ ...span, shrink }))

export const stretch: {
  (span: Span, stretch: number): Span
  (stretch: number): (span: Span) => Span
} = dual(2, (span: Span, stretch: number) => new Span({ ...span, stretch }))

export const place: {
  (span: Span, place: number): Span
  (place: number): (span: Span) => Span
} = dual(2, (span: Span, place: number) => new Span({ ...span, place }))
