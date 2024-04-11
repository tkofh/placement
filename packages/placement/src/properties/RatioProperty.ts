export class RatioProperty {
  readonly #initial: string | number | null
  #raw: string | number | null
  #value: number | null

  constructor(initial: string | number | null) {
    this.#initial = initial
    this.#raw = initial
    if (initial === null) {
      this.#value = null
    } else {
      this.#value = this.#parse(initial)
    }
  }

  get raw(): string | number | null {
    return this.#raw
  }

  get value(): number | null {
    return this.#value
  }
  set value(value: string | number | null) {
    const input = value === 'initial' ? this.#initial : value
    if (input === null) {
      this.#raw = null
      this.#value = null
    } else {
      this.#raw = input
      this.#value = this.#parse(input)
    }
  }

  #parse(value: string | number): number {
    if (typeof value === 'number') {
      if (value === 0) {
        throw new Error('Ratio cannot be 0')
      }

      return value
    }

    const [numerator, denominator] = value.split('/')

    const parsedNumerator = Number(numerator)

    if (Number.isNaN(parsedNumerator)) {
      throw new Error(
        `Invalid ratio: ${value} (numerator must be a number, got ${denominator})`,
      )
    }

    if (denominator === undefined) {
      return parsedNumerator
    }

    const parsedDenominator = Number(denominator)

    if (Number.isNaN(parsedDenominator) || parsedDenominator === 0) {
      throw new Error(
        `Invalid ratio: ${value} (denominator must be a non-zero number, got ${denominator})`,
      )
    }

    return parsedNumerator / parsedDenominator
  }
}
