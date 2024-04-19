import type { ComputedFrameProperties } from '../../frame/ComputedFrameProperties'
import type { Rect } from '../../rect/Rect'
import { FlexItem } from './FlexItem'
import type { FlexLayout } from './FlexLayout'
import { spatialOffsets } from './utils'

export class FlexLine {
  readonly #items: Array<FlexItem> = []
  readonly #layout: FlexLayout
  #next: FlexLine | null = null

  #totalMainSize = 0
  #itemsCrossSize = 0
  #totalGrowth = 0
  #totalScaledShrink = 0

  #growableItems: Set<FlexItem> = new Set()
  #shrinkableItems: Set<FlexItem> = new Set()

  constructor(layout: FlexLayout) {
    this.#layout = layout
  }

  get #firstIndex(): number {
    return this.#items[0].index
  }
  get #lastIndex(): number {
    return this.#items[this.#items.length - 1].index
  }

  get itemsCrossSize(): number {
    return this.#itemsCrossSize
  }

  get hasNext() {
    return this.#next !== null
  }

  insert(frame: ComputedFrameProperties, rect: Rect, index: number) {
    if (this.#items.length === 0 || this.#next === null) {
      this.#items.push(new FlexItem(this.#layout, frame, rect, index))
      return
    }

    if (index > this.#lastIndex) {
      this.#next.insert(frame, rect, index)
      return
    }

    if (index >= this.#firstIndex) {
      this.#items.splice(
        index - this.#firstIndex,
        0,
        new FlexItem(this.#layout, frame, rect, index),
      )
      this.#shiftIndexes(index + 1, 1)
      return
    }

    throw new Error('frame index is out of bounds')
  }

  remove(frame: ComputedFrameProperties) {
    for (const [index, item] of this.#items.entries()) {
      if (item.frame === frame) {
        this.#items.splice(index, 1)
        this.#shiftIndexes(index, -1)
        return
      }
    }

    if (this.#next !== null) {
      this.#next.remove(frame)
      return
    }

    throw new Error('frame not found')
  }

  *reflow(): IterableIterator<FlexLine> {
    this.#totalMainSize = 0
    this.#itemsCrossSize = 0
    this.#totalGrowth = 0
    this.#totalScaledShrink = 0
    this.#growableItems.clear()
    this.#shrinkableItems.clear()

    if (this.#layout.wrap === 'nowrap') {
      this.#reflowNoWrap()
    } else {
      this.#reflowWrap()
    }

    yield this
    if (this.#next !== null) {
      yield* this.#next.reflow()
    }
  }

  *placeItems(
    crossPosition: number,
    crossSize: number,
  ): IterableIterator<FlexItem> {
    if (
      this.#totalMainSize < this.#layout.mainSize &&
      this.#growableItems.size > 0
    ) {
      this.#growItems()
    } else if (
      this.#totalMainSize > this.#layout.mainSize &&
      this.#shrinkableItems.size > 0
    ) {
      this.#shrinkItems()
    }

    const { start, between } = spatialOffsets(
      this.#layout.justifyContent,
      this.#layout.mainSize - this.#totalMainSize,
      this.#layout.mainGap,
      this.#items.length,
      this.#layout.justifyContentSpace,
      this.#layout.justifyContentSpaceOuter,
    )

    if (this.#layout.directionReverse) {
      this.#placeItemsMainReverse(start, between)
    } else {
      this.#placeItemsMainForward(start, between)
    }

    this.#placeItemsCross(crossPosition, crossSize)

    yield* this.#items
  }

  #shiftIndexes(index: number, amount: number) {
    for (const item of this.#items.slice(index)) {
      item.index += amount
    }

    if (this.#next) {
      this.#next.#shiftIndexes(this.#next.#firstIndex, amount)
    }
  }

  #reflowNoWrap() {
    let line: FlexLine | null = this
    while (line !== null) {
      for (const item of line.#items) {
        this.#updateMeasurements(item)

        if (line !== this) {
          this.#items.push(item)
        }
      }

      line = line.#next
    }
    this.#next = null
    this.#totalMainSize -= this.#layout.mainGap
  }

  #reflowWrap() {
    for (const [index, item] of this.#items.entries()) {
      if (
        index > 0 &&
        this.#totalMainSize + item.outerHypotheticalMainSize >
          this.#layout.mainSize
      ) {
        if (this.#next === null) {
          this.#next = new FlexLine(this.#layout)
        }

        this.#next.#items.unshift(...this.#items.splice(index))
        this.#items.length = index
        break
      }

      this.#updateMeasurements(item)
    }

    while (this.#next !== null && this.#totalMainSize < this.#layout.mainSize) {
      const item = this.#next.#items[0]
      if (
        this.#totalMainSize + item.outerHypotheticalMainSize >
        this.#layout.mainSize
      ) {
        break
      }

      this.#updateMeasurements(item)
      this.#items.push(item)
      this.#next.#items.shift()
    }

    this.#totalMainSize -= this.#layout.mainGap
  }

  #updateMeasurements(item: FlexItem) {
    item.mainSize = item.outerHypotheticalMainSize
    item.crossSize = item.outerHypotheticalCrossSize

    this.#totalMainSize += item.outerHypotheticalMainSize + this.#layout.mainGap
    this.#itemsCrossSize = Math.max(
      this.#itemsCrossSize,
      item.outerHypotheticalCrossSize,
    )
    if (item.frame.grow > 0) {
      this.#totalGrowth += item.frame.grow
      this.#growableItems.add(item)
    }
    if (item.frame.shrink > 0) {
      this.#totalScaledShrink += item.scaledShrinkFactor
      this.#shrinkableItems.add(item)
    }
  }

  #growItems() {
    while (
      this.#totalMainSize < this.#layout.mainSize &&
      this.#growableItems.size > 0
    ) {
      const growthUnit =
        (this.#layout.mainSize - this.#totalMainSize) / this.#totalGrowth
      for (const item of this.#growableItems) {
        let growth = growthUnit * item.growthFactor
        if (growth > item.availableGrowth) {
          growth = item.availableGrowth
          this.#growableItems.delete(item)
          this.#totalGrowth -= item.frame.grow
        }

        item.mainSize += growth
        this.#totalMainSize += growth
      }
    }
  }

  #shrinkItems() {
    while (
      this.#totalMainSize > this.#layout.mainSize &&
      this.#shrinkableItems.size > 0
    ) {
      const totalShrink = this.#totalMainSize - this.#layout.mainSize
      const totalScaledShrink = this.#totalScaledShrink

      for (const item of this.#shrinkableItems) {
        let shrink = (totalShrink * item.scaledShrinkFactor) / totalScaledShrink

        if (shrink > item.availableShrinkage) {
          shrink = item.availableShrinkage
          this.#shrinkableItems.delete(item)
          this.#totalScaledShrink -= item.scaledShrinkFactor
        }

        item.mainSize -= shrink
        this.#totalMainSize -= shrink
      }
    }
  }

  #placeItemsMainForward(start: number, between: number) {
    let cursor = start
    for (const item of this.#items) {
      item.mainOffset = cursor
      cursor += item.mainSize + between
    }
  }

  #placeItemsMainReverse(start: number, between: number) {
    let cursor = this.#layout.mainSize - start

    for (const item of this.#items) {
      cursor -= item.mainSize
      item.mainOffset = cursor
      cursor -= between
    }
  }

  #placeItemsCross(crossPosition: number, crossSize: number) {
    for (const item of this.#items) {
      item.crossSize += (crossSize - item.crossSize) * this.#layout.stretchItems

      item.crossOffset =
        crossPosition + (crossSize - item.crossSize) * this.#layout.alignItems
    }
  }
}
