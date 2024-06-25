import { type Interval, interval } from './interval'
import { Pipeable } from './pipeable'
import type { Span } from './span'
import {
  type Track,
  growOrShrink,
  isTrack,
  track as makeTrack,
  stretch,
} from './track'
import { auto } from './utils/arguments'
import { dual } from './utils/function'
import { normalize, remap } from './utils/math'
const TypeBrand: unique symbol = Symbol('placement/axis')
type TypeBrand = typeof TypeBrand

class Axis extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  constructor(
    readonly spans: ReadonlyArray<Interval>,
    readonly size: number,
  ) {
    super()
  }

  get start() {
    return this.spans[0].start
  }

  get end() {
    return this.spans[this.spans.length - 1].end
  }
}

export type { Axis }

export function isAxis(value: unknown): value is Axis {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

interface BaseTrackAxisOptions {
  place?: number
}
interface BaseArrayAxisOptions extends BaseTrackAxisOptions {
  size?: number
}

interface StackTrackAxisOptions extends BaseTrackAxisOptions {
  stretch?: number
}
interface StackArrayAxisOptions
  extends BaseArrayAxisOptions,
    StackTrackAxisOptions {}

interface SequenceTrackAxisOptions extends BaseTrackAxisOptions {
  space?: number
  spaceOuter?: number
}
interface SequenceArrayAxisOptions
  extends BaseArrayAxisOptions,
    SequenceTrackAxisOptions {}

export const stack: {
  (spans: ReadonlyArray<Span>, options?: StackArrayAxisOptions): Axis
  (track: Track, options?: StackTrackAxisOptions): Axis
  (options?: StackArrayAxisOptions): (spans: ReadonlyArray<Span>) => Axis
  (options?: StackTrackAxisOptions): (track: Track) => Axis
} = dual(
  (args) => Array.isArray(args[0]),
  (
    input: ReadonlyArray<Span> | Track,
    options: StackArrayAxisOptions & StackTrackAxisOptions = {},
  ): Axis => {
    const track = isTrack(input)
      ? input
      : makeTrack(input, { size: options.size }).pipe(
          stretch(options.stretch ?? 0),
        )

    const size = track.maxDefiniteOuterSize

    return new Axis(
      Array.from(track.spans, (span) => {
        const free = size - span.definiteOuterSize

        if (span.auto > 0) {
          return interval(
            (free / span.auto) * span.autoStart,
            Math.min(span.size, size),
          )
        }

        return interval(auto(span.place, options.place ?? 0) * free, span.size)
      }),
      size,
    )
  },
)

export const sequence: {
  (spans: ReadonlyArray<Span>, options?: SequenceArrayAxisOptions): Axis
  (track: Track, options?: SequenceTrackAxisOptions): Axis
  (options?: SequenceArrayAxisOptions): (spans: ReadonlyArray<Span>) => Axis
  (options?: SequenceTrackAxisOptions): (track: Track) => Axis
} = dual(
  (args) => Array.isArray(args[0]) || isTrack(args[0]),
  (
    input: ReadonlyArray<Span> | Track,
    options: SequenceArrayAxisOptions & SequenceTrackAxisOptions = {},
  ) => {
    const track = (
      isTrack(input) ? input : makeTrack(input, { size: options.size })
    ).pipe(growOrShrink)

    track.totalGappedDefiniteOuterSize

    let start = 0
    let between = track.gap

    if (track.size !== null) {
      const amount = track.size - track.totalGappedDefiniteOuterSize
      const distributed = amount * (options.space ?? 0)

      start += (amount - distributed) * (options.place ?? 0)

      if (distributed > 0 && track.spans.length > 1) {
        const spaceOuter = options.spaceOuter ?? 0
        const spacing = distributed / (track.spans.length + 1)
        start += spacing * spaceOuter
        between +=
          spacing + (spacing * 2 * (1 - spaceOuter)) / (track.spans.length - 1)
      }
    }

    const intervals: Array<Interval> = []

    for (const span of track.spans) {
      intervals.push(interval(start, span.size))
      start += span.size + between
    }

    return new Axis(intervals, track.size ?? start - between)
  },
)

export const translate: {
  (axis: Axis, amount: number): Axis
  (amount: number): (axis: Axis) => Axis
} = dual(
  2,
  (axis: Axis, amount: number) =>
    new Axis(
      axis.spans.map((span) => interval(span.start + amount, span.size)),
      axis.size,
    ),
)

export const scaleFrom: {
  (axis: Axis, scale: number, offset: number): Axis
  (scale: number, offset: number): (axis: Axis) => Axis
} = dual(3, (axis: Axis, scale: number, offset: number) => {
  return new Axis(
    axis.spans.map((span) =>
      interval((span.start - offset) * scale, span.size * scale),
    ),
    axis.size * scale,
  )
})

export const scale: {
  (axis: Axis, scale: number, origin?: number): Axis
  (scale: number, origin?: number): (axis: Axis) => Axis
} = dual(
  (args) => isAxis(args[0]),
  (axis: Axis, scale: number, origin = 0) =>
    scaleFrom(axis, scale, normalize(origin, axis.start, axis.end)),
)

export const start: {
  (axis: Axis, start: number): Axis
  (start: number): (axis: Axis) => Axis
} = dual(
  2,
  (axis: Axis, start: number) =>
    new Axis(
      axis.spans.map((span) => interval(start, span.size)),
      axis.size,
    ),
)

export const size: {
  (axis: Axis, size: number): Axis
  (size: number): (axis: Axis) => Axis
} = dual(2, (axis: Axis, size: number) => new Axis(axis.spans, size))

export const reverse = (axis: Axis) => {
  return new Axis(
    axis.spans.map((current) =>
      interval(
        remap(current.start, axis.start, axis.end, axis.end, axis.start) -
          current.size,
        current.size,
      ),
    ),
    axis.size,
  )
}
