import type { ComputedFrameProperties } from '../../frame/ComputedFrameProperties'
import type { ReadonlyRect } from '../../rect'
import type { Rect } from '../../rect/Rect'
import type { Layout } from '../types'
import type { FlexItem } from './FlexItem'
import { FlexLine } from './FlexLine'
import { spatialOffsets } from './utils'

export class FlexLayout implements Layout {
  readonly #parentProps: ComputedFrameProperties
  readonly #parentRect: ReadonlyRect
  readonly #lines: FlexLine

  constructor(parentProps: ComputedFrameProperties, parentRect: ReadonlyRect) {
    this.#parentProps = parentProps
    this.#parentRect = parentRect

    this.#lines = new FlexLine(this)
  }

  get directionAxis(): 'row' | 'column' {
    return this.#parentProps.flexDirection.startsWith('row') ? 'row' : 'column'
  }
  get directionReverse(): boolean {
    return this.#parentProps.flexDirection.endsWith('reverse')
  }
  get wrap() {
    return this.#parentProps.flexWrap
  }

  get mainGap() {
    return this.directionAxis === 'row'
      ? this.#parentProps.rowGap
      : this.#parentProps.columnGap
  }
  get mainSize(): number {
    return this.directionAxis === 'row' ? this.#innerWidth : this.#innerHeight
  }

  get justifyContent(): number {
    return this.#parentProps.justifyContent
  }

  get justifySpace(): number {
    return this.#parentProps.justifySpace
  }
  get justifySpaceOuter(): number {
    return this.#parentProps.justifySpaceOuter
  }

  get stretchItems(): number {
    return this.#parentProps.stretchItems
  }

  get alignItems(): number {
    return this.#parentProps.alignItems
  }

  get #innerWidth(): number {
    return Math.max(
      0,
      this.#parentRect.width -
        this.#parentProps.insetLeft -
        this.#parentProps.insetRight,
    )
  }
  get #innerHeight(): number {
    return Math.max(
      0,
      this.#parentRect.height -
        this.#parentProps.insetTop -
        this.#parentProps.insetBottom,
    )
  }

  get #crossGap() {
    return this.directionAxis === 'row'
      ? this.#parentProps.columnGap
      : this.#parentProps.rowGap
  }
  get #crossSize(): number {
    return this.directionAxis === 'row' ? this.#innerHeight : this.#innerWidth
  }

  insert(
    frame: ComputedFrameProperties,
    rect: Rect,
    index: number,
  ): ComputedFrameProperties {
    this.#lines.insert(frame, rect, index)
    this.reflow()

    return frame
  }

  remove(frame: ComputedFrameProperties): ComputedFrameProperties {
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
      totalLinesCrossSize += line.itemsCrossSize + this.#crossGap
    }
    totalLinesCrossSize -= this.#crossGap

    const totalLineStretch =
      Math.max(this.#crossSize - totalLinesCrossSize, 0) *
      this.#parentProps.stretchContent

    const { start, between } = spatialOffsets(
      this.#parentProps.alignContent,
      this.#crossSize - totalLinesCrossSize + totalLineStretch,
      this.#crossGap,
      lines.length,
      this.#parentProps.alignSpace,
      this.#parentProps.alignSpaceOuter,
    )

    const lineStretch = totalLineStretch / lines.length

    if (this.#parentProps.flexWrap === 'wrap-reverse') {
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

  calculate() {
    for (const item of this.placeItems()) {
      item.rect.x = item.x
      item.rect.y = item.y
      item.rect.width = item.width
      item.rect.height = item.height
    }
  }
}
