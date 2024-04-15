import type { ReadonlyRect } from '../rect/Rect'

export type Unit = 'px' | '%' | 'vw' | 'vh' | 'vmin' | 'vmax'
export type Quantity = number | `${number}${Unit}`
export type QuantityKeyword = 'auto' | 'none'
export type QuantityInput<Keyword extends QuantityKeyword = never> =
  | Quantity
  | 'initial'
  | Keyword

const UNITS = {
  px: 0,
  percent: 1,
  vw: 2,
  vh: 3,
  vmin: 4,
  vmax: 5,
} as const

type UnitId = (typeof UNITS)[keyof typeof UNITS]

export class QuantityProperty<Keyword extends QuantityKeyword = never> {
  readonly #allowNegative: boolean
  readonly #percentBasis: 'width' | 'height'
  #allowedKeywords = new Set<Keyword>()
  #keyword: Keyword | null = null
  #value = 0
  #unit: UnitId = UNITS.px

  constructor(
    allowNegative = false,
    percentBasis: 'width' | 'height' = 'width',
    keywords: Array<Keyword> = [],
  ) {
    this.#allowNegative = allowNegative
    this.#percentBasis = percentBasis

    for (const keyword of keywords) {
      this.#allowedKeywords.add(keyword)
    }
  }

  get value(): number | Keyword {
    return this.#keyword ?? this.#value
  }
  set value(value: QuantityInput<Keyword>) {
    if (value !== this.#value) {
      if (this.#allowedKeywords.has(value as Keyword)) {
        this.#keyword = value as Keyword
        return
      }
      this.#parse(value as QuantityInput)
    }
  }

  compute(parent: ReadonlyRect, root: ReadonlyRect): number | Keyword {
    if (this.#keyword !== null) {
      return this.#keyword
    }

    switch (this.#unit) {
      case UNITS.px:
        return this.#value
      case UNITS.percent:
        return (parent[this.#percentBasis] * this.#value) / 100
      case UNITS.vw:
        return (root.width * this.#value) / 100
      case UNITS.vh:
        return (root.height * this.#value) / 100
      case UNITS.vmin:
        return (Math.min(root.width, root.height) * this.#value) / 100
      case UNITS.vmax:
        return (Math.max(root.width, root.height) * this.#value) / 100
    }
  }

  #parse(value: QuantityInput) {
    if (typeof value === 'number') {
      this.#unit = UNITS.px
      this.#value = value
      return
    }

    if (value === 'initial') {
      this.#unit = UNITS.px
      this.#value = 0
      return
    }

    let unit: UnitId
    let parsed: number

    if (value.endsWith('px')) {
      unit = UNITS.px
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('%')) {
      unit = UNITS.percent
      parsed = Number.parseFloat(value.slice(0, -1))
    } else if (value.endsWith('vw')) {
      unit = UNITS.vw
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('vh')) {
      unit = UNITS.vh
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('vmin')) {
      unit = UNITS.vmin
      parsed = Number.parseFloat(value.slice(0, -4))
    } else if (value.endsWith('vmax')) {
      unit = UNITS.vmax
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
