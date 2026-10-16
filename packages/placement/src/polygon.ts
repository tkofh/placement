import { Pipeable, dual } from 'curvy/utils'
import { fitLoops, resolveFractions, resolveRadius } from './internal/polygon.ts'
import * as Point from './point.ts'
import type * as Rect from './rect.ts'

const TypeBrand: unique symbol = Symbol('placement/polygon')
type TypeBrand = typeof TypeBrand

/**
 * The construction input for `make`. Every field is optional, and passing
 * `undefined` for one is the same as omitting it. An empty input is a rect.
 */
export interface PolygonInput {
  /**
   * The number of corners of the base polygon. Fractions truncate, values
   * below `3` act as `3`, and non-finite values act as the default.
   * Defaults to `4`.
   */
  readonly sides?: number | undefined
  /**
   * How many times the outline winds around the center. Past `1`, each
   * corner joins the corner `loops` places on, which makes a star polygon:
   * `sides: 5, loops: 2` is a pentagram. When `loops` and `sides` share a
   * factor, the corners split into that many outlines: `sides: 6, loops: 2`
   * is a hexagram of two triangles. Fractions truncate, and values clamp to
   * `[1, (sides - 1) / 2]`, so a polygon of 3 or 4 sides always has `1`.
   * Non-finite values act as the default. Defaults to `1`.
   */
  readonly loops?: number | undefined
  /**
   * How far each corner moves along the base polygon's edge toward the next
   * corner, as a fraction of the edge. The base polygon has a flat top, so
   * `0.5` puts a corner at the top: a rect becomes a diamond, and a flat
   * topped triangle points up. A triangle points right at `1 / 3` and left
   * at `2 / 3`. Values wrap into `[0, 1)`, and non-finite values act as the
   * default. Defaults to `0`.
   */
  readonly phase?: number | undefined
  /**
   * The radius of the circular arcs that round the corners. The shape grows
   * so that its rounded outline still fills the rect it is placed in, so
   * rounding never shrinks it. Negative and non-finite values act as the
   * default. Defaults to `0`, for sharp corners.
   */
  readonly radius?: number | undefined
}

/**
 * A regular polygon or star polygon, stretched to fill a rect, with
 * optionally rounded corners. `apply` places it in a rect.
 *
 * The base polygon has `sides` corners on an ellipse that fills the rect,
 * with its top edge flat. `phase` slides the corners along its edges, and
 * `loops` joins them into a star. The corners are then stretched so that
 * the shape exactly fills the rect: a triangle touches all four sides of
 * its rect, as a rect and a diamond do.
 *
 * Values are immutable. Every setter returns a new polygon. Create one with
 * `make`.
 */
class Polygon extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The raw number of corners. `apply` truncates and limits it. */
  readonly sides: number
  /** The raw winding count. `apply` truncates and limits it. */
  readonly loops: number
  /** The raw phase. `apply` wraps it into `[0, 1)`. */
  readonly phase: number
  /** The raw corner radius. */
  readonly radius: number

  constructor(input: PolygonInput) {
    super()

    this.sides = input.sides ?? 4
    this.loops = input.loops ?? 1
    this.phase = input.phase ?? 0
    this.radius = input.radius ?? 0
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Polygon [${this.sides}/${this.loops} phase ${this.phase} radius ${this.radius}]`
  }

  /**
   * Returns the polygon's inputs as a plain record of the shape `make`
   * accepts.
   *
   * @returns The input record.
   */
  toJSON() {
    return { sides: this.sides, loops: this.loops, phase: this.phase, radius: this.radius }
  }
}

export type { Polygon }

/**
 * Creates a `Polygon`.
 *
 * @param input - The polygon's fields. See `PolygonInput` for the default of each field.
 * @returns An immutable `Polygon`.
 * @example
 * ```ts
 * const diamond = Polygon.make({ phase: 0.5 })
 * diamond.sides // 4
 * ```
 */
export const make = (input: PolygonInput = {}): Polygon => new Polygon(input)

/**
 * Checks if a value is a `Polygon`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Polygon`, `false` otherwise.
 */
export const isPolygon = (value: unknown): value is Polygon => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from toJSON. Each takes a number, never a polygon, as its
// first data-last argument.

/**
 * Sets the number of corners. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The polygon to update.
 * @param sides - The new number of corners.
 * @returns A new polygon with the number of corners replaced.
 */
export const setSides: {
  (self: Polygon, sides: number): Polygon
  (sides: number): (self: Polygon) => Polygon
} = dual(2, (self: Polygon, sides: number) => new Polygon({ ...self.toJSON(), sides }))

/**
 * Sets how many times the outline winds around the center. The data-last
 * form omits `self` and returns a function of it.
 *
 * @param self - The polygon to update.
 * @param loops - The new winding count.
 * @returns A new polygon with the winding count replaced.
 * @example
 * ```ts
 * const pentagram = Polygon.make({ sides: 5 }).pipe(Polygon.setLoops(2))
 * pentagram.loops // 2
 * ```
 */
export const setLoops: {
  (self: Polygon, loops: number): Polygon
  (loops: number): (self: Polygon) => Polygon
} = dual(2, (self: Polygon, loops: number) => new Polygon({ ...self.toJSON(), loops }))

/**
 * Sets how far each corner moves along its edge. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The polygon to update.
 * @param phase - The new phase.
 * @returns A new polygon with the phase replaced.
 */
export const setPhase: {
  (self: Polygon, phase: number): Polygon
  (phase: number): (self: Polygon) => Polygon
} = dual(2, (self: Polygon, phase: number) => new Polygon({ ...self.toJSON(), phase }))

/**
 * Sets the corner radius. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The polygon to update.
 * @param radius - The new corner radius.
 * @returns A new polygon with the corner radius replaced.
 */
export const setRadius: {
  (self: Polygon, radius: number): Polygon
  (radius: number): (self: Polygon) => Polygon
} = dual(2, (self: Polygon, radius: number) => new Polygon({ ...self.toJSON(), radius }))

/**
 * A polygon placed in a rect.
 *
 * - `outlines`: the closed outlines, each a list of its corners in order.
 *   Most polygons have one. A star whose `loops` shares a factor with its
 *   `sides` has one per shared factor.
 * - `radius`: the radius of the arc that rounds every corner, `0` when
 *   they are sharp. It is the polygon's `radius`, or less when the corners
 *   do not fit it whole.
 */
export interface PolygonLayout {
  /** The closed outlines, each a list of its corners. */
  readonly outlines: ReadonlyArray<ReadonlyArray<Point.Point>>
  /** The radius of every corner's arc, `0` when they are sharp. */
  readonly radius: number
}

/**
 * Places a polygon in a rect and returns its corners and the radius that
 * rounds them.
 *
 * The corners stretch so that the polygon fills the rect. A corner's arc
 * reaches `radius * tan(turn / 2)` along each side, where `turn` is how
 * far the outline turns there, so the two arcs on a side need the side to
 * be at least that long for both. The radius is at most the largest one
 * every side fits, there: a rect's is half its shorter side, which makes
 * a pill. With rounded corners, the outline then grows until its rounded
 * form fills the rect: the arcs touch the rect where the sharp corners
 * would have, and the sharp corners lie outside it. A rect never grows,
 * because its arcs touch its sides.
 *
 * A sharp rect and a sharp diamond have exact corners. Other corners come
 * from sines and cosines, within floating point error, and rounded growth
 * settles by repetition, within floating point error of filling the rect.
 * The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The polygon to place.
 * @param rect - The rect to fill.
 * @returns The corners and their radius.
 * @example
 * ```ts
 * const diamond = Polygon.apply(Polygon.make({ phase: 0.5 }), Rect.make(0, 0, 80, 40))
 * diamond.outlines[0] // [Point (40, 0), Point (80, 20), Point (40, 40), Point (0, 20)]
 * diamond.radius // 0
 * const rounded = Polygon.apply(Polygon.make({ radius: 100 }), Rect.make(0, 0, 80, 40))
 * rounded.radius // 20
 * ```
 */
export const apply: {
  (self: Polygon, rect: Rect.Rect): PolygonLayout
  (rect: Rect.Rect): (self: Polygon) => PolygonLayout
} = dual(2, (self: Polygon, rect: Rect.Rect): PolygonLayout => {
  const { loops, radius } = fitLoops(
    resolveFractions(self),
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    resolveRadius(self.radius),
  )
  return {
    outlines: loops.map((outline) => outline.map(([x, y]) => Point.make(x, y))),
    radius,
  }
})
