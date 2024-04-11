export type NumericInput = number | `${number}` | (string & unknown)

export class NumericProperty {
  readonly #initial: NumericInput
  #raw: NumericInput
  #value: number

  constructor(initial: NumericInput) {
    this.#initial = initial
    this.#raw = initial
    this.#value = this.#parse(initial)
  }

  get raw(): NumericInput {
    return this.#raw
  }

  get value(): number {
    return this.#value
  }
  set value(value: NumericInput | null) {
    this.#raw = value ?? this.#initial
    this.#value = this.#parse(value ?? this.#initial)
  }

  #parse(value: NumericInput): number {
    if (typeof value === 'number') {
      return value
    }

    const parsed = Number.parseFloat(value)

    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid number: ${value}`)
    }

    return parsed
  }
}
