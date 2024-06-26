import { auto, isAuto } from '../../utils/arguments'
import { clamp } from '../../utils/math'
import { TrackItem, type TrackItemInput } from './item'

export interface StackTrackItemInput extends TrackItemInput {
  stretch?: number
  place?: number
}

class StackTrackItem extends TrackItem {
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

    this.stretch = isAuto(stretch) ? stretch : clamp(stretch, 0, 1)
    this.place = isAuto(place) ? place : clamp(place, 0, 1)

    this.stretchable = !(this.startIsAuto || this.endIsAuto)
  }
}

export type { StackTrackItem }

export function stackTrackItem(options: StackTrackItemInput): StackTrackItem {
  return new StackTrackItem(
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
  items: ReadonlyArray<StackTrackItem>,
  size: number,
  stretch: number,
) {
  for (const item of items) {
    if (!item.stretchable) {
      continue
    }

    const free = size - item.definiteOuterSize
    const stretchAmount = auto(item.stretch, stretch) * free
    item.size = item.size + stretchAmount
  }
}
