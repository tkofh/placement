import { clamp } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import * as AspectRatio from './aspectRatio.ts'
import { type RawAspectRatio, toRawRatio } from './internal/aspectRatio.ts'
import * as Rect from './rect.ts'
import { normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/box')
type TypeBrand = typeof TypeBrand

// The raw inputs sit under a module-private symbol, not in `#private`
// fields, so reads still work through a `Proxy` (Vue's `ref`/`reactive`).
const Raw: unique symbol = Symbol('placement/box/raw')

type RawInput = {
  readonly [K in Exclude<keyof BoxInput, 'aspectRatio'>]-?: number | undefined
} & { readonly aspectRatio: RawAspectRatio }

/**
 * The construction input for `make`. Every field is optional, and passing
 * `undefined` is the same as omitting the field. Any non-finite value acts
 * as unset. This differs from `Frame`, where a non-finite size is a literal
 * infinite preference.
 *
 * Unset means a different thing in each group. An unset inset is auto: it
 * does not anchor or shrink its axis. Unset sizing fields stay unset until
 * `apply` resolves them against a parent (see `apply` for the resolution
 * order). Unset constraints default to `0` (minimums) and `Infinity`
 * (maximums).
 */
export interface BoxInput {
  /**
   * The gap between the parent's top edge and the box, as `top` in CSS
   * absolute positioning. When set, it anchors the vertical position.
   * Together with `bottom`, it also determines an unset height. It is unset
   * when omitted or non-finite.
   */
  readonly top?: number | undefined
  /**
   * The gap between the box and the parent's right edge, as `right` in CSS
   * absolute positioning. When it is set and `left` is unset, the box
   * anchors to the right edge. Together with `left`, it also determines an
   * unset width. It is unset when omitted or non-finite.
   */
  readonly right?: number | undefined
  /**
   * The gap between the box and the parent's bottom edge, as `bottom` in
   * CSS absolute positioning. When it is set and `top` is unset, the box
   * anchors to the bottom edge. Together with `top`, it also determines an
   * unset height. It is unset when omitted or non-finite.
   */
  readonly bottom?: number | undefined
  /**
   * The gap between the parent's left edge and the box, as `left` in CSS
   * absolute positioning. When set, it anchors the horizontal position.
   * Together with `right`, it also determines an unset width. It is unset
   * when omitted or non-finite.
   */
  readonly left?: number | undefined
  /**
   * The preferred width. It is unset when omitted or non-finite. The
   * resolved width then derives from the horizontal insets, from the height
   * and `aspectRatio`, or fills the parent (see `apply`).
   */
  readonly width?: number | undefined
  /**
   * The preferred height. It is unset when omitted or non-finite. The
   * resolved height then derives from the vertical insets, from the width
   * and `aspectRatio`, or fills the parent (see `apply`).
   */
  readonly height?: number | undefined
  /**
   * The width-to-height ratio, as a number (`width / height`) or a
   * `[width, height]` pair such as `[16, 9]` (see `placement/aspectRatio`).
   * It derives the dimension that no explicit size or pair of insets
   * determines. A pair derives it with one rounding. Ratios whose value is
   * non-positive or non-finite act as unset. It is unset when
   * omitted.
   */
  readonly aspectRatio?: AspectRatio.AspectRatio | undefined
  /**
   * The lower bound on the resolved width. Negative values clamp to `0`.
   * The default is `0`. Non-finite values act as unset.
   */
  readonly minWidth?: number | undefined
  /**
   * The lower bound on the resolved height. Negative values clamp to `0`.
   * The default is `0`. Non-finite values act as unset.
   */
  readonly minHeight?: number | undefined
  /**
   * The upper bound on the resolved width. Negative values clamp to `0`.
   * If the bounds cross, `minWidth` wins, as in CSS `clamp()`. The default
   * is `Infinity` (unconstrained). Non-finite values act as unset.
   */
  readonly maxWidth?: number | undefined
  /**
   * The upper bound on the resolved height. Negative values clamp to `0`.
   * If the bounds cross, `minHeight` wins, as in CSS `clamp()`. The default
   * is `Infinity` (unconstrained). Non-finite values act as unset.
   */
  readonly maxHeight?: number | undefined
}

/**
 * A positioned-box spec: the inset, sizing, and constraint inputs that
 * `apply` resolves against a parent rect. It is the absolute-positioning
 * counterpart to the flex pair `Frame`/`Flexbox.apply`. A box has no
 * position of its own. `apply` produces `Rect`s.
 *
 * Values are immutable, and every setter returns a new box. The box stores
 * every input raw and keeps unset inputs unset. The setters rebuild from
 * the raw inputs, so a dimension left to derive keeps re-deriving after any
 * setter. `apply` resolves the box again against each parent it gets.
 *
 * Create a box with `make`.
 */
class Box extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly [Raw]: RawInput

  constructor(input: BoxInput) {
    super()

    // `?? undefined` also catches the `null`s of a JSON round trip.
    this[Raw] = {
      top: input.top ?? undefined,
      right: input.right ?? undefined,
      bottom: input.bottom ?? undefined,
      left: input.left ?? undefined,
      width: input.width ?? undefined,
      height: input.height ?? undefined,
      aspectRatio: toRawRatio(input.aspectRatio),
      minWidth: input.minWidth ?? undefined,
      minHeight: input.minHeight ?? undefined,
      maxWidth: input.maxWidth ?? undefined,
      maxHeight: input.maxHeight ?? undefined,
    }
  }

  /**
   * The raw top inset, or `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get top(): number {
    return this[Raw].top ?? Number.NaN
  }

  /**
   * The raw right inset, or `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get right(): number {
    return this[Raw].right ?? Number.NaN
  }

  /**
   * The raw bottom inset, or `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get bottom(): number {
    return this[Raw].bottom ?? Number.NaN
  }

  /**
   * The raw left inset, or `NaN` when unset. Any non-finite value acts as
   * unset in `apply`.
   */
  get left(): number {
    return this[Raw].left ?? Number.NaN
  }

  /**
   * The raw preferred width, or `NaN` when unset. Any non-finite value acts
   * as unset in `apply`, which resolves the used width against a parent.
   */
  get width(): number {
    return this[Raw].width ?? Number.NaN
  }

  /**
   * The raw preferred height, or `NaN` when unset. Any non-finite value acts
   * as unset in `apply`, which resolves the used height against a parent.
   */
  get height(): number {
    return this[Raw].height ?? Number.NaN
  }

  /**
   * The raw width-to-height ratio as one number, or `NaN` when unset. A
   * pair reads as `width / height`, and `toJSON` keeps the pair.
   * Non-positive and non-finite ratios act as unset in `apply`.
   */
  get aspectRatio(): number {
    const raw = this[Raw].aspectRatio
    return raw === undefined ? Number.NaN : AspectRatio.toNumber(raw)
  }

  /**
   * The effective lower bound on the resolved width. It is the raw input
   * clamped to `>= 0`, or `0` when unset or non-finite.
   */
  get minWidth(): number {
    const raw = this[Raw].minWidth ?? 0
    return Number.isFinite(raw) ? Math.max(raw, 0) : 0
  }

  /**
   * The effective lower bound on the resolved height. It is the raw input
   * clamped to `>= 0`, or `0` when unset or non-finite.
   */
  get minHeight(): number {
    const raw = this[Raw].minHeight ?? 0
    return Number.isFinite(raw) ? Math.max(raw, 0) : 0
  }

  /**
   * The effective upper bound on the resolved width. It is the raw input
   * clamped to `>= 0`, or `Infinity` when unset or non-finite. If the bounds
   * cross, it rises to `minWidth`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxWidth(): number {
    const raw = this[Raw].maxWidth ?? Number.POSITIVE_INFINITY
    return Number.isFinite(raw) ? Math.max(raw, this.minWidth) : Number.POSITIVE_INFINITY
  }

  /**
   * The effective upper bound on the resolved height. It is the raw input
   * clamped to `>= 0`, or `Infinity` when unset or non-finite. If the bounds
   * cross, it rises to `minHeight`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxHeight(): number {
    const raw = this[Raw].maxHeight ?? Number.POSITIVE_INFINITY
    return Number.isFinite(raw) ? Math.max(raw, this.minHeight) : Number.POSITIVE_INFINITY
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Box [t:${this.top} r:${this.right} b:${this.bottom} l:${this.left} | ${this.width} x ${this.height}]`
  }

  /**
   * Returns the box's raw inputs. Unset fields come back as `undefined`,
   * never as a sentinel. A ratio pair comes back as a copy (or as its width
   * when its height is `1`). `JSON.stringify` drops unset fields and writes
   * non-finite values as `null`. `make` reads `null` back as unset, so a
   * JSON round trip keeps every meaning.
   *
   * @returns The raw input record, of the shape `make` accepts.
   */
  toJSON(): RawInput {
    return { ...this[Raw] }
  }
}

export type { Box }

/**
 * Creates a `Box`.
 *
 * Omitted fields are unset, not zero. An unset inset is auto, and an unset
 * dimension keeps deriving from the fields that are set. `apply` resolves
 * the rest against the parent.
 *
 * @param input - The box's fields. See `BoxInput` for the per-field defaults.
 * @returns An immutable `Box`.
 * @example
 * ```ts
 * const pinned = Box.make({ top: 10, left: 10, width: 100, height: 50 })
 * const banner = Box.make({ left: 0, right: 0, top: 0, height: 40 })
 * ```
 */
export const make = (input: BoxInput): Box => new Box(input)

/**
 * Checks if a value is a `Box`. It returns `true` only for values built by
 * `make`, which carry the brand.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Box`, `false` otherwise.
 */
export const isBox = (value: unknown): value is Box => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Solves the box against a parent rect, as in CSS absolute positioning.
 * Each axis resolves independently. The rules below show the horizontal
 * axis. The vertical axis mirrors them with `top`/`bottom`/`height`.
 *
 * The used width is the first of these that applies:
 * - the explicit `width`,
 * - `parent.width - left - right` when both insets are set,
 * - the used height times `aspectRatio`, when the ratio is set and one of
 *   the two rules above resolved the height,
 * - the fill fallback: `parent.width` minus whichever insets are set.
 *
 * In every case, `minWidth` and `maxWidth` clamp the result. If the bounds
 * cross, the minimum wins, so the fill fallback never goes negative. If no
 * explicit size or inset pair determines either axis, `apply` ignores
 * `aspectRatio` and both axes fill.
 *
 * The box then anchors to `left` when it is set. An over-constrained box
 * ignores `right`, as in CSS. Otherwise the box anchors to `right`,
 * measured with the used width. With neither inset set, the box sits at
 * the parent's left edge. The fill fallback makes this the same as a
 * `left` of `0`.
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

  // The value gates the derivation, and the raw ratio derives the extent,
  // so a pair rounds once.
  const rawRatio = self[Raw].aspectRatio
  if (rawRatio !== undefined && Number.isFinite(ratio) && ratio > 0) {
    if (Number.isNaN(width) && !Number.isNaN(height)) {
      width = clamp(AspectRatio.widthFor(rawRatio, height), minWidth, maxWidth)
    } else if (Number.isNaN(height) && !Number.isNaN(width)) {
      height = clamp(AspectRatio.heightFor(rawRatio, width), minHeight, maxHeight)
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

// Setters rebuild from the raw inputs (toJSON), never from a resolved value.
// Setters with optional trailing arguments dispatch on isBox. The data-last
// form's first argument is always a number, so the forms cannot collide.

/**
 * Sets all four insets in CSS shorthand order. One value sets every edge.
 * Two values set vertical, then horizontal. Three values set top,
 * horizontal, then bottom. Four values set top, right, bottom, left. A
 * non-finite value unsets its edge. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The box to update.
 * @param top - The top inset. As the only value, it sets every edge. As the first of
 *   two, it sets both vertical edges.
 * @param right - The right inset. As the second of two values, it sets both horizontal edges.
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
 * Sets the horizontal insets. One value sets both edges. Two values set
 * left, then right. A non-finite value unsets its edge. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param left - The left inset. As the only value, it also sets the right inset.
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
 * Sets the vertical insets. One value sets both edges. Two values set top,
 * then bottom. A non-finite value unsets its edge. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param top - The top inset. As the only value, it also sets the bottom inset.
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
 * Sets the top inset and leaves the other edges unchanged. A non-finite
 * value unsets it. The data-last form omits `self` and returns a function of it.
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
 * Sets the right inset and leaves the other edges unchanged. A non-finite
 * value unsets it. The data-last form omits `self` and returns a function of it.
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
 * Sets the bottom inset and leaves the other edges unchanged. A non-finite
 * value unsets it. The data-last form omits `self` and returns a function of it.
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
 * Sets the left inset and leaves the other edges unchanged. A non-finite
 * value unsets it. The data-last form omits `self` and returns a function of it.
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
 * Sets the preferred width and height. The width comes first, the opposite
 * of the vertical-first two-value form of `setInset`. One value sets both
 * dimensions. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param width - The new width.
 * @param height - The new height. Defaults to the width.
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
 * Sets the preferred width and leaves the other inputs as they were, an
 * unset height included. In `apply`, a height left to derive keeps
 * deriving against the new width. A non-finite value unsets the width. The
 * data-last form omits `self` and returns a function of it.
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
 * Sets the preferred height and leaves the other inputs as they were, an
 * unset width included. In `apply`, a width left to derive keeps deriving
 * against the new height. A non-finite value unsets the height. The
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
 * Sets the width-to-height ratio. In `apply`, the ratio derives the
 * dimension that nothing else determines. Non-positive and non-finite ratios
 * act as unset. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The box to update.
 * @param aspectRatio - The new ratio, as `width / height` or a `[width, height]` pair.
 * @returns A new box with the ratio replaced.
 */
export const setAspectRatio: {
  (self: Box, aspectRatio: AspectRatio.AspectRatio): Box
  (aspectRatio: AspectRatio.AspectRatio): (self: Box) => Box
} = dual(
  2,
  (self: Box, aspectRatio: AspectRatio.AspectRatio) => new Box({ ...self.toJSON(), aspectRatio }),
)

/**
 * Sets the minimum width and height, width first. One value sets both
 * minimums. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param minWidth - The new minimum width.
 * @param minHeight - The new minimum height. Defaults to the minimum width.
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
 * @param maxHeight - The new maximum height. Defaults to the maximum width.
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
 * Sets the maximum width, the upper clamp on the resolved width. The
 * constraints take effect when `apply` resolves the box, so raising a
 * maximum un-clamps a width set earlier. The data-last form omits `self` and returns a function of
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
 * Sets the maximum height, the upper clamp on the resolved height. The
 * constraints take effect when `apply` resolves the box, so raising a
 * maximum un-clamps a height set earlier. The data-last form omits `self` and returns a
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
