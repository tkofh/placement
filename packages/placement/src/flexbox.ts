import type { Dimensions, FlexibleDimensions, Rect } from './primitives'

interface AxisPlacement {
  size: number
  offset: number
}

interface MainAxisConfig {
  size: number
  gap: number
  justify: number
  space: number
  spaceOuter: number
}

function mainAxis(config: MainAxisConfig, items: Array<number | 'auto'>) {
  const availableSpace = config.size - config.gap * (items.length - 1)

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

  let offset = justifiedSpace + outerItemSpacing

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

interface CrossAxisConfig {
  size: number
  align: number
  stretch: number
}

function crossAxis(config: CrossAxisConfig, items: Array<number | 'auto'>) {
  const availableSpace = config.size
  const results: Array<AxisPlacement> = []

  for (const item of items) {
    const size: number =
      typeof item === 'number'
        ? item + Math.max(availableSpace - item, 0) * config.stretch
        : availableSpace

    const offset = (availableSpace - size) * config.align

    results.push({ size, offset })
  }

  return results
}

export interface FlexConfig {
  direction: 'row' | 'column'
  gap: number
  justify: number
  align: number
  stretch: number
  space: number
  spaceOuter: number
}

const defaultConfig: FlexConfig = {
  direction: 'row',
  gap: 0,
  justify: 0,
  align: 0,
  stretch: 0,
  space: 0,
  spaceOuter: 0,
}

export function flexbox(
  rect: Rect | Dimensions,
  options: Partial<FlexConfig>,
  items: Array<FlexibleDimensions>,
): Array<Rect> {
  const config = { ...defaultConfig, ...options }

  const mainConfig: MainAxisConfig = {
    size: config.direction === 'row' ? rect.width : rect.height,
    gap: config.gap,
    justify: config.justify,
    space: config.space,
    spaceOuter: config.spaceOuter,
  }

  const crossConfig: CrossAxisConfig = {
    size: config.direction === 'row' ? rect.height : rect.width,
    align: config.align,
    stretch: config.stretch,
  }

  const mainResults = mainAxis(
    mainConfig,
    items.map((item) =>
      config.direction === 'row' ? item.width : item.height,
    ),
  )
  const crossResults = crossAxis(
    crossConfig,
    items.map((item) =>
      config.direction === 'row' ? item.height : item.width,
    ),
  )

  const offsetX = 'x' in rect ? rect.x : 0
  const offsetY = 'y' in rect ? rect.y : 0

  const results = mainResults.map((main, i) => {
    const cross = crossResults[i]

    return {
      x: offsetX + (config.direction === 'row' ? main.offset : cross.offset),
      y: offsetY + (config.direction === 'row' ? cross.offset : main.offset),
      width: config.direction === 'row' ? main.size : cross.size,
      height: config.direction === 'row' ? cross.size : main.size,
    }
  })

  return results
}
