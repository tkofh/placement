import { Pipeable, dual } from 'curvy/utils'
import { heightOf, valueOf, widthOf } from './internal/ratio.ts'
import { fieldsCoincident } from './utils/tolerance.ts'

const TypeBrand: unique symbol = Symbol('placement/aspectRatio')
type TypeBrand = typeof TypeBrand

/**
 * What a ratio field accepts: a plain number, read as `width / height`, or
 * an `AspectRatio`. A number `n` behaves exactly as `AspectRatio.make(n, 1)`.
 * `Box.make`, `Frame.make`, and the ratio ops of `Dimensions` take this type.
 */
export type AspectRatioInput = number | AspectRatio

/**
 * A width-to-height ratio as CSS `<ratio>` has it: a numerator over a
 * denominator, such as `16 / 9`.
 *
 * The ratio keeps both numbers instead of their quotient, so a derived
 * extent rounds once. `heightFor` returns `width * denominator / numerator`
 * and `widthFor` returns `height * numerator / denominator`. With the
 * quotient alone, `16 / 9` is already rounded before it scales anything:
 * a height of `7` derives a width of `12.444444444444443` from it, while
 * `7 * 16 / 9` gives the correctly rounded `12.444444444444445`.
 *
 * The fields are not named `width` and `height`, so a ratio is never
 * mistaken for a `DimensionsLike`.
 *
 * Values are immutable. The class is exported type-only, so construct a
 * value with `make`.
 */
class AspectRatio extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The width part, the number before the `/`. */
  readonly numerator: number
  /** The height part, the number after the `/`. */
  readonly denominator: number

  constructor(numerator: number, denominator: number) {
    super()

    this.numerator = numerator
    this.denominator = denominator
  }

  /**
   * The ratio as one number, `numerator / denominator`, by exact IEEE
   * division. A zero denominator gives `Infinity` (or `NaN` over a zero
   * numerator).
   */
  get value(): number {
    return this.numerator / this.denominator
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `AspectRatio [${this.toString()}]`
  }

  /**
   * Returns the ratio in CSS notation, such as `'16 / 9'`.
   *
   * @returns The numerator and the denominator around a slash.
   */
  override toString(): string {
    return `${this.numerator} / ${this.denominator}`
  }

  /**
   * Returns the ratio as a plain record, the shape `JSON.stringify`
   * serializes. `Box.make` and `Frame.make` read the record back as a ratio.
   *
   * @returns The `{ numerator, denominator }` record.
   */
  toJSON(): { readonly numerator: number; readonly denominator: number } {
    return { numerator: this.numerator, denominator: this.denominator }
  }
}

export type { AspectRatio }

/**
 * Creates an `AspectRatio`. One argument is a ratio over `1`.
 *
 * @param numerator - The width part.
 * @param denominator - The height part. Defaults to `1`.
 * @returns An immutable `AspectRatio`.
 * @example
 * ```ts
 * AspectRatio.make(16, 9) // AspectRatio [16 / 9]
 * AspectRatio.make(2) // AspectRatio [2 / 1]
 * ```
 */
export const make = (numerator: number, denominator = 1): AspectRatio =>
  new AspectRatio(numerator, denominator)

/** The square ratio, `AspectRatio.make(1, 1)`, a shared constant. */
export const square: AspectRatio = new AspectRatio(1, 1)

/**
 * Checks if a value is an `AspectRatio`. It returns `true` only for values
 * built by `make`, which carry the brand. A plain number is not an
 * `AspectRatio`, even though every ratio field accepts one.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `AspectRatio`, `false` otherwise.
 */
export const isAspectRatio = (value: unknown): value is AspectRatio => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Returns a ratio input as one number, `width / height`. A number comes
 * back as it is, and an `AspectRatio` as its `value`.
 *
 * @param input - The ratio input.
 * @returns The ratio as a number.
 * @example
 * ```ts
 * AspectRatio.toNumber(AspectRatio.make(3, 2)) // 1.5
 * AspectRatio.toNumber(1.5) // 1.5
 * ```
 */
export const toNumber = (input: AspectRatioInput): number => valueOf(input)

/**
 * Derives the height that a width has at this ratio:
 * `width * denominator / numerator`, or `width / ratio` for a number. Each
 * form rounds once, so a ratio that a number cannot represent exactly
 * (`16 / 9`) still derives a correctly rounded height from an integer
 * width. The product can overflow to `Infinity` where the quotient form
 * would not, but only for extents and ratio parts near `1e308`. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The ratio input.
 * @param width - The width to derive from.
 * @returns The height that gives `width` this ratio.
 * @example
 * ```ts
 * AspectRatio.heightFor(AspectRatio.make(16, 9), 160) // 90
 * AspectRatio.heightFor(2, 100) // 50
 * AspectRatio.make(4, 3).pipe(AspectRatio.heightFor(80)) // 60
 * ```
 */
export const heightFor: {
  (self: AspectRatioInput, width: number): number
  (width: number): (self: AspectRatioInput) => number
} = dual(2, heightOf)

/**
 * Derives the width that a height has at this ratio:
 * `height * numerator / denominator`, or `height * ratio` for a number.
 * Each form rounds once, as in `heightFor`. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The ratio input.
 * @param height - The height to derive from.
 * @returns The width that gives `height` this ratio.
 * @example
 * ```ts
 * AspectRatio.widthFor(AspectRatio.make(16, 9), 7) // 12.444444444444445
 * AspectRatio.widthFor(2, 50) // 100
 * AspectRatio.make(4, 3).pipe(AspectRatio.widthFor(60)) // 80
 * ```
 */
export const widthFor: {
  (self: AspectRatioInput, height: number): number
  (height: number): (self: AspectRatioInput) => number
} = dual(2, widthOf)

/**
 * Checks whether two ratios describe the same shape, within tolerance.
 * Their values compare through `coincident` from `curvy/number`, so
 * `16 / 9` equals `32 / 18`. Non-finite values compare exactly: two
 * ratios with a zero denominator are equal, and a `NaN` ratio equals
 * nothing. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first ratio.
 * @param other - The ratio to compare against.
 * @returns `true` if the values coincide, `false` otherwise.
 * @example
 * ```ts
 * AspectRatio.equals(AspectRatio.make(16, 9), AspectRatio.make(32, 18)) // true
 * AspectRatio.make(4, 3).pipe(AspectRatio.equals(AspectRatio.make(3, 4))) // false
 * ```
 */
export const equals: {
  (self: AspectRatio, other: AspectRatio): boolean
  (other: AspectRatio): (self: AspectRatio) => boolean
} = dual(2, (self: AspectRatio, other: AspectRatio): boolean =>
  fieldsCoincident(self.value, other.value),
)
