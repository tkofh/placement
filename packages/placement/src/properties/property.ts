// type DataType = 'keyword' | 'length' | 'percentage' | 'number' | 'ratio'

type LengthUnit =
  | 'px'
  | 'cw'
  | 'ch'
  | 'cmin'
  | 'cmax'
  | 'vw'
  | 'vh'
  | 'vmin'
  | 'vmax'

interface LengthConfig<Unit extends LengthUnit> {
  units: ReadonlyArray<Unit>
  allowNegative: boolean
}

interface PropConfig<Keyword extends string, Unit extends LengthUnit> {
  keyword?: ReadonlyArray<Keyword> | false
  length?: LengthConfig<Unit> | false
  percentage?: boolean
  number?: boolean
  ratio?: boolean
}

// interface ParseResult {
//   type: DataType
//   keyword: string
//   value: number
//   unit: LengthUnit
// }

type KeywordParseResult<Config extends PropConfig<string, LengthUnit>> =
  Config['keyword'] extends ReadonlyArray<infer Keyword>
    ? { type: 'keyword'; keyword: Keyword }
    : never

type LengthParseResult<Config extends PropConfig<string, LengthUnit>> =
  Config['length'] extends LengthConfig<infer Unit>
    ? { type: 'length'; value: number; unit: Unit }
    : never

type PercentageParseResult<Config extends PropConfig<string, LengthUnit>> =
  Config['percentage'] extends true
    ? { type: 'percentage'; value: number }
    : never

type NumberParseResult<Config extends PropConfig<string, LengthUnit>> =
  Config['number'] extends true ? { type: 'number'; value: number } : never

type RatioParseResult<Config extends PropConfig<string, LengthUnit>> =
  Config['ratio'] extends true ? { type: 'ratio'; value: number } : never

type TypedParseResult<Config extends PropConfig<string, LengthUnit>> =
  | KeywordParseResult<Config>
  | LengthParseResult<Config>
  | PercentageParseResult<Config>
  | NumberParseResult<Config>
  | RatioParseResult<Config>

const _TYPES = {
  keyword: 0,
  length: 1,
  percentage: 2,
  number: 3,
  ratio: 4,
} as const

const _LENGTH_UNITS = {
  px: 0,
  cw: 1,
  ch: 2,
  cmin: 3,
  cmax: 4,
  vw: 5,
  vh: 6,
  vmin: 7,
  vmax: 8,
} as const

const _KEYWORDS = {
  auto: 0,
  none: 1,
} as const

class Property<const Config extends PropConfig<string, LengthUnit>> {
  static defaults: PropConfig<never, never> = {
    keyword: false,
    length: false,
    percentage: false,
    number: false,
    ratio: false,
  }

  #config: Config

  constructor(config: Config) {
    this.#config = config

    if (
      Array.isArray(this.#config.keyword) &&
      this.#config.keyword.length === 0
    ) {
      this.#config.keyword = false
    }
    if (
      typeof this.#config.length === 'object' &&
      this.#config.length.units.length === 0
    ) {
      this.#config.length = false
    }
  }

  parse(_value: string): TypedParseResult<Config> {
    return { type: 'keyword', keyword: [''] } as never
  }
}

const prop = new Property({
  keyword: ['hello'],
  number: true,
  ratio: true,
})

const result = prop.parse('')

const _foo = result.type
//
// class ComputedProperty {}
