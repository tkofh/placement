import type { FrameOptionGetter } from 'placement/Frame'
import type { RectLike } from 'placement/Rect'

export function parseDimensionProp(
  value: string | number | undefined,
  dimension: 'width' | 'height',
): undefined | number | FrameOptionGetter {
  if (value === undefined) {
    return undefined
  }

  if (typeof value === 'number') {
    return value
  }

  if (value.endsWith('%')) {
    const percentage = Number(value.slice(0, -1))

    if (!Number.isNaN(percentage)) {
      return (parent) => (parent[dimension] * percentage) / 100
    }
  }

  if (value.endsWith('px')) {
    const pixels = Number(value.slice(0, -2))

    if (!Number.isNaN(pixels)) {
      return pixels
    }
  }

  const number = Number(value)
  if (!Number.isNaN(number)) {
    return number
  }

  return 0
}

export function computeDimensionProp(
  value: string | number | undefined,
  dimension: 'width' | 'height',
  parent: RectLike,
  root: RectLike = parent,
) {
  const parsed = parseDimensionProp(value, dimension)
  if (typeof parsed === 'function') {
    return parsed(parent, root)
  }
  return parsed
}
