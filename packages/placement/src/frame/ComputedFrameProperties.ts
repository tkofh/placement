import { clamp } from '../math'
import type { ReadonlyRect } from '../rect'
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
    const minWidth = this.#properties.minWidth.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof minWidth === 'number') {
      return minWidth
    }

    return 0
  }
  get minHeight(): number {
    const minHeight = this.#properties.minHeight.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof minHeight === 'number') {
      return minHeight
    }

    return 0
  }
  get maxWidth(): number {
    const maxWidth = this.#properties.maxWidth.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof maxWidth === 'number') {
      return maxWidth
    }

    return Number.POSITIVE_INFINITY
  }
  get maxHeight(): number {
    const maxHeight = this.#properties.maxHeight.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof maxHeight === 'number') {
      return maxHeight
    }

    return Number.POSITIVE_INFINITY
  }

  get offsetTop(): number | 'auto' | 'none' {
    return this.#properties.offsetTop.getComputed(
      this.#container,
      this.#viewport,
    )
  }
  get offsetRight(): number | 'auto' | 'none' {
    return this.#properties.offsetRight.getComputed(
      this.#container,
      this.#viewport,
    )
  }
  get offsetBottom(): number | 'auto' | 'none' {
    return this.#properties.offsetBottom.getComputed(
      this.#container,
      this.#viewport,
    )
  }
  get offsetLeft(): number | 'auto' | 'none' {
    return this.#properties.offsetLeft.getComputed(
      this.#container,
      this.#viewport,
    )
  }

  get insetTop(): number {
    return this.#properties.insetTop.getComputed(this.#self, this.#viewport)
  }
  get insetRight(): number {
    return this.#properties.insetRight.getComputed(this.#self, this.#viewport)
  }
  get insetBottom(): number {
    return this.#properties.insetBottom.getComputed(this.#self, this.#viewport)
  }
  get insetLeft(): number {
    return this.#properties.insetLeft.getComputed(this.#self, this.#viewport)
  }

  get translateX(): number {
    return this.#properties.translateX.getComputed(this.#self, this.#viewport)
  }
  get translateY(): number {
    return this.#properties.translateY.getComputed(this.#self, this.#viewport)
  }

  get grow(): number {
    const grow = this.#properties.grow.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof grow === 'number') {
      return grow
    }

    return 0
  }
  get shrink(): number {
    const shrink = this.#properties.shrink.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof shrink === 'number') {
      return shrink
    }

    return 0
  }

  get flexDirection(): 'row' | 'row-reverse' | 'column' | 'column-reverse' {
    return this.#properties.flexDirection.getComputed()
  }
  get flexWrap(): 'nowrap' | 'wrap' | 'wrap-reverse' {
    return this.#properties.flexWrap.getComputed()
  }

  get justifyContent(): number {
    return this.#properties.justifyContent.getComputed()
  }

  get alignContent(): number {
    return clamp(this.#properties.alignContent.getComputed(), 0, 1)
  }
  get alignItems(): number {
    return clamp(this.#properties.alignItems.getComputed(), 0, 1)
  }
  get alignSelf(): number | 'auto' {
    const alignSelf = this.#properties.alignSelf.getComputed()

    if (typeof alignSelf === 'number') {
      return clamp(alignSelf, 0, 1)
    }

    return 'auto'
  }

  get stretchContent(): number | 'auto' {
    const stretchContent = this.#properties.stretchContent.getComputed()

    if (typeof stretchContent === 'number') {
      return clamp(stretchContent, 0, 1)
    }

    return 'auto'
  }
  get stretchItems(): number {
    return clamp(this.#properties.stretchItems.getComputed(), 0, 1)
  }
  get stretchSelf(): number | 'auto' {
    const stretchSelf = this.#properties.stretchSelf.getComputed()

    if (typeof stretchSelf === 'number') {
      return clamp(stretchSelf, 0, 1)
    }

    return 'auto'
  }

  get rowGap(): number {
    const rowGap = this.#properties.rowGap.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof rowGap === 'number') {
      return rowGap
    }

    return 0
  }
  get columnGap(): number {
    const columnGap = this.#properties.columnGap.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof columnGap === 'number') {
      return columnGap
    }

    return 0
  }

  get justifyContentSpace(): number {
    return clamp(this.#properties.justifyContentSpace.getComputed(), 0, 1)
  }
  get justifyContentSpaceOuter(): number {
    return clamp(this.#properties.justifyContentSpaceOuter.getComputed(), 0, 1)
  }

  get alignContentSpace(): number {
    return clamp(this.#properties.alignContentSpace.getComputed(), 0, 1)
  }
  get alignContentSpaceOuter(): number {
    return clamp(this.#properties.alignContentSpaceOuter.getComputed(), 0, 1)
  }

  get #definiteWidth(): number | null {
    const width = this.#properties.width.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof width === 'number') {
      return width
    }

    return null
  }

  get #definiteHeight(): number | null {
    const height = this.#properties.height.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof height === 'number') {
      return height
    }

    return null
  }

  get #definiteAspectRatio(): number | null {
    const aspectRatio = this.#properties.aspectRatio.getComputed(
      this.#container,
      this.#viewport,
    )

    if (typeof aspectRatio === 'number') {
      return aspectRatio
    }

    return null
  }

  updateRects(container: ReadonlyRect, viewport: ReadonlyRect = container) {
    this.#container = container
    this.#viewport = viewport
  }
}
