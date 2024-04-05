export interface Quantity {
  value: number
  unit: number
}

export class QuantityProperty {
  static UNITS = {
    pixel: 1,
    percent: 2,
    flex: 4,
    degree: 8,
    radian: 16,
    turn: 32,
  } as const

  static get ALL_UNITS() {
    return (
      QuantityProperty.UNITS.pixel |
      QuantityProperty.UNITS.percent |
      QuantityProperty.UNITS.flex |
      QuantityProperty.UNITS.degree |
      QuantityProperty.UNITS.radian |
      QuantityProperty.UNITS.turn
    )
  }

  static get DIMENSION_UNITS() {
    return QuantityProperty.UNITS.pixel | QuantityProperty.UNITS.percent
  }

  static get DIMENSION_OR_FLEX_UNITS() {
    return (
      QuantityProperty.UNITS.pixel |
      QuantityProperty.UNITS.percent |
      QuantityProperty.UNITS.flex
    )
  }

  static get ANGLE_UNITS() {
    return (
      QuantityProperty.UNITS.degree |
      QuantityProperty.UNITS.radian |
      QuantityProperty.UNITS.turn
    )
  }

  #input: string | number = ''
  #parsed: Quantity = {
    value: 0,
    unit: QuantityProperty.UNITS.pixel,
  }
  #allowedUnits: number
  #defined = false

  constructor(allowedUnits: number) {
    this.#allowedUnits = allowedUnits
  }

  read() {
    if (!this.#defined) {
      return null
    }

    return this.#parsed
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

  #parsePixel(value: string) {
    const parsedValue = Number.parseFloat(value.slice(0, -2))
    if (!Number.isNaN(parsedValue)) {
      this.#parsed.value = parsedValue
      this.#parsed.unit = QuantityProperty.UNITS.pixel
    } else {
      this.#defined = false
    }
  }

  #parsePercent(value: string) {
    const parsedValue = Number.parseFloat(value.slice(0, -1))
    if (!Number.isNaN(parsedValue)) {
      this.#parsed.value = parsedValue
      this.#parsed.unit = QuantityProperty.UNITS.percent
    } else {
      this.#defined = false
    }
  }

  #parseFlex(value: string) {
    const parsedValue = Number.parseFloat(value.slice(0, -2))
    if (!Number.isNaN(parsedValue) && parsedValue >= 0) {
      this.#parsed.value = parsedValue
      this.#parsed.unit = QuantityProperty.UNITS.flex
    } else {
      this.#defined = false
    }
  }

  #parse(value: string | number) {
    if (typeof value === 'number') {
      this.#parsed.value = value
      this.#parsed.unit = QuantityProperty.UNITS.pixel
      return
    }

    if (
      value.endsWith('px') &&
      this.#allowedUnits & QuantityProperty.UNITS.pixel
    ) {
      this.#parsePixel(value)
    } else if (
      value.endsWith('%') &&
      this.#allowedUnits & QuantityProperty.UNITS.percent
    ) {
      this.#parsePercent(value)
    } else if (
      value.endsWith('fr') &&
      this.#allowedUnits & QuantityProperty.UNITS.flex
    ) {
      this.#parseFlex(value)
    } else if (value === '0') {
      this.#parsed.value = 0
      this.#parsed.unit = QuantityProperty.ALL_UNITS
    } else {
      this.#defined = false
    }
  }
}
