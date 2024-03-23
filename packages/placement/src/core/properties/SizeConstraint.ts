type SizeConstraintKeyword = 'none' | 'inherit' | 'min-content' | 'max-content'
type SizeConstraintValue = number | SizeConstraintKeyword
type SizeConstraintUnit = 'pixels' | 'percent'

export class SizeConstraint {
  #value: SizeConstraintValue
  #unit: SizeConstraintUnit | 'none'

  constructor(keyword: SizeConstraintKeyword)
  constructor(value: number, unit: SizeConstraintUnit)
  constructor(
    value: number | SizeConstraintKeyword,
    unit?: SizeConstraintUnit,
  ) {
    this.#value = typeof value === 'string' ? value : value
    this.#unit = unit ?? 'none'
  }

  get value() {
    return this.#value
  }

  set value(value: SizeConstraintValue) {
    if (typeof value === 'string') {
      this.#value = value
      this.#unit = 'none'
    } else {
      this.#value = Math.max(value, 0)
    }
  }

  get unit(): SizeConstraintUnit | 'none' {
    return this.#unit
  }

  set unit(unit: SizeConstraintUnit) {
    if (typeof this.#value === 'number') {
      this.#unit = unit
    }
  }
}
