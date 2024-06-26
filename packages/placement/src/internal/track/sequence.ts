import { TrackItem, type TrackItemInput } from './item'

export interface SequenceTrackItemInput extends TrackItemInput {
  grow?: number
  shrink?: number
}

class SequenceTrackItem extends TrackItem {
  readonly definiteOuterSizeMin: number
  readonly definiteOuterSizeMax: number

  readonly scaledShrinkFactor: number

  constructor(
    start: number,
    end: number,
    basis: number,
    min: number,
    max: number,
    readonly grow: number,
    readonly shrink: number,
  ) {
    super(start, end, basis, min, max)

    this.definiteOuterSizeMin = this.min + this.definiteStart + this.definiteEnd
    this.definiteOuterSizeMax = this.max + this.definiteStart + this.definiteEnd

    this.scaledShrinkFactor = this.shrink * this.basis
  }

  get availableShrinkage(): number {
    return this.definiteOuterSize - this.definiteOuterSizeMin
  }

  get availableGrowth(): number {
    return this.definiteOuterSizeMax - this.definiteOuterSize
  }
}

export type { SequenceTrackItem }

export function sequenceTrackItem(
  options: SequenceTrackItemInput,
): SequenceTrackItem {
  return new SequenceTrackItem(
    options.start ?? 0,
    options.end ?? 0,
    options.basis ?? 0,
    options.min ?? 0,
    options.max ?? Number.POSITIVE_INFINITY,
    options.grow ?? 0,
    options.shrink ?? 0,
  )
}

export function applyGrow(
  growable: Set<SequenceTrackItem>,
  initialExcess: number,
  initialTotalGrow: number,
): number {
  let excess = initialExcess
  let totalGrow = initialTotalGrow

  while (excess > 0 && growable.size > 0) {
    const growthUnit = excess / totalGrow
    for (const item of growable) {
      const growth = Math.min(item.availableGrowth, growthUnit * item.grow)

      if (growth === item.availableGrowth) {
        growable.delete(item)
        totalGrow -= item.grow
      }

      item.size += growth
      excess -= growth
    }
  }

  return initialExcess - excess
}

export function applyShrink(
  shrinkable: Set<SequenceTrackItem>,
  initialExcess: number,
  initialTotalShrink: number,
  initialTotalScaledShrink: number,
): number {
  let excess = initialExcess
  let totalShrink = initialTotalShrink
  let totalScaledShrink = initialTotalScaledShrink

  while (excess > 0 && shrinkable.size > 0) {
    for (const item of shrinkable) {
      const shrink = Math.min(
        item.availableShrinkage,
        (totalShrink * item.scaledShrinkFactor) / totalScaledShrink,
      )

      if (shrink === item.scaledShrinkFactor) {
        shrinkable.delete(item)
        totalShrink -= item.shrink
        totalScaledShrink -= item.scaledShrinkFactor
      }

      item.size -= shrink
      excess -= shrink
    }
  }

  return initialExcess - excess
}
