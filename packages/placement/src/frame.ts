import { Pipeable, dual } from 'curvy/utils'
import type * as AspectRatio from './aspectRatio.ts'
import { SizingOf } from './internal/sizing.ts'
import type { LengthInput } from './length.ts'
import * as Margin from './margin.ts'
import * as Sizing from './sizing.ts'
import { normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/frame')
type TypeBrand = typeof TypeBrand

// Sizing state uses symbols, not `#private` fields, so reads still work
// through a `Proxy` (Vue's `ref`/`reactive`).
const Raw: unique symbol = Symbol('placement/frame/raw')
const Size: unique symbol = Symbol('placement/frame/size')

type RawSizing = { readonly [K in keyof Sizing.SizingInput]-?: Sizing.SizingInput[K] }

/**
 * The construction input for `make`. Every field is optional. Passing
 * `undefined` is the same as omitting the field.
 *
 * Each group of fields treats omission differently:
 *
 * - Margins (see `placement/margin`), `grow`, and `shrink` default to `0`.
 * - `align` and `stretch` default to the inherit sentinel
 *   (`Number.POSITIVE_INFINITY`).
 * - The sizing fields (see `placement/sizing`) stay unset, and so does any
 *   non-finite size or bound. An unset width or height derives through
 *   `aspectRatio` or takes the size its layout supplies, which is `0` for
 *   the frame's own `width` and `height` (see `Frame`).
 *
 * The type parameter `L` is the type of the length fields: the margins,
 * the sizes, and the bounds. `make` takes numbers, the default. A layer
 * that knows the basis of a percentage can take `FrameInput<LengthInput>`
 * (see `placement/length`) and resolve its lengths before it calls `make`.
 */
export interface FrameInput<L extends LengthInput = number>
  extends Sizing.SizingInput<L>, Margin.MarginInput<L> {
  /**
   * The flex grow factor: the frame's share of positive free space along
   * the container's main axis, in proportion to the other items' factors.
   * A frame with a non-positive factor never grows. Defaults to `0`.
   */
  readonly grow?: number | undefined
  /**
   * The flex shrink factor: the frame's share of main-axis overflow, in
   * proportion to factor times base size (as in CSS). A frame with a
   * non-positive factor never shrinks. Defaults to `0`, but CSS defaults
   * to `1`.
   */
  readonly shrink?: number | undefined
  /**
   * The position of the frame in the free cross-axis space of its line, as
   * a fraction: `0` at the cross start, `0.5` centered, `1` at the cross
   * end. Defaults to `Number.POSITIVE_INFINITY`, the inherit sentinel,
   * which applies the container's `alignItems`.
   */
  readonly align?: number | undefined
  /**
   * How much of the free cross-axis space the frame absorbs into its size,
   * as a fraction: `0` keeps the resolved size, `1` fills the line. The
   * min/max constraints still apply. Defaults to
   * `Number.POSITIVE_INFINITY`, the inherit sentinel, which applies the
   * container's `stretchItems`.
   */
  readonly stretch?: number | undefined
}

/**
 * A flex-item spec: the sizing, margin, and placement inputs that
 * `Flexbox.apply` (from `placement/flexbox`) reads for one item of a
 * container. A frame has no position of its own. Layout produces `Rect`s.
 *
 * Values are immutable. Every setter returns a new frame. The frame stores
 * the sizing inputs raw and keeps track of which ones are unset. The sizing
 * getters resolve from whatever is set. The setters rebuild from the raw
 * inputs, so a derived dimension keeps re-deriving after any setter.
 *
 * Width and height resolve as `resolve` in `placement/sizing` resolves
 * them, with `0` for an unset size:
 *
 * - If both are set, each clamps to its own min/max constraints.
 * - If one is set and `aspectRatio` is set, the set dimension clamps. The
 *   other derives from it through the ratio, then clamps.
 * - If only `aspectRatio` is set, the ratio applies against the clamped `0`
 *   fallbacks. A positive minimum on one axis then drives the other.
 * - If nothing is set, both dimensions fall back to `0`, clamped.
 *
 * Layouts resolve the sizing again where they fix an axis. A frame
 * stretched into known space takes the stretched size on that axis, and an
 * unset size on the other axis follows it through the ratio (see
 * `Flexbox.apply` and `Hierarchy.apply`).
 *
 * The resolution arithmetic is exact IEEE 754 (see PRECISION.md).
 *
 * A frame has no identity. A layout that connects items, such as
 * `Hierarchy.apply` (from `placement/hierarchy`), takes its frames keyed by
 * id.
 *
 * Create a frame with `make`.
 */
class Frame extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /**
   * The space reserved above the frame in its container. A non-finite value
   * is an auto margin. Layout then gives the edge an equal share of the free
   * space on its axis.
   */
  readonly marginTop: number
  /**
   * The space reserved to the right of the frame. A non-finite value is an
   * auto margin. Layout then gives the edge an equal share of the free space
   * on its axis.
   */
  readonly marginRight: number
  /**
   * The space reserved below the frame. A non-finite value is an auto
   * margin. Layout then gives the edge an equal share of the free space on
   * its axis.
   */
  readonly marginBottom: number
  /**
   * The space reserved to the left of the frame. A non-finite value is an
   * auto margin. Layout then gives the edge an equal share of the free space
   * on its axis.
   */
  readonly marginLeft: number
  /**
   * The flex grow factor: the frame's share of positive free space along
   * the container's main axis, in proportion to the other items' factors.
   * A frame with a non-positive factor never grows.
   */
  readonly grow: number
  /**
   * The flex shrink factor: the frame's share of main-axis overflow, in
   * proportion to factor times base size (as in CSS). A frame with a
   * non-positive factor never shrinks.
   */
  readonly shrink: number
  /**
   * The position of the frame in the free cross-axis space of its line, as
   * a fraction: `0` at the cross start, `0.5` centered, `1` at the cross
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

  // The frame stores sizing inputs raw (undefined means unset) so that
  // unset-ness survives setter round trips. It normalizes them, and
  // resolves its own size, once at construction.
  readonly [Raw]: RawSizing
  readonly [SizingOf]: Sizing.Sizing
  readonly [Size]: Sizing.Size

  constructor(input: FrameInput) {
    super()

    const margin = Margin.normalize(input)
    this.marginTop = margin.marginTop
    this.marginRight = margin.marginRight
    this.marginBottom = margin.marginBottom
    this.marginLeft = margin.marginLeft
    this.grow = input.grow ?? 0
    this.shrink = input.shrink ?? 0
    this.align = input.align ?? Number.POSITIVE_INFINITY
    this.stretch = input.stretch ?? Number.POSITIVE_INFINITY

    const raw: RawSizing = {
      width: input.width,
      height: input.height,
      aspectRatio: input.aspectRatio,
      minWidth: input.minWidth,
      minHeight: input.minHeight,
      maxWidth: input.maxWidth,
      maxHeight: input.maxHeight,
    }
    this[Raw] = raw
    this[SizingOf] = Sizing.normalize(raw)
    this[Size] = Sizing.resolve(this[SizingOf], { width: 0, height: 0 })
  }

  /**
   * The resolved width. It is the raw input clamped between `minWidth` and
   * `maxWidth`, and it is never negative. If the constraints conflict, the
   * minimum wins.
   *
   * If the raw width is unset or non-finite, it derives from the height
   * through `aspectRatio` where possible
   * (`Frame.make({ height: 50, aspectRatio: 2 })` resolves to `100`).
   * Otherwise it falls back to `0`, which `minWidth` can raise.
   */
  get width(): number {
    return this[Size].width
  }

  /**
   * The resolved height. It is the raw input clamped between `minHeight` and
   * `maxHeight`, and it is never negative. If the constraints conflict, the
   * minimum wins.
   *
   * If the raw height is unset or non-finite, it derives from the width
   * through `aspectRatio` where possible
   * (`Frame.make({ width: 100, aspectRatio: 2 })` resolves to `50`).
   * Otherwise it falls back to `0`, which `minHeight` can raise.
   */
  get height(): number {
    return this[Size].height
  }

  /**
   * The resolved width over the resolved height, by exact IEEE division.
   * The getter always divides the resolved sizes and never returns the raw
   * `aspectRatio` input. For degenerate sizes, it returns what the division
   * produces: `Infinity` for a positive width over a `0` height, and `NaN`
   * for `0` over `0` (the empty `Frame.make({})`).
   */
  get aspectRatio(): number {
    return this[Size].width / this[Size].height
  }

  /**
   * The effective lower bound on `width`: the raw input clamped to
   * `>= 0`, and `0` when unset or non-finite.
   */
  get minWidth(): number {
    return this[SizingOf].minWidth
  }

  /**
   * The effective lower bound on `height`: the raw input clamped to
   * `>= 0`, and `0` when unset or non-finite.
   */
  get minHeight(): number {
    return this[SizingOf].minHeight
  }

  /**
   * The effective upper bound on `width`: the raw input clamped to
   * `>= 0`, and `Infinity` when unset or non-finite. If the bounds cross,
   * it rises to `minWidth`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxWidth(): number {
    return this[SizingOf].maxWidth
  }

  /**
   * The effective upper bound on `height`: the raw input clamped to
   * `>= 0`, and `Infinity` when unset or non-finite. If the bounds cross,
   * it rises to `minHeight`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxHeight(): number {
    return this[SizingOf].maxHeight
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Frame [${this.width} x ${this.height}]`
  }

  /**
   * Returns the raw inputs of the frame. Unset sizing fields come back as
   * `undefined`, never as their resolved values. `JSON.stringify` drops the
   * unset fields and writes infinite values (`align`/`stretch` inherit,
   * auto margins) as `null`. The `make` factory reads `null` back as the
   * default of the field. A JSON round trip therefore keeps inheritance but
   * turns auto margins into `0`.
   *
   * @returns The raw input record, of the shape `make` accepts.
   */
  toJSON(): FrameInput {
    return {
      marginTop: this.marginTop,
      marginRight: this.marginRight,
      marginBottom: this.marginBottom,
      marginLeft: this.marginLeft,
      width: this[Raw].width,
      height: this[Raw].height,
      aspectRatio: this[Raw].aspectRatio,
      minWidth: this[Raw].minWidth,
      minHeight: this[Raw].minHeight,
      maxWidth: this[Raw].maxWidth,
      maxHeight: this[Raw].maxHeight,
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
 * Omitted sizing fields are unset, not zero. The frame keeps deriving them
 * as other fields change. An explicit value, even `0`, pins a dimension.
 *
 * @param input - The frame's fields. See `FrameInput` for the default of each field.
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
 * Checks if a value is a `Frame`. Only values that `make` builds carry the
 * brand, so only they pass.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Frame`, `false` otherwise.
 */
export const isFrame = (value: unknown): value is Frame => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from the raw inputs (toJSON), never from the resolved
// sizing. Setters with optional trailing arguments dispatch on isFrame. The
// first argument of the data-last form is always a number, so the two forms
// cannot collide.

/**
 * Sets all four margins in CSS shorthand order. One value sets every edge.
 * Two values set the vertical edges, then the horizontal edges. Three values
 * set top, horizontal, then bottom. Four values set top, right, bottom, and
 * left. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param marginTop - The top margin. As the only value, it sets every edge. As the
 * first of two, it sets both vertical edges.
 * @param marginRight - The right margin. As the second of two values, it sets both
 * horizontal edges.
 * @param marginBottom - The bottom margin.
 * @param marginLeft - The left margin.
 * @returns A new frame with the margins replaced.
 * @example
 * ```ts
 * Frame.setMargin(Frame.make({}), 1, 2, 3, 4).marginLeft // 4
 * Frame.make({}).pipe(Frame.setMargin(10, 20)).marginTop // 10
 * ```
 */
export const setMargin: {
  (self: Frame, margin: number): Frame
  (self: Frame, marginY: number, marginX: number): Frame
  (self: Frame, marginTop: number, marginX: number, marginBottom: number): Frame
  (
    self: Frame,
    marginTop: number,
    marginRight: number,
    marginBottom: number,
    marginLeft: number,
  ): Frame
  (margin: number): (self: Frame) => Frame
  (marginY: number, marginX: number): (self: Frame) => Frame
  (marginTop: number, marginX: number, marginBottom: number): (self: Frame) => Frame
  (
    marginTop: number,
    marginRight: number,
    marginBottom: number,
    marginLeft: number,
  ): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, a: number, b?: number, c?: number, d?: number) => {
    const [top, right, bottom, left] = normalizeTRBL(a, b, c, d)
    return new Frame({
      ...self.toJSON(),
      marginTop: top,
      marginRight: right,
      marginBottom: bottom,
      marginLeft: left,
    })
  },
)

/**
 * Sets the horizontal margins. One value sets both edges. Two values set
 * left, then right. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The frame to update.
 * @param marginLeft - The left margin. As the only value, it also sets the right margin.
 * @param marginRight - The right margin.
 * @returns A new frame with the horizontal margins replaced.
 */
export const setMarginX: {
  (self: Frame, margin: number): Frame
  (self: Frame, marginLeft: number, marginRight: number): Frame
  (margin: number): (self: Frame) => Frame
  (marginLeft: number, marginRight: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, left: number, right?: number) =>
    new Frame({ ...self.toJSON(), marginLeft: left, marginRight: right ?? left }),
)

/**
 * Sets the vertical margins. One value sets both edges. Two values set top,
 * then bottom. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The frame to update.
 * @param marginTop - The top margin. As the only value, it also sets the bottom margin.
 * @param marginBottom - The bottom margin.
 * @returns A new frame with the vertical margins replaced.
 */
export const setMarginY: {
  (self: Frame, margin: number): Frame
  (self: Frame, marginTop: number, marginBottom: number): Frame
  (margin: number): (self: Frame) => Frame
  (marginTop: number, marginBottom: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, top: number, bottom?: number) =>
    new Frame({ ...self.toJSON(), marginTop: top, marginBottom: bottom ?? top }),
)

/**
 * Sets the top margin and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param margin - The new top margin.
 * @returns A new frame with the top margin replaced.
 */
export const setMarginTop: {
  (self: Frame, margin: number): Frame
  (margin: number): (self: Frame) => Frame
} = dual(2, (self: Frame, margin: number) => new Frame({ ...self.toJSON(), marginTop: margin }))

/**
 * Sets the right margin and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param margin - The new right margin.
 * @returns A new frame with the right margin replaced.
 */
export const setMarginRight: {
  (self: Frame, margin: number): Frame
  (margin: number): (self: Frame) => Frame
} = dual(2, (self: Frame, margin: number) => new Frame({ ...self.toJSON(), marginRight: margin }))

/**
 * Sets the bottom margin and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param margin - The new bottom margin.
 * @returns A new frame with the bottom margin replaced.
 */
export const setMarginBottom: {
  (self: Frame, margin: number): Frame
  (margin: number): (self: Frame) => Frame
} = dual(2, (self: Frame, margin: number) => new Frame({ ...self.toJSON(), marginBottom: margin }))

/**
 * Sets the left margin and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param margin - The new left margin.
 * @returns A new frame with the left margin replaced.
 */
export const setMarginLeft: {
  (self: Frame, margin: number): Frame
  (margin: number): (self: Frame) => Frame
} = dual(2, (self: Frame, margin: number) => new Frame({ ...self.toJSON(), marginLeft: margin }))

/**
 * Sets the preferred width and height. The width comes first. This is the
 * opposite of the two-value form of `setMargin`, which puts the vertical
 * edges first. One value sets both dimensions. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param width - The new width.
 * @param height - The new height. Defaults to the width.
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
 * Sets the preferred width and keeps the other sizing inputs, including an
 * unset height. If the height derives from `aspectRatio`, it re-derives
 * against the new width. The data-last form omits `self` and returns a
 * function of it.
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
 * Sets the preferred height and keeps the other sizing inputs, including an
 * unset width. If the width derives from `aspectRatio`, it re-derives
 * against the new height. The data-last form omits `self` and returns a
 * function of it.
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
 * Sets the width-to-height ratio. The frame uses it to derive whichever
 * dimension is unset. Non-positive and non-finite ratios act as unset. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param aspectRatio - The new ratio, as `width / height` or a `[width, height]` pair.
 * @returns A new frame with the ratio replaced.
 * @example
 * ```ts
 * Frame.setAspectRatio(Frame.make({ width: 100 }), 4).height // 25
 * Frame.setAspectRatio(Frame.make({ height: 7 }), [16, 9]).width // 12.444444444444445
 * ```
 */
export const setAspectRatio: {
  (self: Frame, aspectRatio: AspectRatio.AspectRatio): Frame
  (aspectRatio: AspectRatio.AspectRatio): (self: Frame) => Frame
} = dual(
  2,
  (self: Frame, aspectRatio: AspectRatio.AspectRatio) =>
    new Frame({ ...self.toJSON(), aspectRatio }),
)

/**
 * Sets the minimum width and height, width first. One value sets both
 * minimums. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param minWidth - The new minimum width.
 * @param minHeight - The new minimum height. Defaults to the minimum width.
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
 * @param maxHeight - The new maximum height. Defaults to the maximum width.
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
 * factors. A frame with a non-positive factor never grows. The data-last
 * form omits `self` and returns a function of it.
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
 * proportion to factor times base size (as in CSS). A frame with a
 * non-positive factor never shrinks. The data-last form omits `self` and
 * returns a function of it.
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
 * Sets the cross-axis placement of the frame, which overrides the
 * container's `alignItems`. The value is a fraction: `0` at the cross
 * start, `0.5` centered, `1` at the cross end. `Number.POSITIVE_INFINITY`
 * restores inheritance. The data-last form omits `self` and returns a
 * function of it.
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
 * size, which overrides the container's `stretchItems`. The value is a
 * fraction: `0` keeps the resolved size, `1` fills the line, within the
 * min/max constraints. `Number.POSITIVE_INFINITY` restores inheritance. The data-last form
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
