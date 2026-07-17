import { lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import {
  type InternalSequenceTrackItem,
  type SequenceTrackItem,
  applyGrow,
  applyShrink,
  processItems,
} from './internal/track/sequence.ts'
import {
  type InternalStackTrackItem,
  type StackTrackItem,
  applyStretch,
  stackTrackItem,
} from './internal/track/stack.ts'
import {
  type Interval,
  type IntervalLike,
  alignTo as alignIntervalTo,
  equals as intervalEquals,
  interval,
  normalize as normalizeInterval,
  remap as remapInterval,
  setSize as setIntervalSize,
} from './interval.ts'
import { auto } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/track')
type TypeBrand = typeof TypeBrand

class Track extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly intervals: ReadonlyArray<Interval>

  readonly start: number
  readonly end: number
  readonly size: number

  constructor(intervals: ReadonlyArray<Interval>) {
    super()

    if (intervals.length === 0) {
      throw new RangeError('Track must contain at least one interval')
    }

    this.intervals = intervals

    let start = Number.POSITIVE_INFINITY
    let end = Number.NEGATIVE_INFINITY

    for (const ival of intervals) {
      start = Math.min(start, ival.start)
      end = Math.max(end, ival.end)
    }

    this.start = start
    this.end = end
    this.size = end - start
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Track [${this.intervals.map((ival) => `[${ival.start}, ${ival.end}]`).join(', ')}]`
  }

  toJSON() {
    return {
      intervals: this.intervals.map((ival) => ival.toJSON()),
    }
  }
}

export type { Track }

export function track(intervals: ReadonlyArray<Interval>): Track {
  return new Track(intervals)
}

export const isTrack = (value: unknown): value is Track => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export type StackItem = StackTrackItem
export type SequenceItem = SequenceTrackItem

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
  (items: ReadonlyArray<StackItem>, options: StackOptions): Track
  (options: StackOptions): (items: ReadonlyArray<StackItem>) => Track
} = dual(2, (items: ReadonlyArray<StackItem>, options: StackOptions): Track => {
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

      return interval(auto(item.place, place) * free + item.definiteStart, item.size)
    }),
  )
})

function sequenceWithoutFreeSpace(
  items: ReadonlyArray<InternalSequenceTrackItem>,
  gap: number,
  autoOffset: number,
  start: number,
) {
  const intervals: Array<Interval> = []

  let cursor = start

  for (const item of items) {
    cursor += autoOffset * Number(item.startIsAuto) + item.definiteStart
    intervals.push(interval(cursor, item.size))
    cursor += item.size + gap + autoOffset * Number(item.endIsAuto) + item.definiteEnd
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
    cursor += item.definiteStart
    intervals.push(interval(cursor, item.size))
    cursor += item.size + between + item.definiteEnd
  }

  return new Track(intervals)
}

export const sequence: {
  (items: ReadonlyArray<SequenceItem>, options: SequenceOptions): Track
  (options: SequenceOptions): (items: ReadonlyArray<SequenceItem>) => Track
} = dual(2, (items: ReadonlyArray<SequenceItem>, options: SequenceOptions): Track => {
  const { trackItems, growable, shrinkable, totals } = processItems(items)

  const gap = options.gap ?? 0
  const place = options.place ?? 0

  const definiteOuterSize = totals.definiteOuterSize + (items.length - 1) * gap

  if (options.size == null || options.size === Number.POSITIVE_INFINITY) {
    return sequenceWithoutFreeSpace(trackItems, gap, 0, place * -definiteOuterSize)
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
    applyGrow(growable, deltaSize, totals.growthFactor, options.growRatio ?? 1) +
    applyShrink(shrinkable, deltaSize, totals.scaledShrinkFactor, options.shrinkRatio ?? 1)

  return sequenceWithFreeSpace(
    trackItems,
    options.size,
    consumed,
    gap,
    place,
    options.space ?? 0,
    options.spaceOuter ?? 0,
  )
})

export const toInterval = (self: Track): Interval => {
  return interval(self.start, self.size)
}

export const translate: {
  (self: Track, amount: number): Track
  (amount: number): (self: Track) => Track
} = dual(
  2,
  (self: Track, amount: number) =>
    new Track(self.intervals.map((ival) => interval(ival.start + amount, ival.size))),
)

export const scale: {
  (self: Track, factor: number, origin?: number): Track
  (factor: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, factor: number, origin = 0) =>
    scaleFrom(self, factor, lerpNumber(origin, self.start, self.end)),
)

export const scaleFrom: {
  (self: Track, factor: number, position: number): Track
  (factor: number, position: number): (self: Track) => Track
} = dual(
  3,
  (self: Track, factor: number, position: number) =>
    new Track(
      Array.from(self.intervals, (ival) => {
        const size = ival.size * factor
        return interval(
          position + (ival.start - position) * factor + Math.min(size, 0),
          Math.abs(size),
        )
      }),
    ),
)

// alignTo takes a fixed arity: its target may itself be a Track, so a
// trailing optional would make 2-argument calls ambiguous between the
// data-first and data-last forms.
export const alignTo: {
  (self: Track, target: number | IntervalLike | Track, origin: number): Track
  (target: number | IntervalLike | Track, origin: number): (self: Track) => Track
} = dual(3, (self: Track, target: number | IntervalLike | Track, origin: number) => {
  const position = typeof target === 'number' ? target : target.start + target.size * origin
  const delta = position - self.size * origin - self.start
  return new Track(self.intervals.map((ival) => interval(ival.start + delta, ival.size)))
})

export const setSize: {
  (self: Track, size: number, origin?: number): Track
  (size: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, size: number, origin = 0) => scale(self, size / self.size, origin),
)

export const map: {
  (self: Track, fn: (interval: Interval, index: number, track: Track) => Interval): Track
  (fn: (interval: Interval, index: number, track: Track) => Interval): (self: Track) => Track
} = dual(
  2,
  (self: Track, fn: (interval: Interval, index: number, track: Track) => Interval): Track =>
    new Track(Array.from(self.intervals, (ival, index) => fn(ival, index, self))),
)

export const alignItemsTo: {
  (self: Track, position: number, origin?: number): Track
  (position: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, position: number, origin = 0) =>
    new Track(self.intervals.map((ival) => interval(position - ival.size * origin, ival.size))),
)

export const alignItems: {
  (self: Track, align: number, origin?: number): Track
  (align: number, origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, align: number, origin?: number) =>
    map(self, alignIntervalTo(lerpNumber(align, self.start, self.end), origin ?? align)),
)

export const reflect: {
  (self: Track, origin?: number): Track
  (origin?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, origin = 0.5) => scale(self, -1, origin),
)

export const normalize: {
  (self: Track, target?: Interval): Track
  (target?: Interval): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, target: Interval = toInterval(self)) => map(self, normalizeInterval(target)),
)

// remap takes a fixed arity: a Track is itself IntervalLike, so a 2-argument
// data-first convenience could not be disambiguated from the data-last form.
// Callers pass toInterval(self) as the source explicitly.
export const remap: {
  (self: Track, source: Interval, target: Interval): Track
  (source: Interval, target: Interval): (self: Track) => Track
} = dual(3, (self: Track, source: Interval, target: Interval) =>
  map(self, remapInterval(source, target)),
)

export const distribute: {
  (self: Track, origin?: number, gap?: number): Track
  (origin?: number, gap?: number): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, origin = 0, gap = 0) => {
    let totalSize = -gap
    for (const ival of self.intervals) {
      totalSize += ival.size + gap
    }

    const intervals: Array<Interval> = []

    let cursor = self.start + origin * (self.size - totalSize)
    for (const ival of self.intervals) {
      intervals.push(interval(cursor, ival.size))
      cursor += ival.size + gap
    }

    return new Track(intervals)
  },
)

export const distributeWithin: {
  (self: Track, target?: Interval): Track
  (target?: Interval): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (self: Track, target: Interval = toInterval(self)) => {
    let totalSize = 0
    for (const ival of self.intervals) {
      totalSize += ival.size
    }

    const between = (target.size - totalSize) / (self.intervals.length - 1)

    const intervals: Array<Interval> = []

    let cursor = target.start
    for (const ival of self.intervals) {
      intervals.push(interval(cursor, ival.size))
      cursor += ival.size + between
    }

    return new Track(intervals)
  },
)

export const lerp: {
  (self: Track, other: Track, amount: number): Track
  (other: Track, amount: number): (self: Track) => Track
} = dual(
  3,
  (self: Track, other: Track, amount: number) =>
    new Track(
      Array.from(
        { length: Math.min(self.intervals.length, other.intervals.length) },
        (_, index) => {
          const a = self.intervals[index] as Interval
          const b = other.intervals[index] as Interval
          return interval(lerpNumber(amount, a.start, b.start), lerpNumber(amount, a.size, b.size))
        },
      ),
    ),
)

export const mapItemStarts: {
  (self: Track, fn: (interval: Interval, index: number) => number): Track
  (fn: (interval: Interval, index: number) => number): (self: Track) => Track
} = dual(2, (self: Track, fn: (interval: Interval, index: number) => number) =>
  map(self, (ival, index) => interval(fn(ival, index), ival.size)),
)

export const mapItemEnds: {
  (self: Track, fn: (interval: Interval, index: number) => number): Track
  (fn: (interval: Interval, index: number) => number): (self: Track) => Track
} = dual(2, (self: Track, fn: (interval: Interval, index: number) => number) =>
  map(self, (ival, index) => interval(fn(ival, index) - ival.size, ival.size)),
)

export const mapItemSizes: {
  (
    self: Track,
    size: number | ((interval: Interval, index: number, track: Track) => number),
    origin?: number | ((interval: Interval, index: number, track: Track) => number),
  ): Track
  (
    size: number | ((interval: Interval, index: number, track: Track) => number),
    origin?: number | ((interval: Interval, index: number, track: Track) => number),
  ): (self: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (
    self: Track,
    size: number | ((interval: Interval, index: number, track: Track) => number),
    origin: number | ((interval: Interval, index: number, track: Track) => number) = 0,
  ) => {
    if (typeof size === 'number' && typeof origin === 'number') {
      return map(self, setIntervalSize(size, origin))
    }

    const sizeOf = typeof size === 'number' ? () => size : size
    const originOf = typeof origin === 'number' ? () => origin : origin

    return map(self, (ival, index, current) => {
      const nextSize = sizeOf(ival, index, current)
      return interval(
        ival.start + (ival.size - nextSize) * originOf(ival, index, current),
        nextSize,
      )
    })
  },
)

export const equals: {
  (self: Track, other: Track): boolean
  (other: Track): (self: Track) => boolean
} = dual(
  2,
  (self: Track, other: Track) =>
    self.intervals.length === other.intervals.length &&
    self.intervals.every((ival, index) => intervalEquals(ival, other.intervals[index] as Interval)),
)
