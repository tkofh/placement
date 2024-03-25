import type { AxisPlacement } from './types'

export interface CrossAxisConfig {
  size: number
  padding: number
  align: number
  stretch: number
}

export function crossAxis(
  config: CrossAxisConfig,
  items: Array<number | 'auto'>,
) {
  const availableSpace = config.size - config.padding * 2
  const results: Array<AxisPlacement> = []

  for (const item of items) {
    const size: number =
      typeof item === 'number'
        ? item + Math.max(availableSpace - item, 0) * config.stretch
        : availableSpace

    const offset = config.padding + (availableSpace - size) * config.align

    results.push({ size, offset })
  }

  return results
}
