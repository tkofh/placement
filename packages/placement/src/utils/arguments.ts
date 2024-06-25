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

export function auto(input: number, fallback: number): number
export function auto(
  input: number,
  negativeFallback: number,
  positiveFallback: number,
): number
export function auto(
  input: number,
  negativeFallback: number,
  positiveFallback: number = negativeFallback,
): number {
  return input === Number.NEGATIVE_INFINITY
    ? negativeFallback
    : input === Number.POSITIVE_INFINITY
      ? positiveFallback
      : input
}
