import type { Box } from '../Box'

type SizeUnit = 'pixels' | 'percent'
export type SizeValue =
  | 'auto'
  | 'inherit'
  | 'min-content'
  | 'max-content'
  | { value: number; unit: SizeUnit }

type SizeDimension = 'width' | 'height'

export class Size {
  #dimension: SizeDimension
  #box: Box
  #value: SizeValue
  constructor(box: Box, dimension: SizeDimension) {
    this.#box = box
    this.#dimension = dimension
    this.#value = 'auto'
  }

  get value() {
    return this.#value
  }

  set value(value: SizeValue) {
    if (typeof value === 'string') {
      this.#value = value
    } else {
      this.#value = { value: Math.max(value.value, 0), unit: value.unit }
    }
  }

  get pixels(): number | null {
    let pixels = null

    if (typeof this.#value === 'object') {
      const { value, unit } = this.#value
      pixels =
        unit === 'pixels'
          ? value
          : (value * this.#box.parent.rect[this.#dimension]) / 100
    } else if (this.#value === 'inherit') {
      pixels = this.#box.parent.dimensions[this.#dimension]
    }

    return pixels
  }
}
