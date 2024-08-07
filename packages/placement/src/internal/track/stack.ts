import { auto } from '../../utils/arguments'
import { TrackItem, type TrackItemInput } from './item'

export interface StackTrackItem extends TrackItemInput {
  stretch?: number
  place?: number
}

class InternalStackTrackItem extends TrackItem {
  readonly stretch: number
  readonly place: number

  readonly stretchable: boolean

  constructor(
    start: number,
    end: number,
    basis: number,
    min: number,
    max: number,
    stretch: number,
    place: number,
  ) {
    super(start, end, basis, min, max)

    this.stretch = stretch
    this.place = place

    this.stretchable = !(
      this.startIsAuto ||
      this.endIsAuto ||
      !Number.isFinite(this.initialSize)
    )
  }
}

export type { InternalStackTrackItem }

export function stackTrackItem(
  options: StackTrackItem,
): InternalStackTrackItem {
  return new InternalStackTrackItem(
    options.start ?? 0,
    options.end ?? 0,
    options.basis ?? 0,
    options.min ?? 0,
    options.max ?? Number.POSITIVE_INFINITY,
    options.stretch ?? Number.POSITIVE_INFINITY,
    options.place ?? Number.POSITIVE_INFINITY,
  )
}

export function applyStretch(
  items: ReadonlyArray<InternalStackTrackItem>,
  size: number,
  stretch: number,
) {
  for (const item of items) {
    if (!item.stretchable) {
      continue
    }

    const free = size - item.definiteOuterSize
    const stretchAmount = auto(item.stretch, stretch) * free
    item.adjustment += stretchAmount
  }
}
