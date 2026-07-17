import { Pipeable, dual } from 'curvy/utils'
import { type NormalizedSizing, normalizeSizing, normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/frame')
type TypeBrand = typeof TypeBrand

/**
 * The construction input for `make`. Every field is optional, and passing
 * `undefined` is the same as omitting the field.
 *
 * Omission means different things per group. Offsets, `grow`, and `shrink`
 * default to `0`; `align` and `stretch` default to the inherit sentinel
 * (`Number.POSITIVE_INFINITY`). The sizing fields — `width`, `height`,
 * `aspectRatio`, and the min/max constraints — are stored unset rather than
 * defaulted, so the frame derives them from the fields that are set (see
 * `Frame`).
 */
export interface FrameInput {
  /**
   * Space reserved above the frame — its top margin in the container. A
   * non-finite value requests an auto margin: layout hands the edge an
   * equal share of the free space on its axis. Defaults to `0`.
   */
  readonly offsetTop?: number | undefined
  /**
   * Space reserved to the right of the frame — its right margin. A
   * non-finite value requests an auto margin: layout hands the edge an
   * equal share of the free space on its axis. Defaults to `0`.
   */
  readonly offsetRight?: number | undefined
  /**
   * Space reserved below the frame — its bottom margin. A non-finite value
   * requests an auto margin: layout hands the edge an equal share of the
   * free space on its axis. Defaults to `0`.
   */
  readonly offsetBottom?: number | undefined
  /**
   * Space reserved to the left of the frame — its left margin. A
   * non-finite value requests an auto margin: layout hands the edge an
   * equal share of the free space on its axis. Defaults to `0`.
   */
  readonly offsetLeft?: number | undefined
  /**
   * The preferred width. Unset when omitted: the resolved width then
   * derives from the height and `aspectRatio`, or falls back to `0`.
   */
  readonly width?: number | undefined
  /**
   * The preferred height. Unset when omitted: the resolved height then
   * derives from the width and `aspectRatio`, or falls back to `0`.
   */
  readonly height?: number | undefined
  /**
   * The width-to-height ratio (`width / height`) that derives whichever of
   * `width` and `height` is unset. Non-positive and `NaN` ratios act as
   * unset. Unset when omitted.
   */
  readonly aspectRatio?: number | undefined
  /**
   * The lower bound on the resolved width. Negative values clamp to `0`.
   * Defaults to `0`.
   */
  readonly minWidth?: number | undefined
  /**
   * The lower bound on the resolved height. Negative values clamp to `0`.
   * Defaults to `0`.
   */
  readonly minHeight?: number | undefined
  /**
   * The upper bound on the resolved width. Negative values clamp to `0`.
   * Defaults to `Infinity` (unconstrained).
   */
  readonly maxWidth?: number | undefined
  /**
   * The upper bound on the resolved height. Negative values clamp to `0`.
   * Defaults to `Infinity` (unconstrained).
   */
  readonly maxHeight?: number | undefined
  /**
   * The flex grow factor: the frame's share of positive free space along
   * the container's main axis, in proportion to the other items' factors.
   * Non-positive factors never grow. Defaults to `0`.
   */
  readonly grow?: number | undefined
  /**
   * The flex shrink factor: the frame's share of main-axis overflow, in
   * proportion to factor times base size (as in CSS). Non-positive factors
   * never shrink. Defaults to `0` — where CSS defaults to `1`.
   */
  readonly shrink?: number | undefined
  /**
   * Where the frame sits in its line's free cross-axis space, as a
   * fraction: `0` at the cross start, `0.5` centered, `1` at the cross
   * end. Defaults to `Number.POSITIVE_INFINITY`, the inherit sentinel: the
   * container's `alignItems` applies.
   */
  readonly align?: number | undefined
  /**
   * How much of the free cross-axis space the frame absorbs into its size,
   * as a fraction: `0` keeps the resolved size, `1` fills the line. The
   * min/max constraints still apply. Defaults to
   * `Number.POSITIVE_INFINITY`, the inherit sentinel: the container's
   * `stretchItems` applies.
   */
  readonly stretch?: number | undefined
}

/**
 * A flex-item spec: the sizing, margin, and placement inputs `Flexbox.apply`
 * (from `placement/flexbox`) reads for one item of a container. A frame
 * carries no position of its own; layout produces `Rect`s.
 *
 * Values are immutable — every setter returns a new frame — and the sizing
 * inputs are stored raw, with unset-ness preserved: the sizing getters
 * resolve lazily from whatever is set, and the setters rebuild from the raw
 * inputs, so a derived dimension keeps re-deriving after any setter.
 *
 * Width and height resolve in order:
 * - both set: each clamps to its own min/max constraints
 * - one set plus a positive `aspectRatio`: the set dimension clamps, and
 *   the other derives from it through the ratio, then clamps
 * - `aspectRatio` alone: the ratio applies against the clamped `0`
 *   fallbacks, so a positive minimum on one axis drives the other
 * - nothing set: both dimensions fall back to `0`, clamped
 *
 * The resolution arithmetic is exact IEEE 754 (see PRECISION.md).
 *
 * Created by `make`.
 */
class Frame extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /**
   * Space reserved above the frame — its top margin in the container. A
   * non-finite value is an auto margin: layout hands the edge an equal
   * share of the free space on its axis.
   */
  readonly offsetTop: number
  /**
   * Space reserved to the right of the frame — its right margin. A
   * non-finite value is an auto margin: layout hands the edge an equal
   * share of the free space on its axis.
   */
  readonly offsetRight: number
  /**
   * Space reserved below the frame — its bottom margin. A non-finite value
   * is an auto margin: layout hands the edge an equal share of the free
   * space on its axis.
   */
  readonly offsetBottom: number
  /**
   * Space reserved to the left of the frame — its left margin. A
   * non-finite value is an auto margin: layout hands the edge an equal
   * share of the free space on its axis.
   */
  readonly offsetLeft: number
  /**
   * The flex grow factor: the frame's share of positive free space along
   * the container's main axis, in proportion to the other items' factors.
   * Non-positive factors never grow.
   */
  readonly grow: number
  /**
   * The flex shrink factor: the frame's share of main-axis overflow, in
   * proportion to factor times base size (as in CSS). Non-positive factors
   * never shrink.
   */
  readonly shrink: number
  /**
   * Where the frame sits in its line's free cross-axis space, as a
   * fraction: `0` at the cross start, `0.5` centered, `1` at the cross
   * end. `Number.POSITIVE_INFINITY` (the default) inherits the container's
   * `alignItems`.
   */
  readonly align: number
  /**
   * How much of the free cross-axis space the frame absorbs into its size,
   * as a fraction: `0` keeps the resolved size, `1` fills the line, within
   * the min/max constraints. `Number.POSITIVE_INFINITY` (the default)
   * inherits the container's `stretchItems`.
   */
  readonly stretch: number

  // Sizing inputs are stored raw (undefined = unset) and resolved lazily, so
  // unset-ness survives setter round-trips.
  readonly #width: number | undefined
  readonly #height: number | undefined
  readonly #aspectRatio: number | undefined
  readonly #minWidth: number | undefined
  readonly #minHeight: number | undefined
  readonly #maxWidth: number | undefined
  readonly #maxHeight: number | undefined

  #sizing: NormalizedSizing | undefined

  constructor(input: FrameInput) {
    super()

    this.offsetTop = input.offsetTop ?? 0
    this.offsetRight = input.offsetRight ?? 0
    this.offsetBottom = input.offsetBottom ?? 0
    this.offsetLeft = input.offsetLeft ?? 0
    this.grow = input.grow ?? 0
    this.shrink = input.shrink ?? 0
    this.align = input.align ?? Number.POSITIVE_INFINITY
    this.stretch = input.stretch ?? Number.POSITIVE_INFINITY

    this.#width = input.width
    this.#height = input.height
    this.#aspectRatio = input.aspectRatio
    this.#minWidth = input.minWidth
    this.#minHeight = input.minHeight
    this.#maxWidth = input.maxWidth
    this.#maxHeight = input.maxHeight
  }

  get #resolved(): NormalizedSizing {
    return (this.#sizing ??= normalizeSizing(
      this.#aspectRatio ?? 0,
      this.#width ?? Number.NaN,
      this.#height ?? Number.NaN,
      this.#minWidth ?? 0,
      this.#minHeight ?? 0,
      this.#maxWidth ?? Number.POSITIVE_INFINITY,
      this.#maxHeight ?? Number.POSITIVE_INFINITY,
    ))
  }

  /**
   * The resolved width: the raw input clamped between `minWidth` and
   * `maxWidth`, never negative. The minimum wins when the constraints
   * conflict.
   *
   * When the raw width is unset it derives from the height through
   * `aspectRatio` where possible (`Frame.make({ height: 50, aspectRatio: 2 })`
   * resolves to `100`), and otherwise falls back to `0`, which `minWidth`
   * can raise.
   */
  get width(): number {
    return this.#resolved.width
  }

  /**
   * The resolved height: the raw input clamped between `minHeight` and
   * `maxHeight`, never negative. The minimum wins when the constraints
   * conflict.
   *
   * When the raw height is unset it derives from the width through
   * `aspectRatio` where possible (`Frame.make({ width: 100, aspectRatio: 2 })`
   * resolves to `50`), and otherwise falls back to `0`, which `minHeight`
   * can raise.
   */
  get height(): number {
    return this.#resolved.height
  }

  /**
   * The resolved width over the resolved height — the exact IEEE division,
   * whatever the raw `aspectRatio` input was. Degenerate sizes return what
   * division produces: `Infinity` for a positive width over a `0` height,
   * `NaN` for `0` over `0` (the empty `Frame.make({})`).
   */
  get aspectRatio(): number {
    return this.#resolved.aspectRatio
  }

  /**
   * The effective lower bound on `width`: the raw input clamped to
   * `>= 0`, and `0` when unset.
   */
  get minWidth(): number {
    return this.#resolved.minWidth
  }

  /**
   * The effective lower bound on `height`: the raw input clamped to
   * `>= 0`, and `0` when unset.
   */
  get minHeight(): number {
    return this.#resolved.minHeight
  }

  /**
   * The effective upper bound on `width`: the raw input clamped to
   * `>= 0`, and `Infinity` when unset.
   */
  get maxWidth(): number {
    return this.#resolved.maxWidth
  }

  /**
   * The effective upper bound on `height`: the raw input clamped to
   * `>= 0`, and `Infinity` when unset.
   */
  get maxHeight(): number {
    return this.#resolved.maxHeight
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Frame [${this.width} x ${this.height}]`
  }

  /**
   * Returns the frame's raw inputs: unset sizing fields come back
   * `undefined`, never their resolved values. Under `JSON.stringify`,
   * unset fields drop out and infinite values (`align`/`stretch` inherit,
   * auto offsets) become `null` — which `make` reads back as the field's
   * default, so a JSON round trip keeps inheritance but turns auto offsets
   * into `0`.
   *
   * @returns The raw input record, of the shape `make` accepts.
   */
  toJSON() {
    return {
      offsetTop: this.offsetTop,
      offsetRight: this.offsetRight,
      offsetBottom: this.offsetBottom,
      offsetLeft: this.offsetLeft,
      width: this.#width,
      height: this.#height,
      aspectRatio: this.#aspectRatio,
      minWidth: this.#minWidth,
      minHeight: this.#minHeight,
      maxWidth: this.#maxWidth,
      maxHeight: this.#maxHeight,
      grow: this.grow,
      shrink: this.shrink,
      align: this.align,
      stretch: this.stretch,
    }
  }
}

export type { Frame }

/**
 * Creates a `Frame`.
 *
 * Omitted sizing fields are unset, not zero: the frame keeps deriving them
 * as other fields change, where an explicit value — even `0` — pins a
 * dimension.
 *
 * @param input - The frame's fields; see `FrameInput` for the per-field defaults.
 * @returns An immutable `Frame`.
 * @example
 * ```ts
 * const item = Frame.make({ width: 100, aspectRatio: 2 })
 * item.height // 50
 * Frame.setWidth(item, 200).height // 100 — the height keeps deriving
 * ```
 */
export const make = (input: FrameInput): Frame => new Frame(input)

/**
 * Checks if a value is a `Frame`. True only for values built by `make`,
 * which carry the brand.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Frame`, `false` otherwise.
 */
export const isFrame = (value: unknown): value is Frame => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from the raw inputs (toJSON), never the resolved sizing.
// Those with optional trailing arguments dispatch on isFrame: the data-last
// form's first argument is always a number, so the forms cannot collide.

/**
 * Sets all four offsets in CSS shorthand order: one value for every edge,
 * two values for vertical then horizontal, three values for top,
 * horizontal, then bottom, four values for top, right,
 * bottom, left. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The frame to update.
 * @param offsetTop - The top offset. As the only value, every edge; as the first of two, both vertical edges.
 * @param offsetRight - The right offset. As the second of two values, both horizontal edges.
 * @param offsetBottom - The bottom offset.
 * @param offsetLeft - The left offset.
 * @returns A new frame with the offsets replaced.
 * @example
 * ```ts
 * Frame.setOffset(Frame.make({}), 1, 2, 3, 4).offsetLeft // 4
 * Frame.make({}).pipe(Frame.setOffset(10, 20)).offsetTop // 10
 * ```
 */
export const setOffset: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetY: number, offsetX: number): Frame
  (self: Frame, offsetTop: number, offsetX: number, offsetBottom: number): Frame
  (
    self: Frame,
    offsetTop: number,
    offsetRight: number,
    offsetBottom: number,
    offsetLeft: number,
  ): Frame
  (offset: number): (self: Frame) => Frame
  (offsetY: number, offsetX: number): (self: Frame) => Frame
  (offsetTop: number, offsetX: number, offsetBottom: number): (self: Frame) => Frame
  (
    offsetTop: number,
    offsetRight: number,
    offsetBottom: number,
    offsetLeft: number,
  ): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, a: number, b?: number, c?: number, d?: number) => {
    const [top, right, bottom, left] = normalizeTRBL(a, b, c, d)
    return new Frame({
      ...self.toJSON(),
      offsetTop: top,
      offsetRight: right,
      offsetBottom: bottom,
      offsetLeft: left,
    })
  },
)

/**
 * Sets the horizontal offsets: one value for both edges, two values for
 * left then right. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The frame to update.
 * @param offsetLeft - The left offset. As the only value, the right offset too.
 * @param offsetRight - The right offset.
 * @returns A new frame with the horizontal offsets replaced.
 */
export const setOffsetX: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetLeft: number, offsetRight: number): Frame
  (offset: number): (self: Frame) => Frame
  (offsetLeft: number, offsetRight: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, left: number, right?: number) =>
    new Frame({ ...self.toJSON(), offsetLeft: left, offsetRight: right ?? left }),
)

/**
 * Sets the vertical offsets: one value for both edges, two values for top
 * then bottom. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The frame to update.
 * @param offsetTop - The top offset. As the only value, the bottom offset too.
 * @param offsetBottom - The bottom offset.
 * @returns A new frame with the vertical offsets replaced.
 */
export const setOffsetY: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetTop: number, offsetBottom: number): Frame
  (offset: number): (self: Frame) => Frame
  (offsetTop: number, offsetBottom: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, top: number, bottom?: number) =>
    new Frame({ ...self.toJSON(), offsetTop: top, offsetBottom: bottom ?? top }),
)

/**
 * Sets the top offset, leaving the other edges alone. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new top offset.
 * @returns A new frame with the top offset replaced.
 */
export const setOffsetTop: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetTop: offset }))

/**
 * Sets the right offset, leaving the other edges alone. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new right offset.
 * @returns A new frame with the right offset replaced.
 */
export const setOffsetRight: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetRight: offset }))

/**
 * Sets the bottom offset, leaving the other edges alone. The data-last
 * form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new bottom offset.
 * @returns A new frame with the bottom offset replaced.
 */
export const setOffsetBottom: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetBottom: offset }))

/**
 * Sets the left offset, leaving the other edges alone. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new left offset.
 * @returns A new frame with the left offset replaced.
 */
export const setOffsetLeft: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetLeft: offset }))

/**
 * Sets the preferred width and height. Note the order: width first, the
 * opposite of `setOffset`'s vertical-first two-value form. One value sets
 * both dimensions. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The frame to update.
 * @param width - The new width.
 * @param height - The new height; the width when omitted.
 * @returns A new frame with both dimensions set.
 * @example
 * ```ts
 * Frame.setSize(Frame.make({}), 100, 50).height // 50
 * Frame.make({}).pipe(Frame.setSize(100)).height // 100
 * ```
 */
export const setSize: {
  (self: Frame, width: number, height?: number): Frame
  (width: number, height?: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, width: number, height?: number) =>
    new Frame({ ...self.toJSON(), width, height: height ?? width }),
)

/**
 * Sets the preferred width, leaving the other sizing inputs — including an
 * unset height — as they were: a height left to derive from `aspectRatio`
 * re-derives against the new width. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The frame to update.
 * @param width - The new width.
 * @returns A new frame with the width replaced.
 * @example
 * ```ts
 * const item = Frame.make({ width: 100, aspectRatio: 2 })
 * Frame.setWidth(item, 200).height // 100 — the height keeps deriving
 * ```
 */
export const setWidth: {
  (self: Frame, width: number): Frame
  (width: number): (self: Frame) => Frame
} = dual(2, (self: Frame, width: number) => new Frame({ ...self.toJSON(), width }))

/**
 * Sets the preferred height, leaving the other sizing inputs — including
 * an unset width — as they were: a width left to derive from `aspectRatio`
 * re-derives against the new height. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The frame to update.
 * @param height - The new height.
 * @returns A new frame with the height replaced.
 */
export const setHeight: {
  (self: Frame, height: number): Frame
  (height: number): (self: Frame) => Frame
} = dual(2, (self: Frame, height: number) => new Frame({ ...self.toJSON(), height }))

/**
 * Sets the width-to-height ratio that derives whichever dimension is
 * unset. Non-positive and `NaN` ratios act as unset. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param aspectRatio - The new ratio, as `width / height`.
 * @returns A new frame with the ratio replaced.
 * @example
 * ```ts
 * Frame.setAspectRatio(Frame.make({ width: 100 }), 4).height // 25
 * ```
 */
export const setAspectRatio: {
  (self: Frame, aspectRatio: number): Frame
  (aspectRatio: number): (self: Frame) => Frame
} = dual(2, (self: Frame, aspectRatio: number) => new Frame({ ...self.toJSON(), aspectRatio }))

/**
 * Sets the minimum width and height, width first. One value sets both
 * minimums. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param minWidth - The new minimum width.
 * @param minHeight - The new minimum height; the minimum width when omitted.
 * @returns A new frame with both minimums set.
 */
export const setMinSize: {
  (self: Frame, minWidth: number, minHeight?: number): Frame
  (minWidth: number, minHeight?: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, minWidth: number, minHeight?: number) =>
    new Frame({ ...self.toJSON(), minWidth, minHeight: minHeight ?? minWidth }),
)

/**
 * Sets the minimum width, the lower clamp on the resolved width. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param minWidth - The new minimum width.
 * @returns A new frame with the minimum width replaced.
 */
export const setMinWidth: {
  (self: Frame, minWidth: number): Frame
  (minWidth: number): (self: Frame) => Frame
} = dual(2, (self: Frame, minWidth: number) => new Frame({ ...self.toJSON(), minWidth }))

/**
 * Sets the minimum height, the lower clamp on the resolved height. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param minHeight - The new minimum height.
 * @returns A new frame with the minimum height replaced.
 */
export const setMinHeight: {
  (self: Frame, minHeight: number): Frame
  (minHeight: number): (self: Frame) => Frame
} = dual(2, (self: Frame, minHeight: number) => new Frame({ ...self.toJSON(), minHeight }))

/**
 * Sets the maximum width and height, width first. One value sets both
 * maximums. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param maxWidth - The new maximum width.
 * @param maxHeight - The new maximum height; the maximum width when omitted.
 * @returns A new frame with both maximums set.
 */
export const setMaxSize: {
  (self: Frame, maxWidth: number, maxHeight?: number): Frame
  (maxWidth: number, maxHeight?: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, maxWidth: number, maxHeight?: number) =>
    new Frame({ ...self.toJSON(), maxWidth, maxHeight: maxHeight ?? maxWidth }),
)

/**
 * Sets the maximum width, the upper clamp on the resolved width.
 * Constraints apply to the raw preferred size, so raising a maximum
 * un-clamps a width set earlier. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The frame to update.
 * @param maxWidth - The new maximum width.
 * @returns A new frame with the maximum width replaced.
 * @example
 * ```ts
 * const clamped = Frame.make({ width: 100, maxWidth: 80 })
 * clamped.width // 80
 * Frame.setMaxWidth(clamped, 200).width // 100
 * ```
 */
export const setMaxWidth: {
  (self: Frame, maxWidth: number): Frame
  (maxWidth: number): (self: Frame) => Frame
} = dual(2, (self: Frame, maxWidth: number) => new Frame({ ...self.toJSON(), maxWidth }))

/**
 * Sets the maximum height, the upper clamp on the resolved height.
 * Constraints apply to the raw preferred size, so raising a maximum
 * un-clamps a height set earlier. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The frame to update.
 * @param maxHeight - The new maximum height.
 * @returns A new frame with the maximum height replaced.
 */
export const setMaxHeight: {
  (self: Frame, maxHeight: number): Frame
  (maxHeight: number): (self: Frame) => Frame
} = dual(2, (self: Frame, maxHeight: number) => new Frame({ ...self.toJSON(), maxHeight }))

/**
 * Sets the flex grow factor: the frame's share of positive free space
 * along the container's main axis, in proportion to the other items'
 * factors. Non-positive factors never grow. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param grow - The new grow factor.
 * @returns A new frame with the grow factor replaced.
 */
export const setGrow: {
  (self: Frame, grow: number): Frame
  (grow: number): (self: Frame) => Frame
} = dual(2, (self: Frame, grow: number) => new Frame({ ...self.toJSON(), grow }))

/**
 * Sets the flex shrink factor: the frame's share of main-axis overflow, in
 * proportion to factor times base size (as in CSS). Non-positive factors
 * never shrink. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The frame to update.
 * @param shrink - The new shrink factor.
 * @returns A new frame with the shrink factor replaced.
 */
export const setShrink: {
  (self: Frame, shrink: number): Frame
  (shrink: number): (self: Frame) => Frame
} = dual(2, (self: Frame, shrink: number) => new Frame({ ...self.toJSON(), shrink }))

/**
 * Sets the frame's own cross-axis placement, overriding the container's
 * `alignItems`: `0` at the cross start, `0.5` centered, `1` at the cross
 * end. `Number.POSITIVE_INFINITY` restores inheritance. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param align - The placement fraction, or `Number.POSITIVE_INFINITY` to inherit.
 * @returns A new frame with the alignment replaced.
 */
export const setAlign: {
  (self: Frame, align: number): Frame
  (align: number): (self: Frame) => Frame
} = dual(2, (self: Frame, align: number) => new Frame({ ...self.toJSON(), align }))

/**
 * Sets how much of the free cross-axis space the frame absorbs into its
 * size, overriding the container's `stretchItems`: `0` keeps the resolved
 * size, `1` fills the line, within the min/max constraints.
 * `Number.POSITIVE_INFINITY` restores inheritance. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param stretch - The stretch fraction, or `Number.POSITIVE_INFINITY` to inherit.
 * @returns A new frame with the stretch replaced.
 */
export const setStretch: {
  (self: Frame, stretch: number): Frame
  (stretch: number): (self: Frame) => Frame
} = dual(2, (self: Frame, stretch: number) => new Frame({ ...self.toJSON(), stretch }))
