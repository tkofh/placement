import { Pipeable } from './internal/pipeable'
import {
  type InternalSequenceTrackItem,
  type SequenceTrackItem,
  applyGrow,
  applyShrink,
  processItems,
} from './internal/track/sequence'
import {
  type InternalStackTrackItem,
  type StackTrackItem,
  applyStretch,
  stackTrackItem,
} from './internal/track/stack'
import {
  type Interval,
  alignTo as alignIntervalTo,
  interval,
  isInterval,
  normalize as normalizeInterval,
  remap as remapInterval,
  setSize as setIntervalSize,
  setStart,
  translate as translateInterval,
} from './interval'
import { auto } from './utils/arguments'
import { dual } from './utils/function'
import { lerp as lerpNumber } from './utils/math'

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

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Track [${this.intervals.map((interval) => `[${interval.start}, ${interval.end}]`).join(', ')}]`
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

export interface StackOptions extends BaseOptions {
  stretch?: number
}

export interface SequenceOptions extends BaseOptions {
  gap?: number
  space?: number
  spaceOuter?: number
  growRatio?: number
  shrinkRatio?: number
}

export const stack: {
  (items: ReadonlyArray<StackTrackItem>, options: StackOptions): Track
  (options: StackOptions): (items: ReadonlyArray<StackTrackItem>) => Track
} = dual(
  2,
  (items: ReadonlyArray<StackTrackItem>, options: StackOptions): Track => {
    const trackItems: Array<InternalStackTrackItem> = []
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
  },
)

function sequenceWithoutFreeSpace(
  items: ReadonlyArray<InternalSequenceTrackItem>,
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
  items: ReadonlyArray<InternalSequenceTrackItem>,
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

export const sequence: {
  (items: ReadonlyArray<SequenceTrackItem>, options: SequenceOptions): Track
  (options: SequenceOptions): (items: ReadonlyArray<SequenceTrackItem>) => Track
} = dual(
  2,
  (
    items: ReadonlyArray<SequenceTrackItem>,
    options: SequenceOptions,
  ): Track => {
    const { trackItems, growable, shrinkable, totals } = processItems(items)

    const gap = options.gap ?? 0
    const place = options.place ?? 0

    const definiteOuterSize =
      totals.definiteOuterSize + (items.length - 1) * gap

    if (options.size == null || options.size === Number.POSITIVE_INFINITY) {
      return sequenceWithoutFreeSpace(
        trackItems,
        gap,
        0,
        place * -definiteOuterSize,
      )
    }

    const deltaSize = options.size - definiteOuterSize

    if (totals.autoOffsetCount > 0) {
      return sequenceWithoutFreeSpace(
        trackItems,
        gap,
        (options.size - definiteOuterSize) / totals.autoOffsetCount,
        place * -deltaSize,
      )
    }

    const consumed =
      definiteOuterSize +
      applyGrow(
        growable,
        deltaSize,
        totals.growthFactor,
        options.growRatio ?? 1,
      ) +
      applyShrink(
        shrinkable,
        deltaSize,
        totals.scaledShrinkFactor,
        options.shrinkRatio ?? 1,
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
  },
)

export const toInterval = (track: Track) => {
  return interval(track.start, track.size)
}

export const translate: {
  (track: Track, amount: number): Track
  (amount: number): (track: Track) => Track
} = dual(
  2,
  (track: Track, amount: number) =>
    new Track(
      track.intervals.map((ival) => interval(ival.start + amount, ival.size)),
    ),
)

export const scale: {
  (track: Track, scale: number, origin?: number): Track
  (scale: number, origin?: number): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, scale: number, origin = 0) =>
    scaleFrom(track, scale, lerpNumber(origin, track.start, track.end)),
)

export const scaleFrom: {
  (track: Track, scale: number, position: number): Track
  (scale: number, position: number): (track: Track) => Track
} = dual(
  3,
  (track: Track, scale: number, position: number) =>
    new Track(
      Array.from(track.intervals, (ival) => {
        const size = ival.size * scale
        return interval(
          position + (ival.start - position) * scale + Math.min(size, 0),
          Math.abs(size),
        )
      }),
    ),
)

export const alignTo: {
  (track: Track, target: number | Interval | Track, origin: number): Track
  (target: number | Interval | Track, origin: number): (track: Track) => Track
} = dual(
  3,
  (track: Track, target: number | Interval | Track, origin: number) => {
    const isIntervalLike = isInterval(target) || isTrack(target)

    const set = setStart(
      lerpNumber(
        origin,
        isIntervalLike ? target.start : target,
        isIntervalLike ? target.end : target,
      ) -
        track.size * origin,
    )
    return map(track, (ival) =>
      ival.pipe(set, translateInterval(ival.start - track.start)),
    )
  },
)

export const setSize: {
  (track: Track, size: number, origin?: number): Track
  (size: number, origin?: number): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, size: number, origin = 0) =>
    scale(track, size / track.size, origin),
)

export const map: {
  (
    track: Track,
    fn: (interval: Interval, index: number, track: Track) => Interval,
  ): Track
  (
    fn: (interval: Interval, index: number) => Interval,
    track: Track,
  ): (track: Track) => Track
} = dual(
  2,
  (
    track: Track,
    fn: (interval: Interval, index: number, track: Track) => Interval,
  ): Track =>
    new Track(
      Array.from(track.intervals, (ival, index) => fn(ival, index, track)),
    ),
)

export const alignItemsTo: {
  (track: Track, position: number, origin?: number): Track
  (position: number, origin?: number): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, position: number, origin = 0) =>
    new Track(
      track.intervals.map((ival) =>
        interval(position - ival.size * origin, ival.size),
      ),
    ),
)

export const alignItems: {
  (track: Track, align: number): Track
  (track: Track, align: number, origin: number): Track
  (align: number): (track: Track) => Track
  (align: number, origin: number): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, align: number, origin?: number) =>
    map(
      track,
      alignIntervalTo(
        lerpNumber(align, track.start, track.end),
        origin ?? align,
      ),
    ),
)

export const reflect: {
  (track: Track, origin?: number): Track
  (origin?: number): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, origin = 0.5) => scale(track, -1, origin),
)

export const normalize: {
  (track: Track, target?: Interval): Track
  (target: Interval): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, target = toInterval(track)) =>
    map(track, normalizeInterval(target)),
)

export const remap: {
  (track: Track, target: Interval): Track
  (track: Track, source: Interval, target: Interval): Track
  (target: Interval): (track: Track) => Track
  (source: Interval, target: Interval): (track: Track) => Track
} = dual(3, (track: Track, source: Interval, target?: Interval) =>
  map(
    track,
    remapInterval(
      target == null ? toInterval(track) : source,
      target ?? source,
    ),
  ),
)

export const distribute: {
  (track: Track): Track
  (track: Track, origin: number): Track
  (track: Track, origin: number, gap: number): Track
  (origin: number): (track: Track) => Track
  (origin: number, gap: number): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, origin = 0, gap = 0) => {
    const intervals: Array<Interval> = []

    let totalSize = -gap
    for (const ival of track.intervals) {
      totalSize += ival.size + gap
    }

    let cursor = track.start + origin * (track.size - totalSize)
    for (const ival of track.intervals) {
      intervals.push(interval(cursor, ival.size))
      cursor += ival.size + gap
    }

    return new Track(intervals)
  },
)

export const distributeWithin: {
  (track: Track): Track
  (track: Track, target: Interval): Track
  (target: Interval): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, target: Interval = toInterval(track)) => {
    const intervals: Array<Interval> = []

    let totalSize = 0
    for (const ival of track.intervals) {
      totalSize += ival.size
    }

    const between = (target.size - totalSize) / (track.intervals.length - 1)
    let cursor = target.start
    for (const ival of track.intervals) {
      intervals.push(interval(cursor, ival.size))
      cursor += ival.size + between
    }

    return new Track(intervals)
  },
)

export const lerp: {
  (track: Track, other: Track, amount: number): Track
  (other: Track, amount: number): (track: Track) => Track
} = dual(
  3,
  (track: Track, other: Track, amount = 0.5) =>
    new Track(
      Array.from(
        { length: Math.min(track.intervals.length, other.intervals.length) },
        (_, i) => {
          const trackItem = track.intervals[i]
          const otherItem = other.intervals[i]
          return interval(
            lerpNumber(amount, trackItem.start, otherItem.start),
            lerpNumber(amount, trackItem.size, otherItem.size),
          )
        },
      ),
    ),
)

export const mapItemStarts: {
  (track: Track, fn: (interval: Interval, index: number) => number): Track
  (fn: (interval: Interval, index: number) => number): (track: Track) => Track
} = dual(2, (track: Track, fn: (interval: Interval, index: number) => number) =>
  map(track, (ival, index) => interval(fn(ival, index), ival.size)),
)

export const mapItemEnds: {
  (track: Track, fn: (interval: Interval, index: number) => number): Track
  (fn: (interval: Interval, index: number) => number): (track: Track) => Track
} = dual(2, (track: Track, fn: (interval: Interval, index: number) => number) =>
  map(track, (ival, index) => interval(fn(ival, index) - ival.size, ival.size)),
)

export const mapItemSizes: {
  (
    track: Track,
    size:
      | number
      | ((interval: Interval, index: number, track: Track) => number),
    origin?:
      | number
      | ((interval: Interval, index: number, track: Track) => number),
  ): Track
  (
    size:
      | number
      | ((interval: Interval, index: number, track: Track) => number),
    origin?:
      | number
      | ((interval: Interval, index: number, track: Track) => number),
  ): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (
    track: Track,
    size:
      | number
      | ((interval: Interval, index: number, track: Track) => number),
    origin:
      | number
      | ((interval: Interval, index: number, track: Track) => number) = 0,
  ) => {
    if (typeof size === 'number' && typeof origin === 'number') {
      return map(track, setIntervalSize(size, origin))
    }

    const sizeFn = typeof size === 'number' ? () => size : size
    const originFn = typeof origin === 'number' ? () => origin : origin

    return map(track, (ival, index, track) => {
      const size = sizeFn(ival, index, track)
      return interval(
        ival.start + (ival.size - size) * originFn(ival, index, track),
        size,
      )
    })
  },
)
