type SizeKeyword = 'auto' | 'inherit' | 'min-content' | 'max-content'
type SizeValue = number | SizeKeyword
type SizeUnit = 'pixels' | 'percent'

export class Size {
  #value: SizeValue
  #unit: SizeUnit | 'none'

  constructor(keyword: SizeKeyword)
  constructor(value: number, unit: SizeUnit)
  constructor(value: number | SizeKeyword, unit?: SizeUnit) {
    this.#value = typeof value === 'string' ? value : value
    this.#unit = unit ?? 'none'
  }

  get value() {
    return this.#value
  }

  set value(value: SizeValue) {
    if (typeof value === 'string') {
      this.#value = value
      this.#unit = 'none'
    } else {
      this.#value = Math.max(value, 0)
    }
  }

  get unit(): SizeUnit | 'none' {
    return this.#unit
  }

  set unit(unit: SizeUnit) {
    if (typeof this.#value === 'number') {
      this.#unit = unit
    }
  }
}
