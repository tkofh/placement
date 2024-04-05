export class NumericProperty {
  #input: string | number = 1
  #value = 1
  #defined = false
  #allowNegative: boolean

  constructor(allowNegative: boolean) {
    this.#allowNegative = allowNegative
  }

  read() {
    if (!this.#defined) {
      return null
    }

    return this.#value
  }

  get() {
    return this.#input
  }

  set(value: string | number | null): boolean {
    if (value === this.#input) {
      return false
    }

    if (value == null) {
      this.#defined = false
    } else {
      this.#defined = true
      this.#input = value
      this.#parse(value)
    }
    return true
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
