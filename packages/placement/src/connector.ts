import { coincident } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Adornment, AdornmentPlacement } from './adornment.ts'
import type { Edge } from './edge.ts'
import {
  type Axis,
  type PlacedAdornment,
  frameSize,
  lengths,
  resolveAdornment,
} from './internal/adornments.ts'
import { packLength, placeAdornments, placeFlow } from './internal/connector/adornments.ts'
import { cornerInsets, cornerRadii } from './internal/connector/corners.ts'
import { type Step, type Whisk, addWhisk, step } from './internal/connector/merge.ts'
import {
  type RouteConstraints,
  type XY,
  nudge,
  coupledSegments,
  firstTurn,
  partingCorners,
  partingSide,
} from './internal/connector/nudge.ts'
import { type SlidingEnd, straightenPorts } from './internal/connector/ports.ts'
import { slantJogs } from './internal/connector/slants.ts'
import { type DirectedEdge, preferredOrder } from './internal/graph/acyclic.ts'
import { crossingsBetween } from './internal/graph/crossings.ts'
import type { Obstacle } from './internal/graph/graph.ts'
import {
  type Endpoint,
  type Path,
  markThrough,
  searchAll,
  shortestPath,
} from './internal/graph/search.ts'
import { ALL_DIRECTIONS, type Pin, visibilityGraph } from './internal/graph/visibility.ts'
import * as Interval from './interval.ts'
import * as Point from './point.ts'
import * as Rect from './rect.ts'

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
   * fewer corners wins anyway. Defaults to `0`.
   */
  readonly bendCost?: number | undefined
  /**
   * The extra cost of each corner that turns against a connector's
   * preferred `turn`, in units of length. Defaults to `0`.
   */
  readonly turnCost?: number | undefined
  /**
   * The cost of each crossing, in units of length: a route takes a detour
   * up to this long to cross one route fewer. A route crosses another
   * where it runs straight on across a stretch that the other runs
   * straight along. Routes find these among the routes found before them,
   * then again among all the others. Defaults to `16`.
   */
  readonly crossingCost?: number | undefined
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
  /** The cost of each corner, in units of length. */
  readonly bendCost: number
  /** The extra cost of a corner against the preferred turn. */
  readonly turnCost: number
  /** The cost of each crossing, in units of length. */
  readonly crossingCost: number
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

    this.clearance = length(input.clearance)
    this.gap = length(input.gap)
    this.bendCost = length(input.bendCost)
    this.turnCost = length(input.turnCost)
    this.crossingCost = input.crossingCost === undefined ? 16 : length(input.crossingCost)
    this.alignAdornments = ratio(input.alignAdornments, 0.5)
    this.justifyAdornments = ratio(input.justifyAdornments, 0.5)
    this.justifyAdornmentsSpace = ratio(input.justifyAdornmentsSpace, 0)
    this.justifyAdornmentsSpaceOuter = ratio(input.justifyAdornmentsSpaceOuter, 0)
    this.adornmentGap = length(input.adornmentGap)
    this.jogAt = Math.min(Math.max(ratio(input.jogAt, 0.5), 0), 1)
    this.jogSlant = input.jogSlant === undefined ? 1 : length(input.jogSlant)
    this.merge = input.merge === merge.side || input.merge === merge.near ? input.merge : merge.none
    this.mergeGap =
      input.mergeGap !== undefined && Number.isFinite(input.mergeGap) && input.mergeGap >= 0
        ? input.mergeGap
        : Number.NaN
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Connector [clearance ${this.clearance} gap ${this.gap} bend ${this.bendCost} turn ${this.turnCost} crossing ${this.crossingCost} align ${this.alignAdornments} justify ${this.justifyAdornments} jog ${this.jogAt} slant ${this.jogSlant} merge ${this.merge} merge gap ${this.mergeGap}]`
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
      turnCost: this.turnCost,
      crossingCost: this.crossingCost,
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

const length = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : 0

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
 * Sets the cost of each corner. The data-last form omits `self` and returns
 * a function of it.
 *
 * @param self - The spec to update.
 * @param bendCost - The new cost of each corner.
 * @returns A new spec with the corner cost replaced.
 */
export const setBendCost: {
  (self: Connector, bendCost: number): Connector
  (bendCost: number): (self: Connector) => Connector
} = dual(2, (self: Connector, bendCost: number) => new Connector({ ...self.toJSON(), bendCost }))

/**
 * Sets the extra cost of a corner against the preferred turn. The data-last
 * form omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param turnCost - The new extra cost.
 * @returns A new spec with the turn cost replaced.
 */
export const setTurnCost: {
  (self: Connector, turnCost: number): Connector
  (turnCost: number): (self: Connector) => Connector
} = dual(2, (self: Connector, turnCost: number) => new Connector({ ...self.toJSON(), turnCost }))

/**
 * Sets the cost of each crossing. The data-last form omits `self` and
 * returns a function of it.
 *
 * @param self - The spec to update.
 * @param crossingCost - The new cost of each crossing.
 * @returns A new spec with the crossing cost replaced.
 */
export const setCrossingCost: {
  (self: Connector, crossingCost: number): Connector
  (crossingCost: number): (self: Connector) => Connector
} = dual(
  2,
  (self: Connector, crossingCost: number) => new Connector({ ...self.toJSON(), crossingCost }),
)

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
 * The route constraints of one edge, in the `edges` option of `apply`.
 */
export interface ConnectorEdgeOptions {
  /**
   * Points the route passes through, in order. A point inside a rect, or
   * inside its clearance off the lines out of its ports, cannot be reached,
   * and leaves the edge without a route.
   */
  readonly via?: ReadonlyArray<Point.PointLike> | undefined
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
export interface ConnectorApplyOptions {
  /** The route constraints of each edge, in the order of the edges. */
  readonly edges?: ReadonlyArray<ConnectorEdgeOptions | undefined> | undefined
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
 *   reaches `R`. A right-angled corner reaches at most the edge's `radius`, and
 *   the corners on a segment never reach past each other. The two corners
 *   of a slanted jog reach exactly half its slanted segment, so their arcs
 *   meet in an S. Where routes turn together a short distance apart, each
 *   inner corner shrinks to fit inside the one outside it, about the same
 *   center where the routes are evenly spaced, as on a metro map. It
 *   follows the outer corner down as a short leg holds that in, and past
 *   the shared center grows back by as far as it sits past, so it never
 *   jumps. Inside a corner that a slanted jog turns less than a right
 *   angle, the radius of that corner's arc bounds it in place of the
 *   size, so it grows back as the slant flattens. No
 *   corner reaches into a flow adornment or its gaps. A renderer that
 *   rounds corners draws circular corners that reach these lengths, or any
 *   corner that reaches no farther, though a slanted jog drawn with
 *   smaller corners shows a straight between them.
 * - `insets`: for each inner corner that a nest sized, how far inside the
 *   outermost corner of the nest it sits, one per point, and `0` for the
 *   others. A renderer that draws corners other than circles keeps the
 *   nest about one center by drawing each such corner as the outermost
 *   one moved in by its inset: what the outermost corner's radius would be
 *   at its size plus the inset, less the inset.
 * - `adornments`: where each adornment landed, in the edge's adornment
 *   order (see `AdornmentPlacement` in `placement/adornment`).
 */
export interface ConnectorRoute {
  /** The polyline from the source port to the target port. */
  readonly points: ReadonlyArray<Point.Point>
  /** The size of the corner at each point, `0` at both ends. */
  readonly radii: ReadonlyArray<number>
  /**
   * How far inside the outermost corner of its nest the corner at each
   * point sits, `0` for one that does not nest.
   */
  readonly insets: ReadonlyArray<number>
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
 * The result of `apply`.
 *
 * - `edges`: one route per edge, in input order, or `undefined` for an edge
 *   that no route connects: one whose rect is enclosed by others, or whose
 *   waypoints cannot be reached.
 */
export interface ConnectorLayout {
  /** One route per edge, in input order. */
  readonly edges: ReadonlyArray<ConnectorRoute | undefined>
}

// The outward heading of each side, in the order of the `side` encodings
// of `placement/edge`: top, right, bottom, left.
const OUTWARD = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const

interface Port {
  readonly side: number
  readonly x: number
  readonly y: number
  // The obstacle the port's pin belongs to, when it is not the rect's.
  readonly owner?: number
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
 *    its length and `bendCost` per corner, plus `turnCost` per corner
 *    against the edge's preferred turn, plus `crossingCost` per route it
 *    runs straight across. Routes pass through their `via` points and stay
 *    out of their `avoid` rects. Each route sees the routes found before
 *    it, and each one that still crosses another is found once more among
 *    all the others.
 * 3. It nudges routes that run alongside each other apart, their strokes
 *    `gap` apart (see the edges' `thickness`), ordered so that routes that
 *    share a path cross only where they must.
 *    Where a passage is too narrow, the routes in it spread evenly across
 *    it. A jog between turns that go opposite ways moves to `jogAt` of the
 *    run it shifts, the middle by default. On the way it passes any route
 *    that runs alongside all of it, which adds no crossing, but stops at
 *    a route that runs alongside only part of it.
 *
 * Ports come from each edge's sides and positions. A port sits on its side
 * of its rect, at its `sourceAt` or `targetAt` along the side, and the route
 * leaves it straight out from the side. An auto side (an omitted or
 * non-finite one) is the side of the cheapest route among all four. An
 * auto position is the middle of the side, and the auto ports that share a
 * side spread out evenly, in the order their routes take: routed from the
 * middle of the side, where two of them part, the one that parts toward an
 * end of the side gets the port nearer that end, so the routes nest
 * instead of crossing at the rect. Routes that never part go in the order
 * of where their other ends are. Where the routes from two ports next to
 * each other on a side, or two lanes next to each other in a merge, still
 * cross each other, the ends trade places when that leaves fewer
 * crossings among all the routes (with a `crossingCost`). An edge
 * from a rect to itself leaves on the right and enters on the top, by
 * default.
 *
 * With `merge` on, ends on one side of a rect that carry the same
 * adornments there share one port, which takes one spot among the side's
 * auto ports, or the spot they are pinned to. Their routes come in on
 * lanes whose strokes are `mergeGap` apart, in the order they part in, and
 * run straight to a whisk length from the side. There each lane steps
 * onto the line out of the port on two arcs that leave the merge gap
 * inside them, of radius the merge gap plus half the thickest lane (none
 * on an edge without a `radius`), the second ending right behind the adornments: an
 * S for a lane less than two radii off the line, and two full corners for
 * one farther. The lanes on one side of the line all meet it on the same
 * circle, so they peel off one another along it, and run on to the port
 * as one. Back from the merge, the routes' strokes stay the merge gap
 * apart for as long as they run alongside each other, turning the same
 * ways, and their jogs sit beside one another rather than at `jogAt`, so
 * the bundle turns together and its corners nest. Other routes never run
 * inside a bundle, between strokes that sit the merge gap apart: they go
 * past it, to the side with fewer of its routes alongside, and a route
 * whose port leaves it among the lanes steps out past them once it clears
 * its rect. A route parts from its
 * bundle as far from the merge as its run allows, short of room for the
 * corner past it (and the adornments at its port, when that comes next).
 * A route that goes on alone there, from a group of which at least two go
 * on together, turns as tight as the merge allows: the merge gap inside
 * its stroke, or that plus the offsets of the parting corners nested
 * inside it, and its parting jog stays upright. A pair that parts, or a
 * route whose last partner ends, leaves no group, and turns as usual.
 * The whisk is as long as the outermost lane's step needs past the
 * adornments, or half the room before the next rect in front, or before
 * the far end of one of its routes that faces it, less the gap, if less,
 * with the arcs shrunk to fit. Other routes keep out of it, and
 * `jogSlant` leaves the steps as they are. With no room past the
 * adornments, the ends share the port as they are. Each route's `merged`
 * names the edge that draws the shared adornments.
 *
 * Each route's corners report their `radii`, from the edge's `radius`, with
 * the inner corners of routes that turn together shrunk to nest, down to
 * half the edge's `thickness`, where the inside of the stroke would fold.
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
 * ends by the gap and of the other routes by the gap, and the route runs
 * straight. A jog up to half the short length slides away whole, and a
 * longer one less, down to none at the short length, so ports move
 * smoothly; what is left slants.
 *
 * The edge's `weight`, `minLength`, and `minRadius` have no effect.
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
  options: ConnectorApplyOptions = {},
): ConnectorLayout {
  const ids = Object.keys(rects) as Array<K>
  const index = new Map<string, number>(ids.map((id, i) => [id, i]))
  const boxes = ids.map((id) => rects[id])
  for (const edge of edges) {
    for (const id of [edge.source, edge.target]) {
      if (!index.has(id)) {
        throw new RangeError(`An edge references the id "${id}", which no rect has`)
      }
    }
  }
  const obstacles = grow(boxes, connector.clearance)
  const edgeOptions = edges.map((_, i) => options.edges?.[i])

  // The extra pins that every graph needs: waypoints, and the corners of
  // avoided rects, so that lines run around them.
  const extraPins: Array<Pin> = []
  for (const option of edgeOptions) {
    for (const point of option?.via ?? []) {
      extraPins.push({ x: point.x, y: point.y, directions: ALL_DIRECTIONS })
    }
    for (const r of option?.avoid ?? []) {
      for (const [x, y] of [
        [r.left, r.top],
        [r.right, r.top],
        [r.left, r.bottom],
        [r.right, r.bottom],
      ] as const) {
        extraPins.push({ x, y, directions: ALL_DIRECTIONS })
      }
    }
  }
  const costs = (option: ConnectorEdgeOptions | undefined) => ({
    bendCost: connector.bendCost,
    clockwiseCost: option?.turn === turn.counterclockwise ? connector.turnCost : 0,
    counterclockwiseCost: option?.turn === turn.clockwise ? connector.turnCost : 0,
    avoid: option?.avoid ?? [],
  })

  // The sides of each edge's two ports. Auto sides take the side of the
  // cheapest route over all four, on a graph with a port at the middle of
  // every candidate side.
  const sides = edges.map((edge) => selfLoopSides(edge))
  const searched = sides.flatMap(([source, target], i) =>
    source === undefined || target === undefined ? [i] : [],
  )
  // The trial routes, from the middle of each side, that order the auto
  // ports sharing a side. The side search finds them along the way for
  // every edge with an auto position.
  let trial: Array<Array<XY> | undefined> = edges.map(() => undefined)
  const tried = new Set<number>()
  if (searched.length > 0) {
    const auto = new Set(searched)
    const routed = edges.flatMap((edge, i) =>
      auto.has(i) || !Number.isFinite(edge.sourceAt) || !Number.isFinite(edge.targetAt) ? [i] : [],
    )
    const pins: Array<Pin> = [...extraPins]
    const candidates = routed.map((i) => {
      const edge = edges[i] as Edge<K>
      const [source, target] = sides[i] as [number | undefined, number | undefined]
      const ends = [
        [edge.source, source, edge.sourceAt, 1],
        [edge.target, target, edge.targetAt, -1],
      ] as const
      return ends.map(([id, side, at, outward]) => {
        const owner = index.get(id) as number
        return (side === undefined ? [0, 1, 2, 3] : [side]).map((s) => {
          const port = portOf(boxes[owner] as Rect.Rect, s, Number.isFinite(at) ? at : 0.5)
          pins.push(pinOf(port, owner))
          return { side: s, pin: pins.length - 1, outward }
        })
      })
    })
    const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
    type Candidate = { side: number; pin: number; outward: number }
    const endpoint = ({ side, pin, outward }: Candidate): Endpoint => {
      const heading = OUTWARD[side] as Point.PointLike
      return {
        node: nodes[pin] as number,
        headings: [{ x: outward * heading.x, y: outward * heading.y }],
      }
    }
    const { paths } = searchAll(graph, routed.length, connector.crossingCost, (k, through) => {
      const i = routed[k] as number
      const [starts, ends] = candidates[k] as [Array<Candidate>, Array<Candidate>]
      return shortestPath(graph, starts.map(endpoint), ends.map(endpoint), {
        ...costs(edgeOptions[i]),
        via: viaNodes(edgeOptions[i], nodes, extraPins),
        crossingCost: connector.crossingCost,
        ...(through === undefined ? {} : { through }),
      })
    })
    for (const [k, i] of routed.entries()) {
      const [starts, ends] = candidates[k] as [Array<Candidate>, Array<Candidate>]
      const path = paths[k]
      tried.add(i)
      if (path !== undefined) {
        trial[i] = [...path.nodes].map(
          (node): XY => [graph.xs[node] as number, graph.ys[node] as number],
        )
      }
      if (!auto.has(i)) {
        continue
      }
      const edge = edges[i] as Edge<K>
      const facing = facingSides(
        boxes[index.get(edge.source) as number] as Rect.Rect,
        boxes[index.get(edge.target) as number] as Rect.Rect,
      )
      sides[i] = [
        path === undefined ? facing[0] : (starts[path.start] as { side: number }).side,
        path === undefined ? facing[1] : (ends[path.end] as { side: number }).side,
      ]
    }
  }

  // The routes of the edges `which`, on a graph with the given ports, among
  // the given obstacles. Where the routes from two ends in `trades`, next
  // to each other on one side, cross each other, the ends trade ports when
  // that leaves fewer crossings among all the routes, and the traded pairs
  // come back with the routes.
  const routeAll = (
    ports: ReadonlyArray<[Port, Port]>,
    which: ReadonlyArray<number>,
    blocks: ReadonlyArray<Obstacle> = obstacles,
    trades: ReadonlyArray<readonly [EdgeEnd, EdgeEnd]> = [],
  ): { routes: Array<Array<XY> | undefined>; traded: Array<readonly [EdgeEnd, EdgeEnd]> } => {
    const pins: Array<Pin> = [...extraPins]
    for (const [i, edge] of edges.entries()) {
      const [source, target] = ports[i] as [Port, Port]
      pins.push(pinOf(source, index.get(edge.source) as number))
      pins.push(pinOf(target, index.get(edge.target) as number))
    }
    const { graph, pins: nodes } = visibilityGraph(blocks, pins)
    // The pin each end leaves from or arrives at, which trades swap.
    const pinOfEnd = edges.map((_, i) => [extraPins.length + 2 * i, extraPins.length + 2 * i + 1])
    const search = (i: number, through: ArrayLike<number> | undefined) => {
      const [source, target] = ports[i] as [Port, Port]
      const [start, end] = pinOfEnd[i] as [number, number]
      const out = OUTWARD[source.side] as Point.PointLike
      const into = OUTWARD[target.side] as Point.PointLike
      return shortestPath(
        graph,
        [{ node: nodes[start] as number, headings: [out] }],
        [{ node: nodes[end] as number, headings: [{ x: -into.x, y: -into.y }] }],
        {
          ...costs(edgeOptions[i]),
          via: viaNodes(edgeOptions[i], nodes, extraPins),
          crossingCost: connector.crossingCost,
          ...(through === undefined ? {} : { through }),
        },
      )
    }
    const found = searchAll(graph, which.length, connector.crossingCost, (k, through) =>
      search(which[k] as number, through),
    )
    const paths: Array<Path | undefined> = edges.map(() => undefined)
    for (const [k, i] of which.entries()) {
      paths[i] = found.paths[k]
    }
    const pointsOf = (path: Path | undefined) =>
      path === undefined
        ? undefined
        : [...path.nodes].map((node): XY => [graph.xs[node] as number, graph.ys[node] as number])
    const routes = paths.map(pointsOf)
    const traded: Array<readonly [EdgeEnd, EdgeEnd]> = []
    const through = found.through
    if (through === undefined) {
      return { routes, traded }
    }
    // How many times the routes of edges `a` and `b` cross any route.
    const crossingsOf = (a: number, b: number) => {
      const cross = (i: number, k: number) => {
        const p = paths[i]?.nodes
        const q = paths[k]?.nodes
        return p === undefined || q === undefined ? 0 : crossingsBetween(graph, p, q)
      }
      let count = cross(a, b)
      for (const k of paths.keys()) {
        if (k !== a && k !== b) {
          count += cross(a, k) + cross(b, k)
        }
      }
      return count
    }
    for (const pair of trades) {
      const [a, b] = pair
      const pa = paths[a.edge]?.nodes
      const pb = paths[b.edge]?.nodes
      if (
        a.edge === b.edge ||
        pa === undefined ||
        pb === undefined ||
        crossingsBetween(graph, pa, pb) === 0
      ) {
        continue
      }
      const held = [paths[a.edge], paths[b.edge]] as const
      const before = crossingsOf(a.edge, b.edge)
      const swap = () => {
        const ends = [pinOfEnd[a.edge] as Array<number>, pinOfEnd[b.edge] as Array<number>]
        const pin = ends[0]?.[a.end] as number
        ;(ends[0] as Array<number>)[a.end] = ends[1]?.[b.end] as number
        ;(ends[1] as Array<number>)[b.end] = pin
      }
      swap()
      markThrough(graph, through, held[0], -1)
      markThrough(graph, through, held[1], -1)
      for (const i of [a.edge, b.edge]) {
        paths[i] = search(i, through)
        markThrough(graph, through, paths[i], 1)
        routes[i] = pointsOf(paths[i])
      }
      if (
        paths[a.edge] !== undefined &&
        paths[b.edge] !== undefined &&
        crossingsOf(a.edge, b.edge) < before
      ) {
        traded.push(pair)
        continue
      }
      swap()
      for (const [k, i] of [a.edge, b.edge].entries()) {
        markThrough(graph, through, paths[i], -1)
        paths[i] = held[k]
        markThrough(graph, through, paths[i], 1)
        routes[i] = pointsOf(paths[i])
      }
    }
    return { routes, traded }
  }

  const resolved = edges.map((edge) =>
    edge.adornments.map((adornment) =>
      resolveAdornment(adornment, true, false, connector.alignAdornments),
    ),
  )
  // The length the adornments at an end of an edge pack into at a port on
  // `side`, and the length a merge of it takes at most.
  const packAt = (edge: number, end: number, side: number) => {
    const out = OUTWARD[side] as Point.PointLike
    const axis: Axis = side % 2 === 0 ? 1 : 0
    const heading = (axis === 0 ? out.x : out.y) * (end === 0 ? 1 : -1)
    return packLength(resolved[edge] ?? [], end, axis, heading > 0 ? 1 : -1, connector.adornmentGap)
  }

  // The ends that may merge, by the adornments at them. A loop never
  // merges with itself.
  const merging = connector.merge !== merge.none
  const keys = edges.map((edge) =>
    [0, 1].map((end) => (merging && edge.source !== edge.target ? endKey(edge, end) : undefined)),
  )
  const keyOf = (end: SharedEnd) => (keys[end.edge] as Array<string | undefined>)[end.end]

  // Ends pinned to one spot on a side, with the same adornments there.
  const pinned: Array<{ ends: Array<SharedEnd>; at: number }> = []
  if (merging) {
    for (const [i, edge] of edges.entries()) {
      for (const end of [0, 1]) {
        const at = end === 0 ? edge.sourceAt : edge.targetAt
        const key = (keys[i] as Array<string | undefined>)[end]
        if (!Number.isFinite(at) || key === undefined) {
          continue
        }
        const side = (sides[i] as [number, number])[end] as number
        const rect = index.get(end === 0 ? edge.source : edge.target) as number
        const far = boxes[index.get(end === 0 ? edge.target : edge.source) as number] as Rect.Rect
        const shared: SharedEnd = {
          edge: i,
          end,
          rect,
          side,
          key: side % 2 === 0 ? far.x + far.width / 2 : far.y + far.height / 2,
        }
        const group = pinned.find(
          (g) =>
            (g.ends[0] as SharedEnd).rect === rect &&
            (g.ends[0] as SharedEnd).side === side &&
            keyOf(g.ends[0] as SharedEnd) === key &&
            coincident(g.at, at),
        )
        if (group === undefined) {
          pinned.push({ ends: [shared], at })
        } else {
          group.ends.push(shared)
        }
      }
    }
  }
  const pinnedMerges = pinned.filter((group) => group.ends.length > 1)

  // The ports, with auto positions spread along shared sides. The order
  // along a side comes from routes that all leave its middle: where two of
  // them part, the one that turns toward an end of the side takes the port
  // nearer that end, so the routes nest instead of crossing at the rect.
  // Ends that merge take one spot among the others.
  const shared = sharedSides(edges, sides as Array<[number, number]>, boxes, index)
  const needed = new Set([
    ...[...shared.values()].flatMap((list) =>
      list.length > 1 ? list.map(({ edge }) => edge) : [],
    ),
    ...pinnedMerges.flatMap((group) => group.ends.map(({ edge }) => edge)),
  ])
  const missing = [...needed].filter((i) => !tried.has(i)).toSorted((a, b) => a - b)
  if (missing.length > 0) {
    const { routes: routed } = routeAll(
      portsAt(edges, sides as Array<[number, number]>, boxes, index, new Map()),
      missing,
    )
    for (const i of missing) {
      trial[i] = routed[i]
    }
  }
  const outward = (end: SharedEnd) => {
    const route = trial[end.edge]
    return route === undefined || end.end === 0 ? route : [...route].toReversed()
  }
  const { positions, merges } = spread(
    shared,
    trial,
    merging ? keyOf : () => undefined,
    connector.merge === merge.near
      ? (a, b) => {
          const p = outward(a)
          const q = outward(b)
          return p !== undefined && q !== undefined && firstTurn(p) * firstTurn(q) >= 0
        }
      : undefined,
  )
  for (const group of pinnedMerges) {
    merges.push({ ends: orderEnds(group.ends, trial), at: group.at })
  }
  const ports = portsAt(edges, sides as Array<[number, number]>, boxes, index, positions)

  // Each merge's lanes, their strokes `mergeGap` apart. They end a whisk
  // length out from
  // the side, as far as the outermost lane's step onto the line out of
  // the port needs past the adornments, or halfway to the rects in front, so
  // routes still reach the lanes between; with less room, the steps' arcs
  // shrink to fit. Beyond the clearance, a zone keeps other routes out of
  // the whisk. With no room past the adornments, the ends share the port as
  // they are.
  const mergeGap = Number.isFinite(connector.mergeGap) ? connector.mergeGap : connector.gap
  const zones: Array<Obstacle> = []
  const whisks = new Map<string, Whisk>()
  const merged: Array<Array<{ edge: number; end: number }>> = []
  for (const { ends, at } of merges) {
    const { rect, side } = ends[0] as SharedEnd
    const port = portOf(boxes[rect] as Rect.Rect, side, at)
    const out = OUTWARD[side] as Point.PointLike
    const along = side % 2 === 0 ? { x: 1, y: 0 } : { x: 0, y: 1 }
    const widths = ends.map((end) => thicknessOf(edges[end.edge] as Edge<K>))
    const offsets = [0]
    for (let k = 1; k < ends.length; k++) {
      const previous = offsets[k - 1] as number
      offsets.push(previous + mergeGap + ((widths[k - 1] as number) + (widths[k] as number)) / 2)
    }
    const middle = (offsets.at(-1) as number) / 2
    const lanes = offsets.map((offset) => offset - middle)
    const pack = packAt((ends[0] as SharedEnd).edge, (ends[0] as SharedEnd).end, side)
    // The arcs of a lane's step leave the merge gap inside them: their
    // radius is the gap plus half the thickest lane, on edges with rounded
    // corners.
    const turning = mergeGap + Math.max(...widths) / 2
    const radii = ends.map((end) => (length((edges[end.edge] as Edge<K>).radius) > 0 ? turning : 0))
    const steps = (shrink: number) =>
      ends.map((_, k) => step(Math.abs(lanes[k] as number), Math.min(radii[k] as number, shrink)))
    // Distances out from the side and positions along it.
    const base = side % 2 === 0 ? port.x : port.y
    const line = side % 2 === 0 ? port.y : port.x
    const sign = side % 2 === 0 ? out.y : out.x
    const low = base + (lanes[0] as number)
    const high = base + (lanes.at(-1) as number)
    let free = Infinity
    for (const [j, box] of obstacles.entries()) {
      if (j === rect) {
        continue
      }
      const [from, to] = side % 2 === 0 ? [box.left, box.right] : [box.top, box.bottom]
      if (!(to > low && from < high) || coincident(to, low) || coincident(from, high)) {
        continue
      }
      const [near, far] = side % 2 === 0 ? [box.top, box.bottom] : [box.left, box.right]
      const [ahead, behind] = sign > 0 ? [near - line, far - line] : [line - far, line - near]
      if (behind > 0 && !coincident(behind, 0)) {
        free = Math.min(free, Math.max(ahead, 0))
      }
    }
    // A route whose other end faces this side from in front comes in
    // toward it, so the lanes stop short of half the way there, the gap
    // clear of the other end's half, and no route has to turn back.
    for (const { edge, end } of ends) {
      const other = (ports[edge] as [Port, Port])[1 - end] as Port
      const facing = OUTWARD[other.side] as Point.PointLike
      if (facing.x === -out.x && facing.y === -out.y) {
        const ahead = sign * ((side % 2 === 0 ? other.y : other.x) - line)
        if (ahead > 0) {
          free = Math.min(free, Math.max(ahead - connector.gap, 0))
        }
      }
    }
    const full = steps(Infinity)
    const reach = Math.min(pack + Math.max(...full.map(({ lane }) => lane)), free / 2)
    const fitted = full.every(({ lane }) => pack + lane <= reach || coincident(pack + lane, reach))
      ? full
      : steps(Math.max((reach - pack) / 2, 0))
    const own = obstacles[rect] as Obstacle
    const grown =
      side % 2 === 0 ? (sign > 0 ? own.bottom : own.top) : sign > 0 ? own.right : own.left
    const depth = sign * (grown - line)
    const roomy = reach > 0 && !coincident(reach, 0) && (reach > pack || coincident(reach, pack))
    let owner: number | undefined
    if (roomy && reach > depth && !coincident(reach, depth) && high > low) {
      const outer = line + sign * reach
      zones.push(
        side % 2 === 0
          ? { left: low, right: high, top: Math.min(line, outer), bottom: Math.max(line, outer) }
          : { left: Math.min(line, outer), right: Math.max(line, outer), top: low, bottom: high },
      )
      owner = obstacles.length + zones.length - 1
    }
    for (const [k, end] of ends.entries()) {
      const key = `${end.edge}:${end.end}`
      const pair = ports[end.edge] as [Port, Port]
      const lane = lanes[k] as number
      if (!roomy) {
        pair[end.end] = port
        continue
      }
      pair[end.end] = {
        side,
        x: port.x + out.x * reach + along.x * lane,
        y: port.y + out.y * reach + along.y * lane,
        ...(owner === undefined ? {} : { owner }),
      }
      const { trunk, lane: onLane, reach: corner } = fitted[k] as Step
      whisks.set(key, {
        port: [port.x, port.y],
        outward: [out.x, out.y],
        lateral: [along.x * lane, along.y * lane],
        trunk: pack + trunk,
        lane: pack + onLane,
        reach: corner,
      })
    }
    merged.push(ends.map(({ edge, end }) => ({ edge, end })))
  }
  const blocks = zones.length === 0 ? obstacles : [...obstacles, ...zones]

  // The routes, on a graph with the final ports. Ends next to each other on
  // a side, alone or as lanes of one merge, may trade ports to cross less.
  const lone = (end: EdgeEnd) =>
    !merged.some((members) => members.some((m) => m.edge === end.edge && m.end === end.end))
  const trades: Array<readonly [EdgeEnd, EdgeEnd]> = []
  for (const group of shared.values()) {
    const placed = group
      .filter(lone)
      .toSorted(
        (a, b) =>
          (positions.get(`${a.edge}:${a.end}`) ?? 0.5) -
          (positions.get(`${b.edge}:${b.end}`) ?? 0.5),
      )
    for (let k = 1; k < placed.length; k++) {
      trades.push([placed[k - 1] as SharedEnd, placed[k] as SharedEnd])
    }
  }
  for (const members of merged) {
    for (let k = 1; k < members.length; k++) {
      const [a, b] = [members[k - 1] as EdgeEnd, members[k] as EdgeEnd]
      // Lanes of different strokes sit different distances apart.
      if (thicknessOf(edges[a.edge] as Edge<K>) === thicknessOf(edges[b.edge] as Edge<K>)) {
        trades.push([a, b])
      }
    }
  }
  const { routes, traded } = routeAll(
    ports,
    edges.map((_, i) => i),
    blocks,
    trades,
  )
  for (const [a, b] of traded) {
    const [p, q] = [ports[a.edge] as [Port, Port], ports[b.edge] as [Port, Port]]
    ;[p[a.end], q[b.end]] = [q[b.end] as Port, p[a.end] as Port]
    const [ka, kb] = [`${a.edge}:${a.end}`, `${b.edge}:${b.end}`]
    const [wa, wb] = [whisks.get(ka), whisks.get(kb)]
    if (wa !== undefined && wb !== undefined) {
      whisks.set(ka, wb)
      whisks.set(kb, wa)
    }
  }

  // The first edge of each merge with a route draws the shared adornments.
  const leaders = new Map<string, number>()
  for (const members of merged) {
    const first = members
      .filter(({ edge }) => routes[edge] !== undefined)
      .reduce((lead, { edge }) => Math.min(lead, edge), Infinity)
    for (const { edge, end } of members) {
      leaders.set(`${edge}:${end}`, Number.isFinite(first) ? first : -1)
    }
  }

  // Nudge the routes that were found, together. The routes of a merge stay
  // the merge gap apart while they run together from it.
  const mergeOf = new Map<string, number>()
  for (const [id, members] of merged.entries()) {
    for (const { edge, end } of members) {
      mergeOf.set(`${edge}:${end}`, id)
    }
  }
  const found = routes.flatMap((route, i) => (route === undefined ? [] : [i]))
  const nudgedRoutes = nudge(
    found.map((i) => routes[i] as Array<XY>),
    blocks,
    connector.gap,
    found.map((i): RouteConstraints => {
      const option = edgeOptions[i]
      return {
        anchors: (option?.via ?? []).map((p): XY => [p.x, p.y]),
        avoid: option?.avoid ?? [],
        jogAt:
          option?.jogAt !== undefined && Number.isFinite(option.jogAt)
            ? option.jogAt
            : connector.jogAt,
        merges: [mergeOf.get(`${i}:0`) ?? -1, mergeOf.get(`${i}:1`) ?? -1],
        thickness: thicknessOf(edges[i] as Edge<K>),
        corner: length((edges[i] as Edge<K>).radius),
        slant: connector.jogSlant,
        packs: [0, 1].map((end) =>
          packAt(i, end, ((ports[i] as [Port, Port])[end] as Port).side),
        ) as [number, number],
      }
    }),
    mergeGap,
  )
  // Auto ports that do not merge slide along their sides to take out the
  // short jogs right past them.
  const straight = straightenPorts(
    nudgedRoutes,
    found.map((i) => {
      const edge = edges[i] as Edge<K>
      return [0, 1].map((end) => {
        const id = end === 0 ? edge.source : edge.target
        const at = end === 0 ? edge.sourceAt : edge.targetAt
        const rect = index.get(id) as number
        if (Number.isFinite(at) || mergeOf.has(`${i}:${end}`) || edge.source === edge.target) {
          return undefined
        }
        const box = boxes[rect] as Rect.Rect
        return {
          rect: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
          own: rect,
          side: ((ports[i] as [Port, Port])[end] as Port).side,
        }
      }) as [SlidingEnd | undefined, SlidingEnd | undefined]
    }),
    blocks,
    {
      gap: connector.gap,
      reach: found.map((i) => length((edges[i] as Edge<K>).radius)),
      thickness: found.map((i) => thicknessOf(edges[i] as Edge<K>)),
      anchors: found.map((i) => (edgeOptions[i]?.via ?? []).map((p): XY => [p.x, p.y])),
    },
  )

  // Merged ends lead from their lanes to the shared port. Their steps keep
  // the corners they were given, so nothing slants them further. Where a
  // route leaves a group that goes on without it, it turns as tight as the
  // merge allows, and the jog that leaves it stays upright.
  const exempt = found.map(() => new Set<number>())
  const stepCorners = found.map(() => new Map<number, number>())
  const mergesOf = found.map(
    (i) => [mergeOf.get(`${i}:0`) ?? -1, mergeOf.get(`${i}:1`) ?? -1] as const,
  )
  const parting = partingCorners(straight, mergesOf)
  // A jog in a bundle turns with it, so it stays upright too.
  const coupled = coupledSegments(straight, mergesOf)
  const nudged = straight.map((route, k) => {
    const i = found[k] as number
    const jogs = exempt[k] as Set<number>
    const corners = stepCorners[k] as Map<number, number>
    const parts = parting[k] as Set<number>
    for (const corner of parts) {
      jogs.add(corner - 1).add(corner)
    }
    for (const segment of coupled[k] ?? []) {
      jogs.add(segment)
    }
    let points: Array<XY> = route
    const target = whisks.get(`${i}:1`)
    if (target !== undefined) {
      points = addWhisk(points, target, false)
      if (stepped(target)) {
        jogs.add(points.length - 3)
        corners.set(points.length - 3, target.reach).set(points.length - 2, target.reach)
      }
    }
    const source = whisks.get(`${i}:0`)
    if (source !== undefined) {
      const before = points.length
      points = addWhisk(points, source, true)
      const shift = points.length - before
      const moved = [...jogs].map((jog) => jog + shift)
      const reaches = [...corners].map(([index, reach]) => [index + shift, reach] as const)
      const shifted = [...parts].map((corner) => corner + shift)
      jogs.clear()
      corners.clear()
      parts.clear()
      for (const jog of moved) {
        jogs.add(jog)
      }
      for (const corner of shifted) {
        parts.add(corner)
      }
      for (const [index, reach] of reaches) {
        corners.set(index, reach)
      }
      if (stepped(source)) {
        jogs.add(1)
        corners.set(1, source.reach).set(2, source.reach)
      }
    }
    return points
  })

  // Flow adornments wall off corners, and absolute ones land on the route
  // as drawn, with its corners sized.
  const adornments = found.map((i) => resolved[i] ?? [])
  const cumulative = nudged.map((route) => lengths(route))
  // The segments of every route, as boxes, that the flow adornments between
  // the ports of other routes look for clear stretches among.
  // Each takes the width of its stroke.
  const segments = nudged.map((route, k) => {
    const half = thicknessOf(edges[found[k] as number] as Edge<K>) / 2
    return route.slice(1).map((b, i): Obstacle => {
      const a = route[i] as XY
      return {
        left: Math.min(a[0], b[0]) - half,
        right: Math.max(a[0], b[0]) + half,
        top: Math.min(a[1], b[1]) - half,
        bottom: Math.max(a[1], b[1]) + half,
      }
    })
  })
  const flows = nudged.map((route, k) => {
    const between = (adornments[k] ?? []).some(
      (adornment) => adornment.flow && !coincident(adornment.at, 0) && !coincident(adornment.at, 1),
    )
    return placeFlow(
      route,
      cumulative[k] as Array<number>,
      adornments[k] ?? [],
      {
        radius: length((edges[found[k] as number] as Edge<K>).radius),
        gap: connector.adornmentGap,
        justify: connector.justifyAdornments,
        space: connector.justifyAdornmentsSpace,
        spaceOuter: connector.justifyAdornmentsSpaceOuter,
        clear: connector.gap,
      },
      between ? segments.flatMap((list, other) => (other === k ? [] : list)) : [],
    )
  })
  // The steps keep the corners they were given, and nest with nothing.
  const radii = found.map((i) => (edges[i] as Edge<K>).radius)
  const walls = flows.map((flow) => flow.walls)
  const thickness = found.map((i) => thicknessOf(edges[i] as Edge<K>))
  // The tightest a merged route turns: the merge gap inside its stroke.
  const turning = thickness.map((width) => mergeGap + width / 2)
  const tight = { thickness, exits: parting, turning }
  const sizes = cornerRadii(nudged, radii, walls, { fixed: stepCorners, ...tight })
  // Short jogs slant, and the flow adornments past them move up the
  // shorter route.
  const slanted = slantJogs(
    nudged,
    sizes,
    found.map((i) => length((edges[i] as Edge<K>).radius)),
    connector.jogSlant,
    flows.map((flow) => flow.walls),
    obstacles,
    exempt,
    { gap: connector.gap, thickness, merges: mergesOf, mergeGap },
  )
  // Then the corners settle on the routes as drawn. A slanted corner keeps
  // its size, and so do the corners at the far ends of its legs, which the
  // slant made room beside; the corners nested inside a slanted one grow
  // with its arc.
  const shaped = slanted.map(({ points }) => points)
  const settled = cornerRadii(nudged, radii, walls, {
    fixed: slanted.map(({ points, radii: slantedSizes }, k) => {
      const kept = new Map(stepCorners[k])
      const orthogonal = nudged[k] as ReadonlyArray<XY>
      const moved = (index: number) => {
        const [x, y] = points[index] as XY
        const [x0, y0] = orthogonal[index] as XY
        return x !== x0 || y !== y0
      }
      for (let index = 1; index + 1 < points.length; index++) {
        if (moved(index) || moved(index - 1) || moved(index + 1)) {
          kept.set(index, slantedSizes[index] as number)
        }
      }
      return kept
    }),
    shaped,
    ...tight,
  })
  const insets = cornerInsets(nudged, settled, shaped)
  const result: Array<ConnectorRoute | undefined> = edges.map(() => undefined)
  for (const [k, i] of found.entries()) {
    const { points: route, remap } = slanted[k] as (typeof slanted)[number]
    const radii = settled[k] as Array<number>
    const flow = (flows[k] as { placed: ReadonlyArray<PlacedAdornment | undefined> }).placed
    const placed = placeAdornments(
      route,
      lengths(route),
      radii,
      adornments[k] ?? [],
      flow.map((adornment) =>
        adornment === undefined
          ? undefined
          : {
              center: adornment.center,
              direction: adornment.direction,
              along: [remap(adornment.along[0]), remap(adornment.along[1])],
            },
      ),
    )
    result[i] = {
      points: route.map(([x, y]) => Point.make(x, y)),
      radii,
      insets: insets[k] as Array<number>,
      adornments: placed.map((adornment, a) =>
        placementOf(adornment, (edges[i] as Edge<K>).adornments[a] as Adornment),
      ),
      merged: [leaders.get(`${i}:0`) ?? -1, leaders.get(`${i}:1`) ?? -1],
    }
  }
  return { edges: result }
}

// A placed adornment as the public shape: its upright rect about its
// center, the angle its local x axis turns to, and its stretch of the route.
function placementOf(placed: PlacedAdornment, adornment: Adornment): AdornmentPlacement {
  const { frame } = adornment
  const width = frameSize(frame.width, frame.minWidth, frame.maxWidth)
  const height = frameSize(frame.height, frame.minHeight, frame.maxHeight)
  const [x, y] = placed.center
  const [start, end] = placed.along
  return {
    rect: Rect.make(x - width / 2, y - height / 2, width, height),
    angle:
      placed.direction === undefined ? 0 : Math.atan2(placed.direction[1], placed.direction[0]),
    along: Interval.make(start, end - start),
  }
}

const before = (a: number, b: number) => a < b && !coincident(a, b)

// The rects grown by the clearance on each side, except toward a nearby
// rect, where each side grows by at most half the distance between them,
// so the grown rects never close a passage the rects leave open. Rects that
// touch or overlap leave no passage, so they grow into each other, and no
// route slips through the seam between them.
function grow(boxes: ReadonlyArray<Rect.Rect>, clearance: number): Array<Obstacle> {
  const reach = 2 * clearance
  const near = (a0: number, a1: number, b0: number, b1: number) =>
    b0 < a1 + reach && !coincident(b0, a1 + reach) && b1 > a0 - reach && !coincident(b1, a0 - reach)
  return boxes.map((a, i) => {
    let left = clearance
    let top = clearance
    let right = clearance
    let bottom = clearance
    for (const [j, b] of boxes.entries()) {
      if (i === j) {
        continue
      }
      const acrossY = near(a.top, a.bottom, b.top, b.bottom)
      const acrossX = near(a.left, a.right, b.left, b.right)
      if (acrossY && before(a.right, b.left)) {
        right = Math.min(right, (b.left - a.right) / 2)
      }
      if (acrossY && before(b.right, a.left)) {
        left = Math.min(left, (a.left - b.right) / 2)
      }
      if (acrossX && before(a.bottom, b.top)) {
        bottom = Math.min(bottom, (b.top - a.bottom) / 2)
      }
      if (acrossX && before(b.bottom, a.top)) {
        top = Math.min(top, (a.top - b.bottom) / 2)
      }
    }
    return {
      left: a.left - left,
      top: a.top - top,
      right: a.right + right,
      bottom: a.bottom + bottom,
    }
  })
}

// The given sides of an edge's ports, with a loop from a rect to itself
// leaving on the right and entering on the top unless told otherwise.
function selfLoopSides(edge: Edge<string>): [number | undefined, number | undefined] {
  const source = sideOf(edge.sourceSide)
  const target = sideOf(edge.targetSide)
  if (edge.source !== edge.target) {
    return [source, target]
  }
  if (source === undefined && target === undefined) {
    return [1, 0]
  }
  return [source ?? ((target as number) + 1) % 4, target ?? ((source as number) + 3) % 4]
}

const sideOf = (side: number) =>
  Number.isFinite(side) && side >= 0 && side <= 3 ? Math.trunc(side) : undefined

// The sides of two rects that face each other, along the axis on which
// their centers are farther apart, for an edge without a route.
function facingSides(a: Rect.Rect, b: Rect.Rect): [number, number] {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2)
  const dy = b.y + b.height / 2 - (a.y + a.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [1, 3] : [3, 1]
  }
  return dy >= 0 ? [2, 0] : [0, 2]
}

// A port on a side of a rect, `at` of the way from its top or left end.
function portOf(rect: Rect.Rect, side: number, at: number): Port {
  switch (side) {
    case 0:
      return { side, x: rect.left + rect.width * at, y: rect.top }
    case 1:
      return { side, x: rect.right, y: rect.top + rect.height * at }
    case 2:
      return { side, x: rect.left + rect.width * at, y: rect.bottom }
    default:
      return { side, x: rect.left, y: rect.top + rect.height * at }
  }
}

const pinOf = (port: Port, owner: number): Pin => ({
  x: port.x,
  y: port.y,
  directions: 1 << port.side,
  owner: port.owner ?? owner,
})

// An end of an edge on a side that other ends may share, with where the
// rect at the edge's other end sits along the side.
// One end of an edge: `0` its source, `1` its target.
interface EdgeEnd {
  readonly edge: number
  readonly end: number
}

interface SharedEnd {
  readonly edge: number
  readonly end: number
  readonly rect: number
  readonly side: number
  readonly key: number
}

// Ends that merge, in the order of their lanes along the side, and their
// shared spot on it.
interface Merge {
  readonly ends: ReadonlyArray<SharedEnd>
  readonly at: number
}

// The ends with an auto position, by the rect and side they share.
function sharedSides(
  edges: ReadonlyArray<Edge<string>>,
  sides: ReadonlyArray<[number, number]>,
  boxes: ReadonlyArray<Rect.Rect>,
  index: ReadonlyMap<string, number>,
): Map<string, Array<SharedEnd>> {
  const shared = new Map<string, Array<SharedEnd>>()
  for (const [i, edge] of edges.entries()) {
    const ends = [
      [edge.source, edge.target, edge.sourceAt],
      [edge.target, edge.source, edge.targetAt],
    ] as const
    for (const [end, [id, other, at]] of ends.entries()) {
      if (Number.isFinite(at)) {
        continue
      }
      const side = (sides[i] as [number, number])[end] as number
      const far = boxes[index.get(other) as number] as Rect.Rect
      const key = side % 2 === 0 ? far.x + far.width / 2 : far.y + far.height / 2
      const rect = index.get(id) as number
      const group = `${rect}:${side}`
      const list = shared.get(group) ?? []
      list.push({ edge: i, end, rect, side, key })
      shared.set(group, list)
    }
  }
  return shared
}

// Ends that share a side, in the order the trial routes, which all leave
// one spot on it, take where they part: a route that parts toward one end
// of the side goes nearer that end. Ends whose routes never part, or have
// no trial route, go in the order of the rects at their other ends along
// the side, then of the edges.
function orderEnds(
  group: ReadonlyArray<SharedEnd>,
  trial: ReadonlyArray<ReadonlyArray<XY> | undefined>,
): Array<SharedEnd> {
  const list = [...group].toSorted((a, b) => a.key - b.key || a.edge - b.edge || a.end - b.end)
  // Each trial route, walked out from this end.
  const outward = list.map(({ edge, end }) => {
    const route = trial[edge]
    return route === undefined || end === 0 ? route : [...route].toReversed()
  })
  const side = (list[0] as SharedEnd).side
  const heading = OUTWARD[side] as Point.PointLike
  // The left of travel along the heading, with the Y axis down, is
  // (y, -x), and whether it points up or down the side's positions.
  const leftward = side % 2 === 0 ? Math.sign(heading.y) : Math.sign(-heading.x)
  const preferred: Array<DirectedEdge> = []
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const p = outward[a]
      const q = outward[b]
      const parts = p === undefined || q === undefined ? 0 : partingSide(p, q) * leftward
      if (parts !== 0) {
        preferred.push(parts > 0 ? { source: b, target: a } : { source: a, target: b })
      }
    }
  }
  const order = preferredOrder(list.length, preferred)
  const sorted: Array<SharedEnd> = []
  for (const [k, end] of list.entries()) {
    sorted[order[k] as number] = end
  }
  return sorted
}

// The auto positions of the ends that share a side, spread out evenly along
// it in their order (see `orderEnds`), keyed by edge and end, and the merges
// among them. Ends with the same merge key take one spot, at the mean of
// their places in the order, or, with `together`, only a run of them in a
// row whose routes come in together, each with the one before it.
function spread(
  shared: ReadonlyMap<string, ReadonlyArray<SharedEnd>>,
  trial: ReadonlyArray<ReadonlyArray<XY> | undefined>,
  mergeKey: (end: SharedEnd) => string | undefined,
  together: ((a: SharedEnd, b: SharedEnd) => boolean) | undefined,
): { positions: Map<string, number>; merges: Array<Merge> } {
  const positions = new Map<string, number>()
  const merges: Array<Merge> = []
  for (const group of shared.values()) {
    const ordered = orderEnds(group, trial)
    const slots: Array<Slot> = []
    const open = new Map<string, Slot>()
    let previous: Slot | undefined
    for (const [rank, end] of ordered.entries()) {
      const key = mergeKey(end)
      let slot = key === undefined ? undefined : open.get(key)
      if (
        slot !== undefined &&
        together !== undefined &&
        (slot !== previous || !together(slot.ends.at(-1) as SharedEnd, end))
      ) {
        slot = undefined
      }
      if (slot === undefined) {
        slot = { ends: [], ranks: [] }
        slots.push(slot)
        if (key !== undefined) {
          open.set(key, slot)
        }
      }
      slot.ends.push(end)
      slot.ranks.push(rank)
      previous = slot
    }
    // By the mean of their ranks, compared exactly as sums of integers.
    slots.sort(
      (a, b) =>
        rankSum(a) * b.ranks.length - rankSum(b) * a.ranks.length ||
        (a.ranks[0] as number) - (b.ranks[0] as number),
    )
    for (const [k, slot] of slots.entries()) {
      const at = (k + 1) / (slots.length + 1)
      for (const { edge, end } of slot.ends) {
        positions.set(`${edge}:${end}`, at)
      }
      if (slot.ends.length > 1) {
        merges.push({ ends: slot.ends, at })
      }
    }
  }
  return { positions, merges }
}

// Whether a merged lane steps onto the shared line, rather than running
// along it.
// How thick an edge draws, with unusable values as none.
function thicknessOf(edge: Edge<string>): number {
  return Number.isFinite(edge.thickness) && edge.thickness > 0 ? edge.thickness : 0
}

const stepped = (whisk: Whisk) => whisk.lateral[0] !== 0 || whisk.lateral[1] !== 0

// The ends that take one spot along a side, and their places in its order.
interface Slot {
  readonly ends: Array<SharedEnd>
  readonly ranks: Array<number>
}

const rankSum = (slot: Slot) => slot.ranks.reduce((total, rank) => total + rank, 0)

// The adornments at one end of an edge, as a key that ends with the same
// adornments share.
function endKey(edge: Edge<string>, end: number): string {
  return JSON.stringify(
    edge.adornments.filter((adornment) =>
      coincident(Number.isFinite(adornment.at) ? Math.min(Math.max(adornment.at, 0), 1) : 0.5, end),
    ),
  )
}

// The ports of every edge, with auto positions from `positions`, or the
// middle of the side.
function portsAt(
  edges: ReadonlyArray<Edge<string>>,
  sides: ReadonlyArray<[number, number]>,
  boxes: ReadonlyArray<Rect.Rect>,
  index: ReadonlyMap<string, number>,
  positions: ReadonlyMap<string, number>,
): Array<[Port, Port]> {
  return edges.map((edge, i) => {
    const [source, target] = sides[i] as [number, number]
    const at = (end: number, given: number) =>
      Number.isFinite(given) ? given : (positions.get(`${i}:${end}`) ?? 0.5)
    return [
      portOf(boxes[index.get(edge.source) as number] as Rect.Rect, source, at(0, edge.sourceAt)),
      portOf(boxes[index.get(edge.target) as number] as Rect.Rect, target, at(1, edge.targetAt)),
    ]
  })
}

// The graph nodes of an edge's waypoints, which come first among the extra
// pins, in edge order.
function viaNodes(
  option: ConnectorEdgeOptions | undefined,
  nodes: Int32Array,
  extraPins: ReadonlyArray<Pin>,
): Array<number> {
  const via = option?.via ?? []
  return via.map((point) => {
    const pin = extraPins.findIndex((p) => p.x === point.x && p.y === point.y)
    return nodes[pin] as number
  })
}
