import {
  type SequenceTrackItem,
  type SequenceTrackItemInput,
  applyGrow,
  applyShrink,
  sequenceTrackItem,
} from './internal/track/sequence'
import {
  type StackTrackItem,
  type StackTrackItemInput,
  applyStretch,
  stackTrackItem,
} from './internal/track/stack'
import { type Interval, interval } from './interval'
import { Pipeable } from './pipeable'
import { auto } from './utils/arguments'
import { dual } from './utils/function'
import { clamp, normalize, remap } from './utils/math'

const TypeBrand: unique symbol = Symbol('placement/track')
type TypeBrand = typeof TypeBrand

class Track extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  constructor(
    readonly intervals: ReadonlyArray<Interval>,
    readonly size: number,
  ) {
    super()
  }

  get start() {
    return this.intervals[0].start
  }

  get end() {
    return this.intervals[this.intervals.length - 1].end
  }

  get innerSize(): number {
    return Math.abs(this.end - this.start)
  }
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

  const stretch = clamp(options.stretch ?? 0, 0, 1)
  const place = clamp(options.place ?? 0, 0, 1)

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
    size,
  )
}

function processItems(items: ReadonlyArray<SequenceTrackItemInput>) {
  const trackItems: Array<SequenceTrackItem> = []

  let totalDefiniteOuterSize = 0

  let totalAutoOffsetCount = 0

  const growable = new Set<SequenceTrackItem>()
  let totalGrow = 0

  const shrinkable = new Set<SequenceTrackItem>()
  let totalShrink = 0
  let totalScaledShrink = 0

  for (const item of items) {
    const trackItem = sequenceTrackItem(item)
    trackItems.push(trackItem)

    totalDefiniteOuterSize += trackItem.definiteOuterSize

    totalAutoOffsetCount += trackItem.autoOffsetCount

    if (trackItem.grow > 0) {
      growable.add(trackItem)
      totalGrow += trackItem.grow
    }

    if (trackItem.shrink > 0) {
      shrinkable.add(trackItem)
      totalShrink += trackItem.shrink
      totalScaledShrink += trackItem.shrink * trackItem.size
    }
  }

  return {
    trackItems,
    totalDefiniteOuterSize,
    totalAutoOffsetCount,
    growable,
    totalGrow,
    shrinkable,
    totalShrink,
    totalScaledShrink,
  }
}

export function sequence(
  items: ReadonlyArray<SequenceTrackItemInput>,
  options: SequenceOptions,
) {
  const processResult = processItems(items)
  const {
    trackItems,
    growable,
    shrinkable,
    totalShrink,
    totalScaledShrink,
    totalGrow,
    totalAutoOffsetCount,
  } = processResult

  let totalDefiniteOuterSize = processResult.totalDefiniteOuterSize

  const size = auto(
    options.size ?? Number.POSITIVE_INFINITY,
    totalDefiniteOuterSize,
  )

  let start = 0
  let between = options.gap ?? 0
  let autoOffset = 0

  if (totalAutoOffsetCount === 0) {
    const delta = size - totalDefiniteOuterSize
    const excess = Math.abs(delta)
    if (delta > 0 && growable.size > 0) {
      const growth = applyGrow(growable, excess, totalGrow)
      totalDefiniteOuterSize += growth
    } else if (delta < 0 && shrinkable.size > 0) {
      const shrinkage = applyShrink(
        shrinkable,
        excess,
        totalShrink,
        totalScaledShrink,
      )
      totalDefiniteOuterSize -= shrinkage
    }

    const space = options.space ?? 0
    const spaceOuter = options.spaceOuter ?? 1
    const distributed = (size - totalDefiniteOuterSize) * space

    start +=
      (size - totalDefiniteOuterSize - distributed) * (options.place ?? 0)

    if (distributed > 0 && trackItems.length > 1) {
      const spacing = distributed / (trackItems.length + 1)
      start += spacing * spaceOuter
      between +=
        spacing + (spacing * 2 * (1 - spaceOuter)) / (trackItems.length - 1)
    }
  } else {
    autoOffset = (size - totalDefiniteOuterSize) / totalAutoOffsetCount
  }

  const intervals: Array<Interval> = []

  for (const item of trackItems) {
    start += autoOffset * Number(item.startIsAuto)
    intervals.push(interval(start, item.size))
    start += item.size + between + autoOffset * Number(item.endIsAuto)
  }

  return new Track(intervals, auto(size, start - between))
}

export const translate: {
  (axis: Track, amount: number): Track
  (amount: number): (axis: Track) => Track
} = dual(
  2,
  (axis: Track, amount: number) =>
    new Track(
      axis.intervals.map((ival) => interval(ival.start + amount, ival.size)),
      axis.size,
    ),
)

export const scaleFrom: {
  (axis: Track, scale: number, offset: number): Track
  (scale: number, offset: number): (axis: Track) => Track
} = dual(3, (axis: Track, scale: number, offset: number) => {
  return new Track(
    axis.intervals.map((ival) =>
      interval((ival.start - offset) * scale, ival.size * scale),
    ),
    axis.size * scale,
  )
})

export const scale: {
  (axis: Track, scale: number, origin?: number): Track
  (scale: number, origin?: number): (axis: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (axis: Track, scale: number, origin = 0) =>
    scaleFrom(axis, scale, normalize(origin, axis.start, axis.end)),
)

export const start: {
  (axis: Track, start: number): Track
  (start: number): (axis: Track) => Track
} = dual(
  2,
  (axis: Track, start: number) =>
    new Track(
      axis.intervals.map((ival) => interval(start, ival.size)),
      axis.size,
    ),
)

export const size: {
  (axis: Track, size: number): Track
  (size: number): (axis: Track) => Track
} = dual(2, (axis: Track, size: number) => new Track(axis.intervals, size))

export const reverse = (axis: Track) => {
  return new Track(
    axis.intervals.map((ival) =>
      interval(
        remap(ival.start, axis.start, axis.end, axis.end, axis.start) -
          ival.size,
        ival.size,
      ),
    ),
    axis.size,
  )
}

console.log(
  sequence([{ basis: 100, grow: 1, max: 200 }, { basis: 200 }], {
    size: 500,
    gap: 0,
    place: 0,
    space: 0,
    spaceOuter: 0,
  }),
)
