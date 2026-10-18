import { clamp } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { DimensionsLike } from './dimensions.ts'
import { type RawLength, absolute, resolveRaw, toRaw } from './internal/length.ts'
import * as Length from './length.ts'
import * as Rect from './rect.ts'
import { normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/box')
type TypeBrand = typeof TypeBrand

// The raw inputs sit under a module-private symbol, not in `#private`
// fields, so reads still work through a `Proxy` (Vue's `ref`/`reactive`).
const Raw: unique symbol = Symbol('placement/box/raw')

type LengthField = Exclude<keyof BoxInput, 'aspectRatio'>

type RawInput = { readonly [K in LengthField]: RawLength } & {
  readonly aspectRatio: number | undefined
}

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
 *
 * Every field except `aspectRatio` takes a `Length` as well as a number. A
 * number is pixels. A percentage resolves against the parent that `apply`
 * gets, with the bases of CSS absolute positioning: `left`, `right`,
 * `width`, `minWidth`, and `maxWidth` against the parent's width, and
 * `top`, `bottom`, `height`, `minHeight`, and `maxHeight` against its
 * height.
 */
export interface BoxInput {
  /**
   * The gap between the parent's top edge and the box, as `top` in CSS
   * absolute positioning. When set, it anchors the vertical position.
   * Together with `bottom`, it also determines an unset height. It is unset
   * when omitted or non-finite. A percentage is of the parent's height.
   */
  readonly top?: Length.LengthInput | undefined
  /**
   * The gap between the box and the parent's right edge, as `right` in CSS
   * absolute positioning. When it is set and `left` is unset, the box
   * anchors to the right edge. Together with `left`, it also determines an
   * unset width. It is unset when omitted or non-finite. A percentage is of the parent's width.
   */
  readonly right?: Length.LengthInput | undefined
  /**
   * The gap between the box and the parent's bottom edge, as `bottom` in
   * CSS absolute positioning. When it is set and `top` is unset, the box
   * anchors to the bottom edge. Together with `top`, it also determines an
   * unset height. It is unset when omitted or non-finite. A percentage is of the parent's height.
   */
  readonly bottom?: Length.LengthInput | undefined
  /**
   * The gap between the parent's left edge and the box, as `left` in CSS
   * absolute positioning. When set, it anchors the horizontal position.
   * Together with `right`, it also determines an unset width. It is unset
   * when omitted or non-finite. A percentage is of the parent's width.
   */
  readonly left?: Length.LengthInput | undefined
  /**
   * The preferred width. It is unset when omitted or non-finite. The
   * resolved width then derives from the horizontal insets, from the height
   * and `aspectRatio`, or fills the parent (see `apply`). A percentage is of the parent's width.
   */
  readonly width?: Length.LengthInput | undefined
  /**
   * The preferred height. It is unset when omitted or non-finite. The
   * resolved height then derives from the vertical insets, from the width
   * and `aspectRatio`, or fills the parent (see `apply`). A percentage is of the parent's height.
   */
  readonly height?: Length.LengthInput | undefined
  /**
   * The width-to-height ratio (`width / height`). It derives the dimension
   * that no explicit size or pair of insets determines. Non-positive and
   * non-finite ratios act as unset. It is unset when omitted.
   */
  readonly aspectRatio?: number | undefined
  /**
   * The lower bound on the resolved width. Negative values clamp to `0`.
   * The default is `0`. Non-finite values act as unset. A percentage is of the parent's width.
   */
  readonly minWidth?: Length.LengthInput | undefined
  /**
   * The lower bound on the resolved height. Negative values clamp to `0`.
   * The default is `0`. Non-finite values act as unset. A percentage is of the parent's height.
   */
  readonly minHeight?: Length.LengthInput | undefined
  /**
   * The upper bound on the resolved width. Negative values clamp to `0`.
   * If the bounds cross, `minWidth` wins, as in CSS `clamp()`. The default
   * is `Infinity` (unconstrained). Non-finite values act as unset. A percentage is of the parent's width.
   */
  readonly maxWidth?: Length.LengthInput | undefined
  /**
   * The upper bound on the resolved height. Negative values clamp to `0`.
   * If the bounds cross, `minHeight` wins, as in CSS `clamp()`. The default
   * is `Infinity` (unconstrained). Non-finite values act as unset. A percentage is of the parent's height.
   */
  readonly maxHeight?: Length.LengthInput | undefined
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
 * A box keeps its percentages until a parent is known. `resolve` turns them
 * into numbers, and `apply` resolves them first. Until then, the getters
 * read a percentage as unset, as CSS does against an indefinite basis, and
 * `toJSON` returns it as the `Length` it is.
 *
 * Create a box with `make`.
 */
class Box extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly [Raw]: RawInput

  constructor(input: BoxInput) {
    super()

    // `toRaw` and `?? undefined` also catch the `null`s of a JSON round trip.
    this[Raw] = {
      top: toRaw(input.top),
      right: toRaw(input.right),
      bottom: toRaw(input.bottom),
      left: toRaw(input.left),
      width: toRaw(input.width),
      height: toRaw(input.height),
      aspectRatio: input.aspectRatio ?? undefined,
      minWidth: toRaw(input.minWidth),
      minHeight: toRaw(input.minHeight),
      maxWidth: toRaw(input.maxWidth),
      maxHeight: toRaw(input.maxHeight),
    }
  }

  /**
   * The raw top inset, or `NaN` when unset or a percentage. Any non-finite
   * value acts as unset in `apply`.
   */
  get top(): number {
    return absolute(this[Raw].top) ?? Number.NaN
  }

  /**
   * The raw right inset, or `NaN` when unset or a percentage. Any
   * non-finite value acts as unset in `apply`.
   */
  get right(): number {
    return absolute(this[Raw].right) ?? Number.NaN
  }

  /**
   * The raw bottom inset, or `NaN` when unset or a percentage. Any
   * non-finite value acts as unset in `apply`.
   */
  get bottom(): number {
    return absolute(this[Raw].bottom) ?? Number.NaN
  }

  /**
   * The raw left inset, or `NaN` when unset or a percentage. Any
   * non-finite value acts as unset in `apply`.
   */
  get left(): number {
    return absolute(this[Raw].left) ?? Number.NaN
  }

  /**
   * The raw preferred width, or `NaN` when unset or a percentage. Any
   * non-finite value acts as unset in `apply`, which resolves the used
   * width against a parent.
   */
  get width(): number {
    return absolute(this[Raw].width) ?? Number.NaN
  }

  /**
   * The raw preferred height, or `NaN` when unset or a percentage. Any
   * non-finite value acts as unset in `apply`, which resolves the used
   * height against a parent.
   */
  get height(): number {
    return absolute(this[Raw].height) ?? Number.NaN
  }

  /**
   * The raw width-to-height ratio, or `NaN` when unset. Non-positive and
   * non-finite ratios act as unset in `apply`.
   */
  get aspectRatio(): number {
    return this[Raw].aspectRatio ?? Number.NaN
  }

  /**
   * The effective lower bound on the resolved width. It is the raw input
   * clamped to `>= 0`, or `0` when unset, non-finite, or a percentage.
   */
  get minWidth(): number {
    const raw = absolute(this[Raw].minWidth) ?? 0
    return Number.isFinite(raw) ? Math.max(raw, 0) : 0
  }

  /**
   * The effective lower bound on the resolved height. It is the raw input
   * clamped to `>= 0`, or `0` when unset, non-finite, or a percentage.
   */
  get minHeight(): number {
    const raw = absolute(this[Raw].minHeight) ?? 0
    return Number.isFinite(raw) ? Math.max(raw, 0) : 0
  }

  /**
   * The effective upper bound on the resolved width. It is the raw input
   * clamped to `>= 0`, or `Infinity` when unset, non-finite, or a
   * percentage. If the bounds
   * cross, it rises to `minWidth`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxWidth(): number {
    const raw = absolute(this[Raw].maxWidth) ?? Number.POSITIVE_INFINITY
    return Number.isFinite(raw) ? Math.max(raw, this.minWidth) : Number.POSITIVE_INFINITY
  }

  /**
   * The effective upper bound on the resolved height. It is the raw input
   * clamped to `>= 0`, or `Infinity` when unset, non-finite, or a
   * percentage. If the bounds
   * cross, it rises to `minHeight`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxHeight(): number {
    const raw = absolute(this[Raw].maxHeight) ?? Number.POSITIVE_INFINITY
    return Number.isFinite(raw) ? Math.max(raw, this.minHeight) : Number.POSITIVE_INFINITY
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Box [t:${this.top} r:${this.right} b:${this.bottom} l:${this.left} | ${this.width} x ${this.height}]`
  }

  /**
   * Returns the box's raw inputs. Unset fields come back as `undefined`,
   * never as a sentinel, and percentages come back as `Length`s. A `'px'`
   * length comes back as its number. `JSON.stringify` drops unset fields,
   * writes non-finite values as `null`, and writes a percentage as its
   * `{ value, unit }` record. `make` reads `null` back as unset and the
   * record back as a `Length`, so a JSON round trip keeps every meaning.
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
 * Resolves the box's percentages against a parent's extents and returns a
 * box with numbers in their place. The bases are those of CSS absolute
 * positioning. `left`, `right`, `width`, `minWidth`, and `maxWidth` are
 * percentages of `parent.width`. `top`, `bottom`, `height`, `minHeight`,
 * and `maxHeight` are percentages of `parent.height`. Each one resolves by
 * `Length.resolve` (from `placement/length`), so `p%` becomes
 * `basis * p / 100`.
 *
 * A box without percentages comes back as `self`. `apply` calls `resolve`
 * first, so a box only needs it to read its getters against a basis. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to resolve.
 * @param parent - The extents that percentages are of. A `Rect` works.
 * @returns A box whose every length field is a number or unset.
 * @example
 * ```ts
 * const box = Box.make({ left: Length.percent(10), width: Length.percent(50) })
 * Box.resolve(box, Dimensions.make(400, 200)).width // 200
 * box.pipe(Box.resolve(Dimensions.make(400, 200))).left // 40
 * ```
 */
export const resolve: {
  (self: Box, parent: DimensionsLike): Box
  (parent: DimensionsLike): (self: Box) => Box
} = dual(2, (self: Box, parent: DimensionsLike): Box => {
  const raw = self[Raw]
  if (!LENGTH_FIELDS.some((field) => Length.isLength(raw[field]))) {
    return self
  }

  const { width, height } = parent
  return new Box({
    top: resolveRaw(raw.top, height),
    right: resolveRaw(raw.right, width),
    bottom: resolveRaw(raw.bottom, height),
    left: resolveRaw(raw.left, width),
    width: resolveRaw(raw.width, width),
    height: resolveRaw(raw.height, height),
    aspectRatio: raw.aspectRatio,
    minWidth: resolveRaw(raw.minWidth, width),
    minHeight: resolveRaw(raw.minHeight, height),
    maxWidth: resolveRaw(raw.maxWidth, width),
    maxHeight: resolveRaw(raw.maxHeight, height),
  })
})

const LENGTH_FIELDS: ReadonlyArray<LengthField> = [
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
]

/**
 * Solves the box against a parent rect, as in CSS absolute positioning.
 * Percentages resolve against the parent first (see `resolve` for the
 * basis of each field). Each axis then resolves independently. The rules below show the horizontal
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
  const box = resolve(self, parent)
  const { top, right, bottom, left, minWidth, minHeight, maxWidth, maxHeight } = box

  const topIsSet = Number.isFinite(top)
  const rightIsSet = Number.isFinite(right)
  const bottomIsSet = Number.isFinite(bottom)
  const leftIsSet = Number.isFinite(left)

  const ratio = box.aspectRatio

  let width = Number.isFinite(box.width)
    ? clamp(box.width, minWidth, maxWidth)
    : leftIsSet && rightIsSet
      ? clamp(parent.width - left - right, minWidth, maxWidth)
      : Number.NaN

  let height = Number.isFinite(box.height)
    ? clamp(box.height, minHeight, maxHeight)
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

// Setters rebuild from the raw inputs (toJSON), never from a resolved value.
// Setters with optional trailing arguments dispatch on isBox. The data-last
// form's first argument is always a length input, so the forms cannot collide.

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
  (self: Box, inset: Length.LengthInput): Box
  (self: Box, insetY: Length.LengthInput, insetX: Length.LengthInput): Box
  (self: Box, top: Length.LengthInput, insetX: Length.LengthInput, bottom: Length.LengthInput): Box
  (
    self: Box,
    top: Length.LengthInput,
    right: Length.LengthInput,
    bottom: Length.LengthInput,
    left: Length.LengthInput,
  ): Box
  (inset: Length.LengthInput): (self: Box) => Box
  (insetY: Length.LengthInput, insetX: Length.LengthInput): (self: Box) => Box
  (
    top: Length.LengthInput,
    insetX: Length.LengthInput,
    bottom: Length.LengthInput,
  ): (self: Box) => Box
  (
    top: Length.LengthInput,
    right: Length.LengthInput,
    bottom: Length.LengthInput,
    left: Length.LengthInput,
  ): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (
    self: Box,
    a: Length.LengthInput,
    b?: Length.LengthInput,
    c?: Length.LengthInput,
    d?: Length.LengthInput,
  ) => {
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
  (self: Box, inset: Length.LengthInput): Box
  (self: Box, left: Length.LengthInput, right: Length.LengthInput): Box
  (inset: Length.LengthInput): (self: Box) => Box
  (left: Length.LengthInput, right: Length.LengthInput): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, left: Length.LengthInput, right?: Length.LengthInput) =>
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
  (self: Box, inset: Length.LengthInput): Box
  (self: Box, top: Length.LengthInput, bottom: Length.LengthInput): Box
  (inset: Length.LengthInput): (self: Box) => Box
  (top: Length.LengthInput, bottom: Length.LengthInput): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, top: Length.LengthInput, bottom?: Length.LengthInput) =>
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
  (self: Box, top: Length.LengthInput): Box
  (top: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, top: Length.LengthInput) => new Box({ ...self.toJSON(), top }))

/**
 * Sets the right inset and leaves the other edges unchanged. A non-finite
 * value unsets it. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param right - The new right inset.
 * @returns A new box with the right inset replaced.
 */
export const setRight: {
  (self: Box, right: Length.LengthInput): Box
  (right: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, right: Length.LengthInput) => new Box({ ...self.toJSON(), right }))

/**
 * Sets the bottom inset and leaves the other edges unchanged. A non-finite
 * value unsets it. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param bottom - The new bottom inset.
 * @returns A new box with the bottom inset replaced.
 */
export const setBottom: {
  (self: Box, bottom: Length.LengthInput): Box
  (bottom: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, bottom: Length.LengthInput) => new Box({ ...self.toJSON(), bottom }))

/**
 * Sets the left inset and leaves the other edges unchanged. A non-finite
 * value unsets it. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param left - The new left inset.
 * @returns A new box with the left inset replaced.
 */
export const setLeft: {
  (self: Box, left: Length.LengthInput): Box
  (left: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, left: Length.LengthInput) => new Box({ ...self.toJSON(), left }))

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
  (self: Box, width: Length.LengthInput, height?: Length.LengthInput): Box
  (width: Length.LengthInput, height?: Length.LengthInput): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, width: Length.LengthInput, height?: Length.LengthInput) =>
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
  (self: Box, width: Length.LengthInput): Box
  (width: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, width: Length.LengthInput) => new Box({ ...self.toJSON(), width }))

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
  (self: Box, height: Length.LengthInput): Box
  (height: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, height: Length.LengthInput) => new Box({ ...self.toJSON(), height }))

/**
 * Sets the width-to-height ratio. In `apply`, the ratio derives the
 * dimension that nothing else determines. Non-positive and non-finite ratios
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
 * @param minHeight - The new minimum height. Defaults to the minimum width.
 * @returns A new box with both minimums set.
 */
export const setMinSize: {
  (self: Box, minWidth: Length.LengthInput, minHeight?: Length.LengthInput): Box
  (minWidth: Length.LengthInput, minHeight?: Length.LengthInput): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, minWidth: Length.LengthInput, minHeight?: Length.LengthInput) =>
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
  (self: Box, minWidth: Length.LengthInput): Box
  (minWidth: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, minWidth: Length.LengthInput) => new Box({ ...self.toJSON(), minWidth }))

/**
 * Sets the minimum height, the lower clamp on the resolved height. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The box to update.
 * @param minHeight - The new minimum height.
 * @returns A new box with the minimum height replaced.
 */
export const setMinHeight: {
  (self: Box, minHeight: Length.LengthInput): Box
  (minHeight: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, minHeight: Length.LengthInput) => new Box({ ...self.toJSON(), minHeight }))

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
  (self: Box, maxWidth: Length.LengthInput, maxHeight?: Length.LengthInput): Box
  (maxWidth: Length.LengthInput, maxHeight?: Length.LengthInput): (self: Box) => Box
} = dual(
  (args) => isBox(args[0]),
  (self: Box, maxWidth: Length.LengthInput, maxHeight?: Length.LengthInput) =>
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
  (self: Box, maxWidth: Length.LengthInput): Box
  (maxWidth: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, maxWidth: Length.LengthInput) => new Box({ ...self.toJSON(), maxWidth }))

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
  (self: Box, maxHeight: Length.LengthInput): Box
  (maxHeight: Length.LengthInput): (self: Box) => Box
} = dual(2, (self: Box, maxHeight: Length.LengthInput) => new Box({ ...self.toJSON(), maxHeight }))
