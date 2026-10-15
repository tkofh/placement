import { type NumberValue, isNumberValue } from 'valued/data/number'
import type { PercentageValue } from 'valued/data/percentage'

export function toNormalized(input: NumberValue | PercentageValue): number {
  if (isNumberValue(input)) {
    return input.value
  }
  return input.value / 100
}
