import type { ComputedFrameProperties } from '../../frame/ComputedFrameProperties'
import type { ReadonlyRect } from '../../rect'
import type { Rect } from '../../rect/Rect'
import { clamp } from '../../utils'
import type { Layout } from '../types'

export class AbsoluteLayout implements Layout {
  readonly #parentProperties: ComputedFrameProperties
  readonly #parentRect: ReadonlyRect

  readonly #boxes = new Map<ComputedFrameProperties, Rect>()
  readonly #items: Array<ComputedFrameProperties> = []

  #innerX = 0
  #innerY = 0
  #innerWidth = 0
  #innerHeight = 0

  constructor(
    parentProperties: ComputedFrameProperties,
    parentRect: ReadonlyRect,
  ) {
    this.#parentProperties = parentProperties
    this.#parentRect = parentRect
  }

  insert(config: ComputedFrameProperties, box: Rect, index: number) {
    this.#boxes.set(config, box)
    this.#items.splice(index, 0, config)
  }

  remove(config: ComputedFrameProperties) {
    this.#boxes.delete(config)
    this.#items.splice(this.#items.indexOf(config), 1)
  }

  calculate() {
    this.#computeInnerRect()
    for (const config of this.#items) {
      const box = this.#boxes.get(config) as Rect

      this.#placeBox(config, box)
    }
  }

  #computeInnerRect() {
    const insetTop = this.#parentProperties.insetTop
    const insetRight = this.#parentProperties.insetRight
    const insetBottom = this.#parentProperties.insetBottom
    const insetLeft = this.#parentProperties.insetLeft

    this.#innerX = this.#parentRect.x + insetLeft
    this.#innerY = this.#parentRect.y + insetTop
    this.#innerWidth = this.#parentRect.width - insetLeft - insetRight
    this.#innerHeight = this.#parentRect.height - insetTop - insetBottom
  }

  #placeBox(config: ComputedFrameProperties, box: Rect) {
    const { offsetTop, offsetRight, offsetBottom, offsetLeft } = config

    const width = this.#computeWidth(
      config.width,
      offsetLeft,
      offsetRight,
      config.minWidth,
      config.maxWidth,
    )

    const height = this.#computeHeight(
      config.height,
      offsetTop,
      offsetBottom,
      config.minHeight,
      config.maxHeight,
    )

    box.width = width
    box.height = height

    box.x = this.#computeX(width, offsetLeft, offsetRight)
    box.y = this.#computeY(height, offsetTop, offsetBottom)
  }

  #computeWidth(
    width: number | 'auto',
    offsetLeft: number | 'auto' | 'none',
    offsetRight: number | 'auto' | 'none',
    minWidth: number,
    maxWidth: number,
  ) {
    let definiteWidth = 0

    if (typeof width === 'number') {
      definiteWidth = width
    } else if (offsetLeft !== 'auto' && offsetRight !== 'auto') {
      const definiteLeft = offsetLeft === 'none' ? 0 : offsetLeft
      const definiteRight = offsetRight === 'none' ? 0 : offsetRight

      definiteWidth = this.#innerWidth - (definiteLeft + definiteRight)
    }

    return clamp(definiteWidth, minWidth, maxWidth)
  }

  #computeHeight(
    height: number | 'auto',
    offsetTop: number | 'auto' | 'none',
    offsetBottom: number | 'auto' | 'none',
    minHeight: number,
    maxHeight: number,
  ) {
    let definiteHeight = 0

    if (typeof height === 'number') {
      definiteHeight = height
    } else if (offsetTop !== 'auto' && offsetBottom !== 'auto') {
      const definiteTop = offsetTop === 'none' ? 0 : offsetTop
      const definiteBottom = offsetBottom === 'none' ? 0 : offsetBottom

      definiteHeight = this.#innerHeight - (definiteTop + definiteBottom)
    }

    return clamp(definiteHeight, minHeight, maxHeight)
  }

  #computeX(
    width: number,
    offsetLeft: number | 'auto' | 'none',
    offsetRight: number | 'auto' | 'none',
  ): number {
    let x = this.#innerX

    if (typeof offsetLeft === 'number') {
      x += offsetLeft
    } else if (typeof offsetRight === 'number') {
      x += this.#innerWidth - width - offsetRight
    } else if (offsetLeft === 'auto' && offsetRight === 'auto') {
      x += (this.#innerWidth - width) * 0.5
    } else if (offsetLeft === 'auto') {
      x += this.#innerWidth - width
    }

    return x
  }

  #computeY(
    height: number,
    offsetTop: number | 'auto' | 'none',
    offsetBottom: number | 'auto' | 'none',
  ): number {
    let y = this.#innerY

    if (typeof offsetTop === 'number') {
      y += offsetTop
    } else if (typeof offsetBottom === 'number') {
      y += this.#innerHeight - height - offsetBottom
    } else if (offsetTop === 'auto' && offsetBottom === 'auto') {
      y += (this.#innerHeight - height) * 0.5
    } else if (offsetTop === 'auto') {
      y += this.#innerHeight - height
    }

    return y
  }
}
