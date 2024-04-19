import { DATA_TYPES, type LengthUnit } from '../properties'
import type { ReadonlyRect } from '../rect'
import { clamp } from '../utils'
import type { FrameProperties } from './FrameProperties'

export class ComputedFrameProperties {
  readonly #properties: FrameProperties
  readonly #self: ReadonlyRect
  #container: ReadonlyRect
  #viewport: ReadonlyRect

  constructor(properties: FrameProperties, rect: ReadonlyRect) {
    this.#properties = properties
    this.#viewport = rect
    this.#container = rect
    this.#self = rect
  }

  get width(): number | 'auto' {
    const width = this.#definiteWidth

    if (width !== null) {
      return width
    }

    const height = this.#definiteHeight
    const aspectRatio = this.#definiteAspectRatio

    if (height !== null && aspectRatio !== null) {
      return height * aspectRatio
    }

    return 'auto'
  }
  get height(): number | 'auto' {
    const height = this.#definiteHeight

    if (height !== null) {
      return height
    }

    const width = this.#definiteWidth
    const aspectRatio = this.#definiteAspectRatio

    if (width !== null && aspectRatio !== null) {
      return width / aspectRatio
    }

    return 'auto'
  }

  get minWidth(): number {
    const minWidth = this.#properties.minWidth.parsed

    if (minWidth.type === DATA_TYPES.length) {
      return this.#computeLength(minWidth.value, minWidth.unit)
    }
    if (minWidth.type === DATA_TYPES.percentage) {
      return this.#computePercentage(minWidth.value, this.#container.width)
    }

    return 0
  }
  get minHeight(): number {
    const minHeight = this.#properties.minHeight.parsed

    if (minHeight.type === DATA_TYPES.length) {
      return this.#computeLength(minHeight.value, minHeight.unit)
    }
    if (minHeight.type === DATA_TYPES.percentage) {
      return this.#computePercentage(minHeight.value, this.#container.height)
    }

    return 0
  }
  get maxWidth(): number {
    const maxWidth = this.#properties.maxWidth.parsed

    if (maxWidth.type === DATA_TYPES.length) {
      return this.#computeLength(maxWidth.value, maxWidth.unit)
    }
    if (maxWidth.type === DATA_TYPES.percentage) {
      return this.#computePercentage(maxWidth.value, this.#container.width)
    }

    return Number.POSITIVE_INFINITY
  }
  get maxHeight(): number {
    const maxHeight = this.#properties.maxHeight.parsed

    if (maxHeight.type === DATA_TYPES.length) {
      return this.#computeLength(maxHeight.value, maxHeight.unit)
    }
    if (maxHeight.type === DATA_TYPES.percentage) {
      return this.#computePercentage(maxHeight.value, this.#container.height)
    }

    return Number.POSITIVE_INFINITY
  }

  get offsetTop(): number | 'auto' | 'none' {
    const offsetTop = this.#properties.offsetTop.parsed

    if (offsetTop.type === DATA_TYPES.length) {
      return this.#computeLength(offsetTop.value, offsetTop.unit)
    }
    if (offsetTop.type === DATA_TYPES.percentage) {
      return this.#computePercentage(offsetTop.value, this.#container.height)
    }

    return offsetTop.keyword
  }
  get offsetRight(): number | 'auto' | 'none' {
    const offsetRight = this.#properties.offsetRight.parsed

    if (offsetRight.type === DATA_TYPES.length) {
      return this.#computeLength(offsetRight.value, offsetRight.unit)
    }
    if (offsetRight.type === DATA_TYPES.percentage) {
      return this.#computePercentage(offsetRight.value, this.#container.width)
    }

    return offsetRight.keyword
  }
  get offsetBottom(): number | 'auto' | 'none' {
    const offsetBottom = this.#properties.offsetBottom.parsed

    if (offsetBottom.type === DATA_TYPES.length) {
      return this.#computeLength(offsetBottom.value, offsetBottom.unit)
    }
    if (offsetBottom.type === DATA_TYPES.percentage) {
      return this.#computePercentage(offsetBottom.value, this.#container.height)
    }

    return offsetBottom.keyword
  }
  get offsetLeft(): number | 'auto' | 'none' {
    const offsetLeft = this.#properties.offsetLeft.parsed

    if (offsetLeft.type === DATA_TYPES.length) {
      return this.#computeLength(offsetLeft.value, offsetLeft.unit)
    }
    if (offsetLeft.type === DATA_TYPES.percentage) {
      return this.#computePercentage(offsetLeft.value, this.#container.width)
    }

    return offsetLeft.keyword
  }

  get insetTop(): number {
    const insetTop = this.#properties.insetTop.parsed

    if (insetTop.type === DATA_TYPES.length) {
      return this.#computeLength(insetTop.value, insetTop.unit, this.#self)
    }
    return this.#computePercentage(insetTop.value, this.#self.height)
  }
  get insetRight(): number {
    const insetRight = this.#properties.insetRight.parsed

    if (insetRight.type === DATA_TYPES.length) {
      return this.#computeLength(insetRight.value, insetRight.unit, this.#self)
    }
    return this.#computePercentage(insetRight.value, this.#self.width)
  }
  get insetBottom(): number {
    const insetBottom = this.#properties.insetBottom.parsed

    if (insetBottom.type === DATA_TYPES.length) {
      return this.#computeLength(
        insetBottom.value,
        insetBottom.unit,
        this.#self,
      )
    }
    return this.#computePercentage(insetBottom.value, this.#self.height)
  }
  get insetLeft(): number {
    const insetLeft = this.#properties.insetLeft.parsed

    if (insetLeft.type === DATA_TYPES.length) {
      return this.#computeLength(insetLeft.value, insetLeft.unit, this.#self)
    }
    return this.#computePercentage(insetLeft.value, this.#self.width)
  }

  get grow(): number {
    const grow = this.#properties.grow.parsed

    if (grow.type === DATA_TYPES.number) {
      return grow.value
    }

    return 0
  }
  get shrink(): number {
    const shrink = this.#properties.shrink.parsed

    if (shrink.type === DATA_TYPES.number) {
      return shrink.value
    }

    return 0
  }

  get flexDirection(): 'row' | 'row-reverse' | 'column' | 'column-reverse' {
    const flexDirection = this.#properties.flexDirection.parsed

    return flexDirection.keyword
  }
  get flexWrap(): 'nowrap' | 'wrap' | 'wrap-reverse' {
    const flexWrap = this.#properties.flexWrap.parsed

    return flexWrap.keyword
  }

  get justifyContent(): number {
    return this.#properties.justifyContent.parsed.value
  }
  get justifyItems(): number {
    return this.#properties.justifyItems.parsed.value
  }
  get justifySelf(): number {
    return this.#properties.justifySelf.parsed.value
  }

  get alignContent(): number {
    return this.#properties.alignContent.parsed.value
  }
  get alignItems(): number {
    return this.#properties.alignItems.parsed.value
  }
  get alignSelf(): number {
    return this.#properties.alignSelf.parsed.value
  }

  get stretchContent(): number | 'auto' {
    const stretchContent = this.#properties.stretchContent.parsed

    if (stretchContent.type === DATA_TYPES.keyword) {
      return stretchContent.keyword
    }

    return stretchContent.value
  }
  get stretchItems(): number {
    return this.#properties.stretchItems.parsed.value
  }
  get stretchSelf(): number {
    return this.#properties.stretchSelf.parsed.value
  }

  get rowGap(): number {
    const rowGap = this.#properties.rowGap.parsed

    if (rowGap.type === DATA_TYPES.keyword) {
      return 0
    }

    if (rowGap.type === DATA_TYPES.length) {
      return this.#computeLength(rowGap.value, rowGap.unit)
    }

    return this.#computePercentage(rowGap.value, this.#container.height)
  }
  get columnGap(): number {
    const columnGap = this.#properties.columnGap.parsed

    if (columnGap.type === DATA_TYPES.keyword) {
      return 0
    }

    if (columnGap.type === DATA_TYPES.length) {
      return this.#computeLength(columnGap.value, columnGap.unit)
    }

    return this.#computePercentage(columnGap.value, this.#container.width)
  }

  get justifyContentSpace(): number {
    const justifyContentSpace = this.#properties.justifyContentSpace.parsed

    return clamp(justifyContentSpace.value, 0, 1)
  }
  get justifyContentSpaceOuter(): number {
    const justifyContentSpaceOuter =
      this.#properties.justifyContentSpaceOuter.parsed

    return clamp(justifyContentSpaceOuter.value, 0, 1)
  }

  get alignContentSpace(): number {
    const alignContentSpace = this.#properties.alignContentSpace.parsed

    return clamp(alignContentSpace.value, 0, 1)
  }
  get alignContentSpaceOuter(): number {
    const alignContentSpaceOuter =
      this.#properties.alignContentSpaceOuter.parsed

    return clamp(alignContentSpaceOuter.value, 0, 1)
  }

  get #definiteWidth(): number | null {
    const width = this.#properties.width.parsed

    if (width.type === DATA_TYPES.length) {
      return this.#computeLength(width.value, width.unit)
    }
    if (width.type === DATA_TYPES.percentage) {
      return this.#computePercentage(width.value, this.#container.width)
    }

    return null
  }

  get #definiteHeight(): number | null {
    const height = this.#properties.height.parsed

    if (height.type === DATA_TYPES.length) {
      return this.#computeLength(height.value, height.unit)
    }
    if (height.type === DATA_TYPES.percentage) {
      return this.#computePercentage(height.value, this.#container.height)
    }

    return null
  }

  get #definiteAspectRatio(): number | null {
    const aspectRatio = this.#properties.aspectRatio.parsed

    if (aspectRatio.type === DATA_TYPES.ratio) {
      return aspectRatio.value
    }

    return null
  }

  #computeLength(
    value: number,
    unit: LengthUnit,
    container: ReadonlyRect = this.#container,
  ) {
    if (unit === 'px') {
      return value
    }
    if (unit === 'cw') {
      return (value * container.width) / 100
    }
    if (unit === 'ch') {
      return (value * container.height) / 100
    }
    if (unit === 'vw') {
      return (value * this.#viewport.width) / 100
    }
    if (unit === 'vh') {
      return (value * this.#viewport.height) / 100
    }
    if (unit === 'cmin') {
      return (value * Math.min(container.width, container.height)) / 100
    }
    if (unit === 'cmax') {
      return (value * Math.max(container.width, container.height)) / 100
    }
    if (unit === 'vmin') {
      return (
        (value * Math.min(this.#viewport.width, this.#viewport.height)) / 100
      )
    }
    if (unit === 'vmax') {
      return (
        (value * Math.max(this.#viewport.width, this.#viewport.height)) / 100
      )
    }
    throw new Error(`unrecognized unit ${unit}`)
  }

  #computePercentage(value: number, basis: number) {
    return (value * basis) / 100
  }

  updateRects(container: ReadonlyRect, viewport: ReadonlyRect = container) {
    this.#container = container
    this.#viewport = viewport
  }
}
