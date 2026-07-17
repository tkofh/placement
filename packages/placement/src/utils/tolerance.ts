import { EPSILON, RELATIVE_TOLERANCE, coincident } from 'curvy/number'

/**
 * Compares two fields of a value type for identity, tolerantly for finite
 * pairs and exactly otherwise.
 *
 * Finite pairs use `coincident` from `curvy/number`:
 * `|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)`. That band
 * degenerates when either value is non-finite — `|Inf - Inf|` is `NaN`
 * (an infinity would not equal itself) while `|100 - Inf| <= Inf` holds
 * (an infinity would equal every finite value) — so non-finite pairs fall
 * back to `===`: an infinity equals only the same-signed infinity, and
 * `NaN` equals nothing.
 *
 * Backs the per-field `equals` of every value type (see PRECISION.md).
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
 * Only finite bounds contribute to the relative term — an infinite bound
 * would blow the band up to `Infinity` and accept everything. A
 * half-infinite extent keeps a band scaled to its finite bound, a fully
 * infinite one falls back to the absolute `EPSILON`, and comparisons
 * against the infinite bound itself need no band: every finite value
 * already satisfies `x <= Infinity`.
 *
 * @param min - The lesser bound of the extent under question.
 * @param max - The greater bound of the extent under question.
 * @returns `EPSILON + RELATIVE_TOLERANCE * max(finite magnitudes, or 0)`.
 */
export const boundsTolerance = (min: number, max: number): number =>
  EPSILON + RELATIVE_TOLERANCE * Math.max(finiteMagnitude(min), finiteMagnitude(max))
