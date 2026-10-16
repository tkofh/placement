import { Pipeable, dual } from 'curvy/utils'
import type { Adornment } from './adornment.ts'

const TypeBrand: unique symbol = Symbol('placement/edge')
type TypeBrand = typeof TypeBrand

/**
 * The node sides that a port can sit on, encoded as numbers: `top` is `0`,
 * `right` is `1`, `bottom` is `2`, `left` is `3`. Sides are physical, as
 * `Frame` offsets are: `top` is the top side whatever the layout direction.
 *
 * An omitted or non-finite side is auto. The layout then picks the side
 * that faces along the flow toward the other end of the edge. For a back
 * edge, which points against the flow, the `backEdges` option of
 * `placement/hierarchy` decides instead.
 */
export const side = {
  top: 0,
  right: 1,
  bottom: 2,
  left: 3,
} as const

/**
 * A port side, one of the `side` encodings. Any non-finite number is auto.
 */
export type EdgeSide = (typeof side)[keyof typeof side]

/**
 * The construction input for `make`. Only `source` and `target` are
 * required. Passing `undefined` for an optional field is the same as
 * omitting it.
 */
export interface EdgeInput<K extends string> {
  /** The `id` of the frame that the edge leaves. */
  readonly source: K
  /** The `id` of the frame that the edge enters. */
  readonly target: K
  /**
   * How strongly layout keeps the edge short and straight, relative to the
   * other edges. Negative and non-finite values act as `0`. Defaults to
   * `1`.
   */
  readonly weight?: number | undefined
  /**
   * The minimum number of ranks that the edge spans. Fractions round up,
   * and values below `1` (and non-finite values) act as `1`. Defaults to
   * `1`.
   */
  readonly minLength?: number | undefined
  /**
   * The side of the source node that the edge leaves from, one of the
   * `side` encodings. Omitted or non-finite means auto.
   */
  readonly sourceSide?: number | undefined
  /**
   * The position of the source port along its side, as a fraction from the
   * top or left end (`0`) to the bottom or right end (`1`). Omitted or
   * non-finite means auto: ports that share a side spread out, ordered to
   * avoid crossings.
   */
  readonly sourceAt?: number | undefined
  /**
   * The side of the target node that the edge enters, one of the `side`
   * encodings. Omitted or non-finite means auto.
   */
  readonly targetSide?: number | undefined
  /**
   * The position of the target port along its side, as `sourceAt` is for
   * the source port. Omitted or non-finite means auto.
   */
  readonly targetAt?: number | undefined
  /**
   * How far each corner of the route reaches along its two legs, at most:
   * its radius, for a circular corner. Renderers that round corners draw
   * them this size where the route has room, and the route reports the size
   * of each corner. Negative and non-finite values act as `0`. Defaults to
   * `0`, sharp corners.
   */
  readonly radius?: number | undefined
  /**
   * How far each corner reaches at least. Where layout sets the length of a
   * run (along the flow, and out of each port), it keeps room for corners
   * this size, and corners shrink from `radius` toward it only where the
   * route has less room. Runs across the flow take their length from where
   * the nodes sit, so a short one can hold only smaller corners. Values
   * above `radius` act as `radius`. Defaults to `0`.
   */
  readonly minRadius?: number | undefined
  /** The adornments carried by the edge, from `placement/adornment`. Defaults to none. */
  readonly adornments?: ReadonlyArray<Adornment> | undefined
}

/**
 * A directed edge spec: the ids of the two frames it connects, plus the
 * weight, length, port, corner, and adornment inputs that `Hierarchy.apply` (from
 * `placement/hierarchy`) reads. An edge has no geometry of its own. Layout
 * produces its route.
 *
 * The type parameter `K` is the union of the literal ids the edge can
 * reference. `Hierarchy.apply` checks it against the ids of its frames.
 *
 * Values are immutable. Every setter returns a new edge. Create an edge
 * with `make`.
 */
class Edge<K extends string> extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The `id` of the frame that the edge leaves. */
  readonly source: K
  /** The `id` of the frame that the edge enters. */
  readonly target: K
  /** The raw weight input. Layout treats negative and non-finite values as `0`. */
  readonly weight: number
  /**
   * The raw minimum rank span. Layout rounds it up and treats values below
   * `1` as `1`.
   */
  readonly minLength: number
  /** The source port side, one of the `side` encodings, or non-finite for auto. */
  readonly sourceSide: number
  /** The source port position along its side, or non-finite for auto. */
  readonly sourceAt: number
  /** The target port side, one of the `side` encodings, or non-finite for auto. */
  readonly targetSide: number
  /** The target port position along its side, or non-finite for auto. */
  readonly targetAt: number
  /** The raw corner radius. Layout treats negative and non-finite values as `0`. */
  readonly radius: number
  /** The raw minimum corner radius. Layout clamps it to `[0, radius]`. */
  readonly minRadius: number
  /** The adornments carried by the edge, in input order. */
  readonly adornments: ReadonlyArray<Adornment>

  constructor(input: EdgeInput<K>) {
    super()

    this.source = input.source
    this.target = input.target
    this.weight = input.weight ?? 1
    this.minLength = input.minLength ?? 1
    this.sourceSide = input.sourceSide ?? Number.POSITIVE_INFINITY
    this.sourceAt = input.sourceAt ?? Number.POSITIVE_INFINITY
    this.targetSide = input.targetSide ?? Number.POSITIVE_INFINITY
    this.targetAt = input.targetAt ?? Number.POSITIVE_INFINITY
    this.radius = input.radius ?? 0
    this.minRadius = input.minRadius ?? 0
    this.adornments = input.adornments ?? []
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Edge [${String(this.source)} -> ${String(this.target)}]`
  }

  /**
   * Returns the edge's inputs as a plain record of the shape `make`
   * accepts. `JSON.stringify` writes auto ports (`Infinity`) as `null`, and
   * `make` reads `null` back as auto.
   *
   * @returns The input record.
   */
  toJSON() {
    return {
      source: this.source,
      target: this.target,
      weight: this.weight,
      minLength: this.minLength,
      sourceSide: this.sourceSide,
      sourceAt: this.sourceAt,
      targetSide: this.targetSide,
      targetAt: this.targetAt,
      radius: this.radius,
      minRadius: this.minRadius,
      adornments: this.adornments,
    }
  }
}

export type { Edge }

/**
 * Creates an `Edge`.
 *
 * @param input - The edge's fields. See `EdgeInput` for the default of each field.
 * @returns An immutable `Edge`.
 * @example
 * ```ts
 * const edge = Edge.make({ source: 'start', target: 'end', sourceSide: Edge.side.right })
 * edge.weight // 1
 * ```
 */
export const make = <const K extends string>(input: EdgeInput<K>): Edge<K> => new Edge(input)

/**
 * Checks if a value is an `Edge`. Only values that `make` builds carry the
 * brand, so only they pass.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `Edge`, `false` otherwise.
 */
export const isEdge = (value: unknown): value is Edge<string> => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from toJSON. setSource and setTarget take an id, and the
// other setters take a number, an adornment, or a list first, so none of
// them can receive an edge as their first data-last argument.

/**
 * Sets the source frame id. The result's type parameter keeps the old ids
 * and adds the new one, since the type cannot tell which ids are still in
 * use. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The edge to update.
 * @param source - The new source id.
 * @returns A new edge with the source replaced.
 * @example
 * ```ts
 * Edge.setSource(Edge.make({ source: 'a', target: 'b' }), 'c').source // 'c'
 * ```
 */
export const setSource: {
  <K extends string, const J extends string>(self: Edge<K>, source: J): Edge<K | J>
  <const J extends string>(source: J): <K extends string>(self: Edge<K>) => Edge<K | J>
} = dual(
  2,
  <K extends string, J extends string>(self: Edge<K>, source: J): Edge<K | J> =>
    new Edge<K | J>({ ...self.toJSON(), source }),
)

/**
 * Sets the target frame id. As with `setSource`, the result's type
 * parameter adds the new id to the old ones. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The edge to update.
 * @param target - The new target id.
 * @returns A new edge with the target replaced.
 * @example
 * ```ts
 * Edge.make({ source: 'a', target: 'b' }).pipe(Edge.setTarget('c')).target // 'c'
 * ```
 */
export const setTarget: {
  <K extends string, const J extends string>(self: Edge<K>, target: J): Edge<K | J>
  <const J extends string>(target: J): <K extends string>(self: Edge<K>) => Edge<K | J>
} = dual(
  2,
  <K extends string, J extends string>(self: Edge<K>, target: J): Edge<K | J> =>
    new Edge<K | J>({ ...self.toJSON(), target }),
)

/**
 * Sets the weight: how strongly layout keeps the edge short and straight.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The edge to update.
 * @param weight - The new weight.
 * @returns A new edge with the weight replaced.
 */
export const setWeight: {
  <K extends string>(self: Edge<K>, weight: number): Edge<K>
  (weight: number): <K extends string>(self: Edge<K>) => Edge<K>
} = dual(
  2,
  <K extends string>(self: Edge<K>, weight: number) => new Edge({ ...self.toJSON(), weight }),
)

/**
 * Sets the minimum number of ranks that the edge spans. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The edge to update.
 * @param minLength - The new minimum rank span.
 * @returns A new edge with the minimum length replaced.
 */
export const setMinLength: {
  <K extends string>(self: Edge<K>, minLength: number): Edge<K>
  (minLength: number): <K extends string>(self: Edge<K>) => Edge<K>
} = dual(
  2,
  <K extends string>(self: Edge<K>, minLength: number) => new Edge({ ...self.toJSON(), minLength }),
)

/**
 * Sets the source port. An omitted `at` makes the position along the side
 * auto. A non-finite `side` makes the whole port auto. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The edge to update.
 * @param side - The port side, one of the `side` encodings.
 * @param at - The position along the side, from `0` to `1`. Defaults to auto.
 * @returns A new edge with the source port replaced.
 * @example
 * ```ts
 * const edge = Edge.make({ source: 'a', target: 'b' })
 * Edge.setSourcePort(edge, Edge.side.right, 0.25).sourceAt // 0.25
 * edge.pipe(Edge.setSourcePort(Edge.side.bottom)).sourceAt // Infinity
 * ```
 */
export const setSourcePort: {
  <K extends string>(self: Edge<K>, side: number, at?: number): Edge<K>
  (side: number, at?: number): <K extends string>(self: Edge<K>) => Edge<K>
} = dual(
  (args) => isEdge(args[0]),
  <K extends string>(self: Edge<K>, side: number, at?: number) =>
    new Edge({ ...self.toJSON(), sourceSide: side, sourceAt: at }),
)

/**
 * Sets the target port. An omitted `at` makes the position along the side
 * auto. A non-finite `side` makes the whole port auto. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The edge to update.
 * @param side - The port side, one of the `side` encodings.
 * @param at - The position along the side, from `0` to `1`. Defaults to auto.
 * @returns A new edge with the target port replaced.
 * @example
 * ```ts
 * const edge = Edge.make({ source: 'a', target: 'b' })
 * Edge.setTargetPort(edge, Edge.side.top, 0.5).targetSide // 0
 * ```
 */
export const setTargetPort: {
  <K extends string>(self: Edge<K>, side: number, at?: number): Edge<K>
  (side: number, at?: number): <K extends string>(self: Edge<K>) => Edge<K>
} = dual(
  (args) => isEdge(args[0]),
  <K extends string>(self: Edge<K>, side: number, at?: number) =>
    new Edge({ ...self.toJSON(), targetSide: side, targetAt: at }),
)

/**
 * Sets the corner radius, and optionally the minimum radius. An omitted
 * `minRadius` keeps the current one. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The edge to update.
 * @param radius - How far each corner reaches along its legs, at most.
 * @param minRadius - How far each corner reaches, at least.
 * @returns A new edge with the radius replaced.
 * @example
 * ```ts
 * const edge = Edge.make({ source: 'a', target: 'b' })
 * Edge.setRadius(edge, 12, 6).minRadius // 6
 * edge.pipe(Edge.setRadius(8)).radius // 8
 * ```
 */
export const setRadius: {
  <K extends string>(self: Edge<K>, radius: number, minRadius?: number): Edge<K>
  (radius: number, minRadius?: number): <K extends string>(self: Edge<K>) => Edge<K>
} = dual(
  (args) => isEdge(args[0]),
  <K extends string>(self: Edge<K>, radius: number, minRadius?: number) =>
    new Edge({ ...self.toJSON(), radius, minRadius: minRadius ?? self.minRadius }),
)

/**
 * Replaces every adornment on the edge. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The edge to update.
 * @param adornments - The new adornments, in order.
 * @returns A new edge with the adornments replaced.
 */
export const setAdornments: {
  <K extends string>(self: Edge<K>, adornments: ReadonlyArray<Adornment>): Edge<K>
  (adornments: ReadonlyArray<Adornment>): <K extends string>(self: Edge<K>) => Edge<K>
} = dual(
  2,
  <K extends string>(self: Edge<K>, adornments: ReadonlyArray<Adornment>) =>
    new Edge({ ...self.toJSON(), adornments }),
)

/**
 * Appends an adornment to the edge. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The edge to update.
 * @param adornment - The adornment to append.
 * @returns A new edge with the adornment appended.
 * @example
 * ```ts
 * const edge = Edge.make({ source: 'a', target: 'b' })
 * const label = Adornment.make({ frame: Frame.make({ width: 40, height: 16 }) })
 * Edge.addAdornment(edge, label).adornments.length // 1
 * ```
 */
export const addAdornment: {
  <K extends string>(self: Edge<K>, adornment: Adornment): Edge<K>
  (adornment: Adornment): <K extends string>(self: Edge<K>) => Edge<K>
} = dual(
  2,
  <K extends string>(self: Edge<K>, adornment: Adornment) =>
    new Edge({ ...self.toJSON(), adornments: [...self.adornments, adornment] }),
)
