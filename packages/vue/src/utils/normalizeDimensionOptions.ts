import type { FrameOptions } from 'placement/Frame'
import { parseDimensionProp } from './parseDimensionProp.ts'
import { parseRatioProp } from './parseRatioProp.ts'

export function normalizeDimensionOptions(
  width: string | number | undefined,
  height: string | number | undefined,
  aspectRatio: string | number | undefined,
): Pick<FrameOptions, 'width' | 'height'> {
  const parsedWidth = parseDimensionProp(width, 'width')
  const parsedHeight = parseDimensionProp(height, 'height')
  const parsedAspectRatio = parseRatioProp(aspectRatio)

  const result: Pick<FrameOptions, 'width' | 'height'> = {
    width: 0,
    height: 0,
  }

  if (parsedWidth !== undefined) {
    result.width = parsedWidth
  } else if (parsedHeight !== undefined && parsedAspectRatio !== undefined) {
    result.width =
      typeof parsedHeight === 'number'
        ? parsedHeight * parsedAspectRatio
        : (...args) => parsedHeight(...args) * parsedAspectRatio
  }

  if (parsedHeight !== undefined) {
    result.height = parsedHeight
  } else if (parsedWidth !== undefined && parsedAspectRatio !== undefined) {
    result.height =
      typeof parsedWidth === 'number'
        ? parsedWidth / parsedAspectRatio
        : (...args) => parsedWidth(...args) / parsedAspectRatio
  }

  return result
}
