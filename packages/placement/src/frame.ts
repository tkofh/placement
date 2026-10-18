import { Pipeable, dual } from 'curvy/utils'
import type * as AspectRatio from './aspectRatio.ts'
import { type RawAspectRatio, toRawRatio } from './internal/aspectRatio.ts'
import { type NormalizedSizing, normalizeSizing, normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/frame')
type TypeBrand = typeof TypeBrand

// Sizing state uses module-private symbols, not `#private` fields, so reads
// still work through a `Proxy` (Vue's `ref`/`reactive`).
const Raw: unique symbol = Symbol('placement/frame/raw')
const Sizing: unique symbol = Symbol('placement/frame/sizing')

type RawSizing = {
  readonly [K in 'width' | 'height' | 'minWidth' | 'minHeight' | 'maxWidth' | 'maxHeight']:
    | number
    | undefined
} & {
  readonly aspectRatio: RawAspectRatio
}

/**
 * The construction input for `make`. Every field is optional. Passing
 * `undefined` is the same as omitting the field.
 *
 * Each group of fields treats omission differently. Offsets, `grow`, and
 * `shrink` default to `0`. The fields `align` and `stretch` default to the
 * inherit sentinel (`Number.POSITIVE_INFINITY`). The sizing fields stay
 * unset and get no default. These are `width`, `height`, `aspectRatio`, and
 * the min/max constraints. The frame derives them from the fields that are
 * set (see `Frame`). The `id` stays `undefined` when omitted.
 *
 * The type parameter `K` is the literal type of `id`, or `undefined` when
 * the frame has none.
 */
export interface FrameInput<K extends string | undefined = string | undefined> {
  /**
   * An identifier for the frame. Layouts that connect frames to each other,
   * such as `Hierarchy.apply` (from `placement/hierarchy`), require it and
   * reference frames by it. Other layouts ignore it. Defaults to
   * `undefined`.
   */
  readonly id?: K
  /**
   * Space reserved above the frame, which is its top margin in the
   * container. A non-finite value requests an auto margin. Layout then gives
   * the edge an equal share of the free space on its axis. Defaults to `0`.
   */
  readonly offsetTop?: number | undefined
  /**
   * Space reserved to the right of the frame, which is its right margin. A
   * non-finite value requests an auto margin. Layout then gives the edge an
   * equal share of the free space on its axis. Defaults to `0`.
   */
  readonly offsetRight?: number | undefined
  /**
   * Space reserved below the frame, which is its bottom margin. A non-finite
   * value requests an auto margin. Layout then gives the edge an equal share
   * of the free space on its axis. Defaults to `0`.
   */
  readonly offsetBottom?: number | undefined
  /**
   * Space reserved to the left of the frame, which is its left margin. A
   * non-finite value requests an auto margin. Layout then gives the edge an
   * equal share of the free space on its axis. Defaults to `0`.
   */
  readonly offsetLeft?: number | undefined
  /**
   * The preferred width. If you omit it, the width is unset. The resolved
   * width then derives from the height and `aspectRatio`, or falls back to
   * `0`.
   */
  readonly width?: number | undefined
  /**
   * The preferred height. If you omit it, the height is unset. The resolved
   * height then derives from the width and `aspectRatio`, or falls back to
   * `0`.
   */
  readonly height?: number | undefined
  /**
   * The width-to-height ratio, as a number (`width / height`) or a
   * `[width, height]` pair such as `[16, 9]` (see `placement/aspectRatio`).
   * The frame uses it to derive whichever of `width` and `height` is
   * unset. A pair derives it with one rounding. Ratios whose value is non-positive or `NaN` act as unset. If you omit it, the
   * ratio is unset.
   */
  readonly aspectRatio?: AspectRatio.AspectRatio | undefined
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
 * Width and height resolve in this order:
 * - If both are set, each clamps to its own min/max constraints.
 * - If one is set and `aspectRatio` is positive, the set dimension clamps.
 *   The other derives from it through the ratio, then clamps.
 * - If only `aspectRatio` is set, the ratio applies against the clamped `0`
 *   fallbacks. A positive minimum on one axis then drives the other.
 * - If nothing is set, both dimensions fall back to `0`, clamped.
 *
 * The resolution arithmetic is exact IEEE 754 (see PRECISION.md).
 *
 * The type parameter `K` is the literal type of `id`. A frame without an id
 * is a `Frame<undefined>`. The bare `Frame` type accepts any frame.
 *
 * Create a frame with `make`.
 */
class Frame<K extends string | undefined = string | undefined> extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /**
   * The frame's identifier, or `undefined` when it has none. Layouts that
   * connect frames, such as `Hierarchy.apply`, reference frames by it.
   */
  readonly id: K

  /**
   * Space reserved above the frame, which is its top margin in the
   * container. A non-finite value is an auto margin. Layout then gives the
   * edge an equal share of the free space on its axis.
   */
  readonly offsetTop: number
  /**
   * Space reserved to the right of the frame, which is its right margin. A
   * non-finite value is an auto margin. Layout then gives the edge an equal
   * share of the free space on its axis.
   */
  readonly offsetRight: number
  /**
   * Space reserved below the frame, which is its bottom margin. A non-finite
   * value is an auto margin. Layout then gives the edge an equal share of
   * the free space on its axis.
   */
  readonly offsetBottom: number
  /**
   * Space reserved to the left of the frame, which is its left margin. A
   * non-finite value is an auto margin. Layout then gives the edge an equal
   * share of the free space on its axis.
   */
  readonly offsetLeft: number
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
  // unset-ness survives setter round trips. It resolves them once at
  // construction.
  readonly [Raw]: RawSizing
  readonly [Sizing]: NormalizedSizing

  constructor(input: FrameInput<K>) {
    super()

    this.id = input.id as K
    this.offsetTop = input.offsetTop ?? 0
    this.offsetRight = input.offsetRight ?? 0
    this.offsetBottom = input.offsetBottom ?? 0
    this.offsetLeft = input.offsetLeft ?? 0
    this.grow = input.grow ?? 0
    this.shrink = input.shrink ?? 0
    this.align = input.align ?? Number.POSITIVE_INFINITY
    this.stretch = input.stretch ?? Number.POSITIVE_INFINITY

    const raw: RawSizing = {
      width: input.width,
      height: input.height,
      aspectRatio: toRawRatio(input.aspectRatio),
      minWidth: input.minWidth,
      minHeight: input.minHeight,
      maxWidth: input.maxWidth,
      maxHeight: input.maxHeight,
    }
    this[Raw] = raw
    this[Sizing] = normalizeSizing(
      raw.aspectRatio ?? 0,
      raw.width ?? Number.NaN,
      raw.height ?? Number.NaN,
      raw.minWidth ?? 0,
      raw.minHeight ?? 0,
      raw.maxWidth ?? Number.POSITIVE_INFINITY,
      raw.maxHeight ?? Number.POSITIVE_INFINITY,
    )
  }

  /**
   * The resolved width. It is the raw input clamped between `minWidth` and
   * `maxWidth`, and it is never negative. If the constraints conflict, the
   * minimum wins.
   *
   * If the raw width is unset, it derives from the height through
   * `aspectRatio` where possible (`Frame.make({ height: 50, aspectRatio: 2 })`
   * resolves to `100`). Otherwise it falls back to `0`, which `minWidth` can
   * raise.
   */
  get width(): number {
    return this[Sizing].width
  }

  /**
   * The resolved height. It is the raw input clamped between `minHeight` and
   * `maxHeight`, and it is never negative. If the constraints conflict, the
   * minimum wins.
   *
   * If the raw height is unset, it derives from the width through
   * `aspectRatio` where possible (`Frame.make({ width: 100, aspectRatio: 2 })`
   * resolves to `50`). Otherwise it falls back to `0`, which `minHeight` can
   * raise.
   */
  get height(): number {
    return this[Sizing].height
  }

  /**
   * The resolved width over the resolved height, by exact IEEE division.
   * The getter always divides the resolved sizes and never returns the raw
   * `aspectRatio` input. For degenerate sizes, it returns what the division
   * produces: `Infinity` for a positive width over a `0` height, and `NaN`
   * for `0` over `0` (the empty `Frame.make({})`).
   */
  get aspectRatio(): number {
    return this[Sizing].aspectRatio
  }

  /**
   * The effective lower bound on `width`: the raw input clamped to
   * `>= 0`, and `0` when unset.
   */
  get minWidth(): number {
    return this[Sizing].minWidth
  }

  /**
   * The effective lower bound on `height`: the raw input clamped to
   * `>= 0`, and `0` when unset.
   */
  get minHeight(): number {
    return this[Sizing].minHeight
  }

  /**
   * The effective upper bound on `width`: the raw input clamped to
   * `>= 0`, and `Infinity` when unset. If the bounds cross, it rises to
   * `minWidth`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxWidth(): number {
    return this[Sizing].maxWidth
  }

  /**
   * The effective upper bound on `height`: the raw input clamped to
   * `>= 0`, and `Infinity` when unset. If the bounds cross, it rises to
   * `minHeight`, so the minimum wins, as in CSS `clamp()`.
   */
  get maxHeight(): number {
    return this[Sizing].maxHeight
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Frame [${this.width} x ${this.height}]`
  }

  /**
   * Returns the raw inputs of the frame, including its `id`. Unset sizing
   * fields come back as `undefined`, never as their resolved values.
   * A ratio pair comes back as a copy, or as its width when its height is
   * `1`.
   * `JSON.stringify` drops the unset fields (and an unset `id`) and writes
   * infinite values (`align`/`stretch` inherit, auto offsets) as `null`. The `make` factory reads `null` back as the default
   * of the field. A JSON round trip therefore keeps inheritance but turns
   * auto offsets into `0`.
   *
   * @returns The raw input record, of the shape `make` accepts.
   */
  toJSON(): FrameInput<K> {
    return {
      id: this.id,
      offsetTop: this.offsetTop,
      offsetRight: this.offsetRight,
      offsetBottom: this.offsetBottom,
      offsetLeft: this.offsetLeft,
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
// `NoInfer` keeps a contextual type from choosing the id type. Only the
// input decides it, so an inline frame without an id stays
// `Frame<undefined>` even where a `Frame<string>` is expected.
export const make = <const K extends string | undefined = undefined>(
  input: FrameInput<K>,
): Frame<NoInfer<K>> => new Frame(input)

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

/**
 * Sets the frame's identifier, which changes the frame's type parameter to
 * the new id's literal type. Passing `undefined` removes the id. The id is
 * never a frame, so the arity is fixed. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The frame to update.
 * @param id - The new identifier, or `undefined` to remove it.
 * @returns A new frame with the id replaced.
 * @example
 * ```ts
 * Frame.setId(Frame.make({ width: 100 }), 'start').id // 'start'
 * Frame.make({ id: 'a' }).pipe(Frame.setId(undefined)).id // undefined
 * ```
 */
export const setId: {
  <K extends string | undefined, const J extends string | undefined>(
    self: Frame<K>,
    id: J,
  ): Frame<NoInfer<J>>
  <const J extends string | undefined>(
    id: J,
  ): <K extends string | undefined>(self: Frame<K>) => Frame<NoInfer<J>>
} = dual(
  2,
  <K extends string | undefined, J extends string | undefined>(self: Frame<K>, id: J): Frame<J> =>
    new Frame<J>({ ...self.toJSON(), id }),
)

// Setters rebuild from the raw inputs (toJSON), never from the resolved
// sizing. Setters with optional trailing arguments dispatch on isFrame. The
// first argument of the data-last form is always a number, so the two forms
// cannot collide.

/**
 * Sets all four offsets in CSS shorthand order. One value sets every edge.
 * Two values set the vertical edges, then the horizontal edges. Three values
 * set top, horizontal, then bottom. Four values set top, right, bottom, and
 * left. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offsetTop - The top offset. As the only value, it sets every edge. As the
 * first of two, it sets both vertical edges.
 * @param offsetRight - The right offset. As the second of two values, it sets both
 * horizontal edges.
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
  <K extends string | undefined>(self: Frame<K>, offset: number): Frame<K>
  <K extends string | undefined>(self: Frame<K>, offsetY: number, offsetX: number): Frame<K>
  <K extends string | undefined>(
    self: Frame<K>,
    offsetTop: number,
    offsetX: number,
    offsetBottom: number,
  ): Frame<K>
  <K extends string | undefined>(
    self: Frame<K>,
    offsetTop: number,
    offsetRight: number,
    offsetBottom: number,
    offsetLeft: number,
  ): Frame<K>
  (offset: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
  (offsetY: number, offsetX: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
  (
    offsetTop: number,
    offsetX: number,
    offsetBottom: number,
  ): <K extends string | undefined>(self: Frame<K>) => Frame<K>
  (
    offsetTop: number,
    offsetRight: number,
    offsetBottom: number,
    offsetLeft: number,
  ): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  (args) => isFrame(args[0]),
  <K extends string | undefined>(self: Frame<K>, a: number, b?: number, c?: number, d?: number) => {
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
 * Sets the horizontal offsets. One value sets both edges. Two values set
 * left, then right. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The frame to update.
 * @param offsetLeft - The left offset. As the only value, it also sets the right offset.
 * @param offsetRight - The right offset.
 * @returns A new frame with the horizontal offsets replaced.
 */
export const setOffsetX: {
  <K extends string | undefined>(self: Frame<K>, offset: number): Frame<K>
  <K extends string | undefined>(self: Frame<K>, offsetLeft: number, offsetRight: number): Frame<K>
  (offset: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
  (
    offsetLeft: number,
    offsetRight: number,
  ): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  (args) => isFrame(args[0]),
  <K extends string | undefined>(self: Frame<K>, left: number, right?: number) =>
    new Frame({ ...self.toJSON(), offsetLeft: left, offsetRight: right ?? left }),
)

/**
 * Sets the vertical offsets. One value sets both edges. Two values set top,
 * then bottom. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The frame to update.
 * @param offsetTop - The top offset. As the only value, it also sets the bottom offset.
 * @param offsetBottom - The bottom offset.
 * @returns A new frame with the vertical offsets replaced.
 */
export const setOffsetY: {
  <K extends string | undefined>(self: Frame<K>, offset: number): Frame<K>
  <K extends string | undefined>(self: Frame<K>, offsetTop: number, offsetBottom: number): Frame<K>
  (offset: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
  (
    offsetTop: number,
    offsetBottom: number,
  ): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  (args) => isFrame(args[0]),
  <K extends string | undefined>(self: Frame<K>, top: number, bottom?: number) =>
    new Frame({ ...self.toJSON(), offsetTop: top, offsetBottom: bottom ?? top }),
)

/**
 * Sets the top offset and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new top offset.
 * @returns A new frame with the top offset replaced.
 */
export const setOffsetTop: {
  <K extends string | undefined>(self: Frame<K>, offset: number): Frame<K>
  (offset: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, offset: number) =>
    new Frame({ ...self.toJSON(), offsetTop: offset }),
)

/**
 * Sets the right offset and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new right offset.
 * @returns A new frame with the right offset replaced.
 */
export const setOffsetRight: {
  <K extends string | undefined>(self: Frame<K>, offset: number): Frame<K>
  (offset: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, offset: number) =>
    new Frame({ ...self.toJSON(), offsetRight: offset }),
)

/**
 * Sets the bottom offset and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new bottom offset.
 * @returns A new frame with the bottom offset replaced.
 */
export const setOffsetBottom: {
  <K extends string | undefined>(self: Frame<K>, offset: number): Frame<K>
  (offset: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, offset: number) =>
    new Frame({ ...self.toJSON(), offsetBottom: offset }),
)

/**
 * Sets the left offset and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param offset - The new left offset.
 * @returns A new frame with the left offset replaced.
 */
export const setOffsetLeft: {
  <K extends string | undefined>(self: Frame<K>, offset: number): Frame<K>
  (offset: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, offset: number) =>
    new Frame({ ...self.toJSON(), offsetLeft: offset }),
)

/**
 * Sets the preferred width and height. The width comes first. This is the
 * opposite of the two-value form of `setOffset`, which puts the vertical
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
  <K extends string | undefined>(self: Frame<K>, width: number, height?: number): Frame<K>
  (width: number, height?: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  (args) => isFrame(args[0]),
  <K extends string | undefined>(self: Frame<K>, width: number, height?: number) =>
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
  <K extends string | undefined>(self: Frame<K>, width: number): Frame<K>
  (width: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, width: number) =>
    new Frame({ ...self.toJSON(), width }),
)

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
  <K extends string | undefined>(self: Frame<K>, height: number): Frame<K>
  (height: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, height: number) =>
    new Frame({ ...self.toJSON(), height }),
)

/**
 * Sets the width-to-height ratio. The frame uses it to derive whichever
 * dimension is unset. Non-positive and `NaN` ratios act as unset. The
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
  <K extends string | undefined>(self: Frame<K>, aspectRatio: AspectRatio.AspectRatio): Frame<K>
  (aspectRatio: AspectRatio.AspectRatio): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, aspectRatio: AspectRatio.AspectRatio) =>
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
  <K extends string | undefined>(self: Frame<K>, minWidth: number, minHeight?: number): Frame<K>
  (minWidth: number, minHeight?: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  (args) => isFrame(args[0]),
  <K extends string | undefined>(self: Frame<K>, minWidth: number, minHeight?: number) =>
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
  <K extends string | undefined>(self: Frame<K>, minWidth: number): Frame<K>
  (minWidth: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, minWidth: number) =>
    new Frame({ ...self.toJSON(), minWidth }),
)

/**
 * Sets the minimum height, the lower clamp on the resolved height. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The frame to update.
 * @param minHeight - The new minimum height.
 * @returns A new frame with the minimum height replaced.
 */
export const setMinHeight: {
  <K extends string | undefined>(self: Frame<K>, minHeight: number): Frame<K>
  (minHeight: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, minHeight: number) =>
    new Frame({ ...self.toJSON(), minHeight }),
)

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
  <K extends string | undefined>(self: Frame<K>, maxWidth: number, maxHeight?: number): Frame<K>
  (maxWidth: number, maxHeight?: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  (args) => isFrame(args[0]),
  <K extends string | undefined>(self: Frame<K>, maxWidth: number, maxHeight?: number) =>
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
  <K extends string | undefined>(self: Frame<K>, maxWidth: number): Frame<K>
  (maxWidth: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, maxWidth: number) =>
    new Frame({ ...self.toJSON(), maxWidth }),
)

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
  <K extends string | undefined>(self: Frame<K>, maxHeight: number): Frame<K>
  (maxHeight: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, maxHeight: number) =>
    new Frame({ ...self.toJSON(), maxHeight }),
)

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
  <K extends string | undefined>(self: Frame<K>, grow: number): Frame<K>
  (grow: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, grow: number) =>
    new Frame({ ...self.toJSON(), grow }),
)

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
  <K extends string | undefined>(self: Frame<K>, shrink: number): Frame<K>
  (shrink: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, shrink: number) =>
    new Frame({ ...self.toJSON(), shrink }),
)

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
  <K extends string | undefined>(self: Frame<K>, align: number): Frame<K>
  (align: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, align: number) =>
    new Frame({ ...self.toJSON(), align }),
)

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
  <K extends string | undefined>(self: Frame<K>, stretch: number): Frame<K>
  (stretch: number): <K extends string | undefined>(self: Frame<K>) => Frame<K>
} = dual(
  2,
  <K extends string | undefined>(self: Frame<K>, stretch: number) =>
    new Frame({ ...self.toJSON(), stretch }),
)
