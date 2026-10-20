import { Pipeable } from 'curvy/utils'
import type { AdornmentPlacement } from './adornment.ts'
import * as Connector from './connector.ts'
import type * as Edge from './edge.ts'
import type { Frame } from './frame.ts'
import { solveHierarchy } from './internal/hierarchy/solve.ts'
import type * as Point from './point.ts'
import type { Polygon } from './polygon.ts'
import type * as Rect from './rect.ts'

const TypeBrand: unique symbol = Symbol('placement/hierarchy')
type TypeBrand = typeof TypeBrand

/**
 * The flow directions, encoded as numbers: `down` is `0`, `up` is `1`,
 * `right` is `2`, `left` is `3`.
 *
 * The encoding carries meaning. Directions `<= 1` flow vertically, so ranks
 * are rows. The odd directions flow backward along their axis (upward or
 * leftward).
 */
export const direction = {
  down: 0,
  up: 1,
  right: 2,
  left: 3,
} as const

/** A flow direction, one of the `direction` encodings. */
export type HierarchyDirection = (typeof direction)[keyof typeof direction]

/**
 * The ways to attach back edges, encoded as numbers: `direct` is `0`, `loop`
 * is `1`. A back edge points against the flow. The solver reverses one edge
 * of each cycle to lay the graph out in ranks, and those edges are the back
 * edges.
 *
 * - `direct` attaches a back edge the way its reversed form would: it
 *   leaves the upstream face of its source and enters the downstream face
 *   of its target, so it runs straight back against the flow.
 * - `loop` attaches it the way every other edge attaches: it leaves the
 *   downstream face of its source, loops around beside both nodes, and
 *   enters the upstream face of its target. Flowcharts often draw loops
 *   this way.
 *
 * It applies to auto port sides only. An edge with an explicit side keeps
 * it.
 */
export const backEdges = {
  direct: 0,
  loop: 1,
} as const

/** A back edge style, one of the `backEdges` encodings. */
export type HierarchyBackEdges = (typeof backEdges)[keyof typeof backEdges]

/**
 * The configuration that `make` accepts. Every property is optional. An
 * empty input flows downward with no gaps, nodes centered in their ranks,
 * and adornments centered on their edges.
 */
export interface HierarchyInput {
  /** The flow direction, one of the `direction` encodings. Defaults to `direction.down`. */
  readonly direction?: HierarchyDirection
  /** How back edges attach, one of the `backEdges` encodings. Defaults to `backEdges.direct`. */
  readonly backEdges?: HierarchyBackEdges
  /**
   * The space between adjacent ranks of nodes, along the flow. Flow
   * adornments on an edge add their own size on top, and so do the routes
   * that jog between the ranks where they need more. Defaults to `0`.
   */
  readonly rankGap?: number
  /**
   * The space between adjacent nodes in a rank, across the flow. Routes
   * that run between two nodes add what they need. Defaults to `0`.
   */
  readonly nodeGap?: number
  /**
   * The space between the strokes of adjacent edges, between an edge and a
   * node (half of it, plus half of `nodeGap`), and between the edges that
   * leave a node sideways. Defaults to `0`.
   */
  readonly edgeGap?: number
  /**
   * Placement of each node within the thickness of its rank, as a fraction
   * along the physical axis: `0` at the top (or left, in a horizontal
   * flow), `0.5` centered, `1` at the bottom (or right). A frame with a
   * finite `align` overrides it. Defaults to `0.5`.
   */
  readonly alignItems?: number
  /**
   * How much of its rank's thickness each node absorbs into its size: `0`
   * keeps the node's own size, `1` fills the rank. A frame with a finite
   * `stretch` overrides it. Defaults to `0`.
   */
  readonly stretchItems?: number
  /**
   * Which side of its edge each adornment sits on: `0` on the left of a
   * line running up or down (above a line running left or right), `0.5`
   * centered on the line, `1` on the right (below). An adornment frame with
   * a finite `align` overrides it. Defaults to `0.5`.
   */
  readonly alignAdornments?: number
}

/**
 * An immutable layered layout specification: the flow direction, gaps, and
 * alignment ratios that `apply` consumes together with the `Frame` node specs
 * and `Edge` specs.
 *
 * This is the hierarchical (Sugiyama-style) layout of flowcharts and
 * dependency diagrams. Edges flow in one direction, nodes sit in ranks
 * across the flow, and the solver keeps edges short and straight with few
 * crossings.
 *
 * The class is exported type-only. Construct it with `make`.
 */
class Hierarchy extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The flow direction, one of the `direction` encodings. */
  readonly direction: HierarchyDirection
  /** How back edges attach, one of the `backEdges` encodings. */
  readonly backEdges: HierarchyBackEdges
  /** The space between adjacent ranks of nodes. */
  readonly rankGap: number
  /** The space between adjacent nodes in a rank. */
  readonly nodeGap: number
  /** The space between adjacent edges, ports, and self loops. */
  readonly edgeGap: number
  /** Placement of each node within its rank: `0` top or left, `1` bottom or right. */
  readonly alignItems: number
  /** How much of its rank's thickness each node absorbs: `0` none, `1` fills it. */
  readonly stretchItems: number
  /** Which side of its edge each adornment sits on: `0` left or above, `1` right or below. */
  readonly alignAdornments: number

  constructor(input: HierarchyInput) {
    super()

    this.direction = input.direction ?? direction.down
    this.backEdges = input.backEdges ?? backEdges.direct
    this.rankGap = input.rankGap ?? 0
    this.nodeGap = input.nodeGap ?? 0
    this.edgeGap = input.edgeGap ?? 0
    this.alignItems = input.alignItems ?? 0.5
    this.stretchItems = input.stretchItems ?? 0
    this.alignAdornments = input.alignAdornments ?? 0.5
  }

  /** Whether the flow is vertical: `true` for `down` and `up` (the encodings `<= 1`). */
  get isVertical(): boolean {
    return this.direction <= 1
  }

  /** Whether the flow runs backward: `true` for `up` and `left` (the odd encodings). */
  get isReverse(): boolean {
    return this.direction % 2 === 1
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Hierarchy [${directionNames[this.direction]}]`
  }

  /** Returns the resolved configuration as a plain JSON-serializable object. */
  toJSON() {
    return {
      direction: this.direction,
      backEdges: this.backEdges,
      rankGap: this.rankGap,
      nodeGap: this.nodeGap,
      edgeGap: this.edgeGap,
      alignItems: this.alignItems,
      stretchItems: this.stretchItems,
      alignAdornments: this.alignAdornments,
    }
  }
}

const directionNames = ['down', 'up', 'right', 'left'] as const

export type { Hierarchy }

/**
 * Creates a `Hierarchy` layout specification.
 *
 * @param input - The configuration. See `HierarchyInput` for the per-property defaults.
 * @returns An immutable `Hierarchy`.
 * @example
 * ```ts
 * const spec = Hierarchy.make({ direction: Hierarchy.direction.right, rankGap: 40 })
 * spec.isVertical // false
 * ```
 */
export const make = (input: HierarchyInput): Hierarchy => new Hierarchy(input)

/**
 * Checks if a value is a `Hierarchy`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Hierarchy`, `false` otherwise.
 */
export const isHierarchy = (value: unknown): value is Hierarchy => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

/**
 * The solved geometry of one edge, as `Connector.apply` routes it (see
 * `ConnectorRoute` in `placement/connector`).
 *
 * - `points`: the polyline from the source port to the target port, with
 *   at least two points. Every segment runs along an axis, and every inner
 *   point is a right-angled corner. An edge the connector found no route
 *   for, which a note of the layout reports, has no points.
 * - `radii`: how far the corner at each point reaches along its two legs,
 *   one per point, `0` at both ends. Each is at least the edge's `radius`,
 *   unless a leg is too short for it: the corners on a segment never reach
 *   past each other or into a flow adornment. The corners of routes that
 *   turn together grow outward from the innermost, so that they nest about
 *   one center. A renderer that rounds corners draws circular corners of
 *   these radii, or any corner that reaches no farther.
 * - `outsets`: how much larger than the innermost corner of its nest each
 *   corner is, for the corners of routes that turn together, one per
 *   point: how far outside that corner it sits, where the nest keeps one
 *   center, and less where a leg holds it short of that.
 * - `adornments`: where each adornment landed, in the edge's adornment
 *   order.
 */
export interface HierarchyRoute {
  /** The polyline from the source port to the target port. */
  readonly points: ReadonlyArray<Point.Point>
  /** The size of the corner at each point, `0` at both ends. */
  readonly radii: ReadonlyArray<number>
  /** How much larger than its nest's innermost corner each corner is. */
  readonly outsets: ReadonlyArray<number>
  /** Where each adornment landed, in the edge's adornment order. */
  readonly adornments: ReadonlyArray<AdornmentPlacement>
}

/**
 * The result of `apply`.
 *
 * - `nodes`: one rect per node, keyed by the node's id. The record has no
 *   prototype, so any id is safe as a key, and its keys come in the order
 *   of the input record's.
 * - `edges`: one route per edge, in input order.
 * - `bounds`: the rect enclosing every node, adornment (as turned), and
 *   route point. Its origin is always `(0, 0)`.
 * - `notes`: what the routes gave up after the layout grew for them as far
 *   as it does, as `Connector.apply` reports it (see `ConnectorNote` in
 *   `placement/connector`): a channel still too narrow for its routes, an
 *   adornment longer than every run, or an edge with no route.
 */
export interface HierarchyLayout<K extends string> {
  /** One rect per node, keyed by the node's id. */
  readonly nodes: Readonly<Record<K, Rect.Rect>>
  /** One route per edge, in input order. */
  readonly edges: ReadonlyArray<HierarchyRoute>
  /** The rect enclosing the whole drawing, with its origin at `(0, 0)`. */
  readonly bounds: Rect.Rect
  /** What the routes gave up. */
  readonly notes: ReadonlyArray<Connector.ConnectorNote<K>>
}

/**
 * The per-node options of `apply`, keyed by node id.
 *
 * @example
 * ```ts
 * const nodes = {
 *   a: Frame.make({ width: 100, height: 40 }),
 *   b: Frame.make({ width: 100, height: 40 }),
 * }
 * const edges = [Edge.make({ source: 'a', target: 'b', targetSide: Edge.side.top, targetAt: 0.25 })]
 * const layout = Hierarchy.apply(nodes, edges, Hierarchy.make({ rankGap: 50 }), {
 *   shapes: { b: Polygon.make({ phase: 0.5 }) },
 * })
 * // A quarter of the way along the top, the diamond's slope is 10 below the rect.
 * layout.edges[0]?.points.at(-1) // Point (25, 100)
 * ```
 */
export interface HierarchyApplyOptions<K extends string> {
  /**
   * The shape of each node, as a `Polygon` (see `placement/polygon`) that
   * fills its rect. A node without one is its rect, with sharp corners. A
   * port sits where the line out of it meets the shape first, coming in
   * from its side of the rect, so edges meet a diamond
   * (`Polygon.make({ phase: 0.5 })`) on its slopes and at its tips rather
   * than on its bounding box, and meet a rounded rect on its curve near a
   * corner. Where the line misses the shape, the port stays on the rect.
   * The layout still sizes and spaces nodes by their rects.
   */
  readonly shapes?: Readonly<Partial<Record<K, Polygon>>> | undefined
}

/**
 * Lays out a directed graph in ranks and returns the rects of its nodes, the
 * routes of its edges, and the bounds of the drawing.
 *
 * The solver runs the classic layered pipeline:
 *
 * 1. It reverses a minimal-looking set of edges to break cycles, by a
 *    depth-first search in input order. Reversed edges still route from
 *    their source to their target.
 * 2. It assigns ranks by network simplex, which keeps the weighted sum of
 *    edge lengths small. Each edge spans at least `minLength` ranks.
 * 3. It orders each rank to reduce crossings, by barycenter sweeps.
 * 4. It positions nodes across the flow by Brandes-Köpf, which keeps long
 *    edges straight.
 * 5. It stacks each rank's nodes inside the rank's thickness with the
 *    frames' `align` and `stretch`. A stretched node with an
 *    `aspectRatio` and no size of its own across the flow takes that size
 *    from its stretched size along the flow, before step 4 spaces it.
 * 6. It routes the edges with `Connector.apply` (see `placement/connector`)
 *    around the placed nodes, through the slots between nodes that step 3
 *    ordered each long edge through, from and to the faces of the nodes
 *    that the flow and the edges' ports give. Where the routes needed more
 *    room than the gaps gave, between two ranks or between two nodes of a
 *    rank, the layout grows that room and places and routes again, up to
 *    two more times.
 *
 * Routes are orthogonal: every segment runs along or across the flow. An
 * edge that shifts across the flow does so on a jog between two ranks, and
 * jogs that share the space between two ranks sit `edgeGap` apart, in an
 * order that avoids crossings. That space grows to fit them, and to keep
 * room for corners of each edge's `radius` and for the flow adornments
 * at each end of an edge on a straight run. An edge that leaves a node
 * through a side across the flow, or around the node from the side facing
 * away, runs beside the node, and step 4 reserves room beside it.
 *
 * Nodes are `Frame`s in a record keyed by id, and edges reference them by
 * it. The keys of `nodes` form the allowed ids, so an edge that names an id
 * no node has is a type error. The result's `nodes` record has exactly
 * those keys. Ids known only at runtime widen to `string`, and the runtime
 * check still applies.
 *
 * Edges carry adornments (see `placement/adornment`). A flow adornment at
 * an end of an edge packs against the port there, and the others sit on
 * the straight run nearest their `at` with room for them: an adornment in
 * the middle of a long edge takes room in the rank between the nodes. An
 * absolute adornment sits at `at` of the way along the route as drawn, with
 * corners of the solved `radii`, and takes no room.
 *
 * Ports sit on each node's rect, or on its shape when `options.shapes`
 * gives it one. Auto ports that share a side spread along it in the order
 * their routes part.
 *
 * Node sizes resolve as usual. Margins across the flow add clearance.
 * Margins along the flow add clearance within the rank, and auto
 * (non-finite) margins along the flow position the node in the rank as
 * they do in flexbox. Auto margins across the flow act as `0`. The frames'
 * `grow` and `shrink` have no effect.
 *
 * Every input is deterministic: the same nodes and edges always produce
 * the same layout. Ties in placing the nodes fall back to the input order:
 * the order of the keys of `nodes`, then of `edges`. That key order is
 * JavaScript's property order, which lists integer-like keys (`'2'`,
 * `'10'`) first, in numeric order, and the other keys after them in
 * insertion order. Routing the edges around the placed nodes does not
 * depend on that order (see `Connector.apply`).
 *
 * The geometry comes from exact IEEE 754 arithmetic and is never rounded
 * (see PRECISION.md). The whole drawing translates so that `bounds` starts
 * at the origin. Place it elsewhere by translating the results, for example
 * into a rect that `Box.apply` solves for `bounds`'s size.
 *
 * @param nodes - The node specs, keyed by id. Their key order is the tie-breaking order.
 * @param edges - The edge specs, referencing nodes by id.
 * @param hierarchy - The layout specification.
 * @param options - The per-node options, keyed by node id.
 * @returns The node rects, edge routes, bounds, and notes.
 * @throws `RangeError` when an edge references an id that no node has.
 * @example
 * ```ts
 * const nodes = {
 *   a: Frame.make({ width: 100, height: 40 }),
 *   b: Frame.make({ width: 100, height: 40 }),
 * }
 * const edges = [Edge.make({ source: 'a', target: 'b' })]
 * const layout = Hierarchy.apply(nodes, edges, Hierarchy.make({ rankGap: 50 }))
 * layout.nodes.b // Rect [0, 90, 100, 40]
 * layout.edges[0]?.points // [Point (50, 40), Point (50, 90)]
 * layout.edges[0]?.radii // [0, 0]
 * ```
 */
export function apply<const K extends string>(
  nodes: Readonly<Record<K, Frame>>,
  edges: ReadonlyArray<Edge.Edge<NoInfer<K>>>,
  hierarchy: Hierarchy,
  options: HierarchyApplyOptions<NoInfer<K>> = {},
): HierarchyLayout<K> {
  return solveHierarchy(nodes, edges, hierarchy, options, Connector.apply)
}
