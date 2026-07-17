import {
  EPSILON,
  RELATIVE_TOLERANCE,
  coincident,
  lerp as lerpNumber,
  minMax,
  normalize as normalizeNumber,
  remap as remapNumber,
} from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import { isRecord } from './utils/object.ts'

const TypeBrand: unique symbol = Symbol('placement/interval')
type TypeBrand = typeof TypeBrand

/**
 * The structural shape of an interval: a numeric `start` and a numeric `size`.
 *
 * Operations that compare or combine two intervals (`join`, `intersect`, `contains`,
 * `intersects`, `equals`, and the targets of `alignTo` and `avoid`) accept an `IntervalLike`
 * for the operand measured against `self`, so a plain `{ start, size }` object works there.
 * The `self` position always requires an `Interval` built by `interval`.
 */
export interface IntervalLike {
  /** The start position of the span. */
  readonly start: number
  /** The signed extent of the span: the end is `start + size`, and negative sizes are legal. */
  readonly size: number
}

/**
 * A one-dimensional span: a `start` position and a signed `size`. The 1D core of placement's
 * layout model.
 *
 * Values are immutable, and construction is exact IEEE 754: the fields hold exactly what the
 * arithmetic produced, with no rounding or normalization. A negative `size` is legal — `end`
 * then lies below `start` — and `min`/`max` expose the orientation-normalized bounds. The
 * predicates (`equals`, `contains`, `intersects`) are tolerance-aware; see `PRECISION.md`.
 *
 * Exported type-only; construct with `interval`. Extends `Pipeable`, so operations chain
 * data-last: `interval(0, 100).pipe(translate(50))`.
 */
class Interval extends Pipeable implements IntervalLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The start position, exactly as constructed. */
  readonly start: number
  /** The signed size, exactly as constructed. Negative sizes are legal. */
  readonly size: number

  constructor(start: number, size: number) {
    super()

    this.start = start
    this.size = size
  }

  /** The position where the span ends: `start + size`. Below `start` when `size` is negative. */
  get end(): number {
    return this.start + this.size
  }

  /** The lesser bound: `start` for a non-negative `size`, `end` otherwise. */
  get min(): number {
    return Math.min(this.start, this.end)
  }

  /** The greater bound: `end` for a non-negative `size`, `start` otherwise. */
  get max(): number {
    return Math.max(this.start, this.end)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Interval [${this.min}, ${this.max}]`
  }

  /**
   * Serializes to the constructor shape, so `JSON.stringify` emits the two stored fields and
   * `interval(json.start, json.size)` reconstructs the value.
   *
   * @returns A plain `{ start, size }` object.
   */
  toJSON() {
    return {
      start: this.start,
      size: this.size,
    }
  }
}

export type { Interval }

/**
 * Creates an `Interval`. Arity selects the construction: no arguments make the zero interval,
 * one argument is a `size` for an interval starting at `0`, and two arguments are `start` and
 * `size`.
 *
 * Construction is exact: the fields store the given values unchanged, and a negative `size` is
 * preserved rather than normalized.
 *
 * @param start - The start position. Defaults to `0` in the zero- and one-argument forms.
 * @param size - The signed size. Defaults to `0` in the zero-argument form.
 * @returns The interval.
 * @example
 * ```ts
 * interval() // interval(0, 0)
 * interval(100) // interval(0, 100)
 * interval(50, 100) // interval(50, 100), ending at 150
 * ```
 */
export const interval: {
  (): Interval
  (size: number): Interval
  (start: number, size: number): Interval
} = (a?: number, b?: number) => {
  return b === undefined ? new Interval(0, a ?? 0) : new Interval(a as number, b)
}

/**
 * Checks if a value is an `Interval`.
 *
 * True only for values built by `interval`, which carry the brand. A plain `{ start, size }`
 * object fails; use `isIntervalLike` for the structural check.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `Interval`, `false` otherwise.
 */
export const isInterval = (value: unknown): value is Interval => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Checks if a value has the structural shape of an interval: a numeric `start` and a numeric
 * `size`. Every `Interval` passes, and so does any plain object with the two fields.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `IntervalLike`, `false` otherwise.
 */
export const isIntervalLike = (value: unknown): value is IntervalLike => {
  return isRecord(value) && typeof value.start === 'number' && typeof value.size === 'number'
}

// Tolerance for boundary decisions, scaled to the magnitudes that enter the
// question (see PRECISION.md).
const boundsTolerance = (min: number, max: number): number =>
  EPSILON + RELATIVE_TOLERANCE * Math.max(Math.abs(min), Math.abs(max))

const targetBounds = (target: number | IntervalLike, gap: number): [number, number] => {
  if (typeof target === 'number') {
    return [target - gap, target + gap]
  }
  const [min, max] = minMax(target.start, target.start + target.size)
  return [min - gap, max + gap]
}

/**
 * Moves the interval so it starts at `start`, preserving its size. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The interval to move.
 * @param start - The new start position.
 * @returns An interval at `start` with `self`'s size.
 * @example
 * ```ts
 * setStart(interval(0, 100), 50) // interval(50, 100)
 * interval(0, 100).pipe(setStart(-50)) // interval(-50, 100)
 * ```
 */
export const setStart: {
  (self: Interval, start: number): Interval
  (start: number): (self: Interval) => Interval
} = dual(2, (self: Interval, start: number) => new Interval(start, self.size))

/**
 * Resizes the interval to `size`, anchored at `origin` — the normalized position within the
 * interval that keeps its place: `0` fixes the start, `0.5` the center, `1` the end. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The interval to resize.
 * @param size - The new size.
 * @param origin - The normalized anchor position. Defaults to `0`.
 * @returns An interval of the given size, starting at `self.start + (self.size - size) * origin`.
 * @example
 * ```ts
 * setSize(interval(0, 100), 50) // interval(0, 50)
 * setSize(interval(0, 100), 50, 0.5) // interval(25, 50)
 * interval(0, 100).pipe(setSize(50, 1)) // interval(50, 50)
 * ```
 */
export const setSize: {
  (self: Interval, size: number, origin?: number): Interval
  (size: number, origin?: number): (self: Interval) => Interval
} = dual(
  (args) => isInterval(args[0]),
  (self: Interval, size: number, origin = 0) =>
    new Interval(self.start + (self.size - size) * origin, size),
)

/**
 * Moves the interval so its end (`start + size`) lands at `end`, preserving its size. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The interval to move.
 * @param end - The new end position.
 * @returns An interval starting at `end - self.size` with `self`'s size.
 * @example
 * ```ts
 * setEnd(interval(0, 100), 50) // interval(-50, 100)
 * ```
 */
export const setEnd: {
  (self: Interval, end: number): Interval
  (end: number): (self: Interval) => Interval
} = dual(2, (self: Interval, end: number) => new Interval(end - self.size, self.size))

/**
 * Shifts the interval by `amount`, preserving its size. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The interval to shift.
 * @param amount - The signed distance to move by.
 * @returns An interval starting at `self.start + amount` with `self`'s size.
 * @example
 * ```ts
 * translate(interval(0, 100), 50) // interval(50, 100)
 * interval(0, 100).pipe(translate(-50)) // interval(-50, 100)
 * ```
 */
export const translate: {
  (self: Interval, amount: number): Interval
  (amount: number): (self: Interval) => Interval
} = dual(2, (self: Interval, amount: number) => new Interval(self.start + amount, self.size))

/**
 * Scales the interval's size by `factor`, anchored at `origin` — the normalized position within
 * the interval that stays fixed: `0` fixes the start, `0.5` the center, `1` the end. A negative
 * factor mirrors the interval about the anchor, producing a negative size. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The interval to scale.
 * @param factor - The size multiplier.
 * @param origin - The normalized anchor position. Defaults to `0`.
 * @returns An interval of size `self.size * factor`, anchored at `origin`.
 * @example
 * ```ts
 * scale(interval(0, 100), 2) // interval(0, 200)
 * interval(0, 100).pipe(scale(2, 1)) // interval(-100, 200)
 * ```
 */
export const scale: {
  (self: Interval, factor: number, origin?: number): Interval
  (factor: number, origin?: number): (self: Interval) => Interval
} = dual(
  (args) => isInterval(args[0]),
  (self: Interval, factor: number, origin = 0) =>
    new Interval(self.start + (self.size - self.size * factor) * origin, self.size * factor),
)

/**
 * Scales the interval's size by `factor` about an absolute `position` on the axis, which stays
 * fixed. Where `scale` anchors at a normalized position within the interval, `scaleFrom`
 * anchors at a coordinate, so one shared `position` scales several intervals in concert. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The interval to scale.
 * @param factor - The size multiplier.
 * @param position - The axis coordinate that stays fixed.
 * @returns An interval starting at `position + (self.start - position) * factor` with size
 * `self.size * factor`.
 * @example
 * ```ts
 * scaleFrom(interval(100, 100), 2, 100) // interval(100, 200)
 * interval(100, 100).pipe(scaleFrom(2, 0)) // interval(200, 200)
 * ```
 */
export const scaleFrom: {
  (self: Interval, factor: number, position: number): Interval
  (factor: number, position: number): (self: Interval) => Interval
} = dual(
  3,
  (self: Interval, factor: number, position: number) =>
    new Interval(position + (self.start - position) * factor, self.size * factor),
)

/**
 * Linearly interpolates from `self` toward `target`, per field: `start` and `size` each move by
 * `amount` along the line between the two intervals. Exact at the endpoints — `0` reproduces
 * `self`'s fields, `1` reproduces `target`'s — and not clamped: values outside `[0, 1]`
 * extrapolate. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The interval at `amount = 0`.
 * @param target - The interval at `amount = 1`.
 * @param amount - The interpolation factor. Not restricted to `[0, 1]`.
 * @returns The interpolated interval.
 * @example
 * ```ts
 * lerp(interval(0, 100), interval(100, 50), 0.5) // interval(50, 75)
 * interval(0, 100).pipe(lerp(interval(100, 100), 1)) // interval(100, 100)
 * ```
 */
export const lerp: {
  (self: Interval, target: Interval, amount: number): Interval
  (target: Interval, amount: number): (self: Interval) => Interval
} = dual(
  3,
  (self: Interval, target: Interval, amount: number) =>
    new Interval(
      lerpNumber(amount, self.start, target.start),
      lerpNumber(amount, self.size, target.size),
    ),
)

/**
 * Expresses the interval in `target`'s normalized coordinate space: `start` maps to its relative
 * position within `target` (`target.start` is `0`, `target.end` is `1`), and `size` becomes the
 * ratio `self.size / target.size`. Not clamped: an interval outside `target` maps outside
 * `[0, 1]`. A zero-size `target` divides by zero, producing IEEE `Infinity` or `NaN`. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The interval to normalize.
 * @param target - The reference interval whose span maps to `[0, 1]`.
 * @returns The normalized interval.
 * @example
 * ```ts
 * normalize(interval(25, 50), interval(0, 100)) // interval(0.25, 0.5)
 * interval(0, 100).pipe(normalize(interval(100, 100))) // interval(-1, 1)
 * ```
 */
export const normalize: {
  (self: Interval, target: Interval): Interval
  (target: Interval): (self: Interval) => Interval
} = dual(
  2,
  (self: Interval, target: Interval) =>
    new Interval(normalizeNumber(self.start, target.start, target.end), self.size / target.size),
)

/**
 * Maps the interval from `source`'s coordinate space to `target`'s: `start` keeps its relative
 * position (`source.start` maps to `target.start`, `source.end` to `target.end`), and `size`
 * scales by `target.size / source.size`. Not clamped. A zero-size `source` divides by zero,
 * producing IEEE `Infinity` or `NaN`. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The interval to remap.
 * @param source - The space `self` is currently expressed in.
 * @param target - The space to express it in.
 * @returns The remapped interval.
 * @example
 * ```ts
 * remap(interval(0, 100), interval(0, 100), interval(100, 100)) // interval(100, 100)
 * interval(0, 50).pipe(remap(interval(100, 100), interval(0, 100))) // interval(-100, 50)
 * ```
 */
export const remap: {
  (self: Interval, source: Interval, target: Interval): Interval
  (source: Interval, target: Interval): (self: Interval) => Interval
} = dual(
  3,
  (self: Interval, source: Interval, target: Interval) =>
    new Interval(
      remapNumber(self.start, source.start, source.end, target.start, target.end),
      remapNumber(self.size, 0, source.size, 0, target.size),
    ),
)

// alignTo and avoid take fixed arities: their target may itself be an
// Interval, so a trailing optional would make 2-argument calls ambiguous
// between the data-first and data-last forms.
/**
 * Positions the interval so its `origin` point coincides with the target, preserving its size.
 * `origin` is a normalized position within the interval: `0` its start, `0.5` its center, `1`
 * its end. A number target is the position itself; an interval target contributes its own
 * `origin` point, so `alignTo(a, b, 1)` puts `a`'s end at `b`'s end. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The interval to position.
 * @param target - The position to align to, or an interval whose `origin` point is that position.
 * @param origin - The normalized alignment point, applied to `self` and to an interval target
 * alike.
 * @returns An interval of `self`'s size, aligned to the target.
 * @example
 * ```ts
 * alignTo(interval(0, 100), 50, 0.5) // interval(0, 100), centered on 50
 * alignTo(interval(0, 100), interval(200, 50), 0) // interval(200, 100)
 * interval(0, 100).pipe(alignTo(50, 1)) // interval(-50, 100), ending at 50
 * ```
 */
export const alignTo: {
  (self: Interval, target: number | IntervalLike, origin: number): Interval
  (target: number | IntervalLike, origin: number): (self: Interval) => Interval
} = dual(3, (self: Interval, target: number | IntervalLike, origin: number) => {
  const position = typeof target === 'number' ? target : target.start + target.size * origin
  return new Interval(position - self.size * origin, self.size)
})

/**
 * Moves the interval clear of a forbidden zone: the target's bounds expanded by `gap` on both
 * sides. An interval already clear of the zone is returned unchanged — the same instance, with
 * touching counting as clear, judged within tolerance (see `PRECISION.md`). An overlapping
 * interval escapes by the smaller shift, landing flush against the zone's nearer edge with its
 * size preserved; ties resolve toward the start. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The interval to move.
 * @param target - The obstacle: a position, or an interval whose bounds define the zone.
 * @param gap - The clearance added on both sides of the target.
 * @returns `self` when already clear; otherwise an interval shifted out of the zone.
 * @example
 * ```ts
 * avoid(interval(0, 100), 50, 0) // interval(-50, 100), the tie resolved toward the start
 * avoid(interval(0, 100), interval(0, 10), 10) // interval(20, 100)
 * interval(200, 50).pipe(avoid(interval(0, 100), 0)) // the same instance, untouched
 * ```
 */
export const avoid: {
  (self: Interval, target: number | IntervalLike, gap: number): Interval
  (target: number | IntervalLike, gap: number): (self: Interval) => Interval
} = dual(3, (self: Interval, target: number | IntervalLike, gap: number) => {
  const [lo, hi] = targetBounds(target, gap)
  const tolerance = boundsTolerance(Math.min(lo, self.min), Math.max(hi, self.max))

  if (self.max <= lo + tolerance || self.min >= hi - tolerance) {
    return self
  }

  // Escape by the smaller shift; ties resolve toward the start.
  const shiftDown = self.max - lo
  const shiftUp = hi - self.min
  return new Interval(self.start + (shiftDown <= shiftUp ? -shiftDown : shiftUp), self.size)
})

/**
 * The smallest interval containing both operands — the enclosing hull of their spans. The
 * result is orientation-normalized: it starts at the combined minimum and its size is
 * non-negative, whatever the operands' signs. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The first interval.
 * @param other - The second interval.
 * @returns The enclosing interval.
 * @example
 * ```ts
 * join(interval(0, 100), interval(150, 50)) // interval(0, 200)
 * interval(0, 100).pipe(join(interval(-50, 25))) // interval(-50, 150)
 * ```
 */
export const join: {
  (self: Interval, other: IntervalLike): Interval
  (other: IntervalLike): (self: Interval) => Interval
} = dual(2, (self: Interval, other: IntervalLike) => {
  const [otherMin, otherMax] = minMax(other.start, other.start + other.size)
  const min = Math.min(self.min, otherMin)
  const max = Math.max(self.max, otherMax)
  return new Interval(min, max - min)
})

/**
 * The overlap of the two intervals. Disjoint operands produce a zero-size interval at the
 * midpoint of the gap between their nearest edges. The result is orientation-normalized: it
 * starts at the overlap's minimum and its size is non-negative, whatever the operands' signs.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first interval.
 * @param other - The second interval.
 * @returns The overlapping interval, or a zero-size interval in the gap when there is none.
 * @example
 * ```ts
 * intersect(interval(0, 100), interval(50, 100)) // interval(50, 50)
 * intersect(interval(0, 100), interval(200, 100)) // interval(150, 0)
 * interval(0, 100).pipe(intersect(interval(50, 100))) // interval(50, 50)
 * ```
 */
export const intersect: {
  (self: Interval, other: IntervalLike): Interval
  (other: IntervalLike): (self: Interval) => Interval
} = dual(2, (self: Interval, other: IntervalLike) => {
  const [otherMin, otherMax] = minMax(other.start, other.start + other.size)
  const min = Math.max(self.min, otherMin)
  const max = Math.min(self.max, otherMax)

  if (min > max) {
    // Disjoint: zero-size interval at the midpoint of the gap between the
    // nearest edges.
    return new Interval((min + max) / 2, 0)
  }

  return new Interval(min, max - min)
})

/**
 * Checks whether the interval contains a position or another interval, boundaries included.
 * The comparison is tolerance-aware: a target within rounding distance of a boundary counts as
 * inside, in a band scaled to `self`'s bounds so the verdict is magnitude-invariant (see
 * `PRECISION.md`). Negative sizes are normalized — containment is judged on `min`/`max` bounds
 * on both sides. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The containing interval.
 * @param target - A position, or an interval that must lie entirely within `self`.
 * @returns `true` if `self` contains the target.
 * @example
 * ```ts
 * contains(interval(0, 100), 100) // true
 * contains(interval(0, 100), interval(50, 100)) // false
 * contains(interval(0, 0.1 + 0.2), 0.3) // true, tolerating boundary noise
 * interval(0, 100).pipe(contains(50)) // true
 * ```
 */
export const contains: {
  (self: Interval, target: number | IntervalLike): boolean
  (target: number | IntervalLike): (self: Interval) => boolean
} = dual(2, (self: Interval, target: number | IntervalLike) => {
  const tolerance = boundsTolerance(self.min, self.max)

  if (typeof target === 'number') {
    return target >= self.min - tolerance && target <= self.max + tolerance
  }

  const [targetMin, targetMax] = minMax(target.start, target.start + target.size)
  return targetMin >= self.min - tolerance && targetMax <= self.max + tolerance
})

/**
 * Checks whether the two intervals overlap, with touching counting: intervals sharing only a
 * boundary intersect. The comparison is tolerance-aware — a gap within rounding distance of
 * zero counts as touching (see `PRECISION.md`) — and orientation-normalized, so negative sizes
 * compare by their `min`/`max` bounds. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The first interval.
 * @param other - The second interval.
 * @returns `true` if the intervals overlap or touch.
 * @example
 * ```ts
 * intersects(interval(0, 100), interval(100, 50)) // true, touching at 100
 * interval(0, 100).pipe(intersects(interval(150, 50))) // false
 * ```
 */
export const intersects: {
  (self: Interval, other: IntervalLike): boolean
  (other: IntervalLike): (self: Interval) => boolean
} = dual(2, (self: Interval, other: IntervalLike) => {
  const [otherMin, otherMax] = minMax(other.start, other.start + other.size)
  const tolerance = boundsTolerance(Math.min(self.min, otherMin), Math.max(self.max, otherMax))
  return self.min <= otherMax + tolerance && self.max >= otherMin - tolerance
})

/**
 * Checks the two intervals for equality, per field: `start` against `start` and `size` against
 * `size`, each within the `coincident` band of `curvy/number` —
 * `|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)` — so rounding noise never separates
 * two computed intervals, at any magnitude (see `PRECISION.md`). Orientation matters: an
 * interval and its negative-size mirror cover the same span but are not equal. Like
 * `coincident`, not transitive. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first interval.
 * @param other - The second interval.
 * @returns `true` if the intervals' fields coincide.
 * @example
 * ```ts
 * equals(interval(0, 100), interval(0, 100)) // true
 * equals(interval(0.1 + 0.2, 1), interval(0.3, 1)) // true
 * interval(0, 100).pipe(equals(interval(0, 101))) // false
 * ```
 */
export const equals: {
  (self: Interval, other: IntervalLike): boolean
  (other: IntervalLike): (self: Interval) => boolean
} = dual(
  2,
  (self: Interval, other: IntervalLike) =>
    coincident(self.start, other.start) && coincident(self.size, other.size),
)
