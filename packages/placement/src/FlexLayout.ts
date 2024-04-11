import type { Frame } from './Frame'

function spatialOffsets(
  t: number,
  amount: number,
  gap: number,
  items: number,
  space: number,
  spaceOuter: number,
): { start: number; between: number } {
  const distributed = amount * space
  let start = (amount - distributed) * t
  let between = gap

  if (distributed > 0 && items > 1) {
    const spacing = distributed / (items + 1)
    start += spacing * spaceOuter
    between += spacing + (spacing * 2 * (1 - spaceOuter)) / (items - 1)
  }

  return { start, between }
}

export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'
export type FlexWrap = boolean | 'reverse'

export interface FlexOptions {
  direction: FlexDirection
  wrap: FlexWrap
  gap: number
  justify: number
  align: number
  stretch: number
  linesAlign: number
  linesStretch: number | null
  space: number
  spaceOuter: number
  linesSpace: number
  linesSpaceOuter: number
}

class FlexItem {
  readonly frame: Frame
  readonly #layout: FlexLayout

  mainSize = 0
  crossSize = 0
  mainOffset = 0
  crossOffset = 0

  constructor(layout: FlexLayout, frame: Frame) {
    this.frame = frame

    this.#layout = layout
  }

  get outerX(): number {
    return this.#directionAxis === 'row' ? this.mainOffset : this.crossOffset
  }
  get outerY(): number {
    return this.#directionAxis === 'row' ? this.crossOffset : this.mainOffset
  }
  get outerWidth(): number {
    return this.#directionAxis === 'row' ? this.mainSize : this.crossSize
  }
  get outerHeight(): number {
    return this.#directionAxis === 'row' ? this.crossSize : this.mainSize
  }

  get #directionAxis(): 'row' | 'column' {
    return this.#layout.direction.startsWith('row') ? 'row' : 'column'
  }

  get scaledShrinkFactor(): number {
    return (
      this.frame.config.shrink *
      (this.#directionAxis === 'row'
        ? this.frame.innerRect.width
        : this.frame.innerRect.height)
    )
  }

  get outerHypotheticalMainSize(): number {
    return this.#directionAxis === 'row'
      ? this.frame.config.outerConstrainedWidth
      : this.frame.config.outerConstrainedHeight
  }

  get outerMaxMainSize(): number {
    return this.#directionAxis === 'row'
      ? this.frame.config.outerEffectiveMaxWidth
      : this.frame.config.outerEffectiveMaxHeight
  }

  get outerMinMainSize(): number {
    return this.#directionAxis === 'row'
      ? this.frame.config.outerEffectiveMinWidth
      : this.frame.config.outerEffectiveMinHeight
  }

  get outerHypotheticalCrossSize(): number {
    return this.#directionAxis === 'row'
      ? this.frame.config.outerConstrainedHeight
      : this.frame.config.outerConstrainedWidth
  }

  get availableShrinkage(): number {
    return this.outerHypotheticalMainSize - this.outerMinMainSize
  }

  get growthFactor(): number {
    return this.frame.config.grow
  }

  get availableGrowth(): number {
    return this.outerMaxMainSize - this.outerHypotheticalMainSize
  }
}

class FlexLine {
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
    return this.#items[0].frame.index
  }
  get #lastIndex(): number {
    return this.#items[this.#items.length - 1].frame.index
  }

  get itemsCrossSize(): number {
    return this.#itemsCrossSize
  }

  get hasNext() {
    return this.#next !== null
  }

  insert(frame: Frame) {
    const item = new FlexItem(this.#layout, frame)

    if (this.#items.length === 0 || this.#next === null) {
      this.#items.push(item)
      return
    }

    if (frame.index > this.#lastIndex) {
      this.#next.insert(frame)
      return
    }

    if (frame.index >= this.#firstIndex) {
      this.#items.splice(frame.index - this.#firstIndex, 0, item)
      return
    }

    throw new Error('frame index is out of bounds')
  }

  remove(frame: Frame) {
    if (frame.index >= this.#firstIndex && frame.index <= this.#lastIndex) {
      this.#items.splice(frame.index - this.#firstIndex, 1)
      return
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

    if (this.#layout.wrap === false) {
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
      this.#layout.justify,
      this.#layout.mainSize - this.#totalMainSize,
      this.#layout.gap,
      this.#items.length,
      this.#layout.space,
      this.#layout.spaceOuter,
    )

    if (this.#layout.direction.endsWith('reverse')) {
      this.#placeItemsMainReverse(start, between)
    } else {
      this.#placeItemsMainForward(start, between)
    }

    this.#placeItemsCross(crossPosition, crossSize)

    yield* this.#items
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
    this.#totalMainSize -= this.#layout.gap
  }

  #reflowWrap() {
    for (const [index, item] of this.#items.entries()) {
      if (
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

    this.#totalMainSize -= this.#layout.gap
  }

  #updateMeasurements(item: FlexItem) {
    item.mainSize = item.outerHypotheticalMainSize
    item.crossSize = item.outerHypotheticalCrossSize

    this.#totalMainSize += item.outerHypotheticalMainSize + this.#layout.gap
    this.#itemsCrossSize = Math.max(
      this.#itemsCrossSize,
      item.outerHypotheticalCrossSize,
    )
    if (item.frame.config.grow > 0) {
      this.#totalGrowth += item.frame.config.grow
      this.#growableItems.add(item)
    }
    if (item.frame.config.shrink > 0) {
      this.#totalScaledShrink += item.frame.config.shrink
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
          this.#totalGrowth -= item.frame.config.grow
          continue
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
      for (const item of this.#shrinkableItems) {
        let shrink =
          (totalShrink * item.scaledShrinkFactor) / this.#totalScaledShrink

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
      if (this.#layout.stretch > 0) {
        item.crossSize += (crossSize - item.crossSize) * this.#layout.stretch
      }
      item.crossOffset =
        crossPosition + (crossSize - item.crossSize) * this.#layout.align
    }
  }
}

export class FlexLayout {
  static readonly INITIAL = {
    direction: 'row',
    wrap: false,
    gap: 0,
    justify: 0,
    align: 0,
    stretch: 0,
    linesAlign: 0,
    linesStretch: null,
    space: 0,
    spaceOuter: 0,
    linesSpace: 0,
    linesSpaceOuter: 0,
  } satisfies FlexOptions

  readonly #frame: Frame
  readonly #lines: FlexLine

  #direction!: FlexDirection
  #wrap!: FlexWrap
  #gap!: number
  #justify!: number
  #align!: number
  #stretch!: number
  #linesAlign!: number
  #linesStretch!: number | null
  #space!: number
  #spaceOuter!: number
  #linesSpace!: number
  #linesSpaceOuter!: number

  constructor(frame: Frame) {
    this.#frame = frame
    this.configure(FlexLayout.INITIAL)

    this.#lines = new FlexLine(this)
  }

  //region Properties
  get direction(): FlexDirection {
    return this.#direction
  }
  set direction(value: FlexDirection) {
    this.#direction = value
    this.#frame.markDirty()
  }

  get wrap(): FlexWrap {
    return this.#wrap
  }
  set wrap(value: FlexWrap) {
    this.#wrap = value
    this.#frame.markDirty()
  }

  get gap(): number {
    return this.#gap
  }
  set gap(value: number) {
    this.#gap = value
    this.#frame.markDirty()
  }

  get justify(): number {
    return this.#justify
  }
  set justify(value: number) {
    this.#justify = value
    this.#frame.markDirty()
  }

  get align(): number {
    return this.#align
  }
  set align(value: number) {
    this.#align = value
    this.#frame.markDirty()
  }

  get stretch(): number {
    return this.#stretch
  }
  set stretch(value: number) {
    this.#stretch = value
    this.#frame.markDirty()
  }

  get linesAlign(): number {
    return this.#linesAlign
  }
  set linesAlign(value: number) {
    this.#linesAlign = value
    this.#frame.markDirty()
  }

  get linesStretch(): number {
    if (this.#linesStretch === null) {
      if (this.#lines.hasNext) {
        return 0
      }
      return 1
    }
    return this.#linesStretch
  }
  set linesStretch(value: number) {
    this.#linesStretch = value
    this.#frame.markDirty()
  }

  get space(): number {
    return this.#space
  }
  set space(value: number) {
    this.#space = value
    this.#frame.markDirty()
  }

  get spaceOuter(): number {
    return this.#spaceOuter
  }
  set spaceOuter(value: number) {
    this.#spaceOuter = value
    this.#frame.markDirty()
  }

  get linesSpace(): number {
    return this.#linesSpace
  }
  set linesSpace(value: number) {
    this.#linesSpace = value
    this.#frame.markDirty()
  }

  get linesSpaceOuter(): number {
    return this.#linesSpaceOuter
  }
  set linesSpaceOuter(value: number) {
    this.#linesSpaceOuter = value
    this.#frame.markDirty()
  }
  //endregion

  get #directionAxis(): 'row' | 'column' {
    return this.#direction.startsWith('row') ? 'row' : 'column'
  }
  get mainSize(): number {
    return this.#directionAxis === 'row'
      ? this.#frame.innerRect.width
      : this.#frame.innerRect.height
  }
  get crossSize(): number {
    return this.#directionAxis === 'row'
      ? this.#frame.innerRect.height
      : this.#frame.innerRect.width
  }

  configure(options: Partial<FlexOptions>): void {
    if (options.direction != null) {
      this.#direction = options.direction
    }
    if (options.wrap != null) {
      this.#wrap = options.wrap
    }
    if (options.gap != null) {
      this.#gap = options.gap
    }
    if (options.justify != null) {
      this.#justify = options.justify
    }
    if (options.align != null) {
      this.#align = options.align
    }
    if (options.stretch != null) {
      this.#stretch = options.stretch
    }
    if (options.linesAlign != null) {
      this.#linesAlign = options.linesAlign
    }
    if (options.linesStretch !== undefined) {
      this.#linesStretch = options.linesStretch
    }
    if (options.space != null) {
      this.#space = options.space
    }
    if (options.spaceOuter != null) {
      this.#spaceOuter = options.spaceOuter
    }
    if (options.linesSpace != null) {
      this.#linesSpace = options.linesSpace
    }
    if (options.linesSpaceOuter != null) {
      this.#linesSpaceOuter = options.linesSpaceOuter
    }

    this.#frame.markDirty()
  }

  insert(frame: Frame): Frame {
    this.#lines.insert(frame)
    this.reflow()

    return frame
  }

  remove(frame: Frame): Frame {
    this.#lines.remove(frame)
    this.reflow()

    return frame
  }

  reflow() {
    const lines = this.#lines.reflow()
    let line = lines.next()

    while (!line.done) {
      line = lines.next()
    }
  }

  *placeItems(): IterableIterator<FlexItem> {
    const lines: Array<FlexLine> = []
    let totalLinesCrossSize = 0

    for (const line of this.#lines.reflow()) {
      lines.push(line)
      totalLinesCrossSize += line.itemsCrossSize + this.#gap
    }
    totalLinesCrossSize -= this.#gap

    const totalLineStretch =
      Math.max(this.crossSize - totalLinesCrossSize, 0) * this.linesStretch

    const { start, between } = spatialOffsets(
      this.#linesAlign,
      this.crossSize - totalLinesCrossSize + totalLineStretch,
      this.#gap,
      lines.length,
      this.#linesSpace,
      this.#linesSpaceOuter,
    )

    const lineStretch = totalLineStretch / lines.length

    if (this.wrap === 'reverse') {
      let crossPosition = totalLinesCrossSize + start
      for (const line of lines) {
        crossPosition -= line.itemsCrossSize
        yield* line.placeItems(crossPosition, line.itemsCrossSize + lineStretch)
        crossPosition -= between
      }
    } else {
      let crossPosition = start
      for (const line of lines) {
        yield* line.placeItems(crossPosition, line.itemsCrossSize + lineStretch)
        crossPosition += line.itemsCrossSize + between
      }
    }
  }
}
