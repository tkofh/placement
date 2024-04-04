export class NumericProperty {
  #input: string | number = 1
  #value = 1
  #defined = false
  #allowNegative: boolean

  constructor(allowNegative: boolean) {
    this.#allowNegative = allowNegative
  }

  get value() {
    if (!this.#defined) {
      return null
    }
    return this.#value
  }

  get input() {
    return this.#input
  }

  set input(value: string | number | null) {
    if (value == null) {
      this.#defined = false
      return
    }

    this.#defined = true
    this.#input = value
    this.#parse(value)
  }

  #parse(value: string | number) {
    if (typeof value === 'number') {
      this.#value = value
      return
    }

    const parsed = Number.parseFloat(value)

    if (Number.isNaN(parsed) || (!this.#allowNegative && parsed < 0)) {
      this.#defined = false
      return
    }

    this.#value = parsed
  }
}
