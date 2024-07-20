import { clamp } from './math'

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

export function auto(
  a: number,
  b?: number,
  c?: number,
  ...tail: ReadonlyArray<number>
): number {
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

function safeDivide(a: number, b: number) {
  return b === 0 ? Number.POSITIVE_INFINITY : a / b
}

interface NormalizedSizing {
  readonly aspectRatio: number
  readonly width: number
  readonly height: number
  readonly minWidth: number
  readonly minHeight: number
  readonly maxWidth: number
  readonly maxHeight: number
}

export function normalizeSizing(
  aspectRatio: number,
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): NormalizedSizing {
  const normalizedMinWidth = Math.max(minWidth, 0)
  const normalizedMinHeight = Math.max(minHeight, 0)
  const normalizedMaxWidth = Math.max(maxWidth, 0)
  const normalizedMaxHeight = Math.max(maxHeight, 0)

  const normalizedAspectRatio = Math.max(aspectRatio ?? 0, 0)

  if (width >= 0 && height >= 0) {
    const normalizedWidth = clamp(width, normalizedMinWidth, normalizedMaxWidth)
    const normalizedHeight = clamp(
      height,
      normalizedMinHeight,
      normalizedMaxHeight,
    )
    return {
      aspectRatio: safeDivide(normalizedWidth, normalizedHeight),
      width: normalizedWidth,
      height: normalizedHeight,
      minWidth: normalizedMinWidth,
      minHeight: normalizedMinHeight,
      maxWidth: normalizedMaxWidth,
      maxHeight: normalizedMaxHeight,
    }
  }

  if (normalizedAspectRatio > 0 && width >= 0) {
    const normalizedWidth = clamp(width, normalizedMinWidth, normalizedMaxWidth)
    const normalizedHeight = clamp(
      normalizedWidth / normalizedAspectRatio,
      normalizedMinHeight,
      normalizedMaxHeight,
    )
    return {
      aspectRatio: safeDivide(normalizedWidth, normalizedHeight),
      width: normalizedWidth,
      height: normalizedHeight,
      minWidth: normalizedMinWidth,
      minHeight: normalizedMinHeight,
      maxWidth: normalizedMaxWidth,
      maxHeight: normalizedMaxHeight,
    }
  }

  if (normalizedAspectRatio > 0 && height >= 0) {
    const normalizedHeight = clamp(
      height,
      normalizedMinHeight,
      normalizedMaxHeight,
    )
    const normalizedWidth = clamp(
      normalizedHeight * normalizedAspectRatio,
      normalizedMinWidth,
      normalizedMaxWidth,
    )
    return {
      aspectRatio: safeDivide(normalizedWidth, normalizedHeight),
      width: normalizedWidth,
      height: normalizedHeight,
      minWidth: normalizedMinWidth,
      minHeight: normalizedMinHeight,
      maxWidth: normalizedMaxWidth,
      maxHeight: normalizedMaxHeight,
    }
  }

  const normalizedConstrainedWidth = clamp(
    width ?? 0,
    normalizedMinWidth,
    normalizedMaxWidth,
  )
  const normalizedConstrainedHeight = clamp(
    height ?? 0,
    normalizedMinHeight,
    normalizedMaxHeight,
  )

  if (normalizedAspectRatio > 0) {
    if (normalizedConstrainedWidth === 0) {
      const normalizedWidth = clamp(
        normalizedConstrainedHeight * normalizedAspectRatio,
        normalizedMinWidth,
        normalizedMaxWidth,
      )
      return {
        aspectRatio: safeDivide(normalizedWidth, normalizedConstrainedHeight),
        width: normalizedWidth,
        height: normalizedConstrainedHeight,
        minWidth: normalizedMinWidth,
        minHeight: normalizedMinHeight,
        maxWidth: normalizedMaxWidth,
        maxHeight: normalizedMaxHeight,
      }
    }
    const normalizedHeight = clamp(
      normalizedConstrainedWidth / normalizedAspectRatio,
      normalizedMinHeight,
      normalizedMaxHeight,
    )

    return {
      aspectRatio: safeDivide(normalizedConstrainedWidth, normalizedHeight),
      width: normalizedConstrainedWidth,
      height: normalizedHeight,
      minWidth: normalizedMinWidth,
      minHeight: normalizedMinHeight,
      maxWidth: normalizedMaxWidth,
      maxHeight: normalizedMaxHeight,
    }
  }

  return {
    aspectRatio: safeDivide(
      normalizedConstrainedWidth,
      normalizedConstrainedHeight,
    ),
    width: normalizedConstrainedWidth,
    height: normalizedConstrainedHeight,
    minWidth: normalizedMinWidth,
    minHeight: normalizedMinHeight,
    maxWidth: normalizedMaxWidth,
    maxHeight: normalizedMaxHeight,
  }
}
