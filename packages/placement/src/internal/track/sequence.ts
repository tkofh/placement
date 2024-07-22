import { TrackItem, type TrackItemInput } from './item'

export interface SequenceTrackItem extends TrackItemInput {
  grow?: number
  shrink?: number
}

class InternalSequenceTrackItem extends TrackItem {
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

      item.adjustment += growth
      freeSpace -= growth
    }
  }

  for (const item of initialGrowable) {
    item.adjustment = item.adjustment * ratio
  }

  return initialFreeSpace - freeSpace
}

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

      item.adjustment -= shrink
      excessReduction += shrink
    }

    excess -= excessReduction
    totalScaledShrink -= totalScaledShrinkReduction
  }

  for (const item of initialShrinkable) {
    item.adjustment = item.adjustment * ratio
  }

  return excess - initialExcess
}
