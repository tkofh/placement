import { inspect } from './internal/inspectable'
import { Pipeable } from './internal/pipeable'
import {
  type SequenceTrackItem,
  type SequenceTrackItemInput,
  adjustSizes,
  processItems,
} from './internal/track/sequence'
import {
  type StackTrackItem,
  type StackTrackItemInput,
  applyStretch,
  stackTrackItem,
} from './internal/track/stack'
import { type Interval, interval } from './interval'
import { auto } from './utils/arguments'
import { dual } from './utils/function'
import { lerp } from './utils/math'

const TypeBrand: unique symbol = Symbol('placement/track')
type TypeBrand = typeof TypeBrand

class Track extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly start: number
  readonly end: number
  readonly size: number

  constructor(readonly intervals: ReadonlyArray<Interval>) {
    super()

    if (this.intervals.length === 0) {
      throw new RangeError('Track must contain at least one interval')
    }

    let start = Number.POSITIVE_INFINITY
    let end = Number.NEGATIVE_INFINITY

    for (const interval of intervals) {
      start = Math.min(start, interval.start)
      end = Math.max(end, interval.end)
    }

    this.start = start
    this.end = end
    this.size = end - start
  }

  [inspect]() {
    return `Track [${this.start}, ${this.end}] [ ${this.intervals.map((interval) => `[${interval.start}, ${interval.end}]`).join(', ')} ]`
  }
}

export function track(intervals: ReadonlyArray<Interval>): Track {
  return new Track(intervals)
}

export type { Track }

export function isTrack(value: unknown): value is Track {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

interface BaseOptions {
  place?: number
  size?: number
}

interface StackOptions extends BaseOptions {
  stretch?: number
}

interface SequenceOptions extends BaseOptions {
  gap?: number
  space?: number
  spaceOuter?: number
}

export function stack(
  items: ReadonlyArray<StackTrackItemInput>,
  options: StackOptions,
): Track {
  const trackItems: Array<StackTrackItem> = []
  let maxSize = 0

  for (const item of items) {
    const trackItem = stackTrackItem(item)
    trackItems.push(trackItem)

    maxSize = Math.max(maxSize, trackItem.size)
  }

  const size = auto(options.size ?? Number.POSITIVE_INFINITY, maxSize)

  const stretch = options.stretch ?? 0
  const place = options.place ?? 0

  applyStretch(trackItems, size, stretch)

  return new Track(
    Array.from(trackItems, (item) => {
      const free = size - item.definiteOuterSize

      if (item.autoOffsetCount > 0) {
        return interval(
          item.startIsAuto ? free / item.autoOffsetCount : 0,
          Math.min(item.size, size),
        )
      }

      return interval(
        auto(item.place, place) * free + item.definiteStart,
        item.size,
      )
    }),
  )
}

function sequenceWithoutFreeSpace(
  items: ReadonlyArray<SequenceTrackItem>,
  gap: number,
  autoOffset: number,
  start: number,
) {
  const intervals: Array<Interval> = []

  let cursor = start

  for (const item of items) {
    cursor += autoOffset * Number(item.startIsAuto) + item.start
    intervals.push(interval(cursor, item.size))
    cursor += item.size + gap + autoOffset * Number(item.endIsAuto) + item.end
  }

  return new Track(intervals)
}

function sequenceWithFreeSpace(
  items: ReadonlyArray<SequenceTrackItem>,
  size: number,
  used: number,
  gap: number,
  place: number,
  space: number,
  spaceOuter: number,
) {
  const intervals: Array<Interval> = []
  const free = size - used

  const distributed = free * space

  let cursor = 0
  let between = gap

  cursor += (free - distributed) * place

  if (Math.abs(distributed) > 0 && items.length > 1) {
    const spacing = distributed / (items.length + 1)
    cursor += spacing * spaceOuter
    between += spacing + (spacing * 2 * (1 - spaceOuter)) / (items.length - 1)
  }

  for (const item of items) {
    cursor += item.start
    intervals.push(interval(cursor, item.size))
    cursor += item.size + between + item.end
  }

  return new Track(intervals)
}

export function sequence(
  items: ReadonlyArray<SequenceTrackItemInput>,
  options: SequenceOptions,
) {
  const { trackItems, growable, shrinkable, totals } = processItems(items)

  const gap = options.gap ?? 0
  const place = options.place ?? 0

  if (options.size == null || options.size === Number.POSITIVE_INFINITY) {
    return sequenceWithoutFreeSpace(
      trackItems,
      gap,
      0,
      place * -totals.definiteOuterSize,
    )
  }

  const deltaSize =
    options.size - totals.definiteOuterSize - gap * (trackItems.length - 1)

  if (totals.autoOffsetCount > 0) {
    return sequenceWithoutFreeSpace(
      trackItems,
      gap,
      (options.size - totals.definiteOuterSize) / totals.autoOffsetCount,
      place * -deltaSize,
    )
  }

  const consumed =
    totals.definiteOuterSize +
    adjustSizes(
      deltaSize,
      growable,
      totals.growthFactor,
      shrinkable,
      totals.scaledShrinkFactor,
    )

  return sequenceWithFreeSpace(
    trackItems,
    options.size,
    consumed,
    gap,
    place,
    options.space ?? 0,
    options.spaceOuter ?? 0,
  )
}

export const translate: {
  (axis: Track, amount: number): Track
  (amount: number): (axis: Track) => Track
} = dual(
  2,
  (axis: Track, amount: number) =>
    new Track(
      axis.intervals.map((ival) => interval(ival.start + amount, ival.size)),
    ),
)

export const scaleFrom: {
  (axis: Track, scale: number, offset: number): Track
  (scale: number, offset: number): (axis: Track) => Track
} = dual(3, (axis: Track, scale: number, position: number) => {
  return new Track(
    axis.intervals.map((ival) =>
      interval((ival.start - position) * scale, ival.size * scale),
    ),
  )
})

export const scale: {
  (axis: Track, scale: number, origin?: number): Track
  (scale: number, origin?: number): (axis: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (axis: Track, scale: number, origin = 0) =>
    scaleFrom(axis, scale, lerp(origin, axis.start, axis.end)),
)

/**
 * operations
 * - set start / end
 * - set size w optional origin (default is 0%)
 * - reverse
 * - reflect w optional origin
 * - reflectFrom
 * - normalize
 * - lerp
 * - remap
 * - distribute
 * - distributeWithin
 */

// export const start: {
//   (axis: Track, start: number): Track
//   (start: number): (axis: Track) => Track
// } = dual(
//   2,
//   (axis: Track, start: number) =>
//     new Track(axis.intervals.map((ival) => interval(start, ival.size))),
// )
//
// export const size: {
//   (axis: Track, size: number): Track
//   (size: number): (axis: Track) => Track
// } = dual(2, (axis: Track, size: number) => new Track(axis.intervals, size))

// export const reverse = (axis: Track) => {
//   return new Track(
//     axis.intervals.map((ival) =>
//       interval(
//         remap(ival.start, axis.start, axis.end, axis.end, axis.start) -
//           ival.size,
//         ival.size,
//       ),
//     ),
//     axis.size,
//   )
// }
