import { Pipeable, dual } from 'curvy/utils'
import * as Alignment from './alignment.ts'
import type * as AspectRatio from './aspectRatio.ts'
import { SizingOf } from './internal/sizing.ts'
import type * as Interval from './interval.ts'
import type { LengthInput } from './length.ts'
import * as Margin from './margin.ts'
import type * as Rect from './rect.ts'
import * as Sizing from './sizing.ts'
import { normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/adornment')
type TypeBrand = typeof TypeBrand

// Sizing state uses symbols, not `#private` fields, so reads still work
// through a `Proxy` (Vue's `ref`/`reactive`).
const Raw: unique symbol = Symbol('placement/adornment/raw')
const Size: unique symbol = Symbol('placement/adornment/size')

type RawSizing = { readonly [K in keyof Sizing.SizingInput]-?: Sizing.SizingInput[K] }

/**
 * The ways an adornment sits on its edge, encoded as numbers: `flow` is `0`,
 * `absolute` is `1`.
 *
 * - `flow` adornments sit only on straight runs of the route, never on a
 *   corner. Flow adornments in the same `layer` on one run line up one
 *   after another, in the order of their `at`, like flex items: none
 *   overlaps another, and their margins along the line keep them
 *   apart and keep corners away. An adornment at `at` `0` or `1` packs
 *   against the port, flush with its node. In a hierarchy (see
 *   `placement/hierarchy`), each one goes to the straight run nearest its
 *   `at`, and the layout makes that run long enough for every flow
 *   adornment on it. The runs it can size are the stubs at either end of
 *   the edge (the straight run out of each port) and the runs through the
 *   ranks the edge crosses, which center their adornments in the rank. A
 *   connector (see `placement/connector`) routes around placed rects and
 *   sizes no runs: each one goes to the straight run nearest where its
 *   `at` falls that has room for it, and the run lays out its adornments
 *   like a flex container, justified between its corners.
 * - `absolute` adornments sit at `at` of the way along the route as drawn,
 *   rounded corners included, wherever that falls, and take no room in the
 *   layout.
 */
export const position = {
  flow: 0,
  absolute: 1,
} as const

/** An adornment position, one of the `position` encodings. */
export type AdornmentPosition = (typeof position)[keyof typeof position]

/**
 * Which way an adornment faces, encoded as numbers: `upright` is `0`,
 * `forward` is `1`, `backward` is `2`.
 *
 * - `upright` keeps the adornment in place: its width runs along the x axis and
 *   its height along the y axis, whichever way the line runs. Text labels
 *   usually stay upright.
 * - `forward` turns the adornment with the line, so that its local x axis
 *   points along the route toward the target. Its width then runs along the
 *   line and its height across it, its left margin trails it and its right
 *   margin leads it. An arrowhead at the target end, drawn pointing right,
 *   points into the target.
 * - `backward` turns it the other way, so that its local x axis points
 *   toward the source. An arrowhead at the source end, drawn pointing
 *   right, points into the source.
 */
export const orient = {
  upright: 0,
  forward: 1,
  backward: 2,
} as const

/** An adornment orientation, one of the `orient` encodings. */
export type AdornmentOrient = (typeof orient)[keyof typeof orient]

/**
 * The construction input for `make`. Every field is optional, and passing
 * `undefined` for a field is the same as omitting it.
 *
 * An adornment takes three input slices beside its own fields: sizing (see
 * `placement/sizing`), margins (see `placement/margin`), and the one-axis
 * `align` (see `placement/alignment`). Its size resolves as a frame's does,
 * with `0` for an unset size. Its margins along the line are gaps: they
 * keep other flow adornments in the layer, and corners, that far away. Its
 * margins across the line are clearance. A turned adornment measures its
 * margins and `align` in its own axes, where `0` is above its local x
 * axis. Non-finite margins act as `0`.
 *
 * The type parameter `L` is the type of the length fields: the sizes, the
 * bounds, and the margins. `make` takes numbers, the default.
 */
export interface AdornmentInput<L extends LengthInput = number>
  extends Sizing.SizingInput<L>, Margin.MarginInput<L>, Pick<Alignment.AlignInput, 'align'> {
  /**
   * Which side of the line the adornment sits on: `0` on the left of a
   * line running up or down (above a line running left or right), `1` on
   * the right (below), and `0.5` centered on it. A non-finite value
   * inherits the layout's `alignAdornments`. Defaults to
   * `Alignment.inherit`.
   */
  readonly align?: number | undefined
  /**
   * Where the adornment sits along the edge, from `0` at the source to `1`
   * at the target. Values outside clamp, and an omitted or non-finite value
   * means `0.5`.
   */
  readonly at?: number | undefined
  /** How it sits on the edge, one of the `position` encodings. Defaults to `flow`. */
  readonly position?: number | undefined
  /**
   * The layer it occupies. Flow adornments on the same run make room for
   * each other only within a layer, so adornments in different layers may
   * overlap. Fractions truncate, and non-finite values act as `0`. Defaults
   * to `0`.
   */
  readonly layer?: number | undefined
  /** Which way it faces, one of the `orient` encodings. Defaults to `upright`. */
  readonly orient?: number | undefined
}

/**
 * A marker that decorates an edge: a label, an arrowhead, or any other
 * shape. `Hierarchy.apply` (from `placement/hierarchy`) places each of an
 * edge's adornments, and makes room for the ones that flow.
 * `Connector.apply` (from `placement/connector`) places them on the routes
 * it finds, and keeps corners clear of the ones that flow.
 *
 * Values are immutable. Every setter returns a new adornment. Create one
 * with `make`.
 */
class Adornment extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The space reserved above the adornment, in its own axes when it turns. */
  readonly marginTop: number
  /** The space reserved to the right of the adornment, in its own axes when it turns. */
  readonly marginRight: number
  /** The space reserved below the adornment, in its own axes when it turns. */
  readonly marginBottom: number
  /** The space reserved to the left of the adornment, in its own axes when it turns. */
  readonly marginLeft: number
  /**
   * Which side of the line it sits on: `0` left or above, `0.5` centered,
   * `1` right or below. `Alignment.inherit` (the default) takes the
   * layout's `alignAdornments`.
   */
  readonly align: number
  /** The raw position along the edge. Layout clamps it to `[0, 1]`. */
  readonly at: number
  /** How it sits on the edge, one of the `position` encodings. */
  readonly position: number
  /** The raw layer. Layout truncates it to an integer. */
  readonly layer: number
  /** Which way it faces, one of the `orient` encodings. */
  readonly orient: number

  // The raw sizing inputs survive for the setters. The adornment
  // normalizes them, and resolves its size, once at construction.
  readonly [Raw]: RawSizing
  readonly [SizingOf]: Sizing.Sizing
  readonly [Size]: Sizing.Size

  constructor(input: AdornmentInput) {
    super()

    const margin = Margin.normalize(input)
    this.marginTop = margin.marginTop
    this.marginRight = margin.marginRight
    this.marginBottom = margin.marginBottom
    this.marginLeft = margin.marginLeft
    this.align = input.align ?? Alignment.inherit
    this.at = input.at ?? 0.5
    this.position = input.position ?? position.flow
    this.layer = input.layer ?? 0
    this.orient = input.orient ?? orient.upright

    this[Raw] = {
      width: input.width,
      height: input.height,
      aspectRatio: input.aspectRatio,
      minWidth: input.minWidth,
      minHeight: input.minHeight,
      maxWidth: input.maxWidth,
      maxHeight: input.maxHeight,
    }
    this[SizingOf] = Sizing.normalize(this[Raw])
    this[Size] = Sizing.resolve(this[SizingOf], { width: 0, height: 0 })
  }

  /**
   * The resolved width: the raw input clamped to its bounds, derived from
   * the height through `aspectRatio` when unset, or `0`.
   */
  get width(): number {
    return this[Size].width
  }

  /**
   * The resolved height: the raw input clamped to its bounds, derived from
   * the width through `aspectRatio` when unset, or `0`.
   */
  get height(): number {
    return this[Size].height
  }

  /** The effective lower bound on `width`, `0` when unset. */
  get minWidth(): number {
    return this[SizingOf].minWidth
  }

  /** The effective lower bound on `height`, `0` when unset. */
  get minHeight(): number {
    return this[SizingOf].minHeight
  }

  /** The effective upper bound on `width`, `Infinity` when unset. */
  get maxWidth(): number {
    return this[SizingOf].maxWidth
  }

  /** The effective upper bound on `height`, `Infinity` when unset. */
  get maxHeight(): number {
    return this[SizingOf].maxHeight
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    const name = this.position === position.absolute ? 'absolute' : 'flow'
    return `Adornment [${name} at ${this.at}, ${this.width} x ${this.height}]`
  }

  /**
   * Returns the adornment's inputs as a plain record of the shape `make`
   * accepts. Unset sizing fields come back as `undefined`, never as their
   * resolved values.
   *
   * @returns The input record.
   */
  toJSON(): AdornmentInput {
    return {
      ...this[Raw],
      marginTop: this.marginTop,
      marginRight: this.marginRight,
      marginBottom: this.marginBottom,
      marginLeft: this.marginLeft,
      align: this.align,
      at: this.at,
      position: this.position,
      layer: this.layer,
      orient: this.orient,
    }
  }
}

export type { Adornment }

/**
 * Where an adornment landed on its edge's route, as the layouts that place
 * adornments report it (see `placement/hierarchy` and `placement/connector`).
 *
 * - `rect`: the adornment's rect, upright. Turn it by `angle` about its
 *   center to draw it.
 * - `angle`: the direction its local x axis points, in radians (atan2
 *   convention, with the y axis down). `0` for an upright adornment.
 * - `along`: the stretch of the route it covers, as lengths along the
 *   route's polyline from its first point. An absolute adornment on a
 *   rounded corner maps the corner's arc evenly onto the two stretches of
 *   polyline the corner replaces.
 */
export interface AdornmentPlacement {
  /** The adornment's rect before it turns. */
  readonly rect: Rect.Rect
  /** How far it turns about the rect's center, in radians. */
  readonly angle: number
  /** The stretch of the route it covers, as lengths along the polyline. */
  readonly along: Interval.Interval
}

/**
 * Creates an `Adornment`.
 *
 * @param input - The adornment's fields. See `AdornmentInput` for the default of each field.
 * @returns An immutable `Adornment`.
 * @example
 * ```ts
 * const arrow = Adornment.make({ width: 9, height: 8, at: 1, orient: Adornment.orient.forward })
 * arrow.position // 0
 * arrow.height // 8
 * ```
 */
export const make = (input: AdornmentInput): Adornment => new Adornment(input)

/**
 * Checks if a value is an `Adornment`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `Adornment`, `false` otherwise.
 */
export const isAdornment = (value: unknown): value is Adornment => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from toJSON. Each takes a number or a ratio, never an
// adornment, as its first data-last argument, so the setters with optional
// trailing arguments dispatch on isAdornment.

const rebuild = (self: Adornment, input: AdornmentInput): Adornment =>
  new Adornment({ ...self.toJSON(), ...input })

/**
 * Sets the preferred width and height, width first. One value sets both.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param width - The new width.
 * @param height - The new height. Defaults to the width.
 * @returns A new adornment with both sizes set.
 * @example
 * ```ts
 * Adornment.setSize(Adornment.make({}), 8, 6).height // 6
 * Adornment.make({}).pipe(Adornment.setSize(8)).height // 8
 * ```
 */
export const setSize: {
  (self: Adornment, width: number, height?: number): Adornment
  (width: number, height?: number): (self: Adornment) => Adornment
} = dual(
  (args) => isAdornment(args[0]),
  (self: Adornment, width: number, height?: number) =>
    rebuild(self, { width, height: height ?? width }),
)

/**
 * Sets the preferred width and keeps an unset height deriving from it. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param width - The new width.
 * @returns A new adornment with the width replaced.
 */
export const setWidth: {
  (self: Adornment, width: number): Adornment
  (width: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, width: number) => rebuild(self, { width }))

/**
 * Sets the preferred height and keeps an unset width deriving from it. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param height - The new height.
 * @returns A new adornment with the height replaced.
 */
export const setHeight: {
  (self: Adornment, height: number): Adornment
  (height: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, height: number) => rebuild(self, { height }))

/**
 * Sets the width-to-height ratio, which derives whichever size is unset.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param aspectRatio - The new ratio, as `width / height` or a `[width, height]` pair.
 * @returns A new adornment with the ratio replaced.
 * @example
 * ```ts
 * Adornment.setAspectRatio(Adornment.make({ width: 12 }), 2).height // 6
 * ```
 */
export const setAspectRatio: {
  (self: Adornment, aspectRatio: AspectRatio.AspectRatio): Adornment
  (aspectRatio: AspectRatio.AspectRatio): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, aspectRatio: AspectRatio.AspectRatio) =>
  rebuild(self, { aspectRatio }),
)

/**
 * Sets the minimum width and height, width first. One value sets both.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param minWidth - The new minimum width.
 * @param minHeight - The new minimum height. Defaults to the minimum width.
 * @returns A new adornment with both minimums set.
 */
export const setMinSize: {
  (self: Adornment, minWidth: number, minHeight?: number): Adornment
  (minWidth: number, minHeight?: number): (self: Adornment) => Adornment
} = dual(
  (args) => isAdornment(args[0]),
  (self: Adornment, minWidth: number, minHeight?: number) =>
    rebuild(self, { minWidth, minHeight: minHeight ?? minWidth }),
)

/**
 * Sets the minimum width. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The adornment to update.
 * @param minWidth - The new minimum width.
 * @returns A new adornment with the minimum width replaced.
 */
export const setMinWidth: {
  (self: Adornment, minWidth: number): Adornment
  (minWidth: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, minWidth: number) => rebuild(self, { minWidth }))

/**
 * Sets the minimum height. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The adornment to update.
 * @param minHeight - The new minimum height.
 * @returns A new adornment with the minimum height replaced.
 */
export const setMinHeight: {
  (self: Adornment, minHeight: number): Adornment
  (minHeight: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, minHeight: number) => rebuild(self, { minHeight }))

/**
 * Sets the maximum width and height, width first. One value sets both.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param maxWidth - The new maximum width.
 * @param maxHeight - The new maximum height. Defaults to the maximum width.
 * @returns A new adornment with both maximums set.
 */
export const setMaxSize: {
  (self: Adornment, maxWidth: number, maxHeight?: number): Adornment
  (maxWidth: number, maxHeight?: number): (self: Adornment) => Adornment
} = dual(
  (args) => isAdornment(args[0]),
  (self: Adornment, maxWidth: number, maxHeight?: number) =>
    rebuild(self, { maxWidth, maxHeight: maxHeight ?? maxWidth }),
)

/**
 * Sets the maximum width. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The adornment to update.
 * @param maxWidth - The new maximum width.
 * @returns A new adornment with the maximum width replaced.
 */
export const setMaxWidth: {
  (self: Adornment, maxWidth: number): Adornment
  (maxWidth: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, maxWidth: number) => rebuild(self, { maxWidth }))

/**
 * Sets the maximum height. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The adornment to update.
 * @param maxHeight - The new maximum height.
 * @returns A new adornment with the maximum height replaced.
 */
export const setMaxHeight: {
  (self: Adornment, maxHeight: number): Adornment
  (maxHeight: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, maxHeight: number) => rebuild(self, { maxHeight }))

/**
 * Sets all four margins in CSS shorthand order. One value sets every edge.
 * Two values set the vertical edges, then the horizontal edges. Three
 * values set top, horizontal, then bottom. Four values set top, right,
 * bottom, and left. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The adornment to update.
 * @param marginTop - The top margin. As the only value, it sets every edge. As the first of two, it sets both vertical edges.
 * @param marginRight - The right margin. As the second of two values, it sets both horizontal edges.
 * @param marginBottom - The bottom margin.
 * @param marginLeft - The left margin.
 * @returns A new adornment with the margins replaced.
 * @example
 * ```ts
 * Adornment.setMargin(Adornment.make({}), 1, 2).marginLeft // 2
 * Adornment.make({}).pipe(Adornment.setMargin(1, 2, 3, 4)).marginBottom // 3
 * ```
 */
export const setMargin: {
  (self: Adornment, margin: number): Adornment
  (self: Adornment, marginY: number, marginX: number): Adornment
  (self: Adornment, marginTop: number, marginX: number, marginBottom: number): Adornment
  (
    self: Adornment,
    marginTop: number,
    marginRight: number,
    marginBottom: number,
    marginLeft: number,
  ): Adornment
  (margin: number): (self: Adornment) => Adornment
  (marginY: number, marginX: number): (self: Adornment) => Adornment
  (marginTop: number, marginX: number, marginBottom: number): (self: Adornment) => Adornment
  (
    marginTop: number,
    marginRight: number,
    marginBottom: number,
    marginLeft: number,
  ): (self: Adornment) => Adornment
} = dual(
  (args) => isAdornment(args[0]),
  (self: Adornment, a: number, b?: number, c?: number, d?: number) => {
    const [marginTop, marginRight, marginBottom, marginLeft] = normalizeTRBL(a, b, c, d)
    return rebuild(self, { marginTop, marginRight, marginBottom, marginLeft })
  },
)

/**
 * Sets the horizontal margins. One value sets both edges. Two values set
 * left, then right. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The adornment to update.
 * @param marginLeft - The left margin. As the only value, it also sets the right margin.
 * @param marginRight - The right margin.
 * @returns A new adornment with the horizontal margins replaced.
 */
export const setMarginX: {
  (self: Adornment, margin: number): Adornment
  (self: Adornment, marginLeft: number, marginRight: number): Adornment
  (margin: number): (self: Adornment) => Adornment
  (marginLeft: number, marginRight: number): (self: Adornment) => Adornment
} = dual(
  (args) => isAdornment(args[0]),
  (self: Adornment, marginLeft: number, marginRight?: number) =>
    rebuild(self, { marginLeft, marginRight: marginRight ?? marginLeft }),
)

/**
 * Sets the vertical margins. One value sets both edges. Two values set
 * top, then bottom. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The adornment to update.
 * @param marginTop - The top margin. As the only value, it also sets the bottom margin.
 * @param marginBottom - The bottom margin.
 * @returns A new adornment with the vertical margins replaced.
 */
export const setMarginY: {
  (self: Adornment, margin: number): Adornment
  (self: Adornment, marginTop: number, marginBottom: number): Adornment
  (margin: number): (self: Adornment) => Adornment
  (marginTop: number, marginBottom: number): (self: Adornment) => Adornment
} = dual(
  (args) => isAdornment(args[0]),
  (self: Adornment, marginTop: number, marginBottom?: number) =>
    rebuild(self, { marginTop, marginBottom: marginBottom ?? marginTop }),
)

/**
 * Sets the top margin and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param margin - The new top margin.
 * @returns A new adornment with the top margin replaced.
 */
export const setMarginTop: {
  (self: Adornment, margin: number): Adornment
  (margin: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, margin: number) => rebuild(self, { marginTop: margin }))

/**
 * Sets the right margin and keeps the other edges. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param margin - The new right margin.
 * @returns A new adornment with the right margin replaced.
 */
export const setMarginRight: {
  (self: Adornment, margin: number): Adornment
  (margin: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, margin: number) => rebuild(self, { marginRight: margin }))

/**
 * Sets the bottom margin and keeps the other edges. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param margin - The new bottom margin.
 * @returns A new adornment with the bottom margin replaced.
 */
export const setMarginBottom: {
  (self: Adornment, margin: number): Adornment
  (margin: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, margin: number) => rebuild(self, { marginBottom: margin }))

/**
 * Sets the left margin and keeps the other edges. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param margin - The new left margin.
 * @returns A new adornment with the left margin replaced.
 */
export const setMarginLeft: {
  (self: Adornment, margin: number): Adornment
  (margin: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, margin: number) => rebuild(self, { marginLeft: margin }))

/**
 * Sets which side of the line the adornment sits on: `0` left or above,
 * `0.5` centered, `1` right or below. `Alignment.inherit` restores the
 * layout's `alignAdornments`. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The adornment to update.
 * @param align - The side, or `Alignment.inherit` to inherit.
 * @returns A new adornment with the side replaced.
 */
export const setAlign: {
  (self: Adornment, align: number): Adornment
  (align: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, align: number) => rebuild(self, { align }))

/**
 * Sets the position along the edge, from `0` at the source to `1` at the
 * target. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param at - The new position along the edge.
 * @returns A new adornment with the position replaced.
 * @example
 * ```ts
 * const label = Adornment.make({ width: 30, height: 12 })
 * Adornment.setAt(label, 0.25).at // 0.25
 * ```
 */
export const setAt: {
  (self: Adornment, at: number): Adornment
  (at: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, at: number) => rebuild(self, { at }))

/**
 * Sets how the adornment sits on its edge, one of the `position` encodings.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param value - The new position encoding.
 * @returns A new adornment with the position encoding replaced.
 * @example
 * ```ts
 * const dot = Adornment.make({ width: 4, height: 4 })
 * dot.pipe(Adornment.setPosition(Adornment.position.absolute)).position // 1
 * ```
 */
export const setPosition: {
  (self: Adornment, value: number): Adornment
  (value: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, value: number) => rebuild(self, { position: value }))

/**
 * Sets the layer. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The adornment to update.
 * @param layer - The new layer.
 * @returns A new adornment with the layer replaced.
 */
export const setLayer: {
  (self: Adornment, layer: number): Adornment
  (layer: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, layer: number) => rebuild(self, { layer }))

/**
 * Sets which way the adornment faces, one of the `orient` encodings. The
 * data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param value - The new orientation.
 * @returns A new adornment with the orientation replaced.
 */
export const setOrient: {
  (self: Adornment, value: number): Adornment
  (value: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, value: number) => rebuild(self, { orient: value }))
