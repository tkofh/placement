import { clamp as clampNumber, lerp as lerpNumber, minMax } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Dimensions } from './dimensions.ts'
import type { Interval } from './interval.ts'
import type { Offset } from './offset.ts'
import * as Point from './point.ts'
import { normalizeTRBL, normalizeXYWH } from './utils/arguments.ts'
import { isRecord } from './utils/object.ts'
import { boundsTolerance, fieldsCoincident } from './utils/tolerance.ts'

const TypeBrand: unique symbol = Symbol('placement/rect')
type TypeBrand = typeof TypeBrand

/**
 * The minimal structural shape of a rectangle: a position and a signed
 * size in y-down coordinate space.
 *
 * Read-only inputs accept any `RectLike` — `from`, the second operand
 * of `join`, `intersect`, and `lerp`, and the predicates — while
 * transforms require a branded `Rect` built by `make`.
 */
export interface RectLike {
  /** The x coordinate of the origin corner — the left edge when `width >= 0`. */
  readonly x: number
  /** The y coordinate of the origin corner — the top edge when `height >= 0` (y points down). */
  readonly y: number
  /** The signed horizontal size. Negative values extend leftward from `x`. */
  readonly width: number
  /** The signed vertical size. Negative values extend upward from `y`. */
  readonly height: number
}

/**
 * An axis-aligned rectangle: a position (`x`, `y`) plus a signed size
 * (`width`, `height`), in y-down screen space — `top === y`, and `bottom`
 * is `y + height`.
 *
 * Values are immutable, and constructions are exact IEEE 754: fields hold
 * exactly what the arithmetic produced, with no rounding and no stored
 * precision (see `PRECISION.md`). Negative sizes are legal — a negative
 * `width` extends the rect leftward from `x`. The edge getters report raw
 * coordinates, while bounds questions (`contains`, `intersects`, `join`,
 * `intersect`) normalize the extent first.
 *
 * Construct values with `make` — the class is exported type-only.
 * Extends `Pipeable`, so operations chain as `self.pipe(op(...))`.
 */
class Rect extends Pipeable implements RectLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The x coordinate of the origin corner — the left edge when `width >= 0`. */
  readonly x: number
  /** The y coordinate of the origin corner — the top edge when `height >= 0` (y points down). */
  readonly y: number
  /** The signed horizontal size. Negative values extend leftward from `x`. */
  readonly width: number
  /** The signed vertical size. Negative values extend upward from `y`. */
  readonly height: number

  constructor(x: number, y: number, width: number, height: number) {
    super()

    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  /**
   * The y coordinate of the top edge — identical to `y`, since the y axis
   * points down. Raw, not normalized: with a negative `height`,
   * `bottom < top`.
   */
  get top(): number {
    return this.y
  }

  /** The y coordinate of the bottom edge, `y + height`. */
  get bottom(): number {
    return this.y + this.height
  }

  /**
   * The x coordinate of the left edge — identical to `x`. Raw, not
   * normalized: with a negative `width`, `right < left`.
   */
  get left(): number {
    return this.x
  }

  /** The x coordinate of the right edge, `x + width`. */
  get right(): number {
    return this.x + this.width
  }

  /** The signed area, `width * height` — negative when exactly one size is negative. */
  get area(): number {
    return this.width * this.height
  }

  /**
   * The ratio `width / height`, as exact IEEE division: a zero `height`
   * gives `Infinity` or `-Infinity`, and a zero-size rect gives `NaN`.
   */
  get aspectRatio(): number {
    return this.width / this.height
  }

  /** The x coordinate of the center, `x + width / 2`. */
  get centerX(): number {
    return this.x + this.width / 2
  }

  /** The y coordinate of the center, `y + height / 2`. */
  get centerY(): number {
    return this.y + this.height / 2
  }

  /** The center as a `Point`: `(centerX, centerY)`. */
  get center(): Point.Point {
    return Point.make(this.centerX, this.centerY)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Rect [(${this.x}, ${this.y}) ${this.width}x${this.height}]`
  }

  /**
   * Returns the plain `{ x, y, width, height }` record `JSON.stringify`
   * serializes.
   *
   * @returns The rect's four fields as a plain object.
   */
  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    }
  }
}

export type { Rect }

/**
 * Creates a `Rect`. Arity picks the meaning of the arguments: none is the
 * zero rect, one is a square of that size at the origin, two are a width
 * and height at the origin, three are `x`, `y`, and a square size, and
 * four are `x`, `y`, `width`, and `height`.
 *
 * Inputs are stored exactly as given — no rounding, no normalization — and
 * negative sizes are legal. The other constructors build rects from other
 * shapes: `from` copies a rect-like, `fromDimensions` and `fromInterval`
 * lift the other value types, and `trbl` spans absolute edge coordinates.
 *
 * @example
 * ```ts
 * Rect.make() // Rect.make(0, 0, 0, 0)
 * Rect.make(10) // Rect.make(0, 0, 10, 10)
 * Rect.make(10, 20) // Rect.make(0, 0, 10, 20)
 * Rect.make(10, 20, 30) // Rect.make(10, 20, 30, 30)
 * Rect.make(10, 20, 30, 40) // x 10, y 20, width 30, height 40
 * ```
 */
export const make: {
  /**
   * Creates the zero rect.
   *
   * @returns The rect at `(0, 0)` with zero size.
   */
  (): Rect
  /**
   * Creates a square of `size` at the origin.
   *
   * @param size - The width and height.
   * @returns The rect at `(0, 0)` with size `size` by `size`.
   */
  (size: number): Rect
  /**
   * Creates a rect of `width` by `height` at the origin.
   *
   * @param width - The width.
   * @param height - The height.
   * @returns The rect at `(0, 0)` with the given size.
   */
  (width: number, height: number): Rect
  /**
   * Creates a square of `size` at `(x, y)`.
   *
   * @param x - The x coordinate.
   * @param y - The y coordinate.
   * @param size - The width and height.
   * @returns The rect at `(x, y)` with size `size` by `size`.
   */
  (x: number, y: number, size: number): Rect
  /**
   * Creates a rect of `width` by `height` at `(x, y)`.
   *
   * @param x - The x coordinate.
   * @param y - The y coordinate.
   * @param width - The width.
   * @param height - The height.
   * @returns The rect at `(x, y)` with the given size.
   */
  (x: number, y: number, width: number, height: number): Rect
} = (a?: number, b?: number, c?: number, d?: number): Rect => new Rect(...normalizeXYWH(a, b, c, d))

/**
 * Creates a `Rect` from any value with numeric `x`, `y`, `width`, and
 * `height` fields, copying the four fields exactly.
 *
 * @param rect - The rect-like value to copy.
 * @returns A new `Rect` with the same position and size.
 */
export const from = (rect: RectLike): Rect => new Rect(rect.x, rect.y, rect.width, rect.height)

/**
 * Creates a `Rect` with the size of `dimensions` at `position`.
 *
 * @param dimensions - The size, from `placement/dimensions`.
 * @param position - The `(x, y)` position. Defaults to the origin.
 * @returns A new `Rect` at `position` with the given dimensions.
 */
export const fromDimensions = (dimensions: Dimensions, position?: Point.PointLike): Rect =>
  new Rect(position?.x ?? 0, position?.y ?? 0, dimensions.width, dimensions.height)

/**
 * Creates a `Rect` from 1D intervals, one per axis: each interval's
 * `start` becomes the position coordinate and its `size` the size. With
 * `y` omitted, `x` is mirrored onto both axes.
 *
 * @param x - The horizontal interval (`x` and `width`).
 * @param y - The vertical interval (`y` and `height`). Defaults to `x`.
 * @returns A new `Rect` spanning both intervals.
 */
export const fromInterval = (x: Interval, y: Interval = x): Rect =>
  new Rect(x.start, y.start, x.size, y.size)

/**
 * Creates a `Rect` spanning absolute edge coordinates — not inset
 * distances. The result runs from `left` to `right` and `top` to
 * `bottom` exactly as given, so `right < left` (or `bottom < top`)
 * produces a negative size.
 *
 * Omitted arguments fall back CSS-shorthand style: one value places all
 * four edges (a zero-size rect at `(top, top)`), two are
 * vertical/horizontal, and three leave `left` mirroring `right`.
 *
 * @param top - The y coordinate of the top edge.
 * @param right - The x coordinate of the right edge. Defaults to `top`.
 * @param bottom - The y coordinate of the bottom edge. Defaults to `top`.
 * @param left - The x coordinate of the left edge. Defaults to `right`.
 * @returns A new `Rect` spanning the given edges.
 * @example
 * ```ts
 * Rect.trbl(20, 40, 60, 10) // Rect.make(10, 20, 30, 40)
 * Rect.trbl(10) // Rect.make(10, 10, 0, 0)
 * ```
 */
export const trbl = (top: number, right?: number, bottom?: number, left?: number): Rect => {
  const [t, r, b, l] = normalizeTRBL(top, right, bottom, left)
  return new Rect(l, t, r - l, b - t)
}

/** The rect at `(0, 0)` with zero size — a shared instance. */
export const zero: Rect = new Rect(0, 0, 0, 0)

/**
 * Checks if a value is a `Rect`.
 *
 * True only for values built by this module's constructors (`make`,
 * `from`, `fromDimensions`, `fromInterval`, `trbl`), which carry the
 * brand — a plain `{ x, y, width, height }` object is rect-like but not a
 * `Rect`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Rect`, `false` otherwise.
 */
export const isRect = (value: unknown): value is Rect => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Checks if a value is structurally a rectangle: an object with numeric
 * `x`, `y`, `width`, and `height` fields. Every `Rect` qualifies.
 *
 * This is the shape check `contains` uses to tell rect targets from point
 * targets.
 *
 * @param value - The value to check.
 * @returns `true` if the value carries the four numeric fields, `false` otherwise.
 */
export const isRectLike = (value: unknown): value is RectLike => {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  )
}

// Negative sizes are legal, so bounds questions operate on the normalized
// extents [xMin, xMax, yMin, yMax].
const bounds = (target: RectLike): [number, number, number, number] => {
  const [xMin, xMax] = minMax(target.x, target.x + target.width)
  const [yMin, yMax] = minMax(target.y, target.y + target.height)
  return [xMin, xMax, yMin, yMax]
}

/**
 * Replaces the `x` coordinate, keeping everything else.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to reposition.
 * @param x - The new `x` coordinate.
 * @returns A new `Rect` with `x` replaced.
 */
export const setX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(2, (self: Rect, x: number) => new Rect(x, self.y, self.width, self.height))

/**
 * Replaces the `y` coordinate, keeping everything else.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to reposition.
 * @param y - The new `y` coordinate.
 * @returns A new `Rect` with `y` replaced.
 */
export const setY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(2, (self: Rect, y: number) => new Rect(self.x, y, self.width, self.height))

/**
 * Replaces both position coordinates, keeping the size. With `y` omitted,
 * `x` is used for both.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to reposition.
 * @param x - The new `x` coordinate.
 * @param y - The new `y` coordinate. Defaults to `x`.
 * @returns A new `Rect` at `(x, y)` with the same size.
 */
export const setPosition: {
  (self: Rect, x: number, y?: number): Rect
  (x: number, y?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, x: number, y?: number) => new Rect(x, y ?? x, self.width, self.height),
)

/**
 * Replaces the `width`, keeping everything else.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param width - The new width. May be negative.
 * @returns A new `Rect` with `width` replaced.
 */
export const setWidth: {
  (self: Rect, width: number): Rect
  (width: number): (self: Rect) => Rect
} = dual(2, (self: Rect, width: number) => new Rect(self.x, self.y, width, self.height))

/**
 * Replaces the `height`, keeping everything else.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param height - The new height. May be negative.
 * @returns A new `Rect` with `height` replaced.
 */
export const setHeight: {
  (self: Rect, height: number): Rect
  (height: number): (self: Rect) => Rect
} = dual(2, (self: Rect, height: number) => new Rect(self.x, self.y, self.width, height))

/**
 * Replaces the size, keeping the position. With `height` omitted, `width`
 * is used for both.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param width - The new width.
 * @param height - The new height. Defaults to `width`.
 * @returns A new `Rect` of the given size at the same position.
 */
export const setSize: {
  (self: Rect, width: number, height?: number): Rect
  (width: number, height?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, width: number, height?: number) => new Rect(self.x, self.y, width, height ?? width),
)

/**
 * Moves the rect so its `right` edge (`x + width`) lands on the given
 * coordinate, keeping the size.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to reposition.
 * @param right - The target `right` coordinate.
 * @returns A new `Rect` with `x` set to `right - width`.
 */
export const setRight: {
  (self: Rect, right: number): Rect
  (right: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, right: number) => new Rect(right - self.width, self.y, self.width, self.height),
)

/**
 * Moves the rect so its `bottom` edge (`y + height`) lands on the given
 * coordinate, keeping the size.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to reposition.
 * @param bottom - The target `bottom` coordinate.
 * @returns A new `Rect` with `y` set to `bottom - height`.
 */
export const setBottom: {
  (self: Rect, bottom: number): Rect
  (bottom: number): (self: Rect) => Rect
} = dual(
  2,
  (self: Rect, bottom: number) => new Rect(self.x, bottom - self.height, self.width, self.height),
)

/**
 * Translates the rect along the x axis.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to move.
 * @param x - The distance to add to `x`.
 * @returns A new `Rect` moved horizontally by `x`.
 */
export const translateX: {
  (self: Rect, x: number): Rect
  (x: number): (self: Rect) => Rect
} = dual(2, (self: Rect, x: number) => new Rect(self.x + x, self.y, self.width, self.height))

/**
 * Translates the rect along the y axis. Positive distances move down.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to move.
 * @param y - The distance to add to `y`.
 * @returns A new `Rect` moved vertically by `y`.
 */
export const translateY: {
  (self: Rect, y: number): Rect
  (y: number): (self: Rect) => Rect
} = dual(2, (self: Rect, y: number) => new Rect(self.x, self.y + y, self.width, self.height))

/**
 * Translates the rect on both axes, keeping the size.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to move.
 * @param x - The distance to add to `x`.
 * @param y - The distance to add to `y`. Positive is down.
 * @returns A new `Rect` moved by `(x, y)`.
 * @example
 * ```ts
 * Rect.translate(Rect.make(0, 0, 100), 10, 20) // Rect.make(10, 20, 100, 100)
 * Rect.make(0, 0, 100).pipe(Rect.translate(10, 20)) // Rect.make(10, 20, 100, 100)
 * ```
 */
export const translate: {
  (self: Rect, x: number, y: number): Rect
  (x: number, y: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, x: number, y: number) => new Rect(self.x + x, self.y + y, self.width, self.height),
)

/**
 * Scales the width by `factor` about a fixed point on the x axis.
 *
 * `origin` names the fixed point as a fraction of the width: `0` holds the
 * left edge, `0.5` the center, `1` the right edge — the coordinate
 * `x + width * origin` does not move. `y` and the height are untouched.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to scale.
 * @param factor - The scale factor applied to `width`.
 * @param origin - The fixed point as a fraction of the width. Defaults to `0`.
 * @returns A new `Rect` with `width * factor`, repositioned to hold the origin point.
 * @example
 * ```ts
 * Rect.scaleX(Rect.make(10), 2) // Rect.make(0, 0, 20, 10)
 * Rect.scaleX(Rect.make(10), 2, 0.5) // Rect.make(-5, 0, 20, 10)
 * ```
 */
export const scaleX: {
  (self: Rect, factor: number, origin?: number): Rect
  (factor: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, factor: number, origin = 0) =>
    new Rect(
      self.x + (self.width - self.width * factor) * origin,
      self.y,
      self.width * factor,
      self.height,
    ),
)

/**
 * Scales the height by `factor` about a fixed point on the y axis.
 *
 * `origin` names the fixed point as a fraction of the height: `0` holds
 * the top edge, `0.5` the center, `1` the bottom edge — the coordinate
 * `y + height * origin` does not move. `x` and the width are untouched.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to scale.
 * @param factor - The scale factor applied to `height`.
 * @param origin - The fixed point as a fraction of the height. Defaults to `0`.
 * @returns A new `Rect` with `height * factor`, repositioned to hold the origin point.
 */
export const scaleY: {
  (self: Rect, factor: number, origin?: number): Rect
  (factor: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, factor: number, origin = 0) =>
    new Rect(
      self.x,
      self.y + (self.height - self.height * factor) * origin,
      self.width,
      self.height * factor,
    ),
)

/**
 * Scales both sizes by `factor` about a shared fixed point.
 *
 * `origin` is the fraction along each axis that stays put: `0` holds the
 * top-left corner, `0.5` the center, `1` the bottom-right corner. To scale
 * about an absolute point instead, use `scaleFrom`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to scale.
 * @param factor - The scale factor applied to both sizes.
 * @param origin - The fixed point as a fraction of each size. Defaults to `0`.
 * @returns A new `Rect` scaled by `factor`, repositioned to hold the origin point.
 * @example
 * ```ts
 * Rect.scale(Rect.make(10), 2, 0.5) // Rect.make(-5, -5, 20, 20)
 * Rect.make(10).pipe(Rect.scale(2, 1)) // Rect.make(-10, -10, 20, 20)
 * ```
 */
export const scale: {
  (self: Rect, factor: number, origin?: number): Rect
  (factor: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, factor: number, origin = 0) =>
    new Rect(
      self.x + (self.width - self.width * factor) * origin,
      self.y + (self.height - self.height * factor) * origin,
      self.width * factor,
      self.height * factor,
    ),
)

/**
 * Scales the rect by `factor` about an absolute point: every corner moves
 * along its line through `position`, as
 * `position + (corner - position) * factor`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to scale.
 * @param factor - The scale factor applied to both sizes.
 * @param position - The point that stays fixed.
 * @returns A new `Rect` scaled about `position`.
 * @example
 * ```ts
 * Rect.scaleFrom(Rect.make(100, 100, 100), 2, Point.zero) // Rect.make(200, 200, 200, 200)
 * ```
 */
export const scaleFrom: {
  (self: Rect, factor: number, position: Point.PointLike): Rect
  (factor: number, position: Point.PointLike): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, factor: number, position: Point.PointLike) =>
    new Rect(
      position.x + (self.x - position.x) * factor,
      position.y + (self.y - position.y) * factor,
      self.width * factor,
      self.height * factor,
    ),
)

/**
 * Clamps the `x` coordinate to `[min, max]`, keeping everything else.
 *
 * Crossed bounds resolve as CSS `clamp()` does: when `min > max`, the
 * minimum wins and the result is pinned to `min`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to constrain.
 * @param min - The lower bound for `x`.
 * @param max - The upper bound for `x`.
 * @returns A new `Rect` with `x` clamped.
 * @example
 * ```ts
 * Rect.clampX(Rect.make(), 10, 30) // Rect.make(10, 0, 0, 0)
 * Rect.clampX(Rect.make(), 30, 10) // Rect.make(30, 0, 0, 0) (crossed bounds: the minimum wins)
 * ```
 */
export const clampX: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  // The minimum wins when the bounds cross (CSS clamp semantics).
  return new Rect(clampNumber(self.x, min, Math.max(min, max)), self.y, self.width, self.height)
})

/**
 * Clamps the `y` coordinate to `[min, max]`, keeping everything else.
 * When the bounds cross, the minimum wins, as in `clampX`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to constrain.
 * @param min - The lower bound for `y`.
 * @param max - The upper bound for `y`.
 * @returns A new `Rect` with `y` clamped.
 */
export const clampY: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  return new Rect(self.x, clampNumber(self.y, min, Math.max(min, max)), self.width, self.height)
})

/**
 * Clamps the `width` to `[min, max]`, keeping everything else.
 * When the bounds cross, the minimum wins, as in `clampX`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to constrain.
 * @param min - The lower bound for `width`.
 * @param max - The upper bound for `width`.
 * @returns A new `Rect` with `width` clamped.
 */
export const clampWidth: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  return new Rect(self.x, self.y, clampNumber(self.width, min, Math.max(min, max)), self.height)
})

/**
 * Clamps the `height` to `[min, max]`, keeping everything else.
 * When the bounds cross, the minimum wins, as in `clampX`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to constrain.
 * @param min - The lower bound for `height`.
 * @param max - The upper bound for `height`.
 * @returns A new `Rect` with `height` clamped.
 */
export const clampHeight: {
  (self: Rect, min: number, max: number): Rect
  (min: number, max: number): (self: Rect) => Rect
} = dual(3, (self: Rect, min: number, max: number) => {
  return new Rect(self.x, self.y, self.width, clampNumber(self.height, min, Math.max(min, max)))
})

// The align family takes fixed arities: the target is itself a Rect (or a
// Point), so a trailing optional origin would make 2-argument calls
// ambiguous between the data-first and data-last forms.
/**
 * Positions the rect horizontally within `target` by a normalized origin:
 * `0` aligns the left edges, `0.5` centers, `1` aligns the right edges.
 * Values outside `[0, 1]` keep going in proportion. `y` and the size are
 * untouched.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to position.
 * @param target - The rect to align within.
 * @param origin - The normalized alignment position along the x axis.
 * @returns A new `Rect` with `x` set to `target.x + (target.width - width) * origin`.
 * @example
 * ```ts
 * Rect.alignX(Rect.make(100), Rect.make(200), 0.5) // Rect.make(50, 0, 100, 100)
 * ```
 */
export const alignX: {
  (self: Rect, target: Rect, origin: number): Rect
  (target: Rect, origin: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, target: Rect, origin: number) =>
    new Rect(target.x + (target.width - self.width) * origin, self.y, self.width, self.height),
)

/**
 * Positions the rect vertically within `target` by a normalized origin:
 * `0` aligns the top edges, `0.5` centers, `1` aligns the bottom edges.
 * Values outside `[0, 1]` keep going in proportion. `x` and the size are
 * untouched.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to position.
 * @param target - The rect to align within.
 * @param origin - The normalized alignment position along the y axis.
 * @returns A new `Rect` with `y` set to `target.y + (target.height - height) * origin`.
 */
export const alignY: {
  (self: Rect, target: Rect, origin: number): Rect
  (target: Rect, origin: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, target: Rect, origin: number) =>
    new Rect(self.x, target.y + (target.height - self.height) * origin, self.width, self.height),
)

/**
 * Positions the rect within a target on both axes by a normalized origin:
 * `0` aligns the left/top edges, `0.5` centers, `1` aligns the
 * right/bottom edges. The size is untouched.
 *
 * A `Point` target acts as a zero-size rect at that position, so `origin`
 * picks which point of `self` lands on it — `0` the top-left corner, `1`
 * the bottom-right. A `Point` origin aligns each axis independently
 * (`origin.x` for x, `origin.y` for y).
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to position.
 * @param target - The rect or point to align to.
 * @param origin - The normalized alignment position: one number for both axes, or per-axis as a point.
 * @returns A new `Rect` aligned to `target`.
 * @example
 * ```ts
 * Rect.align(Rect.make(100), Rect.make(200), 0.5) // Rect.make(50, 50, 100, 100)
 * Rect.make(100).pipe(Rect.align(Point.make(50, 60), 0.5)) // Rect.make(0, 10, 100, 100)
 * ```
 */
export const align: {
  (self: Rect, target: Rect | Point.Point, origin: number | Point.Point): Rect
  (target: Rect | Point.Point, origin: number | Point.Point): (self: Rect) => Rect
} = dual(3, (self: Rect, target: Rect | Point.Point, origin: number | Point.Point) => {
  const originX = Point.isPoint(origin) ? origin.x : origin
  const originY = Point.isPoint(origin) ? origin.y : origin

  // A point target is a zero-extent rect at that position.
  const targetWidth = Point.isPoint(target) ? 0 : target.width
  const targetHeight = Point.isPoint(target) ? 0 : target.height

  return new Rect(
    target.x + (targetWidth - self.width) * originX,
    target.y + (targetHeight - self.height) * originY,
    self.width,
    self.height,
  )
})

// resizeTop/resizeRight/resizeBottom/resizeLeft move one edge to an absolute
// coordinate with the opposite edge fixed; crossing edges flip (size stays
// non-negative) rather than clamp.
/**
 * Moves the top edge to an absolute y coordinate, keeping the `bottom`
 * edge fixed. Crossing the fixed edge flips rather than clamps: the result
 * spans from `bottom` to `top`, and the size stays non-negative.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param top - The new y coordinate of the top edge.
 * @returns A new `Rect` spanning `top` to the original `bottom`.
 * @example
 * ```ts
 * Rect.resizeTop(Rect.make(10, 20, 30, 40), 10) // Rect.make(10, 10, 30, 50)
 * Rect.resizeTop(Rect.make(10, 20, 30, 40), 70) // Rect.make(10, 60, 30, 10) (crossed the bottom edge)
 * ```
 */
export const resizeTop: {
  (self: Rect, top: number): Rect
  (top: number): (self: Rect) => Rect
} = dual(2, (self: Rect, top: number) => {
  const [min, max] = minMax(top, self.bottom)
  return new Rect(self.x, min, self.width, max - min)
})

/**
 * Moves the right edge to an absolute x coordinate, keeping the `left`
 * edge (`x`) fixed. Crossing the fixed edge flips rather than clamps: the
 * result spans from `right` to `left`, and the size stays non-negative.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param right - The new x coordinate of the right edge.
 * @returns A new `Rect` spanning the original `left` to `right`.
 */
export const resizeRight: {
  (self: Rect, right: number): Rect
  (right: number): (self: Rect) => Rect
} = dual(2, (self: Rect, right: number) => {
  const [min, max] = minMax(self.x, right)
  return new Rect(min, self.y, max - min, self.height)
})

/**
 * Moves the bottom edge to an absolute y coordinate, keeping the `top`
 * edge (`y`) fixed. Crossing the fixed edge flips rather than clamps: the
 * result spans from `bottom` to `top`, and the size stays non-negative.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param bottom - The new y coordinate of the bottom edge.
 * @returns A new `Rect` spanning the original `top` to `bottom`.
 */
export const resizeBottom: {
  (self: Rect, bottom: number): Rect
  (bottom: number): (self: Rect) => Rect
} = dual(2, (self: Rect, bottom: number) => {
  const [min, max] = minMax(self.y, bottom)
  return new Rect(self.x, min, self.width, max - min)
})

/**
 * Moves the left edge to an absolute x coordinate, keeping the `right`
 * edge fixed. Crossing the fixed edge flips rather than clamps: the result
 * spans from `right` to `left`, and the size stays non-negative.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param left - The new x coordinate of the left edge.
 * @returns A new `Rect` spanning `left` to the original `right`.
 */
export const resizeLeft: {
  (self: Rect, left: number): Rect
  (left: number): (self: Rect) => Rect
} = dual(2, (self: Rect, left: number) => {
  const [min, max] = minMax(left, self.right)
  return new Rect(min, self.y, max - min, self.height)
})

/**
 * Adds `delta` to the width, with `origin` deciding where the change
 * happens: it names the fixed point as a fraction of the width, so `0`
 * holds the left edge (the rect grows rightward), `0.5` splits the change
 * evenly, and `1` holds the right edge. Negative deltas shrink, and may
 * drive the width negative — nothing clamps.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param delta - The amount to add to `width`.
 * @param origin - The fixed point as a fraction of the width. Defaults to `0`.
 * @returns A new `Rect` with `width + delta` and `x` shifted by `-delta * origin`.
 * @example
 * ```ts
 * Rect.resizeX(Rect.make(10, 20, 30, 40), 10, 0.5) // Rect.make(5, 20, 40, 40)
 * ```
 */
export const resizeX: {
  (self: Rect, delta: number, origin?: number): Rect
  (delta: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, delta: number, origin = 0) =>
    new Rect(self.x - delta * origin, self.y, self.width + delta, self.height),
)

/**
 * Adds `delta` to the height, with `origin` deciding where the change
 * happens: it names the fixed point as a fraction of the height, so `0`
 * holds the top edge (the rect grows downward), `0.5` splits the change
 * evenly, and `1` holds the bottom edge. Negative deltas shrink, and may
 * drive the height negative — nothing clamps.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param delta - The amount to add to `height`.
 * @param origin - The fixed point as a fraction of the height. Defaults to `0`.
 * @returns A new `Rect` with `height + delta` and `y` shifted by `-delta * origin`.
 */
export const resizeY: {
  (self: Rect, delta: number, origin?: number): Rect
  (delta: number, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, delta: number, origin = 0) =>
    new Rect(self.x, self.y - delta * origin, self.width, self.height + delta),
)

/**
 * Adds a delta to both sizes, with an origin deciding where the change
 * happens on each axis: `0` holds the left/top edge, `0.5` the center,
 * `1` the right/bottom edge.
 *
 * A `Point` delta resizes each axis by its own amount (`delta.x` to the
 * width, `delta.y` to the height); a `Point` origin fixes each axis
 * independently. Numbers apply to both axes.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to resize.
 * @param delta - The amount to add to the size: one number for both axes, or per-axis as a point.
 * @param origin - The fixed point per axis. Defaults to `0`.
 * @returns A new `Rect` resized about the origin point.
 * @example
 * ```ts
 * Rect.resize(Rect.make(100), 10, 0.5) // Rect.make(-5, -5, 110, 110)
 * Rect.resize(Rect.make(100), Point.make(20, 10), 0.5) // Rect.make(-10, -5, 120, 110)
 * ```
 */
export const resize: {
  (self: Rect, delta: number | Point.Point, origin?: number | Point.Point): Rect
  (delta: number | Point.Point, origin?: number | Point.Point): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[0]),
  (self: Rect, delta: number | Point.Point, origin: number | Point.Point = 0) => {
    const deltaX = Point.isPoint(delta) ? delta.x : delta
    const deltaY = Point.isPoint(delta) ? delta.y : delta
    const originX = Point.isPoint(origin) ? origin.x : origin
    const originY = Point.isPoint(origin) ? origin.y : origin

    return new Rect(
      self.x - deltaX * originX,
      self.y - deltaY * originY,
      self.width + deltaX,
      self.height + deltaY,
    )
  },
)

/**
 * Insets the rect's edges inward, as padding does: a number insets all
 * four edges uniformly, an `Offset` (from `placement/offset`) insets each
 * edge by its own field.
 *
 * The size floors at zero — opposing insets larger than the rect collapse
 * it rather than turning it inside out — but the position still moves by
 * the full `left`/`top` inset. `expand` is the un-floored inverse.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to contract.
 * @param value - The inset: one number for every edge, or a per-edge offset.
 * @returns A new `Rect` inset by `value`, its size floored at zero.
 * @example
 * ```ts
 * Rect.contract(Rect.make(0, 0, 100), 10) // Rect.make(10, 10, 80, 80)
 * Rect.make(0, 0, 100).pipe(Rect.contract(Offset.trbl(10, 20, 30, 40))) // Rect.make(40, 10, 40, 60)
 * Rect.contract(Rect.make(0, 0, 10), 20) // Rect.make(20, 20, 0, 0) (floored)
 * ```
 */
export const contract: {
  (self: Rect, value: Offset | number): Rect
  (value: Offset | number): (self: Rect) => Rect
} = dual(2, (self: Rect, value: Offset | number) => {
  const top = typeof value === 'number' ? value : value.top
  const right = typeof value === 'number' ? value : value.right
  const bottom = typeof value === 'number' ? value : value.bottom
  const left = typeof value === 'number' ? value : value.left

  // Contraction floors the size at zero; expansion (its inverse) does not.
  return new Rect(
    self.x + left,
    self.y + top,
    Math.max(0, self.width - left - right),
    Math.max(0, self.height - top - bottom),
  )
})

/**
 * Outsets the rect's edges outward, as margin does: a number outsets all
 * four edges uniformly, an `Offset` (from `placement/offset`) outsets each
 * edge by its own field.
 *
 * The inverse of `contract`, minus the floor: nothing clamps here, so
 * negative components shrink the rect and can drive its size negative.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to expand.
 * @param value - The outset: one number for every edge, or a per-edge offset.
 * @returns A new `Rect` grown by `value` on each edge.
 * @example
 * ```ts
 * Rect.expand(Rect.make(0, 0, 100), 10) // Rect.make(-10, -10, 120, 120)
 * Rect.expand(Rect.make(0, 0, 100), Offset.trbl(10, 20, 30, 40)) // Rect.make(-40, -10, 160, 140)
 * ```
 */
export const expand: {
  (self: Rect, value: Offset | number): Rect
  (value: Offset | number): (self: Rect) => Rect
} = dual(2, (self: Rect, value: Offset | number) => {
  const top = typeof value === 'number' ? value : value.top
  const right = typeof value === 'number' ? value : value.right
  const bottom = typeof value === 'number' ? value : value.bottom
  const left = typeof value === 'number' ? value : value.left

  return new Rect(
    self.x - left,
    self.y - top,
    self.width + left + right,
    self.height + top + bottom,
  )
})

/**
 * Computes the smallest rect enclosing both `self` and `other` — the
 * bounding hull.
 *
 * Negative sizes are normalized before the hull is taken, so the result
 * always has a non-negative size, positioned at the minimum corner.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first rect.
 * @param other - The second rect (any rect-like value).
 * @returns A new `Rect` covering both inputs.
 * @example
 * ```ts
 * Rect.join(Rect.make(10, 10, 0), Rect.make(-10, -20, 0)) // Rect.make(-10, -20, 20, 30)
 * ```
 */
export const join: {
  (self: Rect, other: RectLike): Rect
  (other: RectLike): (self: Rect) => Rect
} = dual(2, (self: Rect, other: RectLike) => {
  const [selfXMin, selfXMax, selfYMin, selfYMax] = bounds(self)
  const [otherXMin, otherXMax, otherYMin, otherYMax] = bounds(other)

  const x = Math.min(selfXMin, otherXMin)
  const y = Math.min(selfYMin, otherYMin)

  return new Rect(x, y, Math.max(selfXMax, otherXMax) - x, Math.max(selfYMax, otherYMax) - y)
})

/**
 * Computes the overlap of `self` and `other`, on their normalized extents.
 *
 * When the extents do not strictly overlap on both axes — disjoint, or
 * merely edge-touching — the result is a zero-size rect at the midpoint of
 * the two centers. That decision is exact, unlike the tolerant
 * `intersects` predicate: rects touching within rounding noise take the
 * disjoint path.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first rect.
 * @param other - The second rect (any rect-like value).
 * @returns A new `Rect` covering the overlap, or a zero-size `Rect` between the centers.
 * @example
 * ```ts
 * Rect.intersect(Rect.make(0, 0, 100), Rect.make(50, 50, 100)) // Rect.make(50, 50, 50, 50)
 * Rect.intersect(Rect.make(0, 0, 100), Rect.make(300, 0, 100)) // Rect.make(200, 50, 0, 0)
 * ```
 */
export const intersect: {
  (self: Rect, other: RectLike): Rect
  (other: RectLike): (self: Rect) => Rect
} = dual(2, (self: Rect, other: RectLike) => {
  const [selfXMin, selfXMax, selfYMin, selfYMax] = bounds(self)
  const [otherXMin, otherXMax, otherYMin, otherYMax] = bounds(other)

  const xMin = Math.max(selfXMin, otherXMin)
  const xMax = Math.min(selfXMax, otherXMax)
  const yMin = Math.max(selfYMin, otherYMin)
  const yMax = Math.min(selfYMax, otherYMax)

  if (xMin < xMax && yMin < yMax) {
    return new Rect(xMin, yMin, xMax - xMin, yMax - yMin)
  }

  // Disjoint (or merely edge-touching): zero-size rect at the midpoint of
  // the two centers.
  return new Rect(
    (self.centerX + other.x + other.width / 2) / 2,
    (self.centerY + other.y + other.height / 2) / 2,
    0,
    0,
  )
})

// contain/cover/fit dispatch on isRect(args[1]): the data-first form's second
// argument is always the target Rect, while the data-last form's second
// argument is a number, a string, or absent — never ambiguous.
/**
 * Scales `self` uniformly to the largest size that fits inside `target`,
 * preserving `self`'s aspect ratio, then positions it with the leftover
 * space on the loose axis distributed by `origin`: `0` packs toward the
 * left/top, `0.5` centers, `1` packs toward the right/bottom.
 *
 * The aspect ratio comes from `self`'s normalized extents (`|width|` by
 * `|height|`), so a negative-size `self` fits like its positive mirror
 * and the result's size is always non-negative.
 *
 * A zero-area `self` carries no aspect ratio to preserve; the `target`
 * instance itself is returned.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to fit. Only the aspect ratio of its normalized extents matters.
 * @param target - The rect to fit inside.
 * @param origin - The normalized position of the leftover space. Defaults to `0.5`.
 * @returns A new `Rect` inscribed in `target`, or `target` itself when `self` has zero area.
 * @example
 * ```ts
 * Rect.contain(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100)) // Rect.make(75, 50, 50, 100)
 * Rect.contain(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), 0) // Rect.make(50, 50, 50, 100)
 * ```
 */
export const contain: {
  (self: Rect, target: Rect, origin?: number): Rect
  (target: Rect, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, origin = 0.5) => {
    if (self.area === 0) {
      return target
    }

    // Normalized extents: a negative size would flip the factor's sign and
    // place the result outside the target.
    const selfWidth = Math.abs(self.width)
    const selfHeight = Math.abs(self.height)
    const factor = Math.min(target.width / selfWidth, target.height / selfHeight)
    const width = selfWidth * factor
    const height = selfHeight * factor

    return new Rect(
      target.x + (target.width - width) * origin,
      target.y + (target.height - height) * origin,
      width,
      height,
    )
  },
)

/**
 * Scales `self` uniformly to the smallest size that covers `target`,
 * preserving `self`'s aspect ratio, then positions it with the overflow
 * on the long axis distributed by `origin`: `0` aligns the left/top edges
 * (overflow spills right/down), `0.5` centers, `1` aligns the
 * right/bottom edges.
 *
 * The aspect ratio comes from `self`'s normalized extents (`|width|` by
 * `|height|`), so a negative-size `self` covers like its positive mirror
 * and the result's size is always non-negative.
 *
 * A zero-area `self` carries no aspect ratio to preserve; the `target`
 * instance itself is returned.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to fit. Only the aspect ratio of its normalized extents matters.
 * @param target - The rect to cover.
 * @param origin - The normalized position of the overflow. Defaults to `0.5`.
 * @returns A new `Rect` covering `target`, or `target` itself when `self` has zero area.
 * @example
 * ```ts
 * Rect.cover(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100)) // Rect.make(50, 0, 100, 200)
 * Rect.cover(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), 0) // Rect.make(50, 50, 100, 200)
 * ```
 */
export const cover: {
  (self: Rect, target: Rect, origin?: number): Rect
  (target: Rect, origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, origin = 0.5) => {
    if (self.area === 0) {
      return target
    }

    // Normalized extents, as in contain: a negative size would flip the
    // factor's sign and place the result outside the target.
    const selfWidth = Math.abs(self.width)
    const selfHeight = Math.abs(self.height)
    const factor = Math.max(target.width / selfWidth, target.height / selfHeight)
    const width = selfWidth * factor
    const height = selfHeight * factor

    return new Rect(
      target.x + (target.width - width) * origin,
      target.y + (target.height - height) * origin,
      width,
      height,
    )
  },
)

/**
 * Fits `self` to `target` by mode: `'contain'` and `'cover'` scale as the
 * functions of those names do, and `'crop'` is `intersect(self, target)`
 * — no scaling, and `origin` is ignored.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect to fit.
 * @param target - The rect to fit to.
 * @param mode - `'contain'`, `'cover'`, or `'crop'`.
 * @param origin - The normalized position for the scaling modes. Defaults to `0.5`.
 * @returns The fitted `Rect`.
 * @example
 * ```ts
 * Rect.fit(Rect.make(0, 0, 100, 200), Rect.make(50, 50, 100), 'contain') // Rect.make(75, 50, 50, 100)
 * Rect.make(0, 0, 100, 200).pipe(Rect.fit(Rect.make(50, 50, 100), 'cover', 0)) // Rect.make(50, 50, 100, 200)
 * ```
 */
export const fit: {
  (self: Rect, target: Rect, mode: 'contain' | 'cover' | 'crop', origin?: number): Rect
  (target: Rect, mode: 'contain' | 'cover' | 'crop', origin?: number): (self: Rect) => Rect
} = dual(
  (args) => isRect(args[1]),
  (self: Rect, target: Rect, mode: 'contain' | 'cover' | 'crop', origin = 0.5) => {
    if (mode === 'contain') {
      return contain(self, target, origin)
    }

    if (mode === 'cover') {
      return cover(self, target, origin)
    }

    return intersect(self, target)
  },
)

/**
 * Linearly interpolates every field — `x`, `y`, `width`, and `height` —
 * from `self` (at `amount = 0`) toward `target` (at `amount = 1`).
 *
 * Exact at the endpoints, and not clamped: amounts outside `[0, 1]`
 * extrapolate along the same line.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The rect at `amount = 0`.
 * @param target - The rect at `amount = 1` (any rect-like value).
 * @param amount - The interpolation factor. Not restricted to `[0, 1]`.
 * @returns A new `Rect` with each field interpolated.
 * @example
 * ```ts
 * Rect.lerp(Rect.make(0, 0, 100), Rect.make(100, 100, 50), 0.5) // Rect.make(50, 50, 75, 75)
 * ```
 */
export const lerp: {
  (self: Rect, target: RectLike, amount: number): Rect
  (target: RectLike, amount: number): (self: Rect) => Rect
} = dual(
  3,
  (self: Rect, target: RectLike, amount: number) =>
    new Rect(
      lerpNumber(amount, self.x, target.x),
      lerpNumber(amount, self.y, target.y),
      lerpNumber(amount, self.width, target.width),
      lerpNumber(amount, self.height, target.height),
    ),
)

/**
 * Checks whether `self` covers a point or a whole rect. A target carrying
 * the four rect fields is tested as a rect — its normalized extent must
 * lie within `self`'s — and anything point-like is tested as a point.
 * Edges count as inside.
 *
 * Boundary comparisons are tolerant per `PRECISION.md`: a target within
 * rounding noise of an edge counts as contained, at any magnitude. The
 * band scales to `self`'s finite bounds — an infinite bound contributes
 * nothing, so a half-infinite rect still judges its finite edges
 * tolerantly. Negative sizes are normalized on both sides.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The containing rect.
 * @param target - The point or rect to test.
 * @returns `true` if `self` covers `target`.
 * @example
 * ```ts
 * Rect.contains(Rect.make(0, 0, 100), Point.make(100, 100)) // true (edges count)
 * Rect.contains(Rect.make(0, 0, 100), Rect.make(50, 50, 100)) // false
 * Rect.contains(Rect.make(0, 0, 0.3, 1), Point.make(0.1 + 0.2, 0.5)) // true (tolerant boundary)
 * ```
 */
export const contains: {
  (self: Rect, target: Point.PointLike | RectLike): boolean
  (target: Point.PointLike | RectLike): (self: Rect) => boolean
} = dual(2, (self: Rect, target: Point.PointLike | RectLike) => {
  const [xMin, xMax, yMin, yMax] = bounds(self)
  const toleranceX = boundsTolerance(xMin, xMax)
  const toleranceY = boundsTolerance(yMin, yMax)

  if (isRectLike(target)) {
    const [targetXMin, targetXMax, targetYMin, targetYMax] = bounds(target)
    return (
      targetXMin >= xMin - toleranceX &&
      targetXMax <= xMax + toleranceX &&
      targetYMin >= yMin - toleranceY &&
      targetYMax <= yMax + toleranceY
    )
  }

  return (
    target.x >= xMin - toleranceX &&
    target.x <= xMax + toleranceX &&
    target.y >= yMin - toleranceY &&
    target.y <= yMax + toleranceY
  )
})

/**
 * Checks whether the normalized extents of `self` and `other` overlap or
 * touch. Edge contact counts, and the comparison is tolerant per
 * `PRECISION.md`: rects separated by no more than rounding noise still
 * intersect, at any magnitude.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first rect.
 * @param other - The second rect (any rect-like value).
 * @returns `true` if the rects overlap or touch.
 * @example
 * ```ts
 * Rect.intersects(Rect.make(0, 0, 100), Rect.make(100, 0, 100)) // true (edge contact counts)
 * Rect.make(0, 0, 100).pipe(Rect.intersects(Rect.make(150, 0, 50))) // false
 * ```
 */
export const intersects: {
  (self: Rect, other: RectLike): boolean
  (other: RectLike): (self: Rect) => boolean
} = dual(2, (self: Rect, other: RectLike) => {
  const [selfXMin, selfXMax, selfYMin, selfYMax] = bounds(self)
  const [otherXMin, otherXMax, otherYMin, otherYMax] = bounds(other)

  const toleranceX = boundsTolerance(Math.min(selfXMin, otherXMin), Math.max(selfXMax, otherXMax))
  const toleranceY = boundsTolerance(Math.min(selfYMin, otherYMin), Math.max(selfYMax, otherYMax))

  return (
    selfXMin <= otherXMax + toleranceX &&
    selfXMax >= otherXMin - toleranceX &&
    selfYMin <= otherYMax + toleranceY &&
    selfYMax >= otherYMin - toleranceY
  )
})

/**
 * Tolerance-aware equality: `true` when each field — `x`, `y`, `width`,
 * and `height` — is coincident with `other`'s within the hybrid band of
 * `PRECISION.md`, so rounding noise never separates two rects, at any
 * magnitude.
 *
 * Non-finite fields compare exactly: an infinite field equals only the
 * same infinity, and a `NaN` field equals nothing.
 *
 * Fields are compared as stored, not as covered area: two rects describing
 * the same region with opposite-sign sizes are not equal.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first rect.
 * @param other - The second rect (any rect-like value).
 * @returns `true` if all four fields are pairwise coincident.
 * @example
 * ```ts
 * Rect.equals(Rect.make(0.1 + 0.2, 0, 1, 1), Rect.make(0.3, 0, 1, 1)) // true
 * Rect.make(10, 20, 30, 40).pipe(Rect.equals(Rect.make(10, 20, 30, 41))) // false
 * ```
 */
export const equals: {
  (self: Rect, other: RectLike): boolean
  (other: RectLike): (self: Rect) => boolean
} = dual(
  2,
  (self: Rect, other: RectLike) =>
    fieldsCoincident(self.x, other.x) &&
    fieldsCoincident(self.y, other.y) &&
    fieldsCoincident(self.width, other.width) &&
    fieldsCoincident(self.height, other.height),
)
