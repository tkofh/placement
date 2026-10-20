import { EPSILON, RELATIVE_TOLERANCE, coincident } from 'curvy/number'

/**
 * Compares two fields of a value type for identity. Finite pairs compare
 * with a tolerance. All other pairs compare exactly.
 *
 * Finite pairs use `coincident` from `curvy/number`:
 * `|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)`. That band
 * fails when either value is non-finite. `|Inf - Inf|` is `NaN`, so the
 * band rejects an infinity against itself. `|100 - Inf| <= Inf` holds, so
 * the band accepts an infinity against every finite value. Non-finite
 * pairs therefore fall back to `===`. An infinity equals only the infinity
 * with the same sign, and `NaN` equals nothing.
 *
 * The per-field `equals` of every value type uses this function (see
 * PRECISION.md).
 *
 * @param a - The first field.
 * @param b - The second field.
 * @returns `true` when the fields coincide (finite) or are identical (non-finite).
 */
export const fieldsCoincident = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) ? coincident(a, b) : a === b

const finiteMagnitude = (value: number): number => (Number.isFinite(value) ? Math.abs(value) : 0)

/**
 * Computes the tolerance for a boundary decision (`contains`,
 * `intersects`, `avoid`), scaled to the magnitudes that enter the question
 * (see PRECISION.md).
 *
 * Only finite bounds contribute to the relative term. An infinite bound is
 * left out because it turns the band into `Infinity`, which accepts
 * everything. A half-infinite extent keeps a band scaled to its finite
 * bound. A fully infinite extent falls back to the absolute `EPSILON`.
 * Comparisons against the infinite bound itself need no band, because
 * every finite value already satisfies `x <= Infinity`.
 *
 * @param min - The lesser bound of the extent under question.
 * @param max - The greater bound of the extent under question.
 * @returns `EPSILON + RELATIVE_TOLERANCE * max(finite magnitudes, or 0)`.
 */
export const boundsTolerance = (min: number, max: number): number =>
  EPSILON + RELATIVE_TOLERANCE * Math.max(finiteMagnitude(min), finiteMagnitude(max))

// The ordering predicates of the routers. Each decides a discrete question
// about two lengths or coordinates with the `coincident` band, so that noise
// never flips it (see PRECISION.md). `before` and `inside` are strict: they
// hold only beyond the band. `atMost`, `within`, and `touches` are closed:
// they hold within it. `overlaps` asks for more than a point in common, and
// `touches` for a point at least.

/**
 * Whether `a` comes strictly before `b`, beyond the tolerance band.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns `true` when `a < b` and the two do not coincide.
 * @example
 * ```ts
 * before(1, 2) // true
 * before(1, 1 + 1e-13) // false
 * ```
 */
export const before = (a: number, b: number): boolean => a < b && !coincident(a, b)

/**
 * Whether `a` comes at or before `b`, within the tolerance band.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns `true` when `a <= b` or the two coincide.
 * @example
 * ```ts
 * atMost(2, 1) // false
 * atMost(1 + 1e-13, 1) // true
 * ```
 */
export const atMost = (a: number, b: number): boolean => a <= b || coincident(a, b)

/**
 * Whether `x` lies in the closed range from `low` to `high`, within the
 * tolerance band at each end.
 *
 * @param x - The value.
 * @param low - The lesser bound.
 * @param high - The greater bound.
 * @returns `true` when `x` is at or past `low` and at or before `high`.
 * @example
 * ```ts
 * within(0, 0, 1) // true
 * within(1 + 1e-13, 0, 1) // true
 * within(2, 0, 1) // false
 * ```
 */
export const within = (x: number, low: number, high: number): boolean =>
  atMost(low, x) && atMost(x, high)

/**
 * Whether `x` lies strictly inside the range from `low` to `high`, beyond
 * the tolerance band at each end.
 *
 * @param x - The value.
 * @param low - The lesser bound.
 * @param high - The greater bound.
 * @returns `true` when `x` is past `low` and before `high`.
 * @example
 * ```ts
 * inside(0.5, 0, 1) // true
 * inside(0, 0, 1) // false
 * ```
 */
export const inside = (x: number, low: number, high: number): boolean =>
  before(low, x) && before(x, high)

/**
 * Whether two ranges have more than a point in common: ranges that only
 * touch, within the tolerance band, do not overlap. Each range is given as
 * its lesser bound, then its greater. A range without length overlaps one
 * that it lies strictly inside.
 *
 * @param a0 - The lesser bound of the first range.
 * @param a1 - The greater bound of the first range.
 * @param b0 - The lesser bound of the second range.
 * @param b1 - The greater bound of the second range.
 * @returns `true` when each range starts before the other ends.
 * @example
 * ```ts
 * overlaps(0, 2, 1, 3) // true
 * overlaps(0, 1, 1, 2) // false
 * ```
 */
export const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean =>
  before(a0, b1) && before(b0, a1)

/**
 * Whether two ranges have at least a point in common, within the tolerance
 * band: ranges that touch end to end do. Each range is given as its lesser
 * bound, then its greater.
 *
 * @param a0 - The lesser bound of the first range.
 * @param a1 - The greater bound of the first range.
 * @param b0 - The lesser bound of the second range.
 * @param b1 - The greater bound of the second range.
 * @returns `true` when each range starts at or before the other ends.
 * @example
 * ```ts
 * touches(0, 1, 1, 2) // true
 * touches(0, 1, 2, 3) // false
 * ```
 */
export const touches = (a0: number, a1: number, b0: number, b1: number): boolean =>
  atMost(a0, b1) && atMost(b0, a1)
