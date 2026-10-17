import { Pipeable, dual } from 'curvy/utils'
import type { Frame } from './frame.ts'
import type * as Interval from './interval.ts'
import type * as Rect from './rect.ts'

const TypeBrand: unique symbol = Symbol('placement/adornment')
type TypeBrand = typeof TypeBrand

/**
 * The ways an adornment sits on its edge, encoded as numbers: `flow` is `0`,
 * `absolute` is `1`.
 *
 * - `flow` adornments sit only on straight runs of the route, never on a
 *   corner. Flow adornments in the same `layer` on one run line up one
 *   after another, in the order of their `at`, like flex items: none
 *   overlaps another, and the frame's margins along the line keep them
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
 * - `upright` keeps the frame in place: its width runs along the x axis and
 *   its height along the y axis, whichever way the line runs. Text labels
 *   usually stay upright.
 * - `forward` turns the frame with the line, so that its local x axis
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
 * The construction input for `make`. Only `frame` is required. Passing
 * `undefined` for an optional field is the same as omitting it.
 */
export interface AdornmentInput {
  /**
   * The adornment's size, gaps, and side of the line. The frame sizes as
   * any frame does. Its margins along the line are gaps: they keep other
   * flow adornments in the layer, and corners, that far away. Its margins
   * across the line are clearance. Its `align` places it across the line:
   * `0` on the left of a line running up or down (above a line running
   * left or right), `1` on the right (below), and `0.5` centered on it. A
   * turned adornment measures margins and `align` in its own frame, where
   * `0` is above its local x axis. A non-finite `align` inherits the
   * container's `alignAdornments`.
   */
  readonly frame: Frame
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
 * A frame that decorates an edge: a label, an arrowhead, or any other
 * marker. `Hierarchy.apply` (from `placement/hierarchy`) places each of an
 * edge's adornments, and makes room for the ones that flow.
 * `Connector.apply` (from `placement/connector`) places them on the routes
 * it finds, and keeps corners clear of the ones that flow.
 *
 * Values are immutable. Every setter returns a new adornment. Create one
 * with `make`.
 */
class Adornment extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The adornment's size, gaps, and side of the line. */
  readonly frame: Frame
  /** The raw position along the edge. Layout clamps it to `[0, 1]`. */
  readonly at: number
  /** How it sits on the edge, one of the `position` encodings. */
  readonly position: number
  /** The raw layer. Layout truncates it to an integer. */
  readonly layer: number
  /** Which way it faces, one of the `orient` encodings. */
  readonly orient: number

  constructor(input: AdornmentInput) {
    super()

    this.frame = input.frame
    this.at = input.at ?? 0.5
    this.position = input.position ?? position.flow
    this.layer = input.layer ?? 0
    this.orient = input.orient ?? orient.upright
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    const name = this.position === position.absolute ? 'absolute' : 'flow'
    return `Adornment [${name} at ${this.at}]`
  }

  /**
   * Returns the adornment's inputs as a plain record of the shape `make`
   * accepts.
   *
   * @returns The input record.
   */
  toJSON() {
    return {
      frame: this.frame,
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
 * - `rect`: the adornment's frame, upright. Turn it by `angle` about its
 *   center to draw it.
 * - `angle`: the direction its local x axis points, in radians (atan2
 *   convention, with the y axis down). `0` for an upright adornment.
 * - `along`: the stretch of the route it covers, as lengths along the
 *   route's polyline from its first point. An absolute adornment on a
 *   rounded corner maps the corner's arc evenly onto the two stretches of
 *   polyline the corner replaces.
 */
export interface AdornmentPlacement {
  /** The adornment's frame before it turns. */
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
 * const arrow = Adornment.make({
 *   frame: Frame.make({ width: 9, height: 8 }),
 *   at: 1,
 *   orient: Adornment.orient.forward,
 * })
 * arrow.position // 0
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

// Setters rebuild from toJSON. Each takes a frame or a number, never an
// adornment, as its first data-last argument.

/**
 * Sets the frame. The data-last form omits `self` and returns a function of
 * it.
 *
 * @param self - The adornment to update.
 * @param frame - The new frame.
 * @returns A new adornment with the frame replaced.
 */
export const setFrame: {
  (self: Adornment, frame: Frame): Adornment
  (frame: Frame): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, frame: Frame) => new Adornment({ ...self.toJSON(), frame }))

/**
 * Sets the position along the edge, from `0` at the source to `1` at the
 * target. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param at - The new position along the edge.
 * @returns A new adornment with the position replaced.
 * @example
 * ```ts
 * const label = Adornment.make({ frame: Frame.make({ width: 30, height: 12 }) })
 * Adornment.setAt(label, 0.25).at // 0.25
 * ```
 */
export const setAt: {
  (self: Adornment, at: number): Adornment
  (at: number): (self: Adornment) => Adornment
} = dual(2, (self: Adornment, at: number) => new Adornment({ ...self.toJSON(), at }))

/**
 * Sets how the adornment sits on its edge, one of the `position` encodings.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The adornment to update.
 * @param value - The new position encoding.
 * @returns A new adornment with the position encoding replaced.
 * @example
 * ```ts
 * const dot = Adornment.make({ frame: Frame.make({ width: 4, height: 4 }) })
 * dot.pipe(Adornment.setPosition(Adornment.position.absolute)).position // 1
 * ```
 */
export const setPosition: {
  (self: Adornment, value: number): Adornment
  (value: number): (self: Adornment) => Adornment
} = dual(
  2,
  (self: Adornment, value: number) => new Adornment({ ...self.toJSON(), position: value }),
)

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
} = dual(2, (self: Adornment, layer: number) => new Adornment({ ...self.toJSON(), layer }))

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
} = dual(2, (self: Adornment, value: number) => new Adornment({ ...self.toJSON(), orient: value }))
