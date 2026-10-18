import { clamp as clampNumber, lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type * as AspectRatio from './aspectRatio.ts'
import { heightOf, valueOf, widthOf } from './internal/ratio.ts'
import type { Rect } from './rect.ts'
import { isRecord } from './utils/object.ts'
import { fieldsCoincident } from './utils/tolerance.ts'

const TypeBrand: unique symbol = Symbol('placement/dimensions')
type TypeBrand = typeof TypeBrand

/**
 * The structural shape of a dimensions value: numeric `width` and `height`.
 * `Dimensions` and `Rect` both satisfy it, as does a plain object literal.
 * Inputs that only supply extents, such as the `lerp` target and the
 * `equals` operand, accept any `DimensionsLike`.
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
 * so the extents are never negative. This is a domain rule, not rounding.
 * `abs` is exact, and construction is otherwise exact IEEE 754 arithmetic
 * with no post-processing.
 *
 * Values are immutable. The class is exported type-only, so construct a
 * value with `make`. Every operation in this module also applies data-last through
 * `pipe`: `Dimensions.make(100).pipe(Dimensions.scale(2))`.
 */
class Dimensions extends Pipeable implements DimensionsLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The horizontal extent. Never negative. */
  readonly width: number
  /** The vertical extent. Never negative. */
  readonly height: number

  constructor(width: number, height: number) {
    super()

    // Dimensions are magnitudes. abs is a domain rule, not rounding, and it
    // is exact (see PRECISION.md).
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

/**
 * Creates a `Dimensions` from zero, one, or two extents. No arguments give
 * the zero dimensions, one argument is a square size, and two arguments are
 * the width and the height. Inputs take their magnitude, because dimensions
 * are magnitudes.
 *
 * @example
 * ```ts
 * Dimensions.make() // Dimensions [0x0]
 * Dimensions.make(100) // Dimensions [100x100]
 * Dimensions.make(100, 50) // Dimensions [100x50]
 * Dimensions.make(-100, -50) // Dimensions [100x50]
 * ```
 */
export const make: {
  /**
   * Creates the zero dimensions, `Dimensions.make(0, 0)`.
   *
   * @returns The zero `Dimensions`.
   */
  (): Dimensions
  /**
   * Creates square dimensions. `size` is both extents.
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
} = (a?: number, b?: number): Dimensions => {
  return new Dimensions(a ?? 0, b ?? a ?? 0)
}

/** The 0 by 0 dimensions, a shared constant. */
export const zero: Dimensions = new Dimensions(0, 0)

/**
 * The dimensions with both extents `Infinity`. Use it as an unconstrained
 * upper bound for `clamp`.
 */
export const infinity: Dimensions = new Dimensions(
  Number.POSITIVE_INFINITY,
  Number.POSITIVE_INFINITY,
)

/**
 * Checks if a value is a `Dimensions`.
 *
 * It returns `true` only for values built by `make`, which carry the brand.
 * A plain `{ width, height }` record is not a `Dimensions`. Use
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
 * Dimensions.setWidth(Dimensions.make(100), 200) // Dimensions [200x100]
 * Dimensions.make(100).pipe(Dimensions.setWidth(200)) // Dimensions [200x100]
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
 * Dimensions.setHeight(Dimensions.make(100), 200) // Dimensions [100x200]
 * Dimensions.make(100).pipe(Dimensions.setHeight(200)) // Dimensions [100x200]
 * ```
 */
export const setHeight: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, height: number) => new Dimensions(self.width, height))

// Self can be a Rect, so the predicate routes on the Like shape. The
// data-last form's first argument is always a ratio input, never
// DimensionsLike: an `AspectRatio` has no `width` or `height`.
/**
 * Sets the aspect ratio (`width / height`) as a blend between keeping the
 * width and keeping the height.
 *
 * Two candidates have the requested ratio. One keeps `self`'s width and
 * derives the height (bias 0). The other keeps the height and derives the
 * width (bias 1). A bias between 0 and 1 interpolates the candidates, and
 * every blend still has the requested ratio. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param ratio - The target `width / height` ratio, or an `AspectRatio` (from
 *   `placement/aspectRatio`), which derives the other extent with one rounding.
 * @param bias - The blend from keeping the width (0) to keeping the height (1). Defaults to 0.5.
 * @returns A `Dimensions` with aspect ratio `ratio`.
 * @example
 * ```ts
 * Dimensions.setAspectRatio(Dimensions.make(100), 2, 0) // Dimensions [100x50]
 * Dimensions.setAspectRatio(Dimensions.make(100), 2, 1) // Dimensions [200x100]
 * Dimensions.make(100).pipe(Dimensions.setAspectRatio(2)) // Dimensions [150x75]
 * ```
 */
export const setAspectRatio: {
  (self: Dimensions | Rect, ratio: AspectRatio.AspectRatioInput, bias?: number): Dimensions
  (ratio: AspectRatio.AspectRatioInput, bias?: number): (self: Dimensions | Rect) => Dimensions
} = dual(
  (args) => isDimensionsLike(args[0]),
  (self: Dimensions | Rect, ratio: AspectRatio.AspectRatioInput, bias = 0.5) =>
    // Lerps from keeping the width (bias 0) to keeping the height (bias 1).
    // Every blend still has the requested ratio, because height = width / ratio.
    new Dimensions(
      lerpNumber(bias, self.width, widthOf(ratio, self.height)),
      lerpNumber(bias, heightOf(ratio, self.width), self.height),
    ),
)

/**
 * Clamps the width into `[minWidth, maxWidth]`, keeping the height.
 *
 * If the bounds cross, the minimum wins, as in CSS `clamp()`. The effective
 * upper bound is `max(minWidth, maxWidth)`. The data-last form omits `self`
 * and returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param minWidth - The lower bound on the width.
 * @param maxWidth - The upper bound on the width. Loses to `minWidth` when the bounds cross.
 * @returns A `Dimensions` with the clamped width and `self`'s height.
 * @example
 * ```ts
 * Dimensions.clampWidth(Dimensions.make(250), 100, 200) // Dimensions [200x250]
 * Dimensions.make(50).pipe(Dimensions.clampWidth(100, 200)) // Dimensions [100x50]
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
 * If the bounds cross, the minimum wins, as in CSS `clamp()`. The effective
 * upper bound is `max(minHeight, maxHeight)`. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param minHeight - The lower bound on the height.
 * @param maxHeight - The upper bound on the height. Loses to `minHeight` when the bounds cross.
 * @returns A `Dimensions` with `self`'s width and the clamped height.
 * @example
 * ```ts
 * Dimensions.clampHeight(Dimensions.make(50), 100, 200) // Dimensions [50x100]
 * Dimensions.make(250).pipe(Dimensions.clampHeight(100, 200)) // Dimensions [250x200]
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
 * Clamps both extents at once. Each bound is a number for both axes, or a
 * `Dimensions`/`Rect` with per-axis bounds.
 *
 * The width clamps to the widths of the bounds and the height to their
 * heights, independently. On each axis, if the bounds cross, the minimum
 * wins, as in CSS `clamp()`. The data-last form omits `self` and returns
 * a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param min - The lower bound: a number for both axes, or per-axis extents.
 * @param max - The upper bound, in the same form. Loses to `min` when the bounds cross.
 * @returns A `Dimensions` with both extents clamped.
 * @example
 * ```ts
 * Dimensions.clamp(Dimensions.make(250), 100, 200) // Dimensions [200x200]
 * Dimensions.clamp(Dimensions.make(150), 200, 100) // Dimensions [200x200] (the minimum wins)
 * Dimensions.make(50).pipe(
 *   Dimensions.clamp(Dimensions.make(100, 100), Dimensions.make(200, 200)),
 * ) // Dimensions [100x100]
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
 * Scales the extents by one uniform factor, or by separate x and y factors.
 *
 * The results take their magnitude, so a negative factor acts as its
 * absolute value. `Dimensions.scale(self, -2)` is `Dimensions.scale(self, 2)`.
 * The data-last form omits `self` and returns a function of it, with one or
 * two factors.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param x - The width factor, and the height factor when `y` is omitted.
 * @param y - The height factor. Defaults to `x`.
 * @returns A `Dimensions` with both extents scaled.
 * @example
 * ```ts
 * Dimensions.scale(Dimensions.make(100), 2) // Dimensions [200x200]
 * Dimensions.scale(Dimensions.make(100), 2, 0.5) // Dimensions [200x50]
 * Dimensions.make(100).pipe(Dimensions.scale(2, 0.5)) // Dimensions [200x50]
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
 * Scales both extents by the same factor so that the area becomes `area`.
 * The aspect ratio stays the same. The factor is `sqrt(area / self.area)`.
 *
 * A zero-area `self` returns what IEEE arithmetic produces. The factor is
 * `Infinity`, so a zero extent becomes `NaN` and a nonzero one becomes
 * `Infinity`. The function invents no fallback values. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The source extents. A `Rect` contributes only its width and height.
 * @param area - The target area.
 * @returns A `Dimensions` with `self`'s aspect ratio and, up to floating-point rounding, area `area`.
 * @example
 * ```ts
 * Dimensions.scaleTo(Dimensions.make(100), 40000) // Dimensions [200x200]
 * Dimensions.make(100).pipe(Dimensions.scaleTo(40000)) // Dimensions [200x200]
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
 * Dimensions.scaleToWidth(Dimensions.make(100, 50), 200) // Dimensions [200x100]
 * Dimensions.make(100, 50).pipe(Dimensions.scaleToWidth(200)) // Dimensions [200x100]
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
 * Dimensions.scaleToHeight(Dimensions.make(100, 50), 200) // Dimensions [400x200]
 * Dimensions.make(100, 50).pipe(Dimensions.scaleToHeight(200)) // Dimensions [400x200]
 * ```
 */
export const scaleToHeight: {
  (self: Dimensions | Rect, height: number): Dimensions
  (height: number): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, height: number) => {
  return new Dimensions(self.width * (height / self.height), height)
})

/**
 * Fits an aspect ratio inside `self`. The result is the largest dimensions
 * with the requested `width / height` ratio whose extents do not exceed
 * `self`'s. It is the extents analogue of CSS `object-fit: contain`.
 *
 * A ratio wider than `self`'s keeps the width and shrinks the height. A
 * narrower ratio keeps the height and shrinks the width. A ratio
 * coincident with `self`'s aspect ratio (the same per-field tolerance as
 * `equals`) keeps the exact input extents instead of recomputing them
 * through a division. A degenerate aspect ratio (`Infinity` or `NaN`,
 * from a zero extent) matches only the identical ratio. A zero-extent
 * `self` with a finite positive ratio collapses to the zero dimensions,
 * because nothing larger fits. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The extents to fit inside. A `Rect` contributes only its width and height.
 * @param ratio - The target `width / height` ratio, or an `AspectRatio` (from
 *   `placement/aspectRatio`), which derives the other extent with one rounding.
 * @returns The largest `Dimensions` with ratio `ratio` that fit inside `self`.
 * @example
 * ```ts
 * Dimensions.contain(Dimensions.make(100, 50), 4) // Dimensions [100x25]
 * Dimensions.contain(Dimensions.make(100, 50), 1) // Dimensions [50x50]
 * Dimensions.make(100).pipe(Dimensions.contain(2)) // Dimensions [100x50]
 * ```
 */
export const contain: {
  (self: Dimensions | Rect, ratio: AspectRatio.AspectRatioInput): Dimensions
  (ratio: AspectRatio.AspectRatioInput): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, input: AspectRatio.AspectRatioInput) => {
  const ratio = valueOf(input)
  const aspectRatio = self.width / self.height

  // A coincident ratio keeps the exact input extents instead of
  // round-tripping them through a division. They are rewrapped because self
  // can be a Rect. The check must be finite-only. coincident(x, Infinity) is
  // true for every x, so a plain coincident check freezes zero-height inputs
  // at their input extents.
  if (fieldsCoincident(ratio, aspectRatio)) {
    return new Dimensions(self.width, self.height)
  }

  if (ratio > aspectRatio) {
    return new Dimensions(self.width, heightOf(input, self.width))
  }

  return new Dimensions(widthOf(input, self.height), self.height)
})

/**
 * Covers `self` with an aspect ratio. The result is the smallest dimensions
 * with the requested `width / height` ratio whose extents are at least
 * `self`'s. It is the extents analogue of CSS `object-fit: cover`.
 *
 * A ratio wider than `self`'s keeps the height and grows the width. A
 * narrower ratio keeps the width and grows the height. A ratio coincident
 * with `self`'s aspect ratio (the same per-field tolerance as `equals`)
 * keeps the exact input extents. A degenerate aspect ratio (`Infinity` or
 * `NaN`, from a zero extent) matches only the identical ratio. A
 * zero-extent `self` with a finite positive ratio keeps its nonzero
 * extent and derives the other through the ratio. The result is the
 * smallest covering dimensions. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The extents to cover. A `Rect` contributes only its width and height.
 * @param ratio - The target `width / height` ratio, or an `AspectRatio` (from
 *   `placement/aspectRatio`), which derives the other extent with one rounding.
 * @returns The smallest `Dimensions` with ratio `ratio` that cover `self`.
 * @example
 * ```ts
 * Dimensions.cover(Dimensions.make(100, 50), 4) // Dimensions [200x50]
 * Dimensions.cover(Dimensions.make(100, 50), 1) // Dimensions [100x100]
 * Dimensions.make(100).pipe(Dimensions.cover(2)) // Dimensions [200x100]
 * ```
 */
export const cover: {
  (self: Dimensions | Rect, ratio: AspectRatio.AspectRatioInput): Dimensions
  (ratio: AspectRatio.AspectRatioInput): (self: Dimensions | Rect) => Dimensions
} = dual(2, (self: Dimensions | Rect, input: AspectRatio.AspectRatioInput) => {
  const ratio = valueOf(input)
  const aspectRatio = self.width / self.height

  // The check is finite-only, as in contain. coincident(x, Infinity) is true
  // for every x, so a plain coincident check freezes zero-height inputs at
  // their input extents.
  if (fieldsCoincident(ratio, aspectRatio)) {
    return new Dimensions(self.width, self.height)
  }

  if (ratio > aspectRatio) {
    return new Dimensions(widthOf(input, self.height), self.height)
  }

  return new Dimensions(self.width, heightOf(input, self.width))
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
 * Dimensions.lerp(Dimensions.make(100, 50), Dimensions.make(200, 150), 0.25) // Dimensions [125x75]
 * Dimensions.make(100).pipe(Dimensions.lerp(Dimensions.make(200, 200), 0.5)) // Dimensions [150x150]
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
 * extent equals only `Infinity` (`Dimensions.infinity` equals itself),
 * and a `NaN` extent equals nothing. Like `coincident`, the comparison is
 * not transitive. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The first extents. A `Rect` contributes only its width and height.
 * @param other - The extents to compare against. Any `DimensionsLike` works.
 * @returns `true` if both extents coincide within tolerance, `false` otherwise.
 * @example
 * ```ts
 * Dimensions.equals(Dimensions.make(0.1 + 0.2, 1), Dimensions.make(0.3, 1)) // true
 * Dimensions.equals(Dimensions.make(100, 50), { width: 100, height: 50 }) // true
 * Dimensions.equals(Dimensions.infinity, Dimensions.infinity) // true
 * Dimensions.make(100, 50).pipe(Dimensions.equals(Dimensions.make(100, 50))) // true
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
