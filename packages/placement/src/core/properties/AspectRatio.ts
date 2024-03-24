import type { Box } from '../Box'
import { clamp } from '../util'
import type { Size } from './Size'

export type AspectRatioValue = number | 'auto' | 'inherit'

export class AspectRatio {
  #box: Box
  #width: Size
  #height: Size
  #value: AspectRatioValue

  constructor(box: Box, width: Size, height: Size) {
    this.#box = box
    this.#width = width
    this.#height = height
    this.#value = 'auto'
  }

  get value() {
    return this.#value
  }

  set value(value: number | 'auto' | 'inherit') {
    this.#value = typeof value === 'string' ? value : clamp(value, 0.001, 1000)
  }

  get ratio(): number | null {
    return typeof this.#value === 'number'
      ? this.#value
      : this.#value === 'inherit'
        ? this.#box.parent.naturalDimensions.aspectRatio
        : null
  }

  get computedWidth() {
    const ratio = this.ratio
    const height = this.#height.pixels
    if (height === null || ratio === null) {
      return null
    }

    return height * ratio
  }

  get computedHeight() {
    const ratio = this.ratio
    const width = this.#width.pixels
    if (width === null || ratio === null) {
      return null
    }

    return width / ratio
  }
}
