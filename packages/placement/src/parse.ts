export type Unit = 'px' | '%'

interface ValueAndUnit {
  readonly value: number
  readonly unit: Unit | null
}

export const INVALID = Symbol('Invalid Value')

const VALUE_UNIT_RE = /^(-?\d+(?:\.\d+)?)(px|%)?$/

function parseValueAndUnit(value: string): ValueAndUnit | typeof INVALID {
  const match = value.match(VALUE_UNIT_RE)
  if (!match) {
    return INVALID
  }

  return {
    value: Number.parseFloat(match[1]),
    unit: (match[2] ?? 'px') as Unit,
  }
}

export type ValueType = 'length' | 'ratio'

export function parseLength(
  value: string | number,
  percentBasis: number,
): number | typeof INVALID {
  if (typeof value === 'number') {
    return value
  }

  const parsed = parseValueAndUnit(value)
  if (parsed === INVALID) {
    return INVALID
  }

  const { value: length, unit } = parsed

  return unit === '%' ? (percentBasis * length) / 100 : length
}

const RATIO_RE = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/

export function parseRatio(value: string | number): number | typeof INVALID {
  if (typeof value === 'number') {
    return value
  }

  const match = value.match(RATIO_RE)
  if (!match) {
    return INVALID
  }

  const numerator = Number.parseFloat(match[1])
  const denominator = Number.parseFloat(match[2] ?? '1')

  if (denominator === 0) {
    return INVALID
  }

  return numerator / denominator
}
