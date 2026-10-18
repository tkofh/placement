import { Pipeable, dual } from 'curvy/utils'
import { fieldsCoincident } from './utils/tolerance.ts'

const TypeBrand: unique symbol = Symbol('placement/length')
type TypeBrand = typeof TypeBrand

/**
 * The unit of a `Length`: `'px'` for an absolute length, `'%'` for a
 * percentage of a basis that the consumer supplies.
 */
export type Unit = 'px' | '%'

/**
 * What a length field accepts: a plain number, read as pixels, or a
 * `Length`. `Box.make` and `Frame.make` take this type for every inset,
 * size, constraint, and offset.
 */
export type LengthInput = number | Length

/**
 * A length as CSS `<length-percentage>` has it: an absolute value in
 * pixels, or a percentage of a basis that is not known yet. `resolve`
 * turns it into a number once the basis is known.
 *
 * The value is stored as given. A percentage keeps the number before the
 * `%` sign, so `Length.percent(50)` stores `50`, not `0.5`.
 *
 * Values are immutable. The class is exported type-only, so construct a
 * value with `make`, `px`, or `percent`.
 */
class Length extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /**
   * The magnitude: pixels for `'px'`, the number before the `%` sign for
   * `'%'`.
   */
  readonly value: number
  /** The unit that `value` is in. */
  readonly unit: Unit

  constructor(value: number, unit: Unit) {
    super()

    this.value = value
    this.unit = unit
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Length [${this.toString()}]`
  }

  /**
   * Returns the length in CSS notation, such as `'10px'` or `'50%'`.
   *
   * @returns The value followed by its unit.
   */
  override toString(): string {
    return `${this.value}${this.unit}`
  }

  /**
   * Returns the length as a plain record, the shape `JSON.stringify`
   * serializes.
   *
   * @returns The `{ value, unit }` record.
   */
  toJSON(): { readonly value: number; readonly unit: Unit } {
    return { value: this.value, unit: this.unit }
  }
}

export type { Length }

/**
 * Creates a `Length`.
 *
 * @param value - The magnitude: pixels for `'px'`, the number before the
 *   `%` sign for `'%'`.
 * @param unit - The unit. Defaults to `'px'`.
 * @returns An immutable `Length`.
 * @throws `RangeError` when `unit` is neither `'px'` nor `'%'`.
 * @example
 * ```ts
 * Length.make(10) // Length [10px]
 * Length.make(50, '%') // Length [50%]
 * ```
 */
export const make = (value: number, unit: Unit = 'px'): Length => {
  if (unit !== 'px' && unit !== '%') {
    throw new RangeError(`Unknown length unit: ${String(unit)}`)
  }
  return new Length(value, unit)
}

/**
 * Creates an absolute `Length` in pixels, `Length.make(value, 'px')`.
 *
 * @param value - The length in pixels.
 * @returns An immutable `Length`.
 * @example
 * ```ts
 * Length.px(10) // Length [10px]
 * ```
 */
export const px = (value: number): Length => new Length(value, 'px')

/**
 * Creates a percentage `Length`, `Length.make(value, '%')`.
 *
 * @param value - The number before the `%` sign: `50` for half the basis.
 * @returns An immutable `Length`.
 * @example
 * ```ts
 * Length.percent(50) // Length [50%]
 * ```
 */
export const percent = (value: number): Length => new Length(value, '%')

/** The zero length, `Length.px(0)`, a shared constant. */
export const zero: Length = new Length(0, 'px')

/**
 * Checks if a value is a `Length`. It returns `true` only for values built
 * by `make`, `px`, or `percent`, which carry the brand. A plain number is
 * not a `Length`, even though every length field accepts one.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Length`, `false` otherwise.
 */
export const isLength = (value: unknown): value is Length => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Checks if a length input is a percentage, the one kind that needs a basis
 * to resolve. Plain numbers and `'px'` lengths are absolute.
 *
 * @param input - The length input to check.
 * @returns `true` if the input is a `Length` in `'%'`, `false` otherwise.
 * @example
 * ```ts
 * Length.isPercent(Length.percent(50)) // true
 * Length.isPercent(Length.px(50)) // false
 * Length.isPercent(50) // false
 * ```
 */
// Not a type guard: a `false` result must not narrow a `'px'` length to a number.
export const isPercent = (input: LengthInput): boolean => isLength(input) && input.unit === '%'

/**
 * Resolves a length input against a basis. A plain number and a `'px'`
 * length return their value unchanged, without reading `basis`. A
 * percentage returns `basis * value / 100`.
 *
 * The arithmetic is exact IEEE 754 (see PRECISION.md). For an integer
 * basis and an integer percentage, the product is exact, so the result is
 * the correctly rounded quotient. Non-finite inputs propagate: a
 * percentage of a `NaN` basis is `NaN`, and a positive percentage of an
 * infinite basis is infinite. The data-last form omits `self` and returns
 * a function of it.
 *
 * @param self - The length input to resolve.
 * @param basis - The length that `100%` stands for.
 * @returns The length in pixels.
 * @example
 * ```ts
 * Length.resolve(Length.percent(25), 200) // 50
 * Length.resolve(Length.px(10), 200) // 10
 * Length.resolve(10, 200) // 10
 * Length.percent(50).pipe(Length.resolve(300)) // 150
 * ```
 */
export const resolve: {
  (self: LengthInput, basis: number): number
  (basis: number): (self: LengthInput) => number
} = dual(2, (self: LengthInput, basis: number): number => {
  if (typeof self === 'number') {
    return self
  }
  return self.unit === '%' ? (basis * self.value) / 100 : self.value
})

/**
 * Checks whether two lengths are the same, within tolerance. They must
 * share a unit, and their values must coincide. A `'px'` length never
 * equals a percentage, even when one resolves to the other.
 *
 * The values compare through `coincident` from `curvy/number`:
 * `|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)`. Non-finite
 * values compare exactly, so `NaN` equals nothing. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The first length.
 * @param other - The length to compare against.
 * @returns `true` if the units match and the values coincide, `false` otherwise.
 * @example
 * ```ts
 * Length.equals(Length.px(0.1 + 0.2), Length.px(0.3)) // true
 * Length.equals(Length.px(50), Length.percent(50)) // false
 * Length.percent(50).pipe(Length.equals(Length.percent(50))) // true
 * ```
 */
export const equals: {
  (self: Length, other: Length): boolean
  (other: Length): (self: Length) => boolean
} = dual(
  2,
  (self: Length, other: Length): boolean =>
    self.unit === other.unit && fieldsCoincident(self.value, other.value),
)
