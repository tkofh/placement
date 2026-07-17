import { clamp } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import * as Rect from './rect.ts'
import { normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/box')
type TypeBrand = typeof TypeBrand

/**
 * The construction input for `make`. Every field is optional, passing
 * `undefined` is the same as omitting the field, and — unlike `Frame`,
 * where a non-finite size is a literal infinite preference — any non-finite
 * value acts as unset.
 *
 * Unset means different things per group. An unset inset is auto: it
 * neither anchors nor shrinks its axis. Unset sizing fields stay unset
 * until `apply` resolves them against a parent (see `apply` for the
 * resolution order). Unset constraints default to `0` (minimums) and
 * `Infinity` (maximums).
 */
export interface BoxInput {
  /**
   * The gap between the parent's top edge and the box — `top` in CSS
   * absolute positioning. When set, it anchors the vertical position;
   * together with `bottom` it also determines an unset height. Unset when
   * omitted or non-finite.
   */
  readonly top?: number | undefined
  /**
   * The gap between the box and the parent's right edge — `right` in CSS
   * absolute positioning. When set with `top`-side anchoring absent, the
   * box anchors to the right edge; together with `left` it also determines
   * an unset width. Unset when omitted or non-finite.
   */
  readonly right?: number | undefined
  /**
   * The gap between the box and the parent's bottom edge — `bottom` in CSS
   * absolute positioning. When set with `top` unset, the box anchors to
   * the bottom edge; together with `top` it also determines an unset
   * height. Unset when omitted or non-finite.
   */
  readonly bottom?: number | undefined
  /**
   * The gap between the parent's left edge and the box — `left` in CSS
   * absolute positioning. When set, it anchors the horizontal position;
   * together with `right` it also determines an unset width. Unset when
   * omitted or non-finite.
   */
  readonly left?: number | undefined
  /**
   * The preferred width. Unset when omitted or non-finite: the resolved
   * width then derives from the horizontal insets, the height and
   * `aspectRatio`, or fills the parent (see `apply`).
   */
  readonly width?: number | undefined
  /**
   * The preferred height. Unset when omitted or non-finite: the resolved
   * height then derives from the vertical insets, the width and
   * `aspectRatio`, or fills the parent (see `apply`).
   */
  readonly height?: number | undefined
  /**
   * The width-to-height ratio (`width / height`) that derives whichever
   * dimension neither an explicit size nor a pair of insets determines.
   * Non-positive and non-finite ratios act as unset. Unset when omitted.
   */
  readonly aspectRatio?: number | undefined
  /**
   * The lower bound on the resolved width. Negative values clamp to `0`.
   * Defaults to `0`; non-finite values act as unset.
   */
  readonly minWidth?: number | undefined
  /**
   * The lower bound on the resolved height. Negative values clamp to `0`.
   * Defaults to `0`; non-finite values act as unset.
   */
  readonly minHeight?: number | undefined
  /**
   * The upper bound on the resolved width. Negative values clamp to `0`,
   * and `minWidth` wins when the bounds cross, as in CSS `clamp()`.
   * Defaults to `Infinity` (unconstrained); non-finite values act as unset.
   */
  readonly maxWidth?: number | undefined
  /**
   * The upper bound on the resolved height. Negative values clamp to `0`,
   * and `minHeight` wins when the bounds cross, as in CSS `clamp()`.
   * Defaults to `Infinity` (unconstrained); non-finite values act as unset.
   */
  readonly maxHeight?: number | undefined
}

/**
 * A positioned-box spec: the inset, sizing, and constraint inputs `apply`
 * resolves against a parent rect — the absolute-positioning counterpart to
 * the flex pair `Frame`/`Flexbox.apply`. A box carries no position of its
 * own; `apply` produces `Rect`s.
 *
 * Values are immutable — every setter returns a new box — and every input
 * is stored raw, with unset-ness preserved: the setters rebuild from the
 * raw inputs, so a dimension left to derive keeps re-deriving after any
 * setter, and `apply` re-resolves against each parent it is given.
 *
 * Created by `make`.
 */
class Box extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly #top: number | undefined
  readonly #right: number | undefined
  readonly #bottom: number | undefined
  readonly #left: number | undefined
  readonly #width: number | undefined
  readonly #height: number | undefined
  readonly #aspectRatio: number | undefined
  readonly #minWidth: number | undefined
  readonly #minHeight: number | undefined
  readonly #maxWidth: number | undefined
  readonly #maxHeight: number | undefined

  constructor(input: BoxInput) {
    super()

    // `?? undefined` also catches the `null`s of a JSON round trip.
    this.#top = input.top ?? undefined
    this.#right = input.right ?? undefined
    this.#bottom = input.bottom ?? undefined
    this.#left = input.left ?? undefined
    this.#width = input.width ?? undefined
    this.#height = input.height ?? undefined
    this.#aspectRatio = input.aspectRatio ?? undefined
    this.#minWidth = input.minWidth ?? undefined
    this.#minHeight = input.minHeight ?? undefined
    this.#maxWidth = input.maxWidth ?? undefined
    this.#maxHeight = input.maxHeight ?? undefined
  }

  /**
   * The raw top inset: `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get top(): number {
    return this.#top ?? Number.NaN
  }

  /**
   * The raw right inset: `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get right(): number {
    return this.#right ?? Number.NaN
  }

  /**
   * The raw bottom inset: `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get bottom(): number {
    return this.#bottom ?? Number.NaN
  }

  /**
   * The raw left inset: `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get left(): number {
    return this.#left ?? Number.NaN
  }

  /**
   * The raw preferred width: `NaN` when unset. Any non-finite value acts
   * as unset in `apply`, which resolves the used width against a parent.
   */
  get width(): number {
    return this.#width ?? Number.NaN
  }

  /**
   * The raw preferred height: `NaN` when unset. Any non-finite value acts
   * as unset in `apply`, which resolves the used height against a parent.
   */
  get height(): number {
    return this.#height ?? Number.NaN
  }

  /**
   * The raw width-to-height ratio: `NaN` when unset. Non-positive and
   * non-finite ratios act as unset in `apply`.
   */
  get aspectRatio(): number {
    return this.#aspectRatio ?? Number.NaN
  }

  /**
   * The effective lower bound on the resolved width: the raw input clamped
   * to `>= 0`, and `0` when unset or non-finite.
   */
  get minWidth(): number {
    const raw = this.#minWidth ?? 0
    return Number.isFinite(raw) ? Math.max(raw, 0) : 0
  }

  /**
   * The effective lower bound on the resolved height: the raw input
   * clamped to `>= 0`, and `0` when unset or non-finite.
   */
  get minHeight(): number {
    const raw = this.#minHeight ?? 0
    return Number.isFinite(raw) ? Math.max(raw, 0) : 0
  }

  /**
   * The effective upper bound on the resolved width: the raw input clamped
   * to `>= 0`, and `Infinity` when unset or non-finite. Raised to
   * `minWidth` when the bounds cross — the minimum wins, as in CSS
   * `clamp()`.
   */
  get maxWidth(): number {
    const raw = this.#maxWidth ?? Number.POSITIVE_INFINITY
    return Number.isFinite(raw) ? Math.max(raw, this.minWidth) : Number.POSITIVE_INFINITY
  }

  /**
   * The effective upper bound on the resolved height: the raw input
   * clamped to `>= 0`, and `Infinity` when unset or non-finite. Raised to
   * `minHeight` when the bounds cross — the minimum wins, as in CSS
   * `clamp()`.
   */
  get maxHeight(): number {
    const raw = this.#maxHeight ?? Number.POSITIVE_INFINITY
    return Number.isFinite(raw) ? Math.max(raw, this.minHeight) : Number.POSITIVE_INFINITY
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Box [t:${this.top} r:${this.right} b:${this.bottom} l:${this.left} | ${this.width} x ${this.height}]`
  }

  /**
   * Returns the box's raw inputs: unset fields come back `undefined`,
   * never a sentinel. Under `JSON.stringify`, unset fields drop out and
   * non-finite values become `null`, which `make` reads back as unset — a
   * JSON round trip preserves every meaning.
   *
   * @returns The raw input record, of the shape `make` accepts.
   */
  toJSON() {
    return {
      top: this.#top,
      right: this.#right,
      bottom: this.#bottom,
      left: this.#left,
      width: this.#width,
      height: this.#height,
      aspectRatio: this.#aspectRatio,
      minWidth: this.#minWidth,
      minHeight: this.#minHeight,
      maxWidth: this.#maxWidth,
      maxHeight: this.#maxHeight,
    }
  }
}

export type { Box }

/**
 * Creates a `Box`.
 *
 * Omitted fields are unset, not zero: an unset inset is auto, and an unset
 * dimension keeps deriving from the fields that are set — `apply` resolves
 * whatever remains against the parent.
 *
 * @param input - The box's fields; see `BoxInput` for the per-field defaults.
 * @returns An immutable `Box`.
 * @example
 * ```ts
 * const pinned = Box.make({ top: 10, left: 10, width: 100, height: 50 })
 * const banner = Box.make({ left: 0, right: 0, top: 0, height: 40 })
 * ```
 */
export const make = (input: BoxInput): Box => new Box(input)

/**
 * Checks if a value is a `Box`. True only for values built by `make`,
 * which carry the brand.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Box`, `false` otherwise.
 */
export const isBox = (value: unknown): value is Box => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Solves the box against a parent rect — CSS absolute positioning. Each
 * axis resolves independently (the horizontal axis shown; the vertical
 * axis mirrors it with `top`/`bottom`/`height`):
 *
 * The used width is the first of
 * - the explicit `width`,
 * - `parent.width - left - right` when both insets are set,
 * - the used height times `aspectRatio`, when the ratio is set and the
 *   height resolved by one of the two rules above,
 * - the fill fallback: `parent.width` minus whichever insets are set,
 *
 * clamped between `minWidth` and `maxWidth` in every case — the minimum
 * wins when the bounds cross, so the fill fallback never goes negative.
 * When neither axis is determined by an explicit size or an inset pair,
 * `aspectRatio` is ignored and both axes fill.
 *
 * The box then anchors to `left` when it is set (over-constrained boxes
 * ignore `right`, as in CSS), otherwise to `right` — measured with the
 * used width — and otherwise sits at the parent's left edge, which the
 * fill fallback makes indistinguishable from a `left` of `0`.
 *
 * The arithmetic is exact IEEE 754 (see PRECISION.md). The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The box to solve.
 * @param parent - The rect to resolve insets and fills against.
 * @returns The solved `Rect`.
 * @example
 * ```ts
 * const parent = Rect.make(400, 200)
 * Box.apply(Box.make({ right: 10, bottom: 5, width: 100, height: 50 }), parent)
 * // Rect [290, 145, 100, 50]
 * Box.make({ left: 10, right: 30 }).pipe(Box.apply(parent))
 * // Rect [10, 0, 360, 200]
 * Box.apply(Box.make({ top: 0, bottom: 0, aspectRatio: 1 }), parent)
 * // Rect [0, 0, 200, 200] — the width derives from the inset-determined height
 * ```
 */
export const apply: {
  (self: Box, parent: Rect.Rect): Rect.Rect
  (parent: Rect.Rect): (self: Box) => Rect.Rect
} = dual(2, (self: Box, parent: Rect.Rect): Rect.Rect => {
  const { top, right, bottom, left, minWidth, minHeight, maxWidth, maxHeight } = self

  const topIsSet = Number.isFinite(top)
  const rightIsSet = Number.isFinite(right)
  const bottomIsSet = Number.isFinite(bottom)
  const leftIsSet = Number.isFinite(left)

  const ratio = self.aspectRatio

  let width = Number.isFinite(self.width)
    ? clamp(self.width, minWidth, maxWidth)
    : leftIsSet && rightIsSet
      ? clamp(parent.width - left - right, minWidth, maxWidth)
      : Number.NaN

  let height = Number.isFinite(self.height)
    ? clamp(self.height, minHeight, maxHeight)
    : topIsSet && bottomIsSet
      ? clamp(parent.height - top - bottom, minHeight, maxHeight)
      : Number.NaN

  if (Number.isFinite(ratio) && ratio > 0) {
    if (Number.isNaN(width) && !Number.isNaN(height)) {
      width = clamp(height * ratio, minWidth, maxWidth)
    } else if (Number.isNaN(height) && !Number.isNaN(width)) {
      height = clamp(width / ratio, minHeight, maxHeight)
    }
  }

  if (Number.isNaN(width)) {
    width = clamp(
      parent.width - (leftIsSet ? left : 0) - (rightIsSet ? right : 0),
      minWidth,
      maxWidth,
    )
  }

  if (Number.isNaN(height)) {
    height = clamp(
      parent.height - (topIsSet ? top : 0) - (bottomIsSet ? bottom : 0),
      minHeight,
      maxHeight,
    )
  }

  const x = leftIsSet
    ? parent.x + left
    : rightIsSet
      ? parent.x + parent.width - width - right
      : parent.x

  const y = topIsSet
    ? parent.y + top
    : bottomIsSet
      ? parent.y + parent.height - height - bottom
      : parent.y

  return Rect.make(x, y, width, height)
})

// Setters rebuild from the raw inputs (toJSON), never a resolved value.
// Those with optional trailing arguments dispatch on isBox: the data-last
// form's first argument is always a number, so the forms cannot collide.

/**
 * Sets all four insets in CSS shorthand order: one value for every edge,
 * two values for vertical then horizontal, three values for top,
 * horizontal, then bottom, four values for top, right, bottom, left. A
 * non-finite value unsets its edge. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The box to update.
 * @param top - The top inset. As the only value, every edge; as the first of two, both vertical edges.
 * @param right - The right inset. As the second of two values, both horizontal edges.
 * @param bottom - The bottom inset.
 * @param left - The left inset.
 * @returns A new box with the insets replaced.
 * @example
 * ```ts
 * Box.setInset(Box.make({}), 10).left // 10
 * Box.make({}).pipe(Box.setInset(10, 20)).right // 20
 * ```
 */
export const setInset: {
  (self: Box, inset: number): Box
  (self: Box, insetY: number, insetX: number): Box
  (self: Box, top: number, insetX: number, bottom: number): Box
  (self: Box, top: number, right: number, bottom: number, left: number): Box
  (inset: number): (self: Box) => Box
  (insetY: number, insetX: number): (self: Box) => Box
  (top: number, insetX: number, bottom: number): (self: Box) => Box
  (top: number, right: number, bottom: number, left: number): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, a: number, b?: number, c?: number, d?: number) => {
    const [top, right, bottom, left] = normalizeTRBL(a, b, c, d)
    return new Box({ ...self.toJSON(), top, right, bottom, left })
  },
)

/**
 * Sets the horizontal insets: one value for both edges, two values for
 * left then right. A non-finite value unsets its edge. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param left - The left inset. As the only value, the right inset too.
 * @param right - The right inset.
 * @returns A new box with the horizontal insets replaced.
 */
export const setInsetX: {
  (self: Box, inset: number): Box
  (self: Box, left: number, right: number): Box
  (inset: number): (self: Box) => Box
  (left: number, right: number): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, left: number, right?: number) =>
    new Box({ ...self.toJSON(), left, right: right ?? left }),
)

/**
 * Sets the vertical insets: one value for both edges, two values for top
 * then bottom. A non-finite value unsets its edge. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param top - The top inset. As the only value, the bottom inset too.
 * @param bottom - The bottom inset.
 * @returns A new box with the vertical insets replaced.
 */
export const setInsetY: {
  (self: Box, inset: number): Box
  (self: Box, top: number, bottom: number): Box
  (inset: number): (self: Box) => Box
  (top: number, bottom: number): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, top: number, bottom?: number) =>
    new Box({ ...self.toJSON(), top, bottom: bottom ?? top }),
)

/**
 * Sets the top inset, leaving the other edges alone. A non-finite value
 * unsets it. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param top - The new top inset.
 * @returns A new box with the top inset replaced.
 */
export const setTop: {
  (self: Box, top: number): Box
  (top: number): (self: Box) => Box
} = dual(2, (self: Box, top: number) => new Box({ ...self.toJSON(), top }))

/**
 * Sets the right inset, leaving the other edges alone. A non-finite value
 * unsets it. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param right - The new right inset.
 * @returns A new box with the right inset replaced.
 */
export const setRight: {
  (self: Box, right: number): Box
  (right: number): (self: Box) => Box
} = dual(2, (self: Box, right: number) => new Box({ ...self.toJSON(), right }))

/**
 * Sets the bottom inset, leaving the other edges alone. A non-finite value
 * unsets it. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param bottom - The new bottom inset.
 * @returns A new box with the bottom inset replaced.
 */
export const setBottom: {
  (self: Box, bottom: number): Box
  (bottom: number): (self: Box) => Box
} = dual(2, (self: Box, bottom: number) => new Box({ ...self.toJSON(), bottom }))

/**
 * Sets the left inset, leaving the other edges alone. A non-finite value
 * unsets it. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param left - The new left inset.
 * @returns A new box with the left inset replaced.
 */
export const setLeft: {
  (self: Box, left: number): Box
  (left: number): (self: Box) => Box
} = dual(2, (self: Box, left: number) => new Box({ ...self.toJSON(), left }))

/**
 * Sets the preferred width and height. Note the order: width first, the
 * opposite of `setInset`'s vertical-first two-value form. One value sets
 * both dimensions. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The box to update.
 * @param width - The new width.
 * @param height - The new height; the width when omitted.
 * @returns A new box with both dimensions set.
 * @example
 * ```ts
 * Box.setSize(Box.make({}), 100, 50).height // 50
 * Box.make({}).pipe(Box.setSize(100)).height // 100
 * ```
 */
export const setSize: {
  (self: Box, width: number, height?: number): Box
  (width: number, height?: number): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, width: number, height?: number) =>
    new Box({ ...self.toJSON(), width, height: height ?? width }),
)

/**
 * Sets the preferred width, leaving the other inputs — including an unset
 * height — as they were: a height left to derive keeps deriving against
 * the new width in `apply`. A non-finite value unsets it. The data-last
 * form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param width - The new width.
 * @returns A new box with the width replaced.
 */
export const setWidth: {
  (self: Box, width: number): Box
  (width: number): (self: Box) => Box
} = dual(2, (self: Box, width: number) => new Box({ ...self.toJSON(), width }))

/**
 * Sets the preferred height, leaving the other inputs — including an
 * unset width — as they were: a width left to derive keeps deriving
 * against the new height in `apply`. A non-finite value unsets it. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param height - The new height.
 * @returns A new box with the height replaced.
 */
export const setHeight: {
  (self: Box, height: number): Box
  (height: number): (self: Box) => Box
} = dual(2, (self: Box, height: number) => new Box({ ...self.toJSON(), height }))

/**
 * Sets the width-to-height ratio that derives whichever dimension is
 * otherwise undetermined in `apply`. Non-positive and non-finite ratios
 * act as unset. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The box to update.
 * @param aspectRatio - The new ratio, as `width / height`.
 * @returns A new box with the ratio replaced.
 */
export const setAspectRatio: {
  (self: Box, aspectRatio: number): Box
  (aspectRatio: number): (self: Box) => Box
} = dual(2, (self: Box, aspectRatio: number) => new Box({ ...self.toJSON(), aspectRatio }))

/**
 * Sets the minimum width and height, width first. One value sets both
 * minimums. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param minWidth - The new minimum width.
 * @param minHeight - The new minimum height; the minimum width when omitted.
 * @returns A new box with both minimums set.
 */
export const setMinSize: {
  (self: Box, minWidth: number, minHeight?: number): Box
  (minWidth: number, minHeight?: number): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, minWidth: number, minHeight?: number) =>
    new Box({ ...self.toJSON(), minWidth, minHeight: minHeight ?? minWidth }),
)

/**
 * Sets the minimum width, the lower clamp on the resolved width. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param minWidth - The new minimum width.
 * @returns A new box with the minimum width replaced.
 */
export const setMinWidth: {
  (self: Box, minWidth: number): Box
  (minWidth: number): (self: Box) => Box
} = dual(2, (self: Box, minWidth: number) => new Box({ ...self.toJSON(), minWidth }))

/**
 * Sets the minimum height, the lower clamp on the resolved height. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param minHeight - The new minimum height.
 * @returns A new box with the minimum height replaced.
 */
export const setMinHeight: {
  (self: Box, minHeight: number): Box
  (minHeight: number): (self: Box) => Box
} = dual(2, (self: Box, minHeight: number) => new Box({ ...self.toJSON(), minHeight }))

/**
 * Sets the maximum width and height, width first. One value sets both
 * maximums. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param maxWidth - The new maximum width.
 * @param maxHeight - The new maximum height; the maximum width when omitted.
 * @returns A new box with both maximums set.
 */
export const setMaxSize: {
  (self: Box, maxWidth: number, maxHeight?: number): Box
  (maxWidth: number, maxHeight?: number): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, maxWidth: number, maxHeight?: number) =>
    new Box({ ...self.toJSON(), maxWidth, maxHeight: maxHeight ?? maxWidth }),
)

/**
 * Sets the maximum width, the upper clamp on the resolved width.
 * Constraints apply at resolution, so raising a maximum un-clamps a width
 * set earlier. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The box to update.
 * @param maxWidth - The new maximum width.
 * @returns A new box with the maximum width replaced.
 */
export const setMaxWidth: {
  (self: Box, maxWidth: number): Box
  (maxWidth: number): (self: Box) => Box
} = dual(2, (self: Box, maxWidth: number) => new Box({ ...self.toJSON(), maxWidth }))

/**
 * Sets the maximum height, the upper clamp on the resolved height.
 * Constraints apply at resolution, so raising a maximum un-clamps a
 * height set earlier. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The box to update.
 * @param maxHeight - The new maximum height.
 * @returns A new box with the maximum height replaced.
 */
export const setMaxHeight: {
  (self: Box, maxHeight: number): Box
  (maxHeight: number): (self: Box) => Box
} = dual(2, (self: Box, maxHeight: number) => new Box({ ...self.toJSON(), maxHeight }))
