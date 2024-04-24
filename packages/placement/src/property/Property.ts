import type { ReadonlyRect } from '../rect'
import { DATA_TYPES, DEFAULT_CONFIG, DEFAULT_PARSE_RESULT } from './constants'
import type {
  ComputedOutput,
  Input,
  LengthUnit,
  ParseResult,
  PropConfig,
  TypedParseResult,
} from './types'

export class Property<const Config extends Partial<PropConfig<string>>> {
  static defaults = DEFAULT_CONFIG

  readonly #config: Config
  readonly #keywordLookup = new Set<string>()
  readonly #parsed: ParseResult
  #input: string | number

  constructor(config: Config, initial: string | number) {
    this.#config = Object.assign({}, Property.defaults, config) as Config
    this.#parsed = Object.assign({}, DEFAULT_PARSE_RESULT)

    if (Array.isArray(this.#config.keyword)) {
      if (this.#config.keyword.length === 0) {
        this.#config.keyword = false
      } else {
        for (const keyword of this.#config.keyword) {
          this.#keywordLookup.add(keyword)
        }
      }
    }

    if (
      Array.isArray(this.#config.length) &&
      this.#config.length.length === 0
    ) {
      this.#config.length = false
    }

    this.#input = initial
    this.#parse(initial)
  }

  get value(): Input<Config> {
    return this.#input as never
  }

  set value(value: Input<Config>) {
    this.#parse(value)
    this.#input = value
  }

  get parsed(): TypedParseResult<Config> {
    return this.#parsed as never
  }

  getComputed(
    container?: ReadonlyRect,
    viewport?: ReadonlyRect,
  ): ComputedOutput<Config> {
    let result: string | number
    if (this.#parsed.type === DATA_TYPES.keyword) {
      result = this.#parsed.keyword
    } else if (this.#parsed.type === DATA_TYPES.percentage) {
      const basis =
        (this.#config.percentage === 'width'
          ? container?.width
          : container?.height) ?? 0
      result = (this.#parsed.value * basis) / 100
    } else if (this.#parsed.type === DATA_TYPES.length) {
      result = this.#computeLength(
        this.#parsed.value,
        this.#parsed.unit,
        container,
        viewport,
      )
    } else {
      result = this.#parsed.value
    }

    return result as never
  }

  #parse(value: string | number) {
    let parsed = false
    if (this.#config.keyword !== false && typeof value === 'string') {
      parsed = this.#parseKeyword(value)
    }

    if (!parsed && this.#config.length !== false) {
      parsed = this.#parseLength(value)
    }

    if (!parsed && this.#config.number) {
      parsed = this.#parseNumber(value)
    }

    if (!parsed && this.#config.percentage) {
      parsed = this.#parsePercentage(value)
    }

    if (!parsed && this.#config.ratio) {
      parsed = this.#parseRatio(value)
    }

    if (!parsed) {
      throw new Error(`failed to parse ${value}`)
    }
  }

  #parseKeyword(input: string): boolean {
    let parsed = false
    if (this.#keywordLookup.has(input)) {
      this.#parsed.type = DATA_TYPES.keyword
      this.#parsed.keyword = input
      parsed = true
    }

    return parsed
  }

  #parseLength(input: string | number): boolean {
    let parsed = false

    if (typeof input === 'number') {
      parsed = this.#parseLengthNumeric(input)
    } else {
      parsed = this.#parseLengthString(input)
    }

    return parsed
  }
  #parseLengthString(input: string): boolean {
    let unit: LengthUnit
    let value: number

    // todo benchmark against ternary
    if (input.endsWith('px')) {
      unit = 'px'
      value = Number(input.slice(0, -2))
    } else if (input.endsWith('cw')) {
      unit = 'cw'
      value = Number(input.slice(0, -2))
    } else if (input.endsWith('ch')) {
      unit = 'ch'
      value = Number(input.slice(0, -2))
    } else if (input.endsWith('cmin')) {
      unit = 'cmin'
      value = Number(input.slice(0, -4))
    } else if (input.endsWith('cmax')) {
      unit = 'cmax'
      value = Number(input.slice(0, -4))
    } else if (input.endsWith('vw')) {
      unit = 'vw'
      value = Number(input.slice(0, -2))
    } else if (input.endsWith('vh')) {
      unit = 'vh'
      value = Number(input.slice(0, -2))
    } else if (input.endsWith('vmin')) {
      unit = 'vmin'
      value = Number(input.slice(0, -4))
    } else if (input.endsWith('vmax')) {
      unit = 'vmax'
      value = Number(input.slice(0, -4))
    } else {
      unit = 'px'
      value = Number(input)
    }

    return this.#parseLengthNumeric(value, unit)
  }
  #parseLengthNumeric(value: number, unit: LengthUnit = 'px'): boolean {
    let parsed = false

    if (!Number.isNaN(value) && (this.#config.allowNegative || value >= 0)) {
      this.#parsed.type = DATA_TYPES.length
      this.#parsed.value = value
      this.#parsed.unit = unit
      parsed = true
    }

    return parsed
  }

  #parsePercentage(input: string | number): boolean {
    let parsed = false

    let numericInput: number

    if (typeof input === 'number') {
      numericInput = input
    } else if (input.endsWith('%')) {
      numericInput = Number(input.slice(0, -1))
    } else {
      numericInput = Number(input)
    }

    if (
      !Number.isNaN(numericInput) &&
      (this.#config.allowNegative || numericInput >= 0)
    ) {
      this.#parsed.type = DATA_TYPES.percentage
      this.#parsed.value = numericInput
      parsed = true
    }

    return parsed
  }

  #parseNumber(input: string | number): boolean {
    let parsed = false

    let numericInput: number

    if (typeof input === 'number') {
      numericInput = input
    } else {
      numericInput = Number(input)
    }

    if (
      !Number.isNaN(input) &&
      (this.#config.allowNegative || numericInput >= 0)
    ) {
      this.#parsed.type = DATA_TYPES.number
      this.#parsed.value = numericInput
      parsed = true
    }

    return parsed
  }

  #parseRatio(input: string | number): boolean {
    let parsed = false
    if (typeof input === 'number') {
      parsed = this.#parseRatioNumeric(input)
    } else {
      parsed = this.#parseRatioString(input)
    }

    return parsed
  }
  #parseRatioString(input: string): boolean {
    const [numerator, denominator = '1'] = input.split('/')

    const parsedNumerator = Number(numerator)
    const parsedDenominator = Number(denominator)

    return this.#parseRatioNumeric(parsedNumerator / parsedDenominator)
  }
  #parseRatioNumeric(ratio: number): boolean {
    let parsed = false

    if (ratio > 0) {
      this.#parsed.type = DATA_TYPES.ratio
      this.#parsed.value = ratio
      parsed = true
    }

    return parsed
  }

  #computeLength(
    value: number,
    unit: LengthUnit,
    container?: ReadonlyRect,
    viewport?: ReadonlyRect,
  ): number {
    const containerWidth = container?.width ?? 0
    const containerHeight = container?.height ?? 0
    const viewportWidth = viewport?.width ?? 0
    const viewportHeight = viewport?.height ?? 0

    if (unit === 'cw') {
      return (value * containerWidth) / 100
    }
    if (unit === 'ch') {
      return (value * containerHeight) / 100
    }
    if (unit === 'vw') {
      return (value * viewportWidth) / 100
    }
    if (unit === 'vh') {
      return (value * viewportHeight) / 100
    }
    if (unit === 'cmin') {
      return (value * Math.min(containerWidth, containerHeight)) / 100
    }
    if (unit === 'cmax') {
      return (value * Math.max(containerWidth, containerHeight)) / 100
    }
    if (unit === 'vmin') {
      return (value * Math.min(viewportWidth, viewportHeight)) / 100
    }
    if (unit === 'vmax') {
      return (value * Math.max(viewportWidth, viewportHeight)) / 100
    }

    return value
  }
}
