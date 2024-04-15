export type NumericInput = number | `${number}` | 'initial'

export class NumericProperty {
  readonly #initial = 0
  readonly #allowNegative: boolean
  #value = 0

  constructor(allowNegative = false) {
    this.#allowNegative = allowNegative
  }

  get value(): number {
    return this.#value
  }
  set value(value: NumericInput) {
    this.#parse(value)
  }

  #parse(value: NumericInput) {
    if (typeof value === 'number') {
      this.#value = value
      return
    }

    if (value === 'initial') {
      this.#value = this.#initial
      return
    }

    const parsed = Number.parseFloat(value)

    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid number: ${value}`)
    }

    if (!this.#allowNegative && parsed < 0) {
      throw new Error(`Negative numbers are not allowed: ${value}`)
    }

    this.#value = parsed
  }
}
