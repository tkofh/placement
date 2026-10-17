import { coincident } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Adornment, AdornmentPlacement } from './adornment.ts'
import type { Edge } from './edge.ts'
import {
  type PlacedAdornment,
  frameSize,
  lengths,
  resolveAdornment,
} from './internal/adornments.ts'
import { placeAdornments, placeFlow } from './internal/connector/adornments.ts'
import { cornerRadii } from './internal/connector/corners.ts'
import { type RouteConstraints, type XY, nudge } from './internal/connector/nudge.ts'
import { slantJogs } from './internal/connector/slants.ts'
import type { Obstacle } from './internal/graph/graph.ts'
import { type Endpoint, shortestPath } from './internal/graph/search.ts'
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
   * they touch. Defaults to `0`.
   */
  readonly clearance?: number | undefined
  /**
   * The distance between routes that run alongside each other. Where a
   * passage is too narrow for every route at this distance, the routes in it
   * spread evenly across it instead, down to touching. Defaults to `0`,
   * which lets routes overlap.
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
   * adornments, and of the routes and rects (with their clearance) between
   * the two legs, and shrinks back toward the kink where it has less
   * room. `0` keeps every jog upright. Negative and non-finite values act
   * as `0`. Defaults to `1`.
   */
  readonly jogSlant?: number | undefined
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
  /** The distance between routes that run alongside each other. */
  readonly gap: number
  /** The cost of each corner, in units of length. */
  readonly bendCost: number
  /** The extra cost of a corner against the preferred turn. */
  readonly turnCost: number
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

  constructor(input: ConnectorInput) {
    super()

    this.clearance = length(input.clearance)
    this.gap = length(input.gap)
    this.bendCost = length(input.bendCost)
    this.turnCost = length(input.turnCost)
    this.alignAdornments = ratio(input.alignAdornments, 0.5)
    this.justifyAdornments = ratio(input.justifyAdornments, 0.5)
    this.justifyAdornmentsSpace = ratio(input.justifyAdornmentsSpace, 0)
    this.justifyAdornmentsSpaceOuter = ratio(input.justifyAdornmentsSpaceOuter, 0)
    this.adornmentGap = length(input.adornmentGap)
    this.jogAt = Math.min(Math.max(ratio(input.jogAt, 0.5), 0), 1)
    this.jogSlant = input.jogSlant === undefined ? 1 : length(input.jogSlant)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Connector [clearance ${this.clearance} gap ${this.gap} bend ${this.bendCost} turn ${this.turnCost} align ${this.alignAdornments} justify ${this.justifyAdornments} jog ${this.jogAt} slant ${this.jogSlant}]`
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
      alignAdornments: this.alignAdornments,
      justifyAdornments: this.justifyAdornments,
      justifyAdornmentsSpace: this.justifyAdornmentsSpace,
      justifyAdornmentsSpaceOuter: this.justifyAdornmentsSpaceOuter,
      adornmentGap: this.adornmentGap,
      jogAt: this.jogAt,
      jogSlant: this.jogSlant,
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
 *   center where the routes are evenly spaced, as on a metro map. No
 *   corner reaches into a flow adornment or its gaps. A renderer that
 *   rounds corners draws circular corners that reach these lengths, or any
 *   corner that reaches no farther, though a slanted jog drawn with
 *   smaller corners shows a straight between them.
 * - `adornments`: where each adornment landed, in the edge's adornment
 *   order (see `AdornmentPlacement` in `placement/adornment`).
 */
export interface ConnectorRoute {
  /** The polyline from the source port to the target port. */
  readonly points: ReadonlyArray<Point.Point>
  /** The size of the corner at each point, `0` at both ends. */
  readonly radii: ReadonlyArray<number>
  /** Where each adornment landed, in the edge's adornment order. */
  readonly adornments: ReadonlyArray<AdornmentPlacement>
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
 *    against the edge's preferred turn. Routes pass through their `via`
 *    points and stay out of their `avoid` rects.
 * 3. It nudges routes that run alongside each other apart, `gap` apart,
 *    ordered so that routes that share a path cross only where they must.
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
 * side spread out evenly, ordered by where their other ends are. An edge
 * from a rect to itself leaves on the right and enters on the top, by
 * default.
 *
 * Each route's corners report their `radii`, from the edge's `radius`, with
 * the inner corners of routes that turn together shrunk to nest.
 *
 * Edges carry adornments (see `placement/adornment`), which `apply` places
 * on the routes it finds but makes no room for, so adornments on routes
 * that run close alongside each other may overlap. A flow adornment sits on
 * a straight run, and each run lays out its flow adornments the way a flex
 * container with no thickness lays out its items, its main axis pointing
 * toward the target. Those at `0` and `1` pack against their ports. Each
 * of the others goes to the run nearest where its `at` falls that has room
 * for it and for the edge's `radius` at each corner of the run. Failing
 * that, it goes to the nearest run with room for it alone, and failing
 * that, to the roomiest. Runs equally near go to the one nearer the
 * source. A run's adornments keep the order of their `at`, `adornmentGap`
 * apart, and sit between its packs and the room for its corners, placed
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
 * around it allow.
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
  if (searched.length > 0) {
    const pins: Array<Pin> = [...extraPins]
    const candidates = searched.map((i) => {
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
    for (const [k, i] of searched.entries()) {
      const [starts, ends] = candidates[k] as [
        Array<{ side: number; pin: number; outward: number }>,
        Array<{ side: number; pin: number; outward: number }>,
      ]
      const endpoint = ({
        side,
        pin,
        outward,
      }: {
        side: number
        pin: number
        outward: number
      }): Endpoint => {
        const heading = OUTWARD[side] as Point.PointLike
        return {
          node: nodes[pin] as number,
          headings: [{ x: outward * heading.x, y: outward * heading.y }],
        }
      }
      const path = shortestPath(graph, starts.map(endpoint), ends.map(endpoint), {
        ...costs(edgeOptions[i]),
        via: viaNodes(edgeOptions[i], nodes, extraPins),
      })
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

  // The ports, with auto positions spread along shared sides.
  const ports = spreadPorts(edges, sides as Array<[number, number]>, boxes, index)

  // The routes, on a graph with the final ports.
  const pins: Array<Pin> = [...extraPins]
  for (const [i, edge] of edges.entries()) {
    const [source, target] = ports[i] as [Port, Port]
    pins.push(pinOf(source, index.get(edge.source) as number))
    pins.push(pinOf(target, index.get(edge.target) as number))
  }
  const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
  const routes: Array<Array<XY> | undefined> = edges.map((_, i) => {
    const [source, target] = ports[i] as [Port, Port]
    const out = OUTWARD[source.side] as Point.PointLike
    const into = OUTWARD[target.side] as Point.PointLike
    const path = shortestPath(
      graph,
      [{ node: nodes[extraPins.length + 2 * i] as number, headings: [out] }],
      [
        {
          node: nodes[extraPins.length + 2 * i + 1] as number,
          headings: [{ x: -into.x, y: -into.y }],
        },
      ],
      { ...costs(edgeOptions[i]), via: viaNodes(edgeOptions[i], nodes, extraPins) },
    )
    return path === undefined
      ? undefined
      : [...path.nodes].map((node): XY => [graph.xs[node] as number, graph.ys[node] as number])
  })

  // Nudge the routes that were found, together.
  const found = routes.flatMap((route, i) => (route === undefined ? [] : [i]))
  const nudged = nudge(
    found.map((i) => routes[i] as Array<XY>),
    obstacles,
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
      }
    }),
  )

  // Flow adornments wall off corners, and absolute ones land on the route
  // as drawn, with its corners sized.
  const adornments = found.map((i) =>
    (edges[i] as Edge<K>).adornments.map((adornment) =>
      resolveAdornment(adornment, true, false, connector.alignAdornments),
    ),
  )
  const cumulative = nudged.map((route) => lengths(route))
  const flows = nudged.map((route, k) =>
    placeFlow(route, cumulative[k] as Array<number>, adornments[k] ?? [], {
      radius: length((edges[found[k] as number] as Edge<K>).radius),
      gap: connector.adornmentGap,
      justify: connector.justifyAdornments,
      space: connector.justifyAdornmentsSpace,
      spaceOuter: connector.justifyAdornmentsSpaceOuter,
    }),
  )
  const sizes = cornerRadii(
    nudged,
    found.map((i) => (edges[i] as Edge<K>).radius),
    flows.map((flow) => flow.walls),
  )
  // Short jogs slant, and the flow adornments past them move up the
  // shorter route.
  const slanted = slantJogs(
    nudged,
    sizes,
    found.map((i) => length((edges[i] as Edge<K>).radius)),
    connector.jogSlant,
    flows.map((flow) => flow.walls),
    obstacles,
  )
  const result: Array<ConnectorRoute | undefined> = edges.map(() => undefined)
  for (const [k, i] of found.entries()) {
    const { points: route, radii, remap } = slanted[k] as (typeof slanted)[number]
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
      radii: [...radii],
      adornments: placed.map((adornment, a) =>
        placementOf(adornment, (edges[i] as Edge<K>).adornments[a] as Adornment),
      ),
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
  owner,
})

// The ports of every edge. Ports with an auto position that share a side
// spread out evenly along it, ordered by where the rects at their other
// ends sit along the side, then by edge order.
function spreadPorts(
  edges: ReadonlyArray<Edge<string>>,
  sides: ReadonlyArray<[number, number]>,
  boxes: ReadonlyArray<Rect.Rect>,
  index: ReadonlyMap<string, number>,
): Array<[Port, Port]> {
  const shared = new Map<string, Array<{ edge: number; end: number; key: number }>>()
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
      const group = `${index.get(id)}:${side}`
      const list = shared.get(group) ?? []
      list.push({ edge: i, end, key })
      shared.set(group, list)
    }
  }
  const positions = new Map<string, number>()
  for (const list of shared.values()) {
    list.sort((a, b) => a.key - b.key || a.edge - b.edge || a.end - b.end)
    for (const [k, { edge, end }] of list.entries()) {
      positions.set(`${edge}:${end}`, (k + 1) / (list.length + 1))
    }
  }
  return edges.map((edge, i) => {
    const [source, target] = sides[i] as [number, number]
    const at = (end: number, given: number) =>
      Number.isFinite(given) ? given : (positions.get(`${i}:${end}`) as number)
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
