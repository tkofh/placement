import { Pipeable } from './pipeable'
import { type Span, size as setSize } from './span'
import { auto } from './utils/arguments'
import { dual } from './utils/function'

const TypeBrand: unique symbol = Symbol('placement/track')
type TypeBrand = typeof TypeBrand

class Track extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly size: number | null

  private _maxDefiniteOuterSize: number | undefined
  private _maxDefiniteOuterSizeMin: number | undefined
  private _maxDefiniteOuterSizeMax: number | undefined
  private _minDefiniteOuterSize: number | undefined
  private _minDefiniteOuterSizeMin: number | undefined
  private _minDefiniteOuterSizeMax: number | undefined
  private _totalDefiniteOuterSize: number | undefined
  private _totalGappedDefiniteOuterSize: number | undefined
  private _totalDefiniteOuterSizeMin: number | undefined
  private _totalGappedDefiniteOuterSizeMin: number | undefined
  private _totalDefiniteOuterSizeMax: number | undefined
  private _totalGappedDefiniteOuterSizeMax: number | undefined
  private _totalAutoOffsets: number | undefined

  constructor(
    readonly spans: ReadonlyArray<Span>,
    size?: number | null,
    readonly gap = 0,
  ) {
    super()

    if (size != null && size < 0) {
      throw new RangeError('Track size must be a non-negative number')
    }

    if (spans.length === 0) {
      throw new RangeError('Track must have at least one span')
    }

    this.size = size ?? null
  }

  get maxDefiniteOuterSize(): number {
    if (this._maxDefiniteOuterSize === undefined) {
      this._maxDefiniteOuterSize = maxDefiniteOuterSize(this)
    }
    return this._maxDefiniteOuterSize
  }

  get maxDefiniteOuterSizeMin(): number {
    if (this._maxDefiniteOuterSizeMin === undefined) {
      this._maxDefiniteOuterSizeMin = maxDefiniteOuterSizeMin(this)
    }
    return this._maxDefiniteOuterSizeMin
  }

  get maxDefiniteOuterSizeMax(): number {
    if (this._maxDefiniteOuterSizeMax === undefined) {
      this._maxDefiniteOuterSizeMax = maxDefiniteOuterSizeMax(this)
    }
    return this._maxDefiniteOuterSizeMax
  }

  get minDefiniteOuterSize(): number {
    if (this._minDefiniteOuterSize === undefined) {
      this._minDefiniteOuterSize = minDefiniteOuterSize(this)
    }
    return this._minDefiniteOuterSize
  }

  get minDefiniteOuterSizeMin(): number {
    if (this._minDefiniteOuterSizeMin === undefined) {
      this._minDefiniteOuterSizeMin = minDefiniteOuterSizeMin(this)
    }
    return this._minDefiniteOuterSizeMin
  }

  get minDefiniteOuterSizeMax(): number {
    if (this._minDefiniteOuterSizeMax === undefined) {
      this._minDefiniteOuterSizeMax = minDefiniteOuterSizeMax(this)
    }
    return this._minDefiniteOuterSizeMax
  }

  get totalDefiniteOuterSize(): number {
    if (this._totalDefiniteOuterSize === undefined) {
      this._totalDefiniteOuterSize = totalDefiniteOuterSize(this, 0)
    }
    return this._totalDefiniteOuterSize
  }

  get totalGappedDefiniteOuterSize(): number {
    if (this._totalGappedDefiniteOuterSize === undefined) {
      this._totalGappedDefiniteOuterSize = totalDefiniteOuterSize(
        this,
        this.gap,
      )
    }
    return this._totalGappedDefiniteOuterSize
  }

  get totalDefiniteOuterSizeMin(): number {
    if (this._totalDefiniteOuterSizeMin === undefined) {
      this._totalDefiniteOuterSizeMin = totalDefiniteOuterSizeMin(this, 0)
    }
    return this._totalDefiniteOuterSizeMin
  }

  get totalGappedDefiniteOuterSizeMin(): number {
    if (this._totalGappedDefiniteOuterSizeMin === undefined) {
      this._totalGappedDefiniteOuterSizeMin = totalDefiniteOuterSizeMin(
        this,
        this.gap,
      )
    }
    return this._totalGappedDefiniteOuterSizeMin
  }

  get totalDefiniteOuterSizeMax(): number {
    if (this._totalDefiniteOuterSizeMax === undefined) {
      this._totalDefiniteOuterSizeMax = totalDefiniteOuterSizeMax(this, 0)
    }
    return this._totalDefiniteOuterSizeMax
  }

  get totalGappedDefiniteOuterSizeMax(): number {
    if (this._totalGappedDefiniteOuterSizeMax === undefined) {
      this._totalGappedDefiniteOuterSizeMax = totalDefiniteOuterSizeMax(
        this,
        this.gap,
      )
    }
    return this._totalGappedDefiniteOuterSizeMax
  }

  get totalAutoOffsets(): number {
    if (this._totalAutoOffsets === undefined) {
      this._totalAutoOffsets = totalAutoOffsets(this)
    }
    return this._totalAutoOffsets
  }
}

interface TrackOptions {
  size?: number
  gap?: number
}

export function track(
  spans: ReadonlyArray<Span>,
  options: TrackOptions = {},
): Track {
  return new Track(spans, options.size, options.gap)
}

export function isTrack(value: unknown): value is Track {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export type { Track }

export const addSpan: {
  (track: Track, span: Span): Track
  (track: Track, span: Span, index: number): Track
  (span: Span): (track: Track) => Track
  (span: Span, index: number): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (track: Track, span: Span, index?: number) => {
    const spans = [...track.spans]
    if (index !== undefined) {
      spans.splice(index, 0, span)
    } else {
      spans.push(span)
    }
    return new Track(spans, track.size)
  },
)

export const removeSpan: {
  (track: Track, target: Span): Track
  (track: Track, index: number): Track
  (index: number): (track: Track) => Track
  (target: Span): (track: Track) => Track
} = dual(2, (track: Track, target: number | Span) => {
  const spans = [...track.spans]
  if (typeof target === 'number') {
    spans.splice(target, 1)
  } else {
    spans.splice(spans.indexOf(target), 1)
  }
  return new Track(spans, track.size)
})

export const size: {
  (track: Track, size: number): Track
  (size: number): (track: Track) => Track
} = dual(2, (track: Track, size: number) => new Track(track.spans, size))

export const gap: {
  (track: Track, gap: number): Track
  (gap: number): (track: Track) => Track
} = dual(
  2,
  (track: Track, gap: number) => new Track(track.spans, track.size, gap),
)

export const fit: {
  (track: Track, mode: 'max' | 'sum'): Track
  (
    track: Track,
    mode: 'max' | 'sum',
    reference: 'min' | 'max' | 'current',
  ): Track
  (mode: 'max' | 'sum'): (track: Track) => Track
  (
    mode: 'max' | 'sum',
    reference: 'min' | 'max' | 'current',
  ): (track: Track) => Track
} = dual(
  (args) => isTrack(args[0]),
  (
    track: Track,
    mode: 'max' | 'sum',
    reference: 'min' | 'max' | 'current' = 'current',
  ) => {
    if (mode === 'max') {
      if (reference === 'min') {
        return size(track, track.maxDefiniteOuterSize)
      }

      if (reference === 'max') {
        return size(track, track.totalDefiniteOuterSizeMax)
      }

      return size(track, track.maxDefiniteOuterSize)
    }

    if (reference === 'min') {
      return size(track, track.totalDefiniteOuterSizeMin)
    }

    if (reference === 'max') {
      return size(track, track.totalDefiniteOuterSizeMax)
    }

    return size(track, track.totalDefiniteOuterSize)
  },
)

const maxDefiniteOuterSize = (track: Track): number =>
  track.spans.reduce((max, span) => Math.max(max, span.constrainedSize), 0)

const maxDefiniteOuterSizeMin = (track: Track): number =>
  track.spans.reduce((max, span) => Math.max(max, span.definiteOuterSizeMin), 0)

const maxDefiniteOuterSizeMax = (track: Track): number =>
  track.spans.reduce((max, span) => Math.max(max, span.definiteOuterSizeMax), 0)

const minDefiniteOuterSize = (track: Track): number =>
  track.spans.reduce(
    (min, span) => Math.min(min, span.constrainedSize),
    Number.POSITIVE_INFINITY,
  )

const minDefiniteOuterSizeMin = (track: Track): number =>
  track.spans.reduce(
    (min, span) => Math.min(min, span.definiteOuterSizeMin),
    Number.POSITIVE_INFINITY,
  )

const minDefiniteOuterSizeMax = (track: Track): number =>
  track.spans.reduce(
    (min, span) => Math.min(min, span.definiteOuterSizeMax),
    Number.POSITIVE_INFINITY,
  )

const totalDefiniteOuterSize = (track: Track, gap: number) =>
  track.spans.reduce((sum, span) => sum + span.constrainedSize + gap, -gap)

const totalDefiniteOuterSizeMin = (track: Track, gap: number) =>
  track.spans.reduce((sum, span) => sum + span.definiteOuterSizeMin + gap, -gap)

const totalDefiniteOuterSizeMax = (track: Track, gap: number) =>
  track.spans.reduce((sum, span) => sum + span.definiteOuterSizeMax + gap, -gap)

const totalAutoOffsets = (track: Track): number =>
  track.spans.reduce((sum, span) => sum + span.auto, 0)

export const grow = (track: Track) => {
  if (track.size === null) {
    return track
  }

  if (track.totalAutoOffsets > 0) {
    return track
  }

  let freeMainSize = track.size - track.totalGappedDefiniteOuterSize

  const pendingGrowth = new Map<Span, number>()
  let trackTotalGrowth = 0

  for (const span of track.spans) {
    if (span.grow > 0) {
      pendingGrowth.set(span, 0)
      trackTotalGrowth += span.grow
    }
  }

  const growable = new Set(pendingGrowth.keys())

  while (freeMainSize > 0) {
    const growthUnit = freeMainSize / trackTotalGrowth

    for (const span of growable) {
      const pending = pendingGrowth.get(span) ?? 0
      let growth = growthUnit * span.grow

      if (span.size + pending + growth > span.definiteOuterSizeMax) {
        growth = span.definiteOuterSizeMax - span.size - pending
        trackTotalGrowth -= span.grow
        growable.delete(span)
      }

      pendingGrowth.set(span, pending + growth)
      freeMainSize -= growth
    }
  }

  return new Track(
    track.spans.map((span) => {
      const growth = pendingGrowth.get(span) ?? 0
      return growth > 0 ? span.pipe(setSize(span.size + growth)) : span
    }),
    track.size,
    track.gap,
  )
}

export const shrink = (track: Track) => {
  if (track.size === null) {
    return track
  }

  if (track.totalAutoOffsets > 0) {
    return track
  }

  let freeMainSize = track.totalGappedDefiniteOuterSize - track.size

  const pendingShrink = new Map<Span, number>()
  let trackTotalShrink = 0

  for (const span of track.spans) {
    if (span.shrink > 0) {
      pendingShrink.set(span, 0)
      trackTotalShrink += span.shrink
    }
  }

  const shrinkable = new Set(pendingShrink.keys())

  while (freeMainSize > 0) {
    const shrinkUnit = freeMainSize / trackTotalShrink

    for (const span of shrinkable) {
      const pending = pendingShrink.get(span) ?? 0
      let shrink = shrinkUnit * span.shrink

      if (span.size - pending - shrink < span.definiteOuterSizeMin) {
        shrink = span.size - span.definiteOuterSizeMin - pending
        trackTotalShrink -= span.shrink
        shrinkable.delete(span)
      }

      pendingShrink.set(span, pending + shrink)
      freeMainSize -= shrink
    }
  }

  return new Track(
    track.spans.map((span) => {
      const shrink = pendingShrink.get(span) ?? 0
      return shrink > 0 ? span.pipe(setSize(span.size - shrink)) : span
    }),
    track.size,
    track.gap,
  )
}

export const growOrShrink = (track: Track) => {
  if (track.size == null) {
    return track
  }

  if (track.totalAutoOffsets > 0) {
    return track
  }

  if (track.size === track.totalGappedDefiniteOuterSize) {
    return track
  }

  if (track.size > track.totalGappedDefiniteOuterSize) {
    return grow(track)
  }

  return shrink(track)
}

export const stretch: {
  (track: Track, stretch: number): Track
  (stretch: number): (track: Track) => Track
} = dual(2, (track: Track, stretch: number) => {
  const size = track.size ?? track.maxDefiniteOuterSize

  return new Track(
    track.spans.map((span) => {
      if (span.auto > 0) {
        return span
      }

      const free = size - span.definiteOuterSize
      const stretchAmount = auto(span.stretch, stretch) * free
      return setSize(span, span.size + stretchAmount)
    }),
    size,
    track.gap,
  )
})
