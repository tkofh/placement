import type { ComputedFrameProperties } from '../../frame/ComputedFrameProperties'
import type { ReadonlyRect } from '../../rect'
import type { Rect } from '../../rect/Rect'
import type { Layout } from '../types'
import type { FlexItem } from './FlexItem'
import { FlexLine } from './FlexLine'
import { spatialOffsets } from './utils'

export class FlexLayout implements Layout {
  readonly #computed: ComputedFrameProperties
  readonly #rect: ReadonlyRect
  readonly #lines: FlexLine

  constructor(parentProps: ComputedFrameProperties, parentRect: ReadonlyRect) {
    this.#computed = parentProps
    this.#rect = parentRect

    this.#lines = new FlexLine(this)
  }

  get directionAxis(): 'row' | 'column' {
    return this.#computed.flexDirection.startsWith('row') ? 'row' : 'column'
  }
  get directionReverse(): boolean {
    return this.#computed.flexDirection.endsWith('reverse')
  }
  get wrap() {
    return this.#computed.flexWrap
  }

  get mainGap() {
    return this.directionAxis === 'row'
      ? this.#computed.rowGap
      : this.#computed.columnGap
  }
  get mainSize(): number {
    return this.directionAxis === 'row' ? this.#rect.width : this.#rect.height
  }

  get justifyContent(): number {
    return this.#computed.justifyContent
  }

  get justifyContentSpace(): number {
    return this.#computed.justifyContentSpace
  }
  get justifyContentSpaceOuter(): number {
    return this.#computed.justifyContentSpaceOuter
  }

  get stretchItems(): number {
    return this.#computed.stretchItems
  }

  get alignItems(): number {
    return this.#computed.alignItems
  }

  get #crossGap() {
    return this.directionAxis === 'row'
      ? this.#computed.columnGap
      : this.#computed.rowGap
  }
  get #crossSize(): number {
    return this.directionAxis === 'row' ? this.#rect.height : this.#rect.width
  }

  insert(
    frame: ComputedFrameProperties,
    rect: Rect,
    index: number,
  ): ComputedFrameProperties {
    this.#lines.insert(frame, rect, index)

    return frame
  }

  remove(frame: ComputedFrameProperties): ComputedFrameProperties {
    this.#lines.remove(frame)

    return frame
  }

  *placeItems(): IterableIterator<FlexItem> {
    const lines: Array<FlexLine> = []
    let totalLinesCrossSize = 0

    for (const line of this.#lines.reflow()) {
      lines.push(line)
      totalLinesCrossSize += line.itemsCrossSize + this.#crossGap
    }
    totalLinesCrossSize -= this.#crossGap

    const stretchContent =
      typeof this.#computed.stretchContent === 'number'
        ? this.#computed.stretchContent
        : lines.length === 1
          ? 1
          : 0

    const alignContent = lines.length === 1 ? 0 : this.#computed.alignContent

    const totalLineStretch =
      Math.max(this.#crossSize - totalLinesCrossSize, 0) * stretchContent

    const { start, between } = spatialOffsets(
      alignContent,
      this.#crossSize - totalLinesCrossSize + totalLineStretch,
      this.#crossGap,
      lines.length,
      this.#computed.alignContentSpace,
      this.#computed.alignContentSpaceOuter,
    )

    const lineStretch = totalLineStretch / lines.length

    if (this.#computed.flexWrap === 'wrap-reverse') {
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
      item.rect.x = this.#rect.x + item.x + item.frame.translateX
      item.rect.y = this.#rect.y + item.y + item.frame.translateY
      item.rect.width = item.width
      item.rect.height = item.height
    }
  }
}
