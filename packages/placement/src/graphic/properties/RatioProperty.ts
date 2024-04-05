export class RatioProperty {
  #input: string | number = 1
  #value = 1
  #defined = false

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

    const [numerator, denominator] = value.split('/')

    const parsedNumerator = Number.parseFloat(numerator)

    if (Number.isNaN(parsedNumerator) || parsedNumerator <= 0) {
      this.#defined = false
      return
    }

    if (denominator == null) {
      this.#value = parsedNumerator
      return
    }

    const parsedDenominator = Number.parseFloat(denominator)

    if (Number.isNaN(parsedDenominator) || parsedDenominator <= 0) {
      this.#defined = false
      return
    }

    this.#value = parsedNumerator / parsedDenominator
  }
}
