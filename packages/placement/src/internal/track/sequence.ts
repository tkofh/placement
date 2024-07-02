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
    shrink: number,
  ) {
    super(start, end, basis, min, max)

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

export type { SequenceTrackItem }

export function processItems(items: ReadonlyArray<SequenceTrackItemInput>) {
  const trackItems: Array<SequenceTrackItem> = []

  let definiteOuterSize = 0
  let autoOffsetCount = 0
  let growthFactor = 0
  let scaledShrinkFactor = 0

  const growable = new Set<SequenceTrackItem>()
  const shrinkable = new Set<SequenceTrackItem>()

  for (const input of items) {
    const item = new SequenceTrackItem(
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

function applyGrow(
  growable: Set<SequenceTrackItem>,
  initialFreeSpace: number,
  initialTotalGrow: number,
): number {
  let freeSpace = initialFreeSpace
  let totalGrow = initialTotalGrow

  while (freeSpace > 0 && growable.size > 0) {
    const growthUnit = freeSpace / totalGrow
    for (const item of growable) {
      const growth = Math.min(item.availableGrowth, growthUnit * item.grow)

      if (growth === item.availableGrowth) {
        growable.delete(item)
        totalGrow -= item.grow
      }

      item.size += growth
      freeSpace -= growth
    }
  }

  return initialFreeSpace - freeSpace
}

function applyShrink(
  shrinkable: Set<SequenceTrackItem>,
  initialFreeSpace: number,
  initialTotalScaledShrink: number,
): number {
  const initialExcess = Math.abs(initialFreeSpace)
  let excess = initialExcess
  let totalScaledShrink = initialTotalScaledShrink

  while (excess > 0 && shrinkable.size > 0) {
    let excessReduction = 0
    let totalScaledShrinkReduction = 0

    for (const item of shrinkable) {
      const ratio = item.scaledShrinkFactor / totalScaledShrink
      const shrink = Math.min(item.availableShrinkage, excess * ratio)

      if (shrink === item.availableShrinkage) {
        shrinkable.delete(item)
        totalScaledShrinkReduction += item.scaledShrinkFactor
      }

      item.size -= shrink
      excessReduction += shrink
    }

    excess -= excessReduction
    totalScaledShrink -= totalScaledShrinkReduction
  }

  return excess - initialExcess
}

export function adjustSizes(
  delta: number,
  growable: Set<SequenceTrackItem>,
  totalGrow: number,
  shrinkable: Set<SequenceTrackItem>,
  totalScaledShrink: number,
): number {
  if (delta > 0 && growable.size > 0) {
    return applyGrow(growable, delta, totalGrow)
  }
  if (delta < 0 && shrinkable.size > 0) {
    return applyShrink(shrinkable, delta, totalScaledShrink)
  }

  return 0
}
