import { clamp } from 'curvy/number'

export function normalizeXYWH(
  a?: number,
  b?: number,
  c?: number,
  d?: number,
): [number, number, number, number] {
  // x, y, width, height
  if (d != null) {
    return [a ?? 0, b ?? 0, c ?? 0, d]
  }

  // x, y, size
  if (c != null) {
    return [a ?? 0, b ?? 0, c, c]
  }

  // width, height
  if (b != null) {
    return [0, 0, a ?? 0, b]
  }

  // size
  return [0, 0, a ?? 0, a ?? 0]
}

export function normalizeTRBL(
  a?: number,
  b?: number,
  c?: number,
  d?: number,
): [number, number, number, number] {
  // top, right, bottom, left
  if (d != null) {
    return [a ?? 0, b ?? 0, c ?? 0, d]
  }

  // top, x, bottom
  if (c != null) {
    return [a ?? 0, b ?? 0, c, b ?? 0]
  }

  // y, x
  if (b != null) {
    return [a ?? 0, b, a ?? 0, b]
  }

  // all
  return [a ?? 0, a ?? 0, a ?? 0, a ?? 0]
}

export function auto(a: number, b?: number, c?: number, ...tail: ReadonlyArray<number>): number {
  if (Number.isFinite(a)) {
    return a
  }
  let last = a

  if (b !== undefined) {
    if (Number.isFinite(b)) {
      return b
    }
    last = b
  }

  if (c !== undefined) {
    if (Number.isFinite(c)) {
      return c
    }
    last = c
  }

  for (const value of tail) {
    if (Number.isFinite(value)) {
      return value
    }
    last = value
  }

  return last
}

export interface NormalizedSizing {
  readonly aspectRatio: number
  readonly width: number
  readonly height: number
  readonly minWidth: number
  readonly minHeight: number
  readonly maxWidth: number
  readonly maxHeight: number
}

// Resolves a width/height pair from potentially-unset inputs (NaN = unset)
// and an optional aspect ratio (0 = unset). Resolution order: two definite
// dimensions win; one definite dimension plus a ratio derives the other; a
// ratio alone is applied against the clamped zero fallbacks; otherwise both
// fall back to clamped zero.
export function normalizeSizing(
  aspectRatio: number,
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): NormalizedSizing {
  const min = [Math.max(minWidth, 0), Math.max(minHeight, 0)] as const
  const max = [Math.max(maxWidth, 0), Math.max(maxHeight, 0)] as const
  const ratio = Math.max(aspectRatio, 0)

  const widthIsSet = !Number.isNaN(width)
  const heightIsSet = !Number.isNaN(height)

  let resolvedWidth: number
  let resolvedHeight: number

  if (widthIsSet && heightIsSet) {
    resolvedWidth = clamp(width, min[0], max[0])
    resolvedHeight = clamp(height, min[1], max[1])
  } else if (ratio > 0 && widthIsSet) {
    resolvedWidth = clamp(width, min[0], max[0])
    resolvedHeight = clamp(resolvedWidth / ratio, min[1], max[1])
  } else if (ratio > 0 && heightIsSet) {
    resolvedHeight = clamp(height, min[1], max[1])
    resolvedWidth = clamp(resolvedHeight * ratio, min[0], max[0])
  } else {
    const fallbackWidth = clamp(widthIsSet ? width : 0, min[0], max[0])
    const fallbackHeight = clamp(heightIsSet ? height : 0, min[1], max[1])

    if (ratio > 0 && fallbackWidth === 0) {
      resolvedHeight = fallbackHeight
      resolvedWidth = clamp(fallbackHeight * ratio, min[0], max[0])
    } else if (ratio > 0) {
      resolvedWidth = fallbackWidth
      resolvedHeight = clamp(fallbackWidth / ratio, min[1], max[1])
    } else {
      resolvedWidth = fallbackWidth
      resolvedHeight = fallbackHeight
    }
  }

  return {
    aspectRatio: resolvedWidth / resolvedHeight,
    width: resolvedWidth,
    height: resolvedHeight,
    minWidth: min[0],
    minHeight: min[1],
    maxWidth: max[0],
    maxHeight: max[1],
  }
}
