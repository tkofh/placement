import type { ParseResult, PropConfig } from './types'

export const DATA_TYPES = {
  keyword: 0,
  length: 1,
  percentage: 2,
  number: 3,
  ratio: 4,
} as const

export const DEFAULT_PARSE_RESULT = {
  keyword: 'none',
  type: DATA_TYPES.keyword,
  unit: 'px',
  value: 0,
} satisfies ParseResult

export const DEFAULT_CONFIG = {
  keyword: false,
  length: false,
  percentage: false,
  number: false,
  ratio: false,
  allowNegative: false,
} satisfies PropConfig<never>
