import { clamp } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { AdornmentPlacement } from './adornment.ts'
import type { Edge } from './edge.ts'
import { solve } from './internal/connector/pipeline.ts'
import { normalize } from './internal/connector/problem.ts'
import { positiveLength } from './internal/orient.ts'
import type * as Point from './point.ts'
import type { Polygon } from './polygon.ts'
import type * as Rect from './rect.ts'

const TypeBrand: unique symbol = Symbol('placement/connector')
type TypeBrand = typeof TypeBrand

/**
 * The turn a connector prefers, encoded as numbers: `none` is `0`,
 * `clockwise` is `1`, `counterclockwise` is `2`. Turns are as seen on screen,
 * where the Y axis points down: a route that turns clockwise at every corner
 * winds around an obstacle the way the hands of a clock do.
 */
export const turn = {
  none: 0,
  clockwise: 1,
  counterclockwise: 2,
} as const

/** A turn preference, one of the `turn` encodings. */
export type ConnectorTurn = (typeof turn)[keyof typeof turn]

/**
 * Which edge ends merge, encoded as numbers: `none` is `0`, `side` is `1`,
 * `near` is `2`. Ends merge when they sit on one side of one rect and carry
 * the same adornments at that end, none counting as the same. With `side`,
 * every such end on a side merges; with `near`, only those next to each
 * other along the side whose routes come in from the same way: routes that
 * turn opposite ways first, on their way out from the side, stay apart.
 * Ends pinned to one spot merge whenever merging is on.
 */
export const merge = {
  none: 0,
  side: 1,
  near: 2,
} as const

/** A merge setting, one of the `merge` encodings. */
export type ConnectorMerge = (typeof merge)[keyof typeof merge]

/**
 * The construction input for `make`. Every field is optional, and passing
 * `undefined` for one is the same as omitting it. Negative and non-finite
 * lengths and costs act as `0`.
 */
export interface ConnectorInput {
  /**
   * The space routes keep from the rects they pass, except where they leave
   * or enter one. Where two rects are closer than twice this, the space
   * between them shrinks to half the distance on each side, so a route can
   * still pass between them. Rects that touch or overlap leave no
   * passage, so routes keep the clearance around them as around one
   * shape; with a clearance of `0`, a route may run along the seam where
   * they touch. Routes that run along a rect keep half their edge's
   * `thickness` more where they can, so their strokes keep the clearance.
   * Defaults to `0`.
   */
  readonly clearance?: number | undefined
  /**
   * The space between the strokes of routes that run alongside each
   * other: their lines sit this far apart plus half of each edge's
   * `thickness`. Where a passage is too narrow for every route at this
   * distance, the routes in it spread evenly across it instead, down to
   * overlapping. Flow adornments look for stretches of their route where no
   * other route's stroke comes this near them. Defaults to `0`, which lets
   * routes of no thickness overlap.
   */
  readonly gap?: number | undefined
  /**
   * The cost of each corner, in units of length: a route takes a detour up
   * to this long to save a corner. Among routes of equal cost, the one with
   * fewer corners wins anyway. It is the one scale of every cost: a
   * crossing costs two fifths of it (a route takes a detour up to that long
   * to cross one route fewer), a corner that turns against an edge's
   * preferred `turn` costs it twice over, and an auto end with no room in
   * front of its port for its adornments and corner costs up to twice it
   * (see `apply`). A route crosses another where it
   * runs straight on across a stretch that the other runs straight along,
   * or across the end of the other, or comes onto that stretch on one side
   * of the other and leaves it on the other side. Two corners around a jog
   * shorter than twice the edge's `radius` cost in proportion to the jog.
   * A route that steps off its line by such a jog and back onto it by
   * another pays for what it stepped around.
   * Routes find these among the routes found before them, then again among
   * all the others. An omitted or non-finite value is auto: twice the
   * `clearance` and `gap` together, so the costs scale with the room the
   * routes keep. Defaults to auto.
   */
  readonly bendCost?: number | undefined
  /**
   * Which side of its edge each adornment sits on: `0` on the left of a
   * line running up or down (above a line running left or right), `0.5`
   * centered on the line, `1` on the right (below). An adornment frame with
   * a finite `align` overrides it. Non-finite values act as `0.5`.
   * Defaults to `0.5`.
   */
  readonly alignAdornments?: number | undefined
  /**
   * Where the leftover length of a run puts the flow adornments in its
   * middle, as `justifyContent` does in a flex container: `0` at the end
   * of the run toward the source, `0.5` centered, `1` at the end toward the
   * target. Non-finite values act as `0.5`. Defaults to `0.5`.
   */
  readonly justifyAdornments?: number | undefined
  /**
   * The share of a run's leftover length that goes between the flow
   * adornments in its middle instead of to `justifyAdornments`, as
   * `justifyContentSpace` does in a flex container: `0` none, `1` all of
   * it. Non-finite values act as `0`. Defaults to `0`.
   */
  readonly justifyAdornmentsSpace?: number | undefined
  /**
   * The share of the spacing from `justifyAdornmentsSpace` that also goes
   * before the first adornment and after the last, as
   * `justifyContentSpaceOuter` does in a flex container: `0` gives
   * space-between, `0.5` space-around, `1` space-evenly. Non-finite values
   * act as `0`. Defaults to `0`.
   */
  readonly justifyAdornmentsSpaceOuter?: number | undefined
  /**
   * The distance between flow adornments that sit next to each other in a
   * layer of a run, on top of their margins. Defaults to `0`.
   */
  readonly adornmentGap?: number | undefined
  /**
   * Where a jog sits along the run it shifts, between where the legs on
   * either side of it start and end: `0` at the source end, `0.5` in the
   * middle, `1` at the target end. A jog is the short segment between two
   * turns that go opposite ways, the rise of a Z or S. Obstacles, and the
   * routes alongside it, may hold it back. Values outside clamp, and
   * non-finite values act as `0.5`. Defaults to `0.5`.
   */
  readonly jogAt?: number | undefined
  /**
   * How a jog too short for its two corners crosses over. At full size
   * the corners of a jog `d` long need `2 * radius` of it, and below that
   * they would shrink into a kink. Instead they slide apart along the legs,
   * `jogSlant * (2 * radius - d)` apart, and turn less than a right angle,
   * so the route crosses over on a slant, as an S. The S flattens as the
   * jog shrinks, and squares up into the full corners as it grows to
   * `2 * radius`. Larger values give longer, gentler slants. A slant takes
   * only free length: it keeps clear of the next corner, of flow
   * adornments, of whatever its legs pass through, and, by the gap, of the
   * routes and rects (with their clearance) beside the curve, and shrinks
   * back toward the kink where it has less room. `0` keeps every jog
   * upright. Negative and non-finite values act as `0`. Defaults to `1`.
   */
  readonly jogSlant?: number | undefined
  /**
   * Which edge ends merge, one of the `merge` encodings. Merged ends share
   * one port and one copy of their adornments there: their routes come in
   * on lanes whose strokes are `mergeGap` apart, in the order they part in,
   * and each lane
   * steps onto the line out of the port to meet the others right behind
   * the adornments. Other values act as `none`, the default.
   */
  readonly merge?: number | undefined
  /**
   * The space between the strokes of the lanes of merged ends, and of
   * their routes for as long as they run alongside each other back from
   * the merge, turning the same ways, as `gap` is for other routes. It is
   * also the space inside the turns that each lane steps onto the line out
   * of the port with, on edges with a `radius`: arcs whose radius is this
   * plus half the thickest lane. A lane less than two radii off the line
   * crosses on an S of two such arcs, and one farther off turns two full
   * corners, so the lanes on one side of the line all meet it on one
   * circle and peel off one another along it. `0` makes lanes that touch.
   * Negative and non-finite values, the default, act as `gap`.
   */
  readonly mergeGap?: number | undefined
}

/**
 * A connector routing spec: the clearance, spacing, and costs that `apply`
 * routes with.
 *
 * Values are immutable. Every setter returns a new spec. Create one with
 * `make`.
 */
class Connector extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The space routes keep from the rects they pass. */
  readonly clearance: number
  /** The space between the strokes of routes that run alongside each other. */
  readonly gap: number
  /** The cost of each corner, in units of length, or `NaN` for auto. */
  readonly bendCost: number
  /** Which side of its edge each adornment sits on: `0` left or above, `1` right or below. */
  readonly alignAdornments: number
  /** Where a run's leftover length puts the flow adornments in its middle. */
  readonly justifyAdornments: number
  /** The share of a run's leftover length that goes between its adornments. */
  readonly justifyAdornmentsSpace: number
  /** The share of that spacing that also goes before the first and after the last. */
  readonly justifyAdornmentsSpaceOuter: number
  /** The distance between flow adornments next to each other on a run. */
  readonly adornmentGap: number
  /** Where a jog sits along the run it shifts, from `0` at the source end. */
  readonly jogAt: number
  /** How far a jog too short for its corners slants, `0` for not at all. */
  readonly jogSlant: number
  /** Which edge ends merge, one of the `merge` encodings. */
  readonly merge: ConnectorMerge
  /** The space between the strokes of merged lanes, `NaN` for `gap`. */
  readonly mergeGap: number

  constructor(input: ConnectorInput) {
    super()

    this.clearance = positiveLength(input.clearance)
    this.gap = positiveLength(input.gap)
    this.bendCost =
      input.bendCost === undefined || !Number.isFinite(input.bendCost)
        ? Number.NaN
        : positiveLength(input.bendCost)
    this.alignAdornments = ratio(input.alignAdornments, 0.5)
    this.justifyAdornments = ratio(input.justifyAdornments, 0.5)
    this.justifyAdornmentsSpace = ratio(input.justifyAdornmentsSpace, 0)
    this.justifyAdornmentsSpaceOuter = ratio(input.justifyAdornmentsSpaceOuter, 0)
    this.adornmentGap = positiveLength(input.adornmentGap)
    this.jogAt = clamp(ratio(input.jogAt, 0.5), 0, 1)
    this.jogSlant = input.jogSlant === undefined ? 1 : positiveLength(input.jogSlant)
    this.merge = input.merge === merge.side || input.merge === merge.near ? input.merge : merge.none
    this.mergeGap =
      input.mergeGap !== undefined && Number.isFinite(input.mergeGap) && input.mergeGap >= 0
        ? input.mergeGap
        : Number.NaN
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Connector [clearance ${this.clearance} gap ${this.gap} bend ${this.bendCost} align ${this.alignAdornments} justify ${this.justifyAdornments} jog ${this.jogAt} slant ${this.jogSlant} merge ${this.merge} merge gap ${this.mergeGap}]`
  }

  /**
   * Returns the spec as a plain record of the shape `make` accepts.
   *
   * @returns The input record.
   */
  toJSON() {
    return {
      clearance: this.clearance,
      gap: this.gap,
      bendCost: this.bendCost,
      alignAdornments: this.alignAdornments,
      justifyAdornments: this.justifyAdornments,
      justifyAdornmentsSpace: this.justifyAdornmentsSpace,
      justifyAdornmentsSpaceOuter: this.justifyAdornmentsSpaceOuter,
      adornmentGap: this.adornmentGap,
      jogAt: this.jogAt,
      jogSlant: this.jogSlant,
      merge: this.merge,
      mergeGap: this.mergeGap,
    }
  }
}

const ratio = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback

export type { Connector }

/**
 * Creates a `Connector`.
 *
 * @param input - The spec's fields. See `ConnectorInput` for the default of each field.
 * @returns An immutable `Connector`.
 * @example
 * ```ts
 * const connector = Connector.make({ clearance: 8, gap: 4 })
 * connector.bendCost // 0
 * ```
 */
export const make = (input: ConnectorInput = {}): Connector => new Connector(input)

/**
 * Checks if a value is a `Connector`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Connector`, `false` otherwise.
 */
export const isConnector = (value: unknown): value is Connector => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from toJSON. Each takes a number, never a connector, as
// its first data-last argument.

/**
 * Sets the clearance. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The spec to update.
 * @param clearance - The new clearance.
 * @returns A new spec with the clearance replaced.
 */
export const setClearance: {
  (self: Connector, clearance: number): Connector
  (clearance: number): (self: Connector) => Connector
} = dual(2, (self: Connector, clearance: number) => new Connector({ ...self.toJSON(), clearance }))

/**
 * Sets the gap between routes. The data-last form omits `self` and returns
 * a function of it.
 *
 * @param self - The spec to update.
 * @param gap - The new gap.
 * @returns A new spec with the gap replaced.
 */
export const setGap: {
  (self: Connector, gap: number): Connector
  (gap: number): (self: Connector) => Connector
} = dual(2, (self: Connector, gap: number) => new Connector({ ...self.toJSON(), gap }))

/**
 * Sets the cost of each corner, the scale of every cost. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param bendCost - The new cost of each corner, or a non-finite value for
 * auto.
 * @returns A new spec with the corner cost replaced.
 * @example
 * ```ts
 * Connector.make().pipe(Connector.setBendCost(40)).bendCost // 40
 * ```
 */
export const setBendCost: {
  (self: Connector, bendCost: number): Connector
  (bendCost: number): (self: Connector) => Connector
} = dual(2, (self: Connector, bendCost: number) => new Connector({ ...self.toJSON(), bendCost }))

/**
 * Sets which side of its edge each adornment sits on. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param alignAdornments - The new side, from `0` (left or above) to `1`
 * (right or below).
 * @returns A new spec with the adornment alignment replaced.
 */
export const setAlignAdornments: {
  (self: Connector, alignAdornments: number): Connector
  (alignAdornments: number): (self: Connector) => Connector
} = dual(
  2,
  (self: Connector, alignAdornments: number) =>
    new Connector({ ...self.toJSON(), alignAdornments }),
)

/**
 * Sets where the leftover length of a run puts the flow adornments in its
 * middle. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param justifyAdornments - The new position, from `0` (toward the source)
 * to `1` (toward the target).
 * @returns A new spec with the adornment justification replaced.
 */
export const setJustifyAdornments: {
  (self: Connector, justifyAdornments: number): Connector
  (justifyAdornments: number): (self: Connector) => Connector
} = dual(
  2,
  (self: Connector, justifyAdornments: number) =>
    new Connector({ ...self.toJSON(), justifyAdornments }),
)

/**
 * Sets the share of a run's leftover length that goes between its flow
 * adornments. The data-last form omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param justifyAdornmentsSpace - The new share, from `0` to `1`.
 * @returns A new spec with the adornment spacing replaced.
 */
export const setJustifyAdornmentsSpace: {
  (self: Connector, justifyAdornmentsSpace: number): Connector
  (justifyAdornmentsSpace: number): (self: Connector) => Connector
} = dual(
  2,
  (self: Connector, justifyAdornmentsSpace: number) =>
    new Connector({ ...self.toJSON(), justifyAdornmentsSpace }),
)

/**
 * Sets the share of the adornment spacing that also goes before the first
 * adornment of a run and after the last. The data-last form omits `self`
 * and returns a function of it.
 *
 * @param self - The spec to update.
 * @param justifyAdornmentsSpaceOuter - The new share, from `0`
 * (space-between) to `1` (space-evenly).
 * @returns A new spec with the outer adornment spacing replaced.
 */
export const setJustifyAdornmentsSpaceOuter: {
  (self: Connector, justifyAdornmentsSpaceOuter: number): Connector
  (justifyAdornmentsSpaceOuter: number): (self: Connector) => Connector
} = dual(
  2,
  (self: Connector, justifyAdornmentsSpaceOuter: number) =>
    new Connector({ ...self.toJSON(), justifyAdornmentsSpaceOuter }),
)

/**
 * Sets the distance between flow adornments next to each other on a run.
 * The data-last form omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param adornmentGap - The new distance.
 * @returns A new spec with the adornment gap replaced.
 */
export const setAdornmentGap: {
  (self: Connector, adornmentGap: number): Connector
  (adornmentGap: number): (self: Connector) => Connector
} = dual(
  2,
  (self: Connector, adornmentGap: number) => new Connector({ ...self.toJSON(), adornmentGap }),
)

/**
 * Sets where a jog sits along the run it shifts. The data-last form omits
 * `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param jogAt - The new position, from `0` (the source end) to `1` (the
 * target end).
 * @returns A new spec with the jog position replaced.
 * @example
 * ```ts
 * Connector.make().pipe(Connector.setJogAt(0.25)).jogAt // 0.25
 * ```
 */
export const setJogAt: {
  (self: Connector, jogAt: number): Connector
  (jogAt: number): (self: Connector) => Connector
} = dual(2, (self: Connector, jogAt: number) => new Connector({ ...self.toJSON(), jogAt }))

/**
 * Sets how far a jog too short for its corners slants. The data-last form
 * omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param jogSlant - The new slant, `0` to keep jogs upright.
 * @returns A new spec with the jog slant replaced.
 * @example
 * ```ts
 * Connector.make().pipe(Connector.setJogSlant(0)).jogSlant // 0
 * ```
 */
export const setJogSlant: {
  (self: Connector, jogSlant: number): Connector
  (jogSlant: number): (self: Connector) => Connector
} = dual(2, (self: Connector, jogSlant: number) => new Connector({ ...self.toJSON(), jogSlant }))

/**
 * Sets which edge ends merge. The data-last form omits `self` and returns a
 * function of it.
 *
 * @param self - The spec to update.
 * @param merge - The new setting, one of the `merge` encodings.
 * @returns A new spec with the merge setting replaced.
 * @example
 * ```ts
 * Connector.make().pipe(Connector.setMerge(Connector.merge.side)).merge // 1
 * ```
 */
export const setMerge: {
  (self: Connector, merge: number): Connector
  (merge: number): (self: Connector) => Connector
} = dual(2, (self: Connector, merge: number) => new Connector({ ...self.toJSON(), merge }))

/**
 * Sets the space between the strokes of the lanes of merged ends, which
 * also sets the space inside their steps onto the shared line. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The spec to update.
 * @param mergeGap - The new space, or a negative or non-finite value for
 * `gap`.
 * @returns A new spec with the merge gap replaced.
 * @example
 * ```ts
 * Connector.make({ gap: 8 }).pipe(Connector.setMergeGap(2)).mergeGap // 2
 * ```
 */
export const setMergeGap: {
  (self: Connector, mergeGap: number): Connector
  (mergeGap: number): (self: Connector) => Connector
} = dual(2, (self: Connector, mergeGap: number) => new Connector({ ...self.toJSON(), mergeGap }))

/**
 * A point a route passes through, in the `via` option of an edge, and the
 * ways it arrives there and leaves, if it holds them. A route that holds
 * a way through a point may still turn there, but the corner keeps the
 * gap from the point where the routes beside it leave room, so the run
 * on the held side of the point is at least that long.
 */
export interface ConnectorWaypoint extends Point.PointLike {
  /**
   * The direction the route heads as it arrives at the point, as a vector
   * of any length: `{ x: 0, y: 1 }` for a route that comes down onto it.
   * Omitted, or without a direction, the route may arrive any way.
   */
  readonly arriving?: Point.PointLike | undefined
  /**
   * The direction the route heads as it leaves the point, as a vector of
   * any length. Omitted, or without a direction, the route may leave any
   * way.
   */
  readonly leaving?: Point.PointLike | undefined
}

/**
 * The route constraints of one edge, in the `edges` option of `apply`.
 */
export interface ConnectorEdgeOptions {
  /**
   * Points the route passes through, in order, each the ways it holds (see
   * `ConnectorWaypoint`). A point inside a rect, or inside its clearance
   * off the lines out of its ports, cannot be reached, and leaves the edge
   * without a route.
   */
  readonly via?: ReadonlyArray<ConnectorWaypoint> | undefined
  /**
   * Rects whose interior the route stays out of. Other edges may still
   * cross them. The route may run along their sides.
   */
  readonly avoid?: ReadonlyArray<Rect.Rect> | undefined
  /** The turn the route prefers, one of the `turn` encodings. */
  readonly turn?: number | undefined
  /**
   * Where the route's jogs sit along the runs they shift, from `0` at the
   * source end to `1` at the target end. A finite value overrides the
   * spec's `jogAt`.
   */
  readonly jogAt?: number | undefined
}

/**
 * The options of `apply`.
 */
export interface ConnectorApplyOptions<K extends string = string> {
  /** The route constraints of each edge, in the order of the edges. */
  readonly edges?: ReadonlyArray<ConnectorEdgeOptions | undefined> | undefined
  /**
   * The shape of each rect, keyed by id, as a `Polygon` (see
   * `placement/polygon`) that fills its rect. A rect without one is its
   * rect, with sharp corners. A port sits where the line out of it meets
   * the shape first, coming in from its side of the rect, so edges meet a
   * diamond (`Polygon.make({ phase: 0.5 })`) on its slopes and at its tips
   * rather than on its bounding box, and meet a rounded rect on its curve
   * near a corner. Where the line misses the shape, the port stays on the
   * rect. Routes still keep clear of the rects.
   */
  readonly shapes?: Readonly<Partial<Record<K, Polygon>>> | undefined
}

/**
 * The solved geometry of one edge.
 *
 * - `points`: the polyline from the source port to the target port, with
 *   at least two points. Every segment runs along an axis, and every inner
 *   point is a right-angled corner, except at a slanted jog (see
 *   `jogSlant`), where a slanted segment joins two corners that turn less
 *   than a right angle.
 * - `radii`: how far the corner at each point reaches along its two legs,
 *   one per point, `0` at both ends. A circular corner of radius `R` that
 *   turns `theta` reaches `R * tan(theta / 2)`, so a right-angled one
 *   reaches `R`. A right-angled corner reaches at least the edge's
 *   `radius`, unless a leg is too short for it: the corners on a segment
 *   never reach past each other, and no corner reaches into a flow
 *   adornment or its gaps. The two corners of a slanted jog reach exactly
 *   half its slanted segment, so their arcs meet in an S. Where routes
 *   turn together a short distance apart, the innermost corner keeps the
 *   radius and each corner outside it grows by how far it sits outside the
 *   one inside it, so the corners share a center where the routes are
 *   evenly spaced, as on a metro map. The growth tapers off as the routes
 *   drift apart, down to none at both radii together, so no corner jumps.
 *   Around a corner that a slanted jog turns less than a right angle, the
 *   corners inside grow to the radius of its arc less how far they sit
 *   inside, where that is more than their own. A renderer that rounds
 *   corners draws circular corners that reach these lengths, or any corner
 *   that reaches no farther, though a slanted jog drawn with smaller
 *   corners shows a straight between them.
 * - `outsets`: for each corner that a nest grew, how much larger it is
 *   than the innermost corner of the nest, one per point, and `0` for the
 *   others: how far outside that corner it sits, where the nest keeps one
 *   center, and less where a leg holds it short of that. A renderer that
 *   draws corners other than circles keeps the nest about one center by
 *   drawing each such corner as the innermost one moved out by its
 *   outset: what the innermost corner's radius is at its size less the
 *   outset, plus the outset.
 * - `adornments`: where each adornment landed, in the edge's adornment
 *   order (see `AdornmentPlacement` in `placement/adornment`).
 */
export interface ConnectorRoute {
  /** The polyline from the source port to the target port. */
  readonly points: ReadonlyArray<Point.Point>
  /** The size of the corner at each point, `0` at both ends. */
  readonly radii: ReadonlyArray<number>
  /**
   * How much larger than the innermost corner of its nest the corner at
   * each point is, `0` for one that does not nest.
   */
  readonly outsets: ReadonlyArray<number>
  /** Where each adornment landed, in the edge's adornment order. */
  readonly adornments: ReadonlyArray<AdornmentPlacement>
  /**
   * The edge that draws the adornments this edge shares at each end, as
   * `[source, target]`: the index of an edge, this one's own when it draws
   * them, or `-1` where the end does not merge (see `merge`). The routes of
   * merged ends place their shared adornments in the same spots, so only
   * one of them needs drawing.
   */
  readonly merged: readonly [source: number, target: number]
}

/**
 * The kinds of note that `apply` reports, encoded as numbers: `unrouted` is
 * `0`, `crowded` is `1`, `shared` is `2`, `overflow` is `3`.
 */
export const note = {
  unrouted: 0,
  crowded: 1,
  shared: 2,
  overflow: 3,
} as const

/**
 * Something `apply` gave up, or ran short of room for, with what would
 * have fit it: for a caller to show, or for a layout that places the rects
 * to act on, by moving them.
 *
 * - `unrouted`: no route connects `edge`: its rect is enclosed by others,
 *   or its waypoints cannot be reached.
 * - `crowded`: the channel between `rects` is too narrow for the routes of
 *   `edges` to keep their gaps, so they spread evenly across it instead.
 *   They need `need` more room between the rects along `axis` (`0` for x,
 *   `1` for y). `rects` names the rects on either side of the channel that
 *   hold the routes in, and is empty where only ports do.
 * - `shared`: the ends of `edges` merge on `side` of `rect`, but the merge
 *   has no room in front of the side for its lanes, so the ends share the
 *   port as they are. Whatever sits in front of the side, a rect or the far
 *   end of one of the routes, would have to be `need` farther from it.
 * - `overflow`: no run of the route of `edge` has room for its flow
 *   adornment `adornment`, which sits on the roomiest run, `need` longer
 *   than the run is.
 */
export type ConnectorNote<K extends string = string> =
  | {
      readonly kind: typeof note.unrouted
      readonly edge: number
    }
  | {
      readonly kind: typeof note.crowded
      readonly edges: ReadonlyArray<number>
      readonly axis: 0 | 1
      readonly rects: ReadonlyArray<K>
      readonly need: number
    }
  | {
      readonly kind: typeof note.shared
      readonly edges: ReadonlyArray<number>
      readonly rect: K
      readonly side: number
      readonly need: number
    }
  | {
      readonly kind: typeof note.overflow
      readonly edge: number
      readonly adornment: number
      readonly need: number
    }

/**
 * The result of `apply`.
 *
 * - `edges`: one route per edge, in input order, or `undefined` for an edge
 *   that no route connects: one whose rect is enclosed by others, or whose
 *   waypoints cannot be reached.
 * - `notes`: what the routes gave up, and what would have fit them (see
 *   `ConnectorNote`): the edges without a route first, then the crowded
 *   channels, the merges without room, and the adornments without room.
 */
export interface ConnectorLayout<K extends string = string> {
  /** One route per edge, in input order. */
  readonly edges: ReadonlyArray<ConnectorRoute | undefined>
  /** What the routes gave up, and what would have fit them. */
  readonly notes: ReadonlyArray<ConnectorNote<K>>
}
/**
 * Routes edges between rects that are already placed, around the other
 * rects, and returns one orthogonal route per edge.
 *
 * Rects come keyed by id, the shape of the `nodes` that `Hierarchy.apply`
 * returns (see `placement/hierarchy`), and edges reference them by id, as
 * `Edge`s (see `placement/edge`). Every rect is an obstacle that routes keep
 * `clearance` away from, except where they leave or enter it.
 *
 * The solver follows orthogonal connector routing (Wybrow, Marriott, and
 * Stuckey, 2009):
 *
 * 1. It builds the orthogonal visibility graph: lines through every corner
 *    of every rect, grown by the clearance, and through every port, up to
 *    the nearest rect.
 * 2. It finds each edge's cheapest route on the graph, by A*: the sum of
 *    its length and `bendCost` per corner, plus as much again per corner
 *    against the edge's preferred turn, plus two fifths of it per route it
 *    runs straight across. Running straight across the end of another
 *    route crosses it too, since what the route leads to there, its port
 *    or the whisk of its lane, goes on the way it arrives. A jog shorter
 *    than twice the edge's `radius`, whose two corners could not both fit,
 *    costs its two corners in proportion to its length, so that the cost
 *    of a route varies smoothly as the rects move and no route flips to
 *    another over a jog of a pixel. A route that comes onto a run other
 *    routes run straight along, on one side of them, and leaves it on the
 *    other crosses them, and pays for it as for any crossing. A route that
 *    steps off its line by such a short jog and later back onto the same
 *    line by another, the other way, pays for the routes it would have
 *    crossed on the line in between, less those it crossed on the way
 *    around: stepping around a crossing is no cheaper than making it,
 *    while a jog onto another line for good costs only its corners.
 *    Routes pass through their `via` points and stay
 *    out of their `avoid` rects. Each route sees the routes found before
 *    it, and each one that still crosses another is found once more among
 *    all the others. A route whose waypoints hold a run on the line of
 *    another route's port leg, which nudging can move neither of, goes
 *    around it instead, and so does a route that runs along or beside such
 *    a leg where nudging could not move it the gap off: in the strip
 *    between the leg and a rect's clearance too narrow for the gap and
 *    the two strokes, or on the leg's line bound for that strip, the side
 *    its neighbors come from. It crosses the other route, or goes around,
 *    rather than lie on it. The line out of a route's own port never
 *    counts as such a strip for it: where the ports sit, and how close the
 *    lanes of two merges lie, is not the search's to change.
 * 3. It nudges routes that run alongside each other apart, their strokes
 *    `gap` apart (see the edges' `thickness`), ordered so that routes that
 *    share a path cross only where they must. Where two must cross
 *    whichever way they sit, they sit where they want to be, and where
 *    the orders that pairs of routes ask for conflict, the pairs that must
 *    cross anyway give way first.
 *    Where a passage is too narrow, the routes in it spread evenly across
 *    it. A jog between turns that go opposite ways moves to `jogAt` of the
 *    run it shifts, the middle by default. On the way it passes any route
 *    that runs alongside all of it, which adds no crossing, but stops at
 *    a route that runs alongside only part of it.
 *
 * Ports come from each edge's sides and positions. A port sits on its side
 * of its rect, at its `sourceAt` or `targetAt` along the side, and the route
 * leaves it straight out from the side. An auto side (an omitted or
 * non-finite one) is the side of the cheapest route among all four. An end
 * needs a straight run out of its port for the flow adornments packed
 * there and the corner past them, the edge's `radius`; where a side has
 * less room in front of its port than that, up to the nearest rect across
 * the line out of it, the corner would shrink and the adornments spill
 * around it, so the side costs more: up to twice the `bendCost`, growing
 * with the shortfall until it is as long as the radius or the pack,
 * whichever is longer. An end comes in on a side with room where that
 * costs less than the way around. With
 * `merge` on, a route's length costs a quarter of itself where it runs
 * along the route of an edge whose end at one of its rects could merge
 * with its own, so that routes group up where a long run together pays
 * for the bend and length it takes them to meet, and ends come in on one
 * side to merge there. The pull reaches only within the span of the
 * route's own two rects, so no route goes out of its way to join another,
 * and passages narrower than the gap pull nothing, since they hold one
 * route. The search finds every route on its own first, without the pull,
 * and then twice more with it, so that each route is drawn toward where
 * its partners would go by themselves, and no route's choice settles a
 * tie for the next and holds it there. An
 * auto position is the middle of the side, and the auto ports that share a
 * side spread out evenly, in the order their routes take: routed from the
 * middle of the side, where two of them part, the one that parts toward an
 * end of the side gets the port nearer that end, so the routes nest
 * instead of crossing at the rect. Routes that never part go in the order
 * of where their other ends are. Where the routes from two ports next to
 * each other on a side still cross each other, the ends trade places when
 * that leaves fewer crossings among all the routes (with a `bendCost`). An
 * edge from a rect to itself leaves on the right and enters on the top, by
 * default.
 *
 * With `merge` on, ends on one side of a rect that carry the same adornments
 * there share one port, which takes one spot among the side's auto ports, or
 * the spot they are pinned to. Their routes come in a whisk length from the
 * side, on any line within reach of the port's where the whisk starts past
 * the clearance (close enough that the step from it is at most an S at the
 * steps' radius, below, with room for the other lanes beside it), and on the
 * line out of the port where it does not, and the nudge spreads them onto
 * lanes whose strokes are `mergeGap` apart, in the order they part in:
 * centered on the line where nothing is in the way, and shifted together
 * where something is. Other routes cross the runs the routes come in on
 * rather than ride along or between them. A jog right behind a lane goes no
 * further along its run than a gap short of a route in its way. At the whisk
 * each lane steps onto the line out of the port on two arcs that leave the
 * merge gap inside them, of radius the merge gap plus half the thickest lane
 * (none on an edge without a `radius`), the second ending right behind the
 * adornments: an S for a lane less than two radii off the line, and two full
 * corners for one farther. The lanes on one side of the line all meet it on
 * the same circle, so they peel off one another along it, and run on to the
 * port as one. Back from the merge, the routes' strokes stay the merge gap
 * apart for as long as they run alongside each other, turning the same ways,
 * and their jogs sit beside one another rather than at `jogAt`, so the
 * bundle turns together and its corners nest. Other routes never run inside
 * a bundle, between strokes that sit the merge gap apart: they go past it,
 * to the side with fewer of its routes alongside, and the lanes move aside
 * from a route whose port leaves it among them. A route parts from its
 * bundle as far from the merge as its run allows, short of room for the
 * corner past it (and the adornments at its port, when that comes next),
 * and, where the run has the room, for the flow adornments between its
 * ports, so that they sit on a stretch of their own past the bundle. A route
 * that goes on alone there, from a group of which at least two go on
 * together, keeps its parting jog upright. The whisk is as long as the
 * outermost lane's step needs past the adornments, with the lanes centered
 * on the line, and at least what any S at the steps' radius needs, or half
 * the room before the next rect in front, or before the far end of one of
 * its routes that faces it, less the gap, if less. Where the steps of the
 * lanes as the nudge leaves them do not fit, the arcs of all of them shrink
 * to fit. The rect's clearance on that side deepens to the whisk, so other
 * routes keep out of it and run along one face past it, the gap from it
 * where they cross the lanes, as from the lanes; where that would reach into
 * a neighbor's, cover a port or a waypoint, or close a passage on a route, a
 * zone over the lanes keeps them out instead. `jogSlant` leaves the steps as
 * they are. With no room past the adornments, the ends share the port as
 * they are. Each route's `merged` names the edge that draws the shared
 * adornments.
 *
 * Each route's corners report their `radii`: the edge's `radius` at least,
 * except where a leg is too short for it, and the corners of routes that
 * turn together grown outward from the innermost by how far they sit
 * outside one another, so that they nest about one center. Where a leg is
 * too short for a corner grown this way and the corner at its other end,
 * that corner gives way, by no more than the leg has spare past the two
 * radii, so that a nest holds together where its leg falls a little short
 * and lets go slowly where it falls far short.
 *
 * Edges carry adornments (see `placement/adornment`), which `apply` places
 * on the routes it finds but makes no room for, so adornments on routes
 * that run close alongside each other may overlap. A flow adornment sits on
 * a straight run, and each run lays out its flow adornments the way a flex
 * container with no thickness lays out its items, its main axis pointing
 * toward the target. Those at `0` and `1` pack against their ports. Each
 * of the others goes, first, to the clear stretch nearest where its `at`
 * falls that has room for it: a stretch of a run, short of the room for
 * the edge's `radius` at each corner, where no other route, nor a part of
 * its own not next to the run, comes within `gap` of it with its stroke,
 * across the line
 * or along it. The adornments on a run they went to for being clear keep
 * to their stretch. Failing that, it goes to the run nearest where its
 * `at` falls that has room for it and for the corners, then to the
 * nearest run with room for it alone, and then to the roomiest. Stretches
 * and runs equally near go to the one nearer the source. A run's
 * adornments keep the order of their `at`, `adornmentGap` apart, and sit
 * between its packs and the room for its corners, placed
 * by `justifyAdornments`, `justifyAdornmentsSpace`, and
 * `justifyAdornmentsSpaceOuter`, as `justifyContent` places flex items.
 * `alignAdornments` places them across the line, as `alignItems` does.
 * Where the adornments need it, the corners give up their room. Corners
 * keep clear of flow adornments and their gaps along the line. A route
 * leaves and enters its ports straight for at least the clearance, so a
 * clearance at least as long as the end adornments keeps them off the
 * corners. An absolute adornment sits at `at` of the way along the route
 * as drawn, rounded corners included.
 *
 * A jog shorter than its two corners need slants into an S instead of
 * shrinking them into a kink, as far as `jogSlant` and the free length
 * around it allow, with the curve the gap from other routes and clear of
 * the rects. A jog in a bundle, or where a route leaves a group, stays
 * upright. A short jog right past an auto port that does not merge comes
 * out instead where it can: the port slides along its side, short of its
 * ends by the gap and of the other routes by the gap (the merge gap, for
 * those that share a merge with it), and the route runs straight. A jog is short when it is shorter than its two corners need,
 * and the corner at the port has no more of the leg out of it than the
 * adornments packed there leave. A jog up to half the short length slides
 * away whole, and a longer one less, down to none at the short length, so
 * ports move smoothly; what is left slants.
 *
 * The edge's `weight` and `minLength` have no effect.
 *
 * Where the rects leave too little room, the routes give something up and
 * the layout's `notes` say what, and how much more room would have fit it
 * (see `ConnectorNote`): a channel too narrow for the gaps, a merge with no
 * room for its lanes, an adornment longer than every run, or an edge with
 * no route at all. A layout that places the rects can read them and move
 * the rects apart.
 *
 * Every input is deterministic: the same rects and edges always produce the
 * same routes. Ties fall back to the order of the rects' keys, then of the
 * edges.
 *
 * The geometry comes from exact IEEE 754 arithmetic and is never rounded
 * (see PRECISION.md). Ports and the corners of routes that need no nudging
 * sit exactly on the coordinates of the rects.
 *
 * @param rects - The placed rects, keyed by id.
 * @param edges - The edges, referencing rects by id.
 * @param connector - The routing spec.
 * @param options - The route constraints of each edge.
 * @returns One route per edge.
 * @throws `RangeError` when an edge references an id that no rect has.
 * @example
 * ```ts
 * const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
 * const edges = [Edge.make({ source: 'a', target: 'b' })]
 * const layout = Connector.apply(rects, edges, Connector.make({ clearance: 10 }))
 * layout.edges[0]?.points // [Point (40, 10), Point (70, 10), Point (70, 50), Point (100, 50)]
 * ```
 */
export function apply<const K extends string>(
  rects: Readonly<Record<K, Rect.Rect>>,
  edges: ReadonlyArray<Edge<NoInfer<K>>>,
  connector: Connector,
  options: ConnectorApplyOptions<NoInfer<K>> = {},
): ConnectorLayout<K> {
  return solve(normalize(rects, edges, connector, options)) as ConnectorLayout<K>
}
