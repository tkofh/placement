import { clamp as clampNumber, lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Rect } from './rect.ts'
import { isRecord } from './utils/object.ts'
import { fieldsCoincident } from './utils/tolerance.ts'

const TypeBrand: unique symbol = Symbol('placement/dimensions')
type TypeBrand = typeof TypeBrand

/**
 * The structural shape of a dimensions value: numeric `width` and `height`.
 * `Dimensions` and `Rect` both satisfy it, as does a plain object literal.
 * Operations that only read extents — the `lerp` target, the `equals`
 * operand — accept any `DimensionsLike`.
 */
export interface DimensionsLike {
  /** The horizontal extent. */
  readonly width: number
  /** The vertical extent. */
  readonly height: number
}

/**
 * A 2D extent: a width and a height, with no position.
 *
 * Dimensions are magnitudes. Construction takes `Math.abs` of both inputs,
 * so the extents are never negative — a domain rule, not rounding: `abs` is
 * exact, and construction is otherwise exact IEEE 754 arithmetic with no
 * post-processing.
 *
 * Values are immutable. The class is exported type-only; construct with the
 * `dimensions` factory. Every operation in this module also applies
 * data-last through `pipe`: `dimensions(100).pipe(scale(2))`.
 */
class Dimensions extends Pipeable implements DimensionsLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The horizontal extent. Never negative. */
  readonly width: number
  /** The vertical extent. Never negative. */
  readonly height: number

  constructor(width: number, height: number) {
    super()

    // Dimensions are magnitudes: abs is a domain rule, not rounding (it is
    // exact — see PRECISION.md).
    this.width = Math.abs(width)
    this.height = Math.abs(height)
  }

  /**
   * The area, as the exact IEEE product `width * height`.
   */
  get area(): number {
    return this.width * this.height
  }

  /**
   * The ratio of width to height, as the exact IEEE quotient
   * `width / height`.
   *
   * Degenerate divisions return what IEEE produces: `Infinity` when only
   * the height is zero, `0` when only the width is zero, and `NaN` when
   * both are.
   */
  get aspectRatio(): number {
    return this.width / this.height
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Dimensions [${this.width}x${this.height}]`
  }

  /**
   * Returns the extents as a plain record, the shape `JSON.stringify`
   * serializes.
   *
   * @returns The `{ width, height }` record.
   */
  toJSON() {
    return {
      width: this.width,
      height: this.height,
    }
  }
}

export type { Dimensions }

interface DimensionsConstructor {
  /**
   * Creates the zero dimensions, `dimensions(0, 0)`.
   *
   * @returns The zero `Dimensions`.
   */
  (): Dimensions
  /**
   * Creates square dimensions: `size` is both extents.
   *
   * @param size - The width and the height. Takes its magnitude.
   * @returns The square `Dimensions`.
   */
  (size: number): Dimensions
  /**
   * Creates dimensions from a width and a height.
   *
   * @param width - The horizontal extent. Takes its magnitude.
   * @param height - The vertical extent. Takes its magnitude.
   * @returns The `Dimensions`.
   */
  (width: number, height: number): Dimensions

  /** The 0 by 0 dimensions, a shared constant. */
  zero: Dimensions
  /**
   * The dimensions with both extents `Infinity` — an unconstrained upper
   * bound for `clamp`.
   */
  infinity: Dimensions
}

/**
 * Creates a `Dimensions` from zero, one, or two extents: no arguments is
 * the zero dimensions, one argument is a square size, and two arguments are
 * the width and the height. Inputs take their magnitude (dimensions are
 * magnitudes).
 *
 * Carries two constants: `dimensions.zero` and `dimensions.infinity`.
 *
 * @example
 * ```ts
 * dimensions() // Dimensions [0x0]
 * dimensions(100) // Dimensions [100x100]
 * dimensions(100, 50) // Dimensions [100x50]
 * dimensions(-100, -50) // Dimensions [100x50]
 * ```
 */
const dimensions = ((a?: number, b?: number): Dimensions => {
  return new Dimensions(a ?? 0, b ?? a ?? 0)
}) as DimensionsConstructor

dimensions.zero = new Dimensions(0, 0)
dimensions.infinity = new Dimensions(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)

export { dimensions }

/**
 * Checks if a value is a `Dimensions`.
 *
 * True only for values built by the `dimensions` factory, which carry the
 * brand. A plain `{ width, height }` record is not a `Dimensions`; use
 * `isDimensionsLike` for the structural check.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Dimensions`, `false` otherwise.
 */
export const isDimensions = (value: unknown): value is Dimensions => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Checks if a value is structurally usable as extents: a record with
 * numeric `width` and `height`. `Dimensions` and `Rect` values pass, as do
 * plain records.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `DimensionsLike`, `false` otherwise.
 */
export const isDimensionsLike = (value: unknown): value is DimensionsLike => {
  return isRecord(value) && typeof value.width === 'number' && typeof value.height === 'number'
}

/**
 * Replaces the width, keeping the height. The data-last form omits `self`
 * and returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param width - The new width. Takes its magnitude.
 * @returns A `Dimensions` with the new width and `self`'s height.
 * @example
 * ```ts
 * setWidth(dimensions(100), 200) // Dimensions [200x100]
 * dimensions(100).pipe(setWidth(200)) // Dimensions [200x100]
 * ```
 */
export const setWidth: {
  (self: Dimensions | Rect, width: number): Dimensions
  (width: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, width: number) => new Dimensions(width, self.height))

/**
 * Replaces the height, keeping the width. The data-last form omits `self`
 * and returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param height - The new height. Takes its magnitude.
 * @returns A `Dimensions` with `self`'s width and the new height.
 * @example
 * ```ts
 * setHeight(dimensions(100), 200) // Dimensions [100x200]
 * dimensions(100).pipe(setHeight(200)) // Dimensions [100x200]
 * ```
 */
export const setHeight: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, height: number) => new Dimensions(self.width, height))

// Self may be a Rect, so the predicate routes on the Like shape; the
// data-last form's first argument is always a number, never DimensionsLike.
/**
 * Sets the aspect ratio (`width / height`), blending between keeping the
 * width and keeping the height.
 *
 * Two candidates have the requested ratio: keep `self`'s width and derive
 * the height (bias 0), or keep the height and derive the width (bias 1).
 * Intermediate biases interpolate the candidates, and every blend still has
 * the requested ratio. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param ratio - The target `width / height` ratio.
 * @param bias - The blend from keeping the width (0) to keeping the height (1). Defaults to 0.5.
 * @returns A `Dimensions` with aspect ratio `ratio`.
 * @example
 * ```ts
 * setAspectRatio(dimensions(100), 2, 0) // Dimensions [100x50]
 * setAspectRatio(dimensions(100), 2, 1) // Dimensions [200x100]
 * dimensions(100).pipe(setAspectRatio(2)) // Dimensions [150x75]
 * ```
 */
export const setAspectRatio: {
  (self: Dimensions | Rect, ratio: number, bias?: number): Dimensions
  (ratio: number, bias?: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  (args) => isDimensionsLike(args[0]),
  (self: Dimensions | Rect, ratio: number, bias = 0.5) =>
    // Lerps from keeping the width (bias 0) to keeping the height (bias 1);
    // every blend still has the requested ratio, since height = width / ratio.
    new Dimensions(
      lerpNumber(bias, self.width, self.height * ratio),
      lerpNumber(bias, self.width / ratio, self.height),
    ),
)

/**
 * Clamps the width into `[minWidth, maxWidth]`, keeping the height.
 *
 * The minimum wins when the bounds cross, as in CSS `clamp()`: the
 * effective upper bound is `max(minWidth, maxWidth)`. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param minWidth - The lower bound on the width.
 * @param maxWidth - The upper bound on the width. Loses to `minWidth` when the bounds cross.
 * @returns A `Dimensions` with the clamped width and `self`'s height.
 * @example
 * ```ts
 * clampWidth(dimensions(250), 100, 200) // Dimensions [200x250]
 * dimensions(50).pipe(clampWidth(100, 200)) // Dimensions [100x50]
 * ```
 */
export const clampWidth: {
  (self: Dimensions | Rect, minWidth: number, maxWidth: number): Dimensions
  (minWidth: number, maxWidth: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  // The minimum wins when the bounds cross (CSS clamp semantics).
  (self: Dimensions | Rect, minWidth: number, maxWidth: number) =>
    new Dimensions(clampNumber(self.width, minWidth, Math.max(minWidth, maxWidth)), self.height),
)

/**
 * Clamps the height into `[minHeight, maxHeight]`, keeping the width.
 *
 * The minimum wins when the bounds cross, as in CSS `clamp()`: the
 * effective upper bound is `max(minHeight, maxHeight)`. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param minHeight - The lower bound on the height.
 * @param maxHeight - The upper bound on the height. Loses to `minHeight` when the bounds cross.
 * @returns A `Dimensions` with `self`'s width and the clamped height.
 * @example
 * ```ts
 * clampHeight(dimensions(50), 100, 200) // Dimensions [50x100]
 * dimensions(250).pipe(clampHeight(100, 200)) // Dimensions [250x200]
 * ```
 */
export const clampHeight: {
  (self: Dimensions | Rect, minHeight: number, maxHeight: number): Dimensions
  (minHeight: number, maxHeight: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, minHeight: number, maxHeight: number) =>
    new Dimensions(self.width, clampNumber(self.height, minHeight, Math.max(minHeight, maxHeight))),
)

/**
 * Clamps both extents at once. Each bound is a number, applied to both
 * axes, or a `Dimensions`/`Rect` supplying per-axis bounds.
 *
 * The width is clamped into the bounds' widths and the height into their
 * heights, independently. The minimum wins on each axis when the bounds
 * cross, as in CSS `clamp()`. The data-last form omits `self` and returns
 * a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param min - The lower bound: a number for both axes, or per-axis extents.
 * @param max - The upper bound, likewise. Loses to `min` when the bounds cross.
 * @returns A `Dimensions` with both extents clamped.
 * @example
 * ```ts
 * clamp(dimensions(250), 100, 200) // Dimensions [200x200]
 * clamp(dimensions(150), 200, 100) // Dimensions [200x200] (the minimum wins)
 * dimensions(50).pipe(clamp(dimensions(100, 100), dimensions(200, 200))) // Dimensions [100x100]
 * ```
 */
export const clamp: {
  (
    self: Dimensions | Rect,
    min: Dimensions | Rect | number,
    max: Dimensions | Rect | number,
  ): Dimensions
  (
    min: Dimensions | Rect | number,
    max: Dimensions | Rect | number,
  ): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, min: Dimensions | Rect | number, max: Dimensions | Rect | number) => {
    const minWidth = typeof min === 'number' ? min : min.width
    const minHeight = typeof min === 'number' ? min : min.height
    const maxWidth = typeof max === 'number' ? max : max.width
    const maxHeight = typeof max === 'number' ? max : max.height
    // The minimum wins when the bounds cross (CSS clamp semantics).
    return new Dimensions(
      clampNumber(self.width, minWidth, Math.max(minWidth, maxWidth)),
      clampNumber(self.height, minHeight, Math.max(minHeight, maxHeight)),
    )
  },
)

/**
 * Scales the extents by a factor: one uniform factor, or separate x and y
 * factors.
 *
 * The results take their magnitude, so a negative factor acts as its
 * absolute value: `scale(self, -2)` is `scale(self, 2)`. The data-last
 * form omits `self` and returns a function of it, with one or two factors.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param x - The width factor, and the height factor when `y` is omitted.
 * @param y - The height factor. Defaults to `x`.
 * @returns A `Dimensions` with both extents scaled.
 * @example
 * ```ts
 * scale(dimensions(100), 2) // Dimensions [200x200]
 * scale(dimensions(100), 2, 0.5) // Dimensions [200x50]
 * dimensions(100).pipe(scale(2, 0.5)) // Dimensions [200x50]
 * ```
 */
export const scale: {
  (self: Dimensions | Rect, scale: number): Dimensions
  (self: Dimensions | Rect, x: number, y: number): Dimensions
  (scale: number): (self: Dimensions | Rect) => Dimensions
  (x: number, y: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  (args) => isDimensionsLike(args[0]),
  (self: Dimensions | Rect, x: number, y?: number) =>
    new Dimensions(self.width * x, self.height * (y ?? x)),
)

/**
 * Scales both extents by the same factor so the area becomes `area`,
 * preserving the aspect ratio. The factor is `sqrt(area / self.area)`.
 *
 * A zero-area `self` returns what IEEE arithmetic produces: the factor is
 * `Infinity`, so a zero extent becomes `NaN` and a nonzero one `Infinity`.
 * No fallback values are invented. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param area - The target area.
 * @returns A `Dimensions` with `self`'s aspect ratio and, up to floating-point rounding, area `area`.
 * @example
 * ```ts
 * scaleTo(dimensions(100), 40000) // Dimensions [200x200]
 * dimensions(100).pipe(scaleTo(40000)) // Dimensions [200x200]
 * ```
 */
export const scaleTo: {
  (self: Dimensions | Rect, area: number): Dimensions
  (area: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, area: number) => {
  const factor = Math.sqrt(area / (self.width * self.height))
  return new Dimensions(self.width * factor, self.height * factor)
})

/**
 * Scales `self` proportionally so its width becomes `width`.
 *
 * The height scales by the same factor, `width / self.width`. A zero-width
 * `self` returns the IEEE result: an `Infinity` height, or `NaN` when the
 * height is zero too. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param width - The target width. Takes its magnitude.
 * @returns A `Dimensions` with the target width and a proportionally scaled height.
 * @example
 * ```ts
 * scaleToWidth(dimensions(100, 50), 200) // Dimensions [200x100]
 * dimensions(100, 50).pipe(scaleToWidth(200)) // Dimensions [200x100]
 * ```
 */
export const scaleToWidth: {
  (self: Dimensions | Rect, width: number): Dimensions
  (width: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, width: number) => {
  return new Dimensions(width, self.height * (width / self.width))
})

/**
 * Scales `self` proportionally so its height becomes `height`.
 *
 * The width scales by the same factor, `height / self.height`. A
 * zero-height `self` returns the IEEE result: an `Infinity` width, or
 * `NaN` when the width is zero too. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param height - The target height. Takes its magnitude.
 * @returns A `Dimensions` with a proportionally scaled width and the target height.
 * @example
 * ```ts
 * scaleToHeight(dimensions(100, 50), 200) // Dimensions [400x200]
 * dimensions(100, 50).pipe(scaleToHeight(200)) // Dimensions [400x200]
 * ```
 */
export const scaleToHeight: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, height: number) => {
  return new Dimensions(self.width * (height / self.height), height)
})

/**
 * Fits an aspect ratio inside `self`: the largest dimensions with the
 * requested `width / height` ratio whose extents do not exceed `self`'s —
 * the extents analogue of CSS `object-fit: contain`.
 *
 * A ratio wider than `self`'s keeps the width and shrinks the height. A
 * narrower ratio keeps the height and shrinks the width. A ratio
 * coincident with `self`'s aspect ratio (the same per-field tolerance as
 * `equals`) keeps the exact input extents instead of recomputing them
 * through a division; a degenerate aspect ratio (`Infinity` or `NaN`,
 * from a zero extent) matches only the identical ratio. A zero-extent
 * `self` with a finite positive ratio collapses to the zero dimensions —
 * nothing larger fits. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The extents to fit inside. A `Rect` contributes only its width and height.
 * @param ratio - The target `width / height` ratio.
 * @returns The largest `Dimensions` with ratio `ratio` that fit inside `self`.
 * @example
 * ```ts
 * contain(dimensions(100, 50), 4) // Dimensions [100x25]
 * contain(dimensions(100, 50), 1) // Dimensions [50x50]
 * dimensions(100).pipe(contain(2)) // Dimensions [100x50]
 * ```
 */
export const contain: {
  (self: Dimensions | Rect, ratio: number): Dimensions
  (ratio: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, ratio: number) => {
  const aspectRatio = self.width / self.height

  // A coincident ratio keeps the exact input extents (rewrapped: self may
  // be a Rect) rather than round-tripping them through a division. The
  // finite-only check matters: coincident(x, Infinity) is true for every x,
  // which would freeze zero-height inputs at their input extents.
  if (fieldsCoincident(ratio, aspectRatio)) {
    return new Dimensions(self.width, self.height)
  }

  if (ratio > aspectRatio) {
    return new Dimensions(self.width, self.width / ratio)
  }

  return new Dimensions(self.height * ratio, self.height)
})

/**
 * Covers `self` with an aspect ratio: the smallest dimensions with the
 * requested `width / height` ratio whose extents are at least `self`'s —
 * the extents analogue of CSS `object-fit: cover`.
 *
 * A ratio wider than `self`'s keeps the height and grows the width. A
 * narrower ratio keeps the width and grows the height. A ratio coincident
 * with `self`'s aspect ratio (the same per-field tolerance as `equals`)
 * keeps the exact input extents; a degenerate aspect ratio (`Infinity` or
 * `NaN`, from a zero extent) matches only the identical ratio. A
 * zero-extent `self` with a finite positive ratio keeps its nonzero
 * extent and derives the other through the ratio — the smallest covering
 * dimensions. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The extents to cover. A `Rect` contributes only its width and height.
 * @param ratio - The target `width / height` ratio.
 * @returns The smallest `Dimensions` with ratio `ratio` that cover `self`.
 * @example
 * ```ts
 * cover(dimensions(100, 50), 4) // Dimensions [200x50]
 * cover(dimensions(100, 50), 1) // Dimensions [100x100]
 * dimensions(100).pipe(cover(2)) // Dimensions [200x100]
 * ```
 */
export const cover: {
  (self: Dimensions | Rect, ratio: number): Dimensions
  (ratio: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, ratio: number) => {
  const aspectRatio = self.width / self.height

  // Finite-only coincidence, as in contain: coincident(x, Infinity) is true
  // for every x, which would freeze zero-height inputs at their input
  // extents.
  if (fieldsCoincident(ratio, aspectRatio)) {
    return new Dimensions(self.width, self.height)
  }

  if (ratio > aspectRatio) {
    return new Dimensions(self.height * ratio, self.height)
  }

  return new Dimensions(self.width, self.width / ratio)
})

/**
 * Interpolates linearly from `self` toward `target`, per extent.
 *
 * An `amount` of 0 returns `self`'s extents and 1 returns `target`'s.
 * Values between blend each extent independently. The amount is not
 * clamped. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The starting extents. A `Rect` contributes only its width and height.
 * @param target - The destination extents. Any `DimensionsLike` works.
 * @param amount - The interpolation parameter: 0 is `self`, 1 is `target`.
 * @returns A `Dimensions` with both extents interpolated.
 * @example
 * ```ts
 * lerp(dimensions(100, 50), dimensions(200, 150), 0.25) // Dimensions [125x75]
 * dimensions(100).pipe(lerp(dimensions(200, 200), 0.5)) // Dimensions [150x150]
 * ```
 */
export const lerp: {
  (self: Dimensions | Rect, target: DimensionsLike, amount: number): Dimensions
  (target: DimensionsLike, amount: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  3,
  (self: Dimensions | Rect, target: DimensionsLike, amount: number) =>
    new Dimensions(
      lerpNumber(amount, self.width, target.width),
      lerpNumber(amount, self.height, target.height),
    ),
)

/**
 * Checks whether two values describe the same extents, within tolerance.
 *
 * Each extent pair is judged by `coincident` from `curvy/number`: equal
 * when `|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)`, with
 * `EPSILON = 1e-10` and `RELATIVE_TOLERANCE = 1e-12`. The band absorbs
 * rounding noise at any magnitude, so uniformly scaling both values never
 * changes the verdict. Non-finite extents compare exactly: an infinite
 * extent equals only `Infinity` (`dimensions.infinity` equals itself),
 * and a `NaN` extent equals nothing. Like `coincident`, the comparison is
 * not transitive. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The first extents. A `Rect` contributes only its width and height.
 * @param other - The extents to compare against. Any `DimensionsLike` works.
 * @returns `true` if both extents coincide within tolerance, `false` otherwise.
 * @example
 * ```ts
 * equals(dimensions(0.1 + 0.2, 1), dimensions(0.3, 1)) // true
 * equals(dimensions(100, 50), { width: 100, height: 50 }) // true
 * equals(dimensions.infinity, dimensions.infinity) // true
 * dimensions(100, 50).pipe(equals(dimensions(100, 50))) // true
 * ```
 */
export const equals: {
  (self: Dimensions | Rect, other: DimensionsLike): boolean
  (other: DimensionsLike): (self: Dimensions | Rect) => boolean
} = dual(
  2,
  (self: Dimensions | Rect, other: DimensionsLike) =>
    fieldsCoincident(self.width, other.width) && fieldsCoincident(self.height, other.height),
)
