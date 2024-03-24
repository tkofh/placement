import type { Box } from '../Box'

type SizeConstraintUnit = 'pixels' | 'percent'
export type SizeConstraintValue =
  | 'none'
  | 'inherit'
  | 'min-content'
  | 'max-content'
  | { value: number; unit: SizeConstraintUnit }

type SizeConstraintDimension =
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight'

export class SizeConstraint {
  #box: Box
  #dimension: SizeConstraintDimension

  #value: SizeConstraintValue

  constructor(box: Box, dimension: SizeConstraintDimension) {
    this.#box = box
    this.#dimension = dimension
    this.#value = 'none'
  }

  get value() {
    return this.#value
  }

  set value(value: SizeConstraintValue) {
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
        unit === 'pixels' ? value : (value * this.#box.parent.rect.width) / 100
    } else if (this.#value === 'inherit') {
      pixels = this.#box.parent.dimensions[this.#dimension]
    }

    return pixels
  }
}
