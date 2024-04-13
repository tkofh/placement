export type RatioInput =
  | number
  | `${number}`
  | `${number}${' ' | never}/${' ' | never}${number}`
  | 'none'
  | 'initial'

export class RatioProperty {
  #raw: RatioInput
  #value: number | 'none'

  constructor() {
    this.#raw = 'initial'
    this.#value = 'none'
  }

  get raw(): RatioInput {
    return this.#raw
  }

  get value(): number | 'none' {
    return this.#value
  }
  set value(value: RatioInput) {
    this.#raw = value
    this.#parse(value)
  }

  #parse(value: RatioInput) {
    if (typeof value === 'number') {
      if (value === 0) {
        throw new Error('Ratio cannot be 0')
      }

      this.#value = value
      return
    }

    if (value === 'none' || value === 'initial') {
      this.#value = 'none'
      return
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
