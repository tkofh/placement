import type { DATA_TYPES } from './constants'

export type DataType = (typeof DATA_TYPES)[keyof typeof DATA_TYPES]

export type LengthUnit =
  | 'px'
  | 'cw'
  | 'ch'
  | 'cmin'
  | 'cmax'
  | 'vw'
  | 'vh'
  | 'vmin'
  | 'vmax'

export type Keyword = 'none' | 'auto'

export interface PropConfig<Keyword extends string> {
  keyword: ReadonlyArray<Keyword> | false
  length: boolean
  percentage: boolean
  number: boolean
  ratio: boolean
  allowNegative: boolean
}

export interface ParseResult {
  type: DataType
  keyword: string
  value: number
  unit: LengthUnit
}

export type KeywordParseResult<Config extends Partial<PropConfig<string>>> =
  Config['keyword'] extends ReadonlyArray<infer Keyword>
    ? { type: (typeof DATA_TYPES)['keyword']; keyword: Keyword }
    : never

export type LengthParseResult<Config extends Partial<PropConfig<string>>> =
  Config['length'] extends true
    ? { type: (typeof DATA_TYPES)['length']; value: number; unit: LengthUnit }
    : never

export type PercentageParseResult<Config extends Partial<PropConfig<string>>> =
  Config['percentage'] extends true
    ? { type: (typeof DATA_TYPES)['percentage']; value: number }
    : never

export type NumberParseResult<Config extends Partial<PropConfig<string>>> =
  Config['number'] extends true
    ? { type: (typeof DATA_TYPES)['number']; value: number }
    : never

export type RatioParseResult<Config extends Partial<PropConfig<string>>> =
  Config['ratio'] extends true
    ? { type: (typeof DATA_TYPES)['ratio']; value: number }
    : never

export type TypedParseResult<Config extends Partial<PropConfig<string>>> =
  | KeywordParseResult<Config>
  | LengthParseResult<Config>
  | PercentageParseResult<Config>
  | NumberParseResult<Config>
  | RatioParseResult<Config>

export type KeywordInput<Config extends Partial<PropConfig<string>>> =
  Config extends { keyword: ReadonlyArray<infer Keyword> } ? Keyword : never
export type LengthInput<Config extends Partial<PropConfig<string>>> =
  Config extends { length: true }
    ? number | `${number}` | `${number}${LengthUnit}`
    : never
export type PercentageInput<Config extends Partial<PropConfig<string>>> =
  Config extends { percentage: true } ? number | `${number}%` : never
export type NumberInput<Config extends Partial<PropConfig<string>>> =
  Config extends { number: true } ? number | `${number}` : never
export type RatioInput<Config extends Partial<PropConfig<string>>> =
  Config extends { ratio: true }
    ? number | `${number}` | `${number}${' ' | never}/${' ' | never}${number}`
    : never

export type Input<Config extends Partial<PropConfig<string>>> =
  | KeywordInput<Config>
  | LengthInput<Config>
  | PercentageInput<Config>
  | NumberInput<Config>
  | RatioInput<Config>
