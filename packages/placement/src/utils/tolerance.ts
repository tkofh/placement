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
