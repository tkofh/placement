import { RELATIVE_TOLERANCE } from 'curvy/number'
import { TrackItem, type TrackItemInput } from './item.ts'

export interface SequenceTrackItem extends TrackItemInput {
  grow?: number
  shrink?: number
}

class InternalSequenceTrackItem extends TrackItem {
  readonly grow: number

  readonly definiteOuterSizeMin: number
  readonly definiteOuterSizeMax: number

  readonly scaledShrinkFactor: number

  constructor(
    start: number,
    end: number,
    basis: number,
    min: number,
    max: number,
    grow: number,
    shrink: number,
  ) {
    super(start, end, basis, min, max)

    this.grow = grow

    this.definiteOuterSizeMin = this.min + this.definiteStart + this.definiteEnd
    this.definiteOuterSizeMax = this.max + this.definiteStart + this.definiteEnd

    this.scaledShrinkFactor = shrink * this.basis
  }

  get availableShrinkage(): number {
    return this.definiteOuterSize - this.definiteOuterSizeMin
  }

  get availableGrowth(): number {
    return this.definiteOuterSizeMax - this.definiteOuterSize
  }
}

export type { InternalSequenceTrackItem }

export function processItems(items: ReadonlyArray<SequenceTrackItem>) {
  const trackItems: Array<InternalSequenceTrackItem> = []

  let definiteOuterSize = 0
  let autoOffsetCount = 0
  let growthFactor = 0
  let scaledShrinkFactor = 0

  const growable = new Set<InternalSequenceTrackItem>()
  const shrinkable = new Set<InternalSequenceTrackItem>()

  for (const input of items) {
    const item = new InternalSequenceTrackItem(
      input.start ?? 0,
      input.end ?? 0,
      input.basis ?? 0,
      input.min ?? 0,
      input.max ?? Number.POSITIVE_INFINITY,
      input.grow ?? 0,
      input.shrink ?? 0,
    )
    trackItems.push(item)

    definiteOuterSize += item.definiteOuterSize
    autoOffsetCount += item.autoOffsetCount

    if (item.grow > 0) {
      growable.add(item)
      growthFactor += item.grow
    }

    if (item.scaledShrinkFactor > 0) {
      shrinkable.add(item)
      scaledShrinkFactor += item.scaledShrinkFactor
    }
  }

  return {
    trackItems,
    growable,
    shrinkable,
    totals: {
      definiteOuterSize,
      autoOffsetCount,
      growthFactor,
      scaledShrinkFactor,
    },
  }
}

export function applyGrow(
  initialGrowable: Set<InternalSequenceTrackItem>,
  initialFreeSpace: number,
  initialTotalGrow: number,
  ratio: number,
): number {
  if (initialFreeSpace <= 0 || ratio === 0 || initialGrowable.size === 0) {
    return 0
  }

  const growable = new Set(initialGrowable)

  // Free space this small, relative to the free space at the start of
  // distribution, is rounding residue and not layout. Treat it as consumed
  // (see PRECISION.md).
  const tolerance = RELATIVE_TOLERANCE * initialFreeSpace

  let freeSpace = initialFreeSpace
  let totalGrow = initialTotalGrow

  while (freeSpace > tolerance && growable.size > 0) {
    const growthUnit = freeSpace / totalGrow
    for (const item of growable) {
      const growth = Math.min(item.availableGrowth, growthUnit * item.grow)

      if (growth === item.availableGrowth) {
        growable.delete(item)
        totalGrow -= item.grow
      }

      item.adjustment += growth
      freeSpace -= growth
    }
  }

  if (freeSpace <= tolerance) {
    freeSpace = 0
  }

  for (const item of initialGrowable) {
    item.adjustment *= ratio
  }

  // The reported consumption scales with the adjustments. The growth that a
  // fractional ratio withholds stays free for space and place.
  return (initialFreeSpace - freeSpace) * ratio
}

// Returns the change in consumed size. The value is zero or negative, so
// callers can add it to the non-negative result of applyGrow.
export function applyShrink(
  initialShrinkable: Set<InternalSequenceTrackItem>,
  initialFreeSpace: number,
  initialTotalScaledShrink: number,
  ratio: number,
): number {
  if (initialFreeSpace >= 0 || ratio === 0 || initialShrinkable.size === 0) {
    return 0
  }

  const shrinkable = new Set(initialShrinkable)

  const initialExcess = Math.abs(initialFreeSpace)

  // Excess this small, relative to the excess at the start of distribution,
  // is rounding residue and not layout. Treat it as consumed (see
  // PRECISION.md).
  const tolerance = RELATIVE_TOLERANCE * initialExcess

  let excess = initialExcess
  let totalScaledShrink = initialTotalScaledShrink

  while (excess > tolerance && shrinkable.size > 0) {
    let excessReduction = 0
    let totalScaledShrinkReduction = 0

    for (const item of shrinkable) {
      const share = item.scaledShrinkFactor / totalScaledShrink
      const shrink = Math.min(item.availableShrinkage, excess * share)

      if (shrink === item.availableShrinkage) {
        shrinkable.delete(item)
        totalScaledShrinkReduction += item.scaledShrinkFactor
      }

      item.adjustment -= shrink
      excessReduction += shrink
    }

    excess -= excessReduction
    totalScaledShrink -= totalScaledShrinkReduction
  }

  if (excess <= tolerance) {
    excess = 0
  }

  for (const item of initialShrinkable) {
    item.adjustment *= ratio
  }

  // The reported consumption scales with the adjustments. The shrinkage that
  // a fractional ratio withholds still counts as used space.
  return (excess - initialExcess) * ratio
}
