export class NumericProperty {
  readonly #initial: string | number
  #raw: string | number
  #value: number

  constructor(initial: string | number) {
    this.#initial = initial
    this.#raw = initial
    this.#value = this.#parse(initial)
  }

  get raw(): string | number {
    return this.#raw
  }

  get value(): number {
    return this.#value
  }
  set value(value: string | number | null) {
    this.#raw = value ?? this.#initial
    this.#value = this.#parse(value ?? this.#initial)
  }

  #parse(value: string | number): number {
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
