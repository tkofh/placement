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
