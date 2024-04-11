import type { ReadonlyRect } from '../Box'

export type Unit = 'px' | '%' | 'vw' | 'vh' | 'vmin' | 'vmax'
export type QuantityInput = number | `${number}${Unit}` | (string & unknown)

export class QuantityProperty {
  static readonly #UNITS = {
    px: 0,
    percent: 1,
    vw: 2,
    vh: 3,
    vmin: 4,
    vmax: 5,
  } as const

  readonly #initial: QuantityInput | null
  readonly #allowNegative: boolean
  readonly #percentBasis: 'width' | 'height'
  #raw: QuantityInput | null
  #value!: number | null
  #unit!: number

  constructor(
    initial: QuantityInput | null,
    allowNegative = false,
    percentBasis: 'width' | 'height' = 'width',
  ) {
    this.#initial = initial
    this.#allowNegative = allowNegative
    this.#percentBasis = percentBasis
    this.#raw = initial
    if (initial === null) {
      this.#value = null
    } else {
      this.#parse(initial)
    }
  }

  get raw(): QuantityInput | null {
    return this.#raw
  }

  get value(): number | null {
    return this.#value
  }
  set value(value: QuantityInput | null) {
    const input = value === 'initial' ? this.#initial : value
    if (input === null) {
      this.#raw = null
      this.#value = null
    } else {
      this.#raw = input
      this.#parse(input)
    }
  }

  compute(parent: ReadonlyRect, root: ReadonlyRect) {
    if (this.#value === null) {
      return null
    }
    switch (this.#unit) {
      case QuantityProperty.#UNITS.px:
        return this.#value
      case QuantityProperty.#UNITS.percent:
        return (parent[this.#percentBasis] * this.#value) / 100
      case QuantityProperty.#UNITS.vw:
        return (root.width * this.#value) / 100
      case QuantityProperty.#UNITS.vh:
        return (root.height * this.#value) / 100
      case QuantityProperty.#UNITS.vmin:
        return (Math.min(root.width, root.height) * this.#value) / 100
      case QuantityProperty.#UNITS.vmax:
        return (Math.max(root.width, root.height) * this.#value) / 100
    }

    throw new Error(`Unknown quantity: ${this.#raw}`)
  }

  #parse(value: QuantityInput) {
    if (typeof value === 'number') {
      this.#unit = QuantityProperty.#UNITS.px
      this.#value = value
      return
    }

    let unit: number = QuantityProperty.#UNITS.px
    let parsed: number

    if (value.endsWith('px')) {
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('%')) {
      unit = QuantityProperty.#UNITS.percent
      parsed = Number.parseFloat(value.slice(0, -1))
    } else if (value.endsWith('vw')) {
      unit = QuantityProperty.#UNITS.vw
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('vh')) {
      unit = QuantityProperty.#UNITS.vh
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('vmin')) {
      unit = QuantityProperty.#UNITS.vmin
      parsed = Number.parseFloat(value.slice(0, -4))
    } else if (value.endsWith('vmax')) {
      unit = QuantityProperty.#UNITS.vmax
      parsed = Number.parseFloat(value.slice(0, -4))
    } else {
      throw new Error(`Could not parse quantity ${value}`)
    }

    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid quantity: ${value}`)
    }

    if (!this.#allowNegative && parsed < 0) {
      throw new Error(
        `Negative values are not allowed for this property: ${value}`,
      )
    }

    this.#unit = unit
    this.#value = parsed
  }
}
