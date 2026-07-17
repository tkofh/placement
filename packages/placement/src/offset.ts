import { lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Dimensions } from './dimensions.ts'
import type { Point } from './point.ts'
import { isRecord } from './utils/object.ts'
import { fieldsCoincident } from './utils/tolerance.ts'

const TypeBrand: unique symbol = Symbol('placement/offset')
type TypeBrand = typeof TypeBrand

/**
 * The structural shape of an offset: one number per side, in CSS order —
 * `top`, `right`, `bottom`, `left`.
 *
 * Read-only operations (`equals`) accept any `OffsetLike`, so plain objects
 * compare without constructing. Operations that build new values take the
 * branded `Offset`. `isOffsetLike` is the runtime check for this shape.
 */
export interface OffsetLike {
  /** The top side's value. */
  readonly top: number
  /** The right side's value. */
  readonly right: number
  /** The bottom side's value. */
  readonly bottom: number
  /** The left side's value. */
  readonly left: number
}

/**
 * A per-side quantity in CSS order — `top`, `right`, `bottom`, `left` — the
 * shape of margins, paddings, and insets. What a side means is the consumer's
 * choice: `Rect` reads an `Offset` as insets in `contract` and as outsets in
 * `expand`. Sides pair by axis — `top` and `bottom` along y, `right` and
 * `left` along x — the pairing `offset.xy`, `setX`, and `setY` write.
 *
 * Values are immutable, and constructions are exact IEEE 754: every operation
 * returns a new `Offset` carrying exactly what the arithmetic produced, and
 * `equals` compares within a tolerance instead. Any number is a legal side —
 * negative sides are meaningful (a negative inset expands), and
 * `offset.infinity` carries `Infinity` on all four.
 *
 * Exported type-only: construct through the `offset` factory. Extends
 * `Pipeable`, so operations chain data-last: `o.pipe(add(10), scale(2))`.
 */
class Offset extends Pipeable implements OffsetLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The top side's value. */
  readonly top: number
  /** The right side's value. */
  readonly right: number
  /** The bottom side's value. */
  readonly bottom: number
  /** The left side's value. */
  readonly left: number

  constructor(top: number, right: number, bottom: number, left: number) {
    super()

    this.top = top
    this.right = right
    this.bottom = bottom
    this.left = left
  }

  /**
   * Formats the offset for Node console inspection, as
   * `Offset [top right bottom left]`.
   *
   * @returns The debug string.
   */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Offset [${this.top} ${this.right} ${this.bottom} ${this.left}]`
  }

  /**
   * Serializes the offset for `JSON.stringify`.
   *
   * @returns A plain `{ top, right, bottom, left }` object.
   */
  toJSON() {
    return {
      top: this.top,
      right: this.right,
      bottom: this.bottom,
      left: this.left,
    }
  }
}

export type { Offset }

type OffsetConstructor = {
  /**
   * Creates an offset with `value` on all four sides.
   *
   * @param value - The value for every side.
   * @returns The uniform offset.
   */
  (value: number): Offset

  /**
   * Creates an offset from per-axis values: `x` fills the x-axis sides
   * (`right`, `left`) and `y` the y-axis sides (`top`, `bottom`).
   *
   * @param x - The value for `right` and `left`.
   * @param y - The value for `top` and `bottom`.
   * @returns The per-axis offset.
   * @example
   * ```ts
   * offset.xy(10, 20) // Offset [20 10 20 10]
   * ```
   */
  xy(x: number, y: number): Offset

  /**
   * Creates an offset from one to four values with CSS shorthand fallbacks:
   * a missing `right` or `bottom` mirrors `top`, and a missing `left`
   * mirrors `right`.
   *
   * @param top - The top side.
   * @param right - The right side. Defaults to `top`.
   * @param bottom - The bottom side. Defaults to `top`.
   * @param left - The left side. Defaults to the value used for `right`.
   * @returns The offset.
   * @example
   * ```ts
   * offset.trbl(1) // Offset [1 1 1 1]
   * offset.trbl(1, 2) // Offset [1 2 1 2]
   * offset.trbl(1, 2, 3) // Offset [1 2 3 2]
   * offset.trbl(1, 2, 3, 4) // Offset [1 2 3 4]
   * ```
   */
  trbl(top: number, right?: number, bottom?: number, left?: number): Offset

  /**
   * Creates an offset from a point: `point.x` fills the x-axis sides
   * (`right`, `left`) and `point.y` the y-axis sides (`top`, `bottom`) —
   * `offset.xy(point.x, point.y)`.
   *
   * @param point - The point to read `x` and `y` from.
   * @returns The per-axis offset.
   */
  fromPoint(point: Point): Offset

  /**
   * Creates an offset of half of each dimension per side: `width / 2` on
   * `right` and `left`, `height / 2` on `top` and `bottom`. Expanding a
   * zero-size rect by the result yields a rect of `dimensions` centered on
   * the rect's position.
   *
   * @param dimensions - The dimensions to halve.
   * @returns The half-dimensions offset.
   * @example
   * ```ts
   * offset.fromDimensions(dimensions(100, 50)) // Offset [25 50 25 50]
   * ```
   */
  fromDimensions(dimensions: Dimensions): Offset

  /** The offset with `0` on every side — the identity of `add` and `subtract`. */
  zero: Offset

  /** The offset with `Infinity` on every side. */
  infinity: Offset
}

/**
 * Creates an `Offset` with `value` on all four sides. The other construction
 * forms live on the function itself: `offset.xy`, `offset.trbl`,
 * `offset.fromPoint`, `offset.fromDimensions`, and the constants
 * `offset.zero` and `offset.infinity`.
 *
 * Construction is exact: the sides store exactly the numbers given, with no
 * rounding.
 *
 * @param value - The value for every side.
 * @returns The uniform offset.
 * @example
 * ```ts
 * offset(10) // Offset [10 10 10 10]
 * offset.xy(10, 20) // Offset [20 10 20 10]
 * ```
 */
const offset = ((value: number): Offset =>
  new Offset(value, value, value, value)) as OffsetConstructor

offset.xy = (x: number, y: number) => new Offset(y, x, y, x)

// CSS shorthand fallbacks: bottom mirrors top, left mirrors right.
offset.trbl = (top: number, right?: number, bottom?: number, left?: number) =>
  new Offset(top, right ?? top, bottom ?? top, left ?? right ?? top)

offset.fromPoint = (point: Point) => new Offset(point.y, point.x, point.y, point.x)

offset.fromDimensions = (dimensions: Dimensions) =>
  new Offset(
    dimensions.height * 0.5,
    dimensions.width * 0.5,
    dimensions.height * 0.5,
    dimensions.width * 0.5,
  )

offset.zero = new Offset(0, 0, 0, 0)
offset.infinity = new Offset(
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
)

export { offset }

/**
 * Checks if a value is an `Offset`.
 *
 * True only for values built by the `offset` factory, which carry the brand;
 * a plain `{ top, right, bottom, left }` object fails. For the structural
 * check, use `isOffsetLike`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `Offset`, `false` otherwise.
 */
export const isOffset = (value: unknown): value is Offset => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Checks if a value has the structural shape of an offset: an object with
 * numeric `top`, `right`, `bottom`, and `left`. Every `Offset` passes, and
 * so does any plain object carrying the four sides.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `OffsetLike`, `false` otherwise.
 */
export const isOffsetLike = (value: unknown): value is OffsetLike => {
  return (
    isRecord(value) &&
    typeof value.top === 'number' &&
    typeof value.right === 'number' &&
    typeof value.bottom === 'number' &&
    typeof value.left === 'number'
  )
}

/**
 * Replaces the top side, keeping the other three. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The offset to update.
 * @param top - The new top side.
 * @returns A new `Offset` with `top` replaced.
 */
export const setTop: {
  (self: Offset, top: number): Offset
  (top: number): (self: Offset) => Offset
} = dual(2, (self: Offset, top: number) => new Offset(top, self.right, self.bottom, self.left))

/**
 * Replaces the right side, keeping the other three. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The offset to update.
 * @param right - The new right side.
 * @returns A new `Offset` with `right` replaced.
 */
export const setRight: {
  (self: Offset, right: number): Offset
  (right: number): (self: Offset) => Offset
} = dual(2, (self: Offset, right: number) => new Offset(self.top, right, self.bottom, self.left))

/**
 * Replaces the bottom side, keeping the other three. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The offset to update.
 * @param bottom - The new bottom side.
 * @returns A new `Offset` with `bottom` replaced.
 */
export const setBottom: {
  (self: Offset, bottom: number): Offset
  (bottom: number): (self: Offset) => Offset
} = dual(2, (self: Offset, bottom: number) => new Offset(self.top, self.right, bottom, self.left))

/**
 * Replaces the left side, keeping the other three. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The offset to update.
 * @param left - The new left side.
 * @returns A new `Offset` with `left` replaced.
 */
export const setLeft: {
  (self: Offset, left: number): Offset
  (left: number): (self: Offset) => Offset
} = dual(2, (self: Offset, left: number) => new Offset(self.top, self.right, self.bottom, left))

/**
 * Replaces both x-axis sides (`right` and `left`) with one value, keeping
 * `top` and `bottom`. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The offset to update.
 * @param x - The new value for `right` and `left`.
 * @returns A new `Offset` with both x-axis sides set to `x`.
 */
export const setX: {
  (self: Offset, x: number): Offset
  (x: number): (self: Offset) => Offset
} = dual(2, (self: Offset, x: number) => new Offset(self.top, x, self.bottom, x))

/**
 * Replaces both y-axis sides (`top` and `bottom`) with one value, keeping
 * `right` and `left`. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The offset to update.
 * @param y - The new value for `top` and `bottom`.
 * @returns A new `Offset` with both y-axis sides set to `y`.
 */
export const setY: {
  (self: Offset, y: number): Offset
  (y: number): (self: Offset) => Offset
} = dual(2, (self: Offset, y: number) => new Offset(y, self.right, y, self.left))

/**
 * Adds to every side: a number adds uniformly, an `OffsetLike` adds side
 * by side. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The offset to add to.
 * @param value - A number for every side, or per-side amounts (any `OffsetLike`).
 * @returns The sum.
 * @example
 * ```ts
 * add(offset.trbl(1, 2, 3, 4), 10) // Offset [11 12 13 14]
 * offset(1).pipe(add(offset.trbl(10, 20, 30, 40))) // Offset [11 21 31 41]
 * ```
 */
export const add: {
  (self: Offset, value: number | OffsetLike): Offset
  (value: number | OffsetLike): (self: Offset) => Offset
} = dual(2, (self: Offset, value: number | OffsetLike) =>
  typeof value === 'number'
    ? new Offset(self.top + value, self.right + value, self.bottom + value, self.left + value)
    : new Offset(
        self.top + value.top,
        self.right + value.right,
        self.bottom + value.bottom,
        self.left + value.left,
      ),
)

/**
 * Subtracts from every side: a number subtracts uniformly, an
 * `OffsetLike` subtracts side by side. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The offset to subtract from.
 * @param value - A number for every side, or per-side amounts (any `OffsetLike`).
 * @returns The difference.
 * @example
 * ```ts
 * subtract(offset.trbl(11, 12, 13, 14), 10) // Offset [1 2 3 4]
 * offset(11).pipe(subtract(offset.trbl(1, 2, 3, 4))) // Offset [10 9 8 7]
 * ```
 */
export const subtract: {
  (self: Offset, value: number | OffsetLike): Offset
  (value: number | OffsetLike): (self: Offset) => Offset
} = dual(2, (self: Offset, value: number | OffsetLike) =>
  typeof value === 'number'
    ? new Offset(self.top - value, self.right - value, self.bottom - value, self.left - value)
    : new Offset(
        self.top - value.top,
        self.right - value.right,
        self.bottom - value.bottom,
        self.left - value.left,
      ),
)

/**
 * Multiplies every side by `factor`. Nothing clamps: a negative factor flips
 * every sign. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The offset to scale.
 * @param factor - The multiplier applied to each side.
 * @returns The scaled offset.
 * @example
 * ```ts
 * scale(offset.trbl(1, 2, 3, 4), 2) // Offset [2 4 6 8]
 * offset.trbl(1, 2, 3, 4).pipe(scale(0.5)) // Offset [0.5 1 1.5 2]
 * ```
 */
export const scale: {
  (self: Offset, factor: number): Offset
  (factor: number): (self: Offset) => Offset
} = dual(
  2,
  (self: Offset, factor: number) =>
    new Offset(self.top * factor, self.right * factor, self.bottom * factor, self.left * factor),
)

/**
 * Flips the sign of every side. Not a dual: pass the bare function to
 * `.pipe`.
 *
 * @param self - The offset to negate.
 * @returns The negated offset.
 * @example
 * ```ts
 * negate(offset.trbl(1, -2, 3, -4)) // Offset [-1 2 -3 4]
 * offset.trbl(1, -2, 3, -4).pipe(negate) // Offset [-1 2 -3 4]
 * ```
 */
export const negate = (self: Offset): Offset =>
  new Offset(-self.top, -self.right, -self.bottom, -self.left)

/**
 * Takes the magnitude of every side (`Math.abs`). Not a dual: pass the bare
 * function to `.pipe`.
 *
 * @param self - The offset to take magnitudes of.
 * @returns The offset with every side non-negative.
 * @example
 * ```ts
 * absolute(offset.trbl(1, -2, 3, -4)) // Offset [1 2 3 4]
 * offset.trbl(-1, -2, -3, -4).pipe(absolute) // Offset [1 2 3 4]
 * ```
 */
export const absolute = (self: Offset): Offset =>
  new Offset(Math.abs(self.top), Math.abs(self.right), Math.abs(self.bottom), Math.abs(self.left))

/**
 * Linearly interpolates each side from `self` (at `amount = 0`) toward
 * `target` (at `amount = 1`). `amount` is not clamped: values outside
 * `[0, 1]` extrapolate along the same line. The data-last form omits `self`
 * and returns a function of it.
 *
 * Exact at the endpoints for finite sides. An infinite side makes the
 * opposite endpoint `NaN` (`Infinity * 0`).
 *
 * @param self - The offset at `amount = 0`.
 * @param target - The offset at `amount = 1`.
 * @param amount - The interpolation parameter. Not restricted to `[0, 1]`.
 * @returns Per side, `target * amount + self * (1 - amount)`.
 * @example
 * ```ts
 * lerp(offset(0), offset.trbl(10, 20, 30, 40), 0.5) // Offset [5 10 15 20]
 * offset(0).pipe(lerp(offset.trbl(10, 20, 30, 40), 1)) // Offset [10 20 30 40]
 * ```
 */
export const lerp: {
  (self: Offset, target: Offset, amount: number): Offset
  (target: Offset, amount: number): (self: Offset) => Offset
} = dual(
  3,
  (self: Offset, target: Offset, amount: number) =>
    new Offset(
      lerpNumber(amount, self.top, target.top),
      lerpNumber(amount, self.right, target.right),
      lerpNumber(amount, self.bottom, target.bottom),
      lerpNumber(amount, self.left, target.left),
    ),
)

/**
 * Compares two offsets side by side within the tolerance band of
 * `coincident` from `curvy/number`:
 * `|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)` per side
 * (`1e-10` and `1e-12`). Rounding noise never fails an equality, and the
 * verdict is invariant under uniform scaling of both operands. Non-finite
 * sides compare exactly: an infinite side equals only the same infinity
 * (`offset.infinity` equals itself), and a `NaN` side equals nothing.
 * Like every tolerant comparison, not transitive. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The offset to compare.
 * @param other - The offset, or any offset-shaped object, to compare against.
 * @returns `true` when all four sides coincide within tolerance.
 * @example
 * ```ts
 * equals(offset(0.1 + 0.2), offset(0.3)) // true
 * equals(offset.infinity, offset.infinity) // true
 * offset(1).pipe(equals(offset.trbl(1, 2, 3, 4))) // false
 * ```
 */
export const equals: {
  (self: Offset, other: OffsetLike): boolean
  (other: OffsetLike): (self: Offset) => boolean
} = dual(
  2,
  (self: Offset, other: OffsetLike) =>
    fieldsCoincident(self.top, other.top) &&
    fieldsCoincident(self.right, other.right) &&
    fieldsCoincident(self.bottom, other.bottom) &&
    fieldsCoincident(self.left, other.left),
)
