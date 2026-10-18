import { clamp } from 'curvy/number'
import type * as AspectRatio from '../aspectRatio.ts'
import { heightOf, valueOf, widthOf } from '../internal/ratio.ts'

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

/**
 * Resolves a chain of candidate values to the first finite one, or to the
 * last candidate when none is finite. The library uses it to resolve its
 * `Infinity`-as-auto sentinels. Read `auto(value, fallback)` as "value,
 * unless it is auto, then fallback".
 *
 * @param a - The preferred value.
 * @param b - The next candidate, used when `a` is not finite.
 * @param c - The next candidate after `b`.
 * @param tail - Any further candidates, in order of preference.
 * @returns The first finite candidate, or the last candidate when every one
 * is non-finite.
 * @example
 * ```ts
 * auto(Number.POSITIVE_INFINITY, 5) // 5
 * auto(10, 5) // 10
 * auto(Number.NaN, Number.POSITIVE_INFINITY) // Infinity
 * ```
 */
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

// Resolves a width/height pair from inputs that can be unset (NaN means
// unset) and an optional aspect ratio (0 means unset). The ratio's value
// gates the derivation, and the ratio itself derives the extent, so a
// `16 / 9` ratio rounds once (see `placement/aspectRatio`). If both dimensions are
// definite, they win. If one dimension is definite and a ratio is set, the
// ratio derives the other. A ratio alone applies against the clamped zero
// fallbacks. Otherwise, both fall back to clamped zero. Crossed constraints
// resolve as CSS clamp() does: the maximum rises to the minimum, so the
// minimum wins.
export function normalizeSizing(
  aspectRatio: AspectRatio.AspectRatioInput,
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): NormalizedSizing {
  const min = [Math.max(minWidth, 0), Math.max(minHeight, 0)] as const
  const max = [Math.max(maxWidth, min[0]), Math.max(maxHeight, min[1])] as const
  const ratio = Math.max(valueOf(aspectRatio), 0)

  const widthIsSet = !Number.isNaN(width)
  const heightIsSet = !Number.isNaN(height)

  let resolvedWidth: number
  let resolvedHeight: number

  if (widthIsSet && heightIsSet) {
    resolvedWidth = clamp(width, min[0], max[0])
    resolvedHeight = clamp(height, min[1], max[1])
  } else if (ratio > 0 && widthIsSet) {
    resolvedWidth = clamp(width, min[0], max[0])
    resolvedHeight = clamp(heightOf(aspectRatio, resolvedWidth), min[1], max[1])
  } else if (ratio > 0 && heightIsSet) {
    resolvedHeight = clamp(height, min[1], max[1])
    resolvedWidth = clamp(widthOf(aspectRatio, resolvedHeight), min[0], max[0])
  } else {
    const fallbackWidth = clamp(widthIsSet ? width : 0, min[0], max[0])
    const fallbackHeight = clamp(heightIsSet ? height : 0, min[1], max[1])

    if (ratio > 0 && fallbackWidth === 0) {
      resolvedHeight = fallbackHeight
      resolvedWidth = clamp(widthOf(aspectRatio, fallbackHeight), min[0], max[0])
    } else if (ratio > 0) {
      resolvedWidth = fallbackWidth
      resolvedHeight = clamp(heightOf(aspectRatio, fallbackWidth), min[1], max[1])
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
