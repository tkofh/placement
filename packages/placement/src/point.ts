import { lerp as lerpNumber } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import { isRecord } from './utils/object.ts'
import { boundsTolerance, fieldsCoincident } from './utils/tolerance.ts'

const TypeBrand: unique symbol = Symbol('placement/point')
type TypeBrand = typeof TypeBrand

/**
 * The structural shape of a point: any value with numeric `x` and `y`
 * fields.
 *
 * Operations take their primary operand as a branded `Point`. Where an
 * operation only reads a point, it accepts a `PointLike`: the other point
 * of `add`, the center of `orbit`, and the whole iterable of `center`. So
 * a plain `{ x, y }` literal works as a secondary operand.
 */
export interface PointLike {
  /** The x coordinate. */
  readonly x: number
  /** The y coordinate, increasing downward. */
  readonly y: number
}

/**
 * An immutable 2D point in y-down screen space. The vector operations
 * (`add`, `scale`, `dot`, `cross`, and others) also use it as a vector.
 *
 * Coordinates are exact IEEE 754 doubles. Construction and the operations
 * do not round or snap their results (see `PRECISION.md`). To compare
 * computed points, use `equals`, which tolerates rounding noise. Do not
 * compare raw coordinates.
 *
 * The module exports this class as a type only. Instances come from
 * `make`, `fromPolar`, or any operation in this module. The class extends
 * `Pipeable`, so data-last operations chain:
 * `p.pipe(Point.translate(10, 0), Point.scale(2))`.
 */
class Point extends Pipeable implements PointLike {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The x coordinate. */
  readonly x: number

  /** The y coordinate, increasing downward. */
  readonly y: number

  constructor(x: number, y: number) {
    super()

    this.x = x
    this.y = y
  }

  /**
   * Formats the point for Node's `util.inspect`, which `console.log`
   * uses.
   *
   * @returns The debug string, in the style `'Point (3, 4)'`.
   */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Point (${this.x}, ${this.y})`
  }

  /**
   * Converts the point to the plain `{ x, y }` record that
   * `JSON.stringify` serializes.
   *
   * @returns An object with the point's `x` and `y`.
   */
  toJSON() {
    return {
      x: this.x,
      y: this.y,
    }
  }
}

export type { Point }

/**
 * Creates a `Point`. With no arguments, it makes the origin. One argument
 * fills both components, and two arguments are `x` and `y`.
 *
 * The module exports common points as shared constants: `Point.zero`,
 * `Point.half`, `Point.one`, and `Point.infinity`.
 *
 * @param x - The x coordinate. Defaults to `0`.
 * @param y - The y coordinate. Copies `x` when omitted.
 * @returns The point `(x, y)`.
 * @example
 * ```ts
 * Point.make() // Point (0, 0)
 * Point.make(100) // Point (100, 100)
 * Point.make(50, 100) // Point (50, 100)
 * ```
 */
export const make: {
  (): Point
  (xy: number): Point
  (x: number, y: number): Point
} = (x?: number, y?: number) => new Point(x ?? 0, y ?? x ?? 0)

/** The origin, `(0, 0)`, which is the additive identity. */
export const zero: Point = new Point(0, 0)

/** The point `(0.5, 0.5)`, the center of the unit square. */
export const half: Point = new Point(0.5, 0.5)

/** The point `(1, 1)`, the far corner of the unit square. */
export const one: Point = new Point(1, 1)

/**
 * The point `(Infinity, Infinity)`, which is the identity for
 * componentwise `min`. It is one shared instance, so it also works as a
 * sentinel that you check by identity.
 */
export const infinity: Point = new Point(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)

/**
 * Checks whether a value is a `Point`.
 *
 * True only for branded instances that this module builds with `make`,
 * `fromPolar`, and the operations. A plain `{ x, y }` record fails. To
 * test for the structural shape, use `isPointLike`.
 *
 * @param value - The value to check.
 * @returns `true` when `value` is a `Point`.
 */
export const isPoint = (value: unknown): value is Point => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * Checks whether a value has the structural shape of a point: an object
 * with numeric `x` and `y` fields. Every `Point` passes.
 *
 * @param value - The value to check.
 * @returns `true` when `value` is a `PointLike`.
 */
export const isPointLike = (value: unknown): value is PointLike => {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
}

/**
 * Creates a `Point` from polar coordinates.
 *
 * Angles are in radians and follow the atan2 convention. The angle `0`
 * points along +x, and positive angles rotate toward +y, which is
 * clockwise on a y-down screen. The function does not normalize the
 * angle. Whole revolutions wrap through trig periodicity.
 *
 * The result comes from exact IEEE arithmetic, so off-axis angles carry
 * ordinary trig rounding. For example, `fromPolar(100, Math.PI / 2)` lands
 * within rounding distance of `(0, 100)`, not exactly on it.
 *
 * @param magnitude - The distance from the origin.
 * @param angle - The direction, in radians from the positive x axis.
 * @returns The point `(magnitude * cos(angle), magnitude * sin(angle))`.
 * @example
 * ```ts
 * Point.fromPolar(100, 0) // Point (100, 0)
 * ```
 */
export const fromPolar = (magnitude: number, angle: number): Point =>
  new Point(magnitude * Math.cos(angle), magnitude * Math.sin(angle))

/**
 * Computes the Euclidean length of the vector from the origin to
 * `self`: `sqrt(x^2 + y^2)`.
 *
 * @param self - The point to measure.
 * @returns The length, always non-negative.
 * @example
 * ```ts
 * Point.magnitude(Point.make(3, 4)) // 5
 * ```
 */
export const magnitude = (self: Point): number => Math.hypot(self.x, self.y)

/**
 * Computes the direction of the vector from the origin to `self`, in
 * radians from the positive x axis (`Math.atan2` of `y` and `x`).
 *
 * Positive angles rotate toward +y, which is clockwise on a y-down
 * screen. The result lies in `[-pi, pi]`. For the origin, the result is
 * `0`.
 *
 * @param self - The point to measure.
 * @returns The angle in radians, in `[-pi, pi]`.
 * @example
 * ```ts
 * Point.angle(Point.make(0, 100)) // Math.PI / 2 (straight down on screen)
 * ```
 */
export const angle = (self: Point): number => Math.atan2(self.y, self.x)

/**
 * Computes the arithmetic mean of the points, which is their centroid.
 *
 * The function consumes the iterable in a single pass and accepts any
 * `PointLike` values. For an empty iterable, it returns the origin.
 *
 * @param points - The points to average.
 * @returns The centroid, or `(0, 0)` for no points.
 * @example
 * ```ts
 * Point.center([Point.make(0, 0), Point.make(100, 50)]) // Point (50, 25)
 * ```
 */
export const center = (points: Iterable<PointLike>): Point => {
  let x = 0
  let y = 0
  let count = 0

  for (const point of points) {
    x += point.x
    y += point.y
    count++
  }

  return count === 0 ? new Point(0, 0) : new Point(x / count, y / count)
}

/**
 * Replaces the x coordinate of `self`, leaving y unchanged.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The point to derive from.
 * @param x - The new x coordinate.
 * @returns The point `(x, self.y)`.
 * @example
 * ```ts
 * Point.setX(Point.make(0, 100), 50) // Point (50, 100)
 * ```
 */
export const setX: {
  (self: Point, x: number): Point
  (x: number): (self: Point) => Point
} = dual(2, (self: Point, x: number) => new Point(x, self.y))

/**
 * Replaces the y coordinate of `self`, leaving x unchanged.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The point to derive from.
 * @param y - The new y coordinate.
 * @returns The point `(self.x, y)`.
 * @example
 * ```ts
 * Point.setY(Point.make(100, 0), 50) // Point (100, 50)
 * ```
 */
export const setY: {
  (self: Point, y: number): Point
  (y: number): (self: Point) => Point
} = dual(2, (self: Point, y: number) => new Point(self.x, y))

/**
 * Moves `self` by an offset per axis.
 *
 * The data-last form takes only the offsets and returns a function of
 * `self`.
 *
 * @param self - The point to move.
 * @param x - The offset added to the x coordinate.
 * @param y - The offset added to the y coordinate. Positive is downward.
 * @returns The point `(self.x + x, self.y + y)`.
 * @example
 * ```ts
 * Point.translate(Point.make(1, 2), 10, 20) // Point (11, 22)
 * ```
 */
export const translate: {
  (self: Point, x: number, y: number): Point
  (x: number, y: number): (self: Point) => Point
} = dual(3, (self: Point, x: number, y: number) => new Point(self.x + x, self.y + y))

/**
 * Moves `self` along the x axis by `x`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The point to move.
 * @param x - The offset added to the x coordinate.
 * @returns The point `(self.x + x, self.y)`.
 * @example
 * ```ts
 * Point.translateX(Point.make(1, 2), 10) // Point (11, 2)
 * ```
 */
export const translateX: {
  (self: Point, x: number): Point
  (x: number): (self: Point) => Point
} = dual(2, (self: Point, x: number) => new Point(self.x + x, self.y))

/**
 * Moves `self` along the y axis by `y`. A positive `y` moves it downward.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The point to move.
 * @param y - The offset added to the y coordinate.
 * @returns The point `(self.x, self.y + y)`.
 * @example
 * ```ts
 * Point.translateY(Point.make(1, 2), 20) // Point (1, 22)
 * ```
 */
export const translateY: {
  (self: Point, y: number): Point
  (y: number): (self: Point) => Point
} = dual(2, (self: Point, y: number) => new Point(self.x, self.y + y))

/**
 * Adds the coordinates of `other` to `self`, componentwise. This is
 * vector addition.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The point to add to.
 * @param other - The point to add. Any `PointLike` works.
 * @returns The point `(self.x + other.x, self.y + other.y)`.
 * @example
 * ```ts
 * Point.add(Point.make(1, 2), Point.make(3, 4)) // Point (4, 6)
 * Point.make(1, 2).pipe(Point.add({ x: 3, y: 4 })) // Point (4, 6)
 * ```
 */
export const add: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(2, (self: Point, other: PointLike) => new Point(self.x + other.x, self.y + other.y))

/**
 * Subtracts the coordinates of `other` from `self`, componentwise. As a
 * vector, the result points from `other` to `self`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The minuend.
 * @param other - The subtrahend. Any `PointLike` works.
 * @returns The point `(self.x - other.x, self.y - other.y)`.
 * @example
 * ```ts
 * Point.subtract(Point.make(1, 2), Point.make(3, 4)) // Point (-2, -2)
 * ```
 */
export const subtract: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(2, (self: Point, other: PointLike) => new Point(self.x - other.x, self.y - other.y))

/**
 * Multiplies both coordinates by `factor`. This scales the vector from
 * the origin to the point. A negative factor reflects the point through
 * the origin.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The point to scale.
 * @param factor - The multiplier applied to both coordinates.
 * @returns The point `(self.x * factor, self.y * factor)`.
 * @example
 * ```ts
 * Point.scale(Point.make(100, 50), 0.5) // Point (50, 25)
 * Point.scale(Point.make(100, 50), -1) // Point (-100, -50)
 * ```
 */
export const scale: {
  (self: Point, factor: number): Point
  (factor: number): (self: Point) => Point
} = dual(2, (self: Point, factor: number) => new Point(self.x * factor, self.y * factor))

/**
 * Interpolates from `self` toward `target`, componentwise.
 *
 * The result is exact at the endpoints. An `amount` of `0` returns the
 * exact coordinates of `self`, and `1` returns those of `target`. The
 * function does not clamp `amount`, so values outside `[0, 1]`
 * extrapolate along the same line.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The point at `amount = 0`.
 * @param target - The point at `amount = 1`. Any `PointLike` works.
 * @param amount - The interpolation parameter.
 * @returns The point `amount` of the way from `self` to `target`.
 * @example
 * ```ts
 * Point.lerp(Point.make(0, 0), Point.make(100, 100), 0.5) // Point (50, 50)
 * Point.make(100, 100).pipe(Point.lerp(Point.make(200, 200), 0.5)) // Point (150, 150)
 * ```
 */
export const lerp: {
  (self: Point, target: PointLike, amount: number): Point
  (target: PointLike, amount: number): (self: Point) => Point
} = dual(
  3,
  (self: Point, target: PointLike, amount: number) =>
    new Point(lerpNumber(amount, self.x, target.x), lerpNumber(amount, self.y, target.y)),
)

/**
 * Takes the componentwise minimum of `self` and `other`. Together with
 * `max`, it gives the corners of the bounding box of the two points. In
 * y-down space, `min` is the top-left corner.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first point.
 * @param other - The second point. Any `PointLike` works.
 * @returns The point `(min(self.x, other.x), min(self.y, other.y))`.
 * @example
 * ```ts
 * Point.min(Point.make(0, 100), Point.make(100, 0)) // Point (0, 0)
 * ```
 */
export const min: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(
  2,
  (self: Point, other: PointLike) =>
    new Point(Math.min(self.x, other.x), Math.min(self.y, other.y)),
)

/**
 * Takes the componentwise maximum of `self` and `other`. Together with
 * `min`, it gives the corners of the bounding box of the two points. In
 * y-down space, `max` is the bottom-right corner.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first point.
 * @param other - The second point. Any `PointLike` works.
 * @returns The point `(max(self.x, other.x), max(self.y, other.y))`.
 * @example
 * ```ts
 * Point.max(Point.make(0, 100), Point.make(100, 0)) // Point (100, 100)
 * ```
 */
export const max: {
  (self: Point, other: PointLike): Point
  (other: PointLike): (self: Point) => Point
} = dual(
  2,
  (self: Point, other: PointLike) =>
    new Point(Math.max(self.x, other.x), Math.max(self.y, other.y)),
)

/**
 * Rotates `self` about `center` by `angle` radians.
 *
 * Positive angles rotate from +x toward +y, which is clockwise on a
 * y-down screen. The function does not normalize the angle. Whole
 * revolutions wrap through trig periodicity. Off-axis results carry
 * ordinary trig rounding, as in `fromPolar`.
 *
 * The data-last form takes only (`center`, `angle`) and returns a
 * function of `self`.
 *
 * @param self - The point to rotate.
 * @param center - The point to rotate around. Any `PointLike` works.
 * @param angle - The rotation, in radians.
 * @returns The rotated point.
 * @example
 * ```ts
 * // within rounding of Point (0, -100):
 * Point.orbit(Point.make(0, 100), Point.make(0, 0), Math.PI)
 * ```
 */
export const orbit: {
  (self: Point, center: PointLike, angle: number): Point
  (center: PointLike, angle: number): (self: Point) => Point
} = dual(3, (self: Point, center: PointLike, angle: number) => {
  const deltaX = self.x - center.x
  const deltaY = self.y - center.y

  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  return new Point(center.x + deltaX * cos - deltaY * sin, center.y + deltaX * sin + deltaY * cos)
})

// avoid takes a fixed arity because its target can itself be a Point. With
// an optional trailing gap, a 2-argument call is ambiguous between the
// data-first and data-last forms.
/**
 * Pushes `self` away from `target` until it is at least `gap` away.
 *
 * If `self` is already `gap` or more from `target`, the function returns
 * it unchanged, as the same instance. The boundary decision tolerates
 * rounding noise at any magnitude (see `PRECISION.md`). A closer point
 * moves directly away from `target`, along the ray from `target` through
 * `self`, to the gap distance.
 *
 * Coincident points have no escape direction. In that case, `self` moves
 * `gap` further along its own ray from the origin. If `self` is the
 * origin, it moves along +x.
 *
 * The data-last form takes only (`target`, `gap`) and returns a
 * function of `self`.
 *
 * @param self - The point to push.
 * @param target - The point to keep away from. Any `PointLike` works.
 * @param gap - The minimum distance to enforce.
 * @returns `self` when already far enough, otherwise a point `gap` away from `target`.
 * @example
 * ```ts
 * Point.avoid(Point.make(3, 4), Point.make(0, 0), 10) // Point (6, 8)
 * Point.make(20, 0).pipe(Point.avoid(Point.make(0, 0), 10)) // the same instance, untouched
 * ```
 */
export const avoid: {
  (self: Point, target: PointLike, gap: number): Point
  (target: PointLike, gap: number): (self: Point) => Point
} = dual(3, (self: Point, target: PointLike, gap: number) => {
  const deltaX = self.x - target.x
  const deltaY = self.y - target.y
  const distance = Math.hypot(deltaX, deltaY)

  // Tolerance for the boundary decision, scaled to the magnitudes in the
  // comparison (see PRECISION.md). Only finite magnitudes count. Otherwise an
  // infinite gap makes the band Infinity, and every point then counts as
  // already outside.
  const tolerance = boundsTolerance(distance, gap)

  if (distance >= gap - tolerance) {
    return self
  }

  if (distance === 0) {
    // Coincident points have no escape direction. Push along self's own ray
    // from the origin, or along +x when self is the origin.
    const selfMagnitude = Math.hypot(self.x, self.y)
    if (selfMagnitude === 0) {
      return new Point(gap, 0)
    }
    return new Point(
      self.x + (self.x / selfMagnitude) * gap,
      self.y + (self.y / selfMagnitude) * gap,
    )
  }

  return new Point(
    self.x + (deltaX / distance) * (gap - distance),
    self.y + (deltaY / distance) * (gap - distance),
  )
})

/**
 * Scales `self` to magnitude `1` and keeps its direction. The result is
 * the unit vector.
 *
 * The zero vector has no direction, so both components are `NaN` (IEEE
 * `0 / 0`). The function does not invent a fallback value (see
 * `PRECISION.md`).
 *
 * @param self - The point to normalize.
 * @returns The unit vector, or `(NaN, NaN)` for the zero vector.
 * @example
 * ```ts
 * Point.normalize(Point.make(3, 4)) // Point (0.6, 0.8)
 * ```
 */
export const normalize = (self: Point): Point => {
  const selfMagnitude = Math.hypot(self.x, self.y)
  return new Point(self.x / selfMagnitude, self.y / selfMagnitude)
}

/**
 * Computes the Euclidean distance between `self` and `target`.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first point.
 * @param target - The second point. Any `PointLike` works.
 * @returns The distance, always non-negative.
 * @example
 * ```ts
 * Point.distance(Point.make(0, 0), Point.make(100, 0)) // 100
 * ```
 */
export const distance: {
  (self: Point, target: PointLike): number
  (target: PointLike): (self: Point) => number
} = dual(2, (self: Point, target: PointLike) => Math.hypot(target.x - self.x, target.y - self.y))

/**
 * Computes the dot product `self.x * target.x + self.y * target.y`.
 *
 * The result is zero for perpendicular vectors. It is positive when the
 * vectors point within a quarter turn of each other, and negative beyond
 * that.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first vector.
 * @param target - The second vector. Any `PointLike` works.
 * @returns The dot product.
 * @example
 * ```ts
 * Point.dot(Point.make(3, 4), Point.make(1, 2)) // 11
 * Point.dot(Point.make(3, 4), Point.make(4, -3)) // 0 (perpendicular)
 * ```
 */
export const dot: {
  (self: Point, target: PointLike): number
  (target: PointLike): (self: Point) => number
} = dual(2, (self: Point, target: PointLike) => self.x * target.x + self.y * target.y)

/**
 * Computes the 2D cross product `self.x * target.y - self.y * target.x`.
 * This is the z component of the 3D cross product of the two vectors.
 *
 * The result is zero when the vectors are parallel or either is zero. It
 * is positive when the shorter rotation from `self` to `target` goes from
 * +x toward +y, which is a clockwise turn on a y-down screen. Its
 * magnitude is the area of the parallelogram that the vectors span.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first vector.
 * @param target - The second vector. Any `PointLike` works.
 * @returns The signed cross product.
 * @example
 * ```ts
 * Point.cross(Point.make(5, 0), Point.make(0, 5)) // 25 (a clockwise turn on screen)
 * Point.cross(Point.make(3, 4), Point.make(1, 2)) // 2
 * ```
 */
export const cross: {
  (self: Point, target: PointLike): number
  (target: PointLike): (self: Point) => number
} = dual(2, (self: Point, target: PointLike) => self.x * target.y - self.y * target.x)

/**
 * Compares two points for coordinate equality within tolerance.
 *
 * The function compares each coordinate pair with `coincident` from
 * `curvy/number`. Two values are equal when
 * `|a - b| <= EPSILON + RELATIVE_TOLERANCE * max(|a|, |b|)`, so rounding
 * noise never separates points at any magnitude (see `PRECISION.md`).
 * Non-finite coordinates compare exactly. An infinite coordinate equals
 * only the same infinity (`Point.infinity` equals itself), and a `NaN`
 * coordinate equals nothing. Like any tolerant equality, it is not
 * transitive.
 *
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The first point.
 * @param other - The second point. Any `PointLike` works.
 * @returns `true` when both coordinates coincide within tolerance.
 * @example
 * ```ts
 * Point.equals(Point.make(0.1 + 0.2, 1), Point.make(0.3, 1)) // true
 * Point.equals(Point.infinity, Point.infinity) // true
 * Point.make(1, 2).pipe(Point.equals(Point.make(1, 3))) // false
 * ```
 */
export const equals: {
  (self: Point, other: PointLike): boolean
  (other: PointLike): (self: Point) => boolean
} = dual(
  2,
  (self: Point, other: PointLike) =>
    fieldsCoincident(self.x, other.x) && fieldsCoincident(self.y, other.y),
)
