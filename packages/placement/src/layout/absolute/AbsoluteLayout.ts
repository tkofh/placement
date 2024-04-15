import type { Frame } from '../../frame/Frame'
import type { FrameConfig } from '../../placement/FrameConfig'
import type { Rect } from '../../rect/Rect'

import type { QuantityProperty } from '../../properties/QuantityProperty'
import { clamp } from '../../utils'
import type { Layout } from '../types'

export class AbsoluteLayout implements Layout {
  readonly #frame: Frame

  readonly #insetTop: QuantityProperty
  readonly #insetRight: QuantityProperty
  readonly #insetBottom: QuantityProperty
  readonly #insetLeft: QuantityProperty

  readonly #boxes = new Map<FrameConfig, Rect>()
  readonly #items: Array<FrameConfig> = []

  #innerX = 0
  #innerY = 0
  #innerWidth = 0
  #innerHeight = 0

  constructor(
    frame: Frame,
    insetTop: QuantityProperty,
    insetRight: QuantityProperty,
    insetBottom: QuantityProperty,
    insetLeft: QuantityProperty,
  ) {
    this.#frame = frame
    this.#insetTop = insetTop
    this.#insetRight = insetRight
    this.#insetBottom = insetBottom
    this.#insetLeft = insetLeft
  }

  get innerWidth() {
    return this.#innerWidth
  }

  get innerHeight() {
    return this.#innerHeight
  }

  insert(config: FrameConfig, box: Rect, index: number) {
    this.#boxes.set(config, box)
    this.#items.splice(index, 0, config)
  }

  remove(config: FrameConfig) {
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
    const top = this.#insetTop.compute(this.#frame.rect, this.#frame.root.rect)
    const right = this.#insetRight.compute(
      this.#frame.rect,
      this.#frame.root.rect,
    )
    const bottom = this.#insetBottom.compute(
      this.#frame.rect,
      this.#frame.root.rect,
    )
    const left = this.#insetLeft.compute(
      this.#frame.rect,
      this.#frame.root.rect,
    )

    this.#innerX = this.#frame.rect.x + left
    this.#innerY = this.#frame.rect.y + top
    this.#innerWidth = this.#frame.rect.width - left - right
    this.#innerHeight = this.#frame.rect.height - top - bottom
  }

  #placeBox(config: FrameConfig, box: Rect) {
    const { top, right, bottom, left } = config

    const width = this.#computeWidth(
      config.width,
      left,
      right,
      config.minWidth,
      config.maxWidth,
    )

    const height = this.#computeHeight(
      config.height,
      top,
      bottom,
      config.minHeight,
      config.maxHeight,
    )

    box.width = width
    box.height = height

    box.x = this.#computeX(width, left, right)
    box.y = this.#computeY(height, top, bottom)
  }

  #computeWidth(
    width: number | 'auto',
    left: number | 'auto' | 'none',
    right: number | 'auto' | 'none',
    minWidth: number,
    maxWidth: number,
  ) {
    let definiteWidth = 0

    if (typeof width === 'number') {
      definiteWidth = width
    } else if (left !== 'auto' && right !== 'auto') {
      const definiteLeft = left === 'none' ? 0 : left
      const definiteRight = right === 'none' ? 0 : right

      definiteWidth = this.#innerWidth - (definiteLeft + definiteRight)
    }

    return clamp(definiteWidth, minWidth, maxWidth)
  }

  #computeHeight(
    height: number | 'auto',
    top: number | 'auto' | 'none',
    bottom: number | 'auto' | 'none',
    minHeight: number,
    maxHeight: number,
  ) {
    let definiteHeight = 0

    if (typeof height === 'number') {
      definiteHeight = height
    } else if (top !== 'auto' && bottom !== 'auto') {
      const definiteTop = top === 'none' ? 0 : top
      const definiteBottom = bottom === 'none' ? 0 : bottom

      definiteHeight = this.#innerHeight - (definiteTop + definiteBottom)
    }

    return clamp(definiteHeight, minHeight, maxHeight)
  }

  #computeX(
    width: number,
    left: number | 'auto' | 'none',
    right: number | 'auto' | 'none',
  ): number {
    let x = this.#innerX

    if (typeof left === 'number') {
      x += left
    } else if (typeof right === 'number') {
      x += this.#innerWidth - width - right
    } else if (left === 'auto' && right === 'auto') {
      x += (this.#innerWidth - width) * 0.5
    } else if (left === 'auto') {
      x += this.#innerWidth - width
    }

    return x
  }

  #computeY(
    height: number,
    top: number | 'auto' | 'none',
    bottom: number | 'auto' | 'none',
  ): number {
    let y = this.#innerY

    if (typeof top === 'number') {
      y += top
    } else if (typeof bottom === 'number') {
      y += this.#innerHeight - height - bottom
    } else if (top === 'auto' && bottom === 'auto') {
      y += (this.#innerHeight - height) * 0.5
    } else if (top === 'auto') {
      y += this.#innerHeight - height
    }

    return y
  }
}
