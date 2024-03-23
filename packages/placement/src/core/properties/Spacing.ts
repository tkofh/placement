type SpacingKeyword = 'inherit'
type SpacingValue = number | SpacingKeyword
type SpacingUnit = 'pixels' | 'percent'

export class Spacing {
  #value: SpacingValue
  #unit: SpacingUnit | 'none'

  #allowNegative: boolean

  constructor(allowNegative: boolean, keyword: SpacingKeyword)
  constructor(allowNegative: boolean, value: number, unit: SpacingUnit)
  constructor(
    allowNegative: boolean,
    value: number | SpacingKeyword,
    unit?: SpacingUnit,
  ) {
    this.#allowNegative = allowNegative
    this.#value = typeof value === 'string' ? value : value
    this.#unit = unit ?? 'none'
  }

  get value() {
    return this.#value
  }

  set value(value: SpacingValue) {
    if (typeof value === 'string') {
      this.#value = value
      this.#unit = 'none'
    } else {
      this.#value = this.#allowNegative ? value : Math.max(value, 0)
    }
  }

  get unit(): SpacingUnit | 'none' {
    return this.#unit
  }

  set unit(unit: SpacingUnit) {
    if (typeof this.#value === 'number') {
      this.#unit = unit
    }
  }
}
