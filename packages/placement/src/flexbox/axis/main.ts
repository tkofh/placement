import type { AxisPlacement } from './types'

export interface MainAxisConfig {
  size: number
  gap: number
  padding: number
  justify: number
  space: number
  spaceOuter: number
}

export function mainAxis(
  config: MainAxisConfig,
  items: Array<number | 'auto'>,
) {
  const availableSpace =
    config.size - config.padding * 2 - config.gap * (items.length - 1)

  let fixedUsedSpace = 0
  let autoItemCount = 0

  for (const item of items) {
    if (typeof item === 'number') {
      fixedUsedSpace += item
    } else {
      autoItemCount++
    }
  }

  const autoItemSize =
    autoItemCount === 0
      ? 0
      : Math.max((availableSpace - fixedUsedSpace) / autoItemCount, 0)

  const freeSpace =
    availableSpace - fixedUsedSpace - autoItemCount * autoItemSize

  const itemSpacing = (freeSpace / (items.length + 1)) * config.space
  const outerItemSpacing = itemSpacing * config.spaceOuter
  const innerItemSpacing =
    itemSpacing +
    (itemSpacing * 2 * (1 - config.spaceOuter)) / (items.length - 1)

  const distributedSpace =
    outerItemSpacing * 2 + innerItemSpacing * (items.length - 1)

  const justifiedSpace = (freeSpace - distributedSpace) * config.justify

  let offset = config.padding + justifiedSpace + outerItemSpacing

  const results: Array<AxisPlacement> = []
  for (const item of items) {
    const result = {
      offset,
      size: typeof item === 'number' ? item : autoItemSize,
    }
    results.push(result)
    offset += result.size + innerItemSpacing + config.gap
  }

  return results
}
