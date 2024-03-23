type DimensionUnit = 'px' | 'percent'
type Value =
  | { value: number; unit: DimensionUnit }
  | 'inherit'
  | 'min-content'
  | 'max-content'

interface DimensionInput {
  min?: Value
  basis?: Value
  max?: Value
}

export class Dimension {
  #min: Value | null
  #basis: Value | null
  #max: Value | null

  constructor(input: DimensionInput = {}) {
    this.#min = input.min ?? null
    this.#basis = input.basis ?? null
    this.#max = input.max ?? null
  }

  get min(): Value | null {
    return this.#min
  }

  set min(value: Value | null) {
    this.#min = value
  }

  get basis(): Value | null {
    if (this.#min === null && this.#basis === null && this.#max === null) {
      return 'min-content'
    }
    return this.#basis
  }

  set basis(value: Value | null) {
    this.#basis = value
  }

  get max(): Value | null {
    return this.#max
  }

  set max(value: Value | null) {
    this.#max = value
  }
}
