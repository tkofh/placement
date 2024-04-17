import type { ComputedFrameProperties } from '../../frame/ComputedFrameProperties'
import type { Rect } from '../../rect/Rect'
import { clamp } from '../../utils'
import type { FlexLayout } from './FlexLayout'

export class FlexItem {
  readonly frame: ComputedFrameProperties
  readonly rect: Rect
  index: number

  readonly #layout: FlexLayout

  mainSize = 0
  crossSize = 0
  mainOffset = 0
  crossOffset = 0

  constructor(
    layout: FlexLayout,
    frame: ComputedFrameProperties,
    rect: Rect,
    index: number,
  ) {
    this.frame = frame
    this.rect = rect
    this.index = index

    this.#layout = layout
  }

  get x(): number {
    return this.#layout.directionAxis === 'row'
      ? this.mainOffset + this.#definiteMainOffsetStart
      : this.crossOffset + this.#definiteCrossOffsetStart
  }
  get y(): number {
    return this.#layout.directionAxis === 'row'
      ? this.crossOffset + this.#definiteCrossOffsetStart
      : this.mainOffset + this.#definiteMainOffsetStart
  }
  get width(): number {
    return this.#layout.directionAxis === 'row'
      ? this.mainSize - this.#definiteMainOffset
      : this.crossSize - this.#definiteCrossOffset
  }
  get height(): number {
    return this.#layout.directionAxis === 'row'
      ? this.crossSize - this.#definiteCrossOffset
      : this.mainSize - this.#definiteMainOffset
  }

  get #definiteMainOffsetStart(): number {
    let offsetStart: string | number

    if (this.#layout.directionAxis === 'row') {
      if (this.#layout.directionReverse) {
        offsetStart = this.frame.offsetRight
      } else {
        offsetStart = this.frame.offsetLeft
      }
    } else if (this.#layout.directionReverse) {
      offsetStart = this.frame.offsetBottom
    } else {
      offsetStart = this.frame.offsetTop
    }

    return typeof offsetStart === 'string' ? 0 : offsetStart
  }
  get #definiteMainOffsetEnd(): number {
    let offsetEnd: string | number

    if (this.#layout.directionAxis === 'row') {
      if (this.#layout.directionReverse) {
        offsetEnd = this.frame.offsetLeft
      } else {
        offsetEnd = this.frame.offsetRight
      }
    } else if (this.#layout.directionReverse) {
      offsetEnd = this.frame.offsetTop
    } else {
      offsetEnd = this.frame.offsetBottom
    }

    return typeof offsetEnd === 'string' ? 0 : offsetEnd
  }
  get #definiteMainOffset(): number {
    return this.#definiteMainOffsetStart + this.#definiteMainOffsetEnd
  }

  get #definiteCrossOffsetStart(): number {
    let offsetStart: string | number

    if (this.#layout.directionAxis === 'row') {
      if (this.#layout.wrap === 'wrap-reverse') {
        offsetStart = this.frame.offsetBottom
      } else {
        offsetStart = this.frame.offsetTop
      }
    } else if (this.#layout.wrap === 'wrap-reverse') {
      offsetStart = this.frame.offsetRight
    } else {
      offsetStart = this.frame.offsetLeft
    }

    return typeof offsetStart === 'string' ? 0 : offsetStart
  }
  get #definiteCrossOffsetEnd(): number {
    let offsetEnd: string | number

    if (this.#layout.directionAxis === 'row') {
      if (this.#layout.wrap === 'wrap-reverse') {
        offsetEnd = this.frame.offsetTop
      } else {
        offsetEnd = this.frame.offsetBottom
      }
    } else if (this.#layout.wrap === 'wrap-reverse') {
      offsetEnd = this.frame.offsetLeft
    } else {
      offsetEnd = this.frame.offsetRight
    }

    return typeof offsetEnd === 'string' ? 0 : offsetEnd
  }
  get #definiteCrossOffset(): number {
    return this.#definiteCrossOffsetStart + this.#definiteCrossOffsetEnd
  }

  get #constrainedWidth(): number {
    const width = this.frame.width
    if (width === 'auto') {
      return 0
    }
    return clamp(width, this.frame.minWidth, this.frame.maxWidth)
  }
  get #constrainedHeight(): number {
    const height = this.frame.height
    if (height === 'auto') {
      return 0
    }
    return clamp(height, this.frame.minHeight, this.frame.maxHeight)
  }

  get #innerWidth(): number {
    const width = this.frame.width
    if (width === 'auto') {
      return 0
    }

    const insetLeft = this.frame.insetLeft
    const insetRight = this.frame.insetRight

    return Math.max(0, width - insetLeft - insetRight)
  }
  get #innerHeight(): number {
    const height = this.frame.height
    if (height === 'auto') {
      return 0
    }

    const insetTop = this.frame.insetTop
    const insetBottom = this.frame.insetBottom

    return Math.max(0, height - insetTop - insetBottom)
  }

  get outerHypotheticalMainSize(): number {
    return (
      this.#definiteMainOffset +
      (this.#layout.directionAxis === 'row'
        ? this.#constrainedWidth
        : this.#constrainedHeight)
    )
  }

  get outerMaxMainSize(): number {
    return this.#layout.directionAxis === 'row'
      ? this.frame.maxWidth + this.#definiteMainOffset
      : this.frame.maxHeight + this.#definiteMainOffset
  }
  get outerMinMainSize(): number {
    return this.#layout.directionAxis === 'row'
      ? this.frame.minWidth + this.#definiteMainOffset
      : this.frame.minHeight + this.#definiteMainOffset
  }

  get outerHypotheticalCrossSize(): number {
    return (
      this.#definiteCrossOffset +
      (this.#layout.directionAxis === 'row'
        ? this.#constrainedHeight
        : this.#constrainedWidth)
    )
  }

  get scaledShrinkFactor(): number {
    return (
      this.frame.shrink *
      (this.#layout.directionAxis === 'row'
        ? this.#innerWidth
        : this.#innerHeight)
    )
  }

  get availableShrinkage(): number {
    return this.outerHypotheticalMainSize - this.outerMinMainSize
  }

  get growthFactor(): number {
    return this.frame.grow
  }

  get availableGrowth(): number {
    return this.outerMaxMainSize - this.outerHypotheticalMainSize
  }
}
