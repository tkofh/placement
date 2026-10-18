import { coincident } from 'curvy/number'
import { Pipeable } from 'curvy/utils'
import type { Adornment, AdornmentPlacement } from './adornment.ts'
import * as Connector from './connector.ts'
import * as Edge from './edge.ts'
import type { Frame } from './frame.ts'
import { type SolveAdornment, resolveAdornment } from './internal/adornments.ts'
import {
  type Growth,
  type LogicalBox,
  type LogicalPoint,
  ORDER_END,
  ORDER_START,
  type PlacedPort,
  type Placement,
  RANK_END,
  RANK_START,
  type SolveEdge,
  type SolveNode,
  type SolvePort,
  noGrowth,
  place,
} from './internal/hierarchy/layout.ts'
import * as Interval from './interval.ts'
import * as Point from './point.ts'
import type { Polygon } from './polygon.ts'
import * as Rect from './rect.ts'
import { auto } from './utils/arguments.ts'

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
 * - `nodes`: one rect per frame, keyed by frame `id`. The record has no
 *   prototype, so any id is safe as a key. Its key order is the JavaScript
 *   property order, which lists integer-like ids first. Iterate the input
 *   frames for input order.
 * - `edges`: one route per edge, in input order.
 * - `bounds`: the rect enclosing every node, adornment (as turned), and
 *   route point. Its origin is always `(0, 0)`.
 * - `notes`: what the routes gave up after the layout grew for them as far
 *   as it does, as `Connector.apply` reports it (see `ConnectorNote` in
 *   `placement/connector`): a channel still too narrow for its routes, an
 *   adornment longer than every run, or an edge with no route.
 */
export interface HierarchyLayout<K extends string> {
  /** One rect per frame, keyed by frame `id`. */
  readonly nodes: Readonly<Record<K, Rect.Rect>>
  /** One route per edge, in input order. */
  readonly edges: ReadonlyArray<HierarchyRoute>
  /** The rect enclosing the whole drawing, with its origin at `(0, 0)`. */
  readonly bounds: Rect.Rect
  /** What the routes gave up. */
  readonly notes: ReadonlyArray<Connector.ConnectorNote<K>>
}

/**
 * The per-node options of `apply`, keyed by frame `id`.
 *
 * @example
 * ```ts
 * const frames = [
 *   Frame.make({ id: 'a', width: 100, height: 40 }),
 *   Frame.make({ id: 'b', width: 100, height: 40 }),
 * ]
 * const edges = [Edge.make({ source: 'a', target: 'b', targetSide: Edge.side.top, targetAt: 0.25 })]
 * const layout = Hierarchy.apply(frames, edges, Hierarchy.make({ rankGap: 50 }), {
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

// How many times the layout places the nodes and routes the edges at most:
// once, and then once more each time the routes needed more room.
const ROUNDS = 3

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
 *    frames' `align` and `stretch`.
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
 * Nodes are `Frame`s with an `id`, and edges reference them by it. The
 * types check both. The literal ids of `frames` form the allowed ids, so a
 * frame without an id is a type error, and so is an edge that names an id
 * no frame has. The result's `nodes` record has exactly those keys. Ids
 * known only at runtime widen to `string`, and the runtime checks still
 * apply.
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
 * Frame sizes resolve as usual. Offsets across the flow add clearance.
 * Offsets along the flow add clearance within the rank, and auto
 * (non-finite) offsets along the flow position the node in the rank as auto
 * margins do in flexbox. Auto offsets across the flow act as `0`. The
 * frames' `grow` and `shrink` have no effect.
 *
 * Every input is deterministic: the same frames and edges always produce
 * the same layout. Ties fall back to the order of the input arrays.
 *
 * The geometry comes from exact IEEE 754 arithmetic and is never rounded
 * (see PRECISION.md). The whole drawing translates so that `bounds` starts
 * at the origin. Place it elsewhere by translating the results, for example
 * into a rect that `Box.apply` solves for `bounds`'s size.
 *
 * @param frames - The node specs, each with a unique `id`. Their order is the tie-breaking order.
 * @param edges - The edge specs, referencing frames by `id`.
 * @param hierarchy - The layout specification.
 * @param options - The per-node options, keyed by frame `id`.
 * @returns The node rects, edge routes, bounds, and notes.
 * @throws `RangeError` when a frame has no `id`, when two frames share an
 * `id`, or when an edge references an `id` that no frame has.
 * @example
 * ```ts
 * const frames = [
 *   Frame.make({ id: 'a', width: 100, height: 40 }),
 *   Frame.make({ id: 'b', width: 100, height: 40 }),
 * ]
 * const edges = [Edge.make({ source: 'a', target: 'b' })]
 * const layout = Hierarchy.apply(frames, edges, Hierarchy.make({ rankGap: 50 }))
 * layout.nodes.b // Rect [0, 90, 100, 40]
 * layout.edges[0]?.points // [Point (50, 40), Point (50, 90)]
 * layout.edges[0]?.radii // [0, 0]
 * ```
 */
export function apply<const T extends ReadonlyArray<Frame<string>>>(
  frames: T,
  edges: ReadonlyArray<Edge.Edge<NoInfer<T[number]['id']>>>,
  hierarchy: Hierarchy,
  options: HierarchyApplyOptions<NoInfer<T[number]['id']>> = {},
): HierarchyLayout<T[number]['id']> {
  type K = T[number]['id']
  const index = new Map<string, number>()
  for (const [i, frame] of frames.entries()) {
    const id: unknown = frame.id
    if (typeof id !== 'string') {
      throw new RangeError(`Frame ${i} has no id`)
    }
    if (index.has(id)) {
      throw new RangeError(`Frames share the id "${id}"`)
    }
    index.set(id, i)
  }

  const vertical = hierarchy.isVertical
  const reverse = hierarchy.isReverse

  const solveNodes: Array<SolveNode> = frames.map((frame) => {
    const [rLeading, rTrailing] = vertical
      ? [frame.offsetTop, frame.offsetBottom]
      : [frame.offsetLeft, frame.offsetRight]
    const placeAt = auto(frame.align, hierarchy.alignItems)
    return {
      oSize: vertical ? frame.width : frame.height,
      rSize: vertical ? frame.height : frame.width,
      rMin: vertical ? frame.minHeight : frame.minWidth,
      rMax: vertical ? frame.maxHeight : frame.maxWidth,
      oStart: finite(vertical ? frame.offsetLeft : frame.offsetTop),
      oEnd: finite(vertical ? frame.offsetRight : frame.offsetBottom),
      rStart: reverse ? rTrailing : rLeading,
      rEnd: reverse ? rLeading : rTrailing,
      place: reverse ? 1 - placeAt : placeAt,
      stretch: auto(frame.stretch, hierarchy.stretchItems),
    }
  })

  const solveEdges: Array<SolveEdge> = edges.map((edge, i) => {
    const source = index.get(edge.source)
    const target = index.get(edge.target)
    if (source === undefined || target === undefined) {
      throw new RangeError(`Edge ${i} references an id that no frame has`)
    }
    return {
      source,
      target,
      weight: Number.isFinite(edge.weight) ? Math.max(edge.weight, 0) : 0,
      minLength: Number.isFinite(edge.minLength) ? Math.max(Math.ceil(edge.minLength), 1) : 1,
      sourcePort: resolvePort(edge.sourceSide, edge.sourceAt, hierarchy.direction),
      targetPort: resolvePort(edge.targetSide, edge.targetAt, hierarchy.direction),
      radius: finite(Math.max(edge.radius, 0)),
      adornments: edge.adornments.map((adornment) => resolveEdgeAdornment(adornment, hierarchy)),
    }
  })

  const layoutNodes = Object.create(null) as Record<K, Rect.Rect>

  if (frames.length === 0) {
    return { nodes: layoutNodes, edges: [], bounds: Rect.make(), notes: [] }
  }

  const solveOptions = {
    rankGap: hierarchy.rankGap,
    nodeGap: hierarchy.nodeGap,
    edgeGap: hierarchy.edgeGap,
    backEdges: hierarchy.backEdges,
    mirror: mirrors[hierarchy.direction],
  }
  // The routes keep a clearance from the nodes that an edge and a node
  // keep apart by: half of each gap. Jogs sit in the middle of the room
  // between their legs, and stay upright, so every segment runs along an
  // axis.
  const spec = Connector.make({
    clearance: (hierarchy.nodeGap + hierarchy.edgeGap) / 2,
    gap: hierarchy.edgeGap,
    jogAt: 0.5,
    jogSlant: 0,
    merge: Connector.merge.none,
    alignAdornments: hierarchy.alignAdornments,
  })
  const sides = faceSides[hierarchy.direction]
  const ids = frames.map((frame) => frame.id as string)

  // Place, route, and grow what the routes needed, until they need nothing
  // more or the rounds run out.
  let growth: Growth = noGrowth
  let placement: Placement
  let routed: Connector.ConnectorLayout<string>
  for (let round = 0; ; round++) {
    placement = place(solveNodes, solveEdges, solveOptions, growth)
    const extent = placement.rankExtent
    const toRect = (box: LogicalBox): Rect.Rect => {
      const r = reverse ? extent - (box.r + box.rSize) : box.r
      return vertical
        ? Rect.make(box.o, r, box.oSize, box.rSize)
        : Rect.make(r, box.o, box.rSize, box.oSize)
    }
    const toPoint = ([o, r]: LogicalPoint): Point.PointLike => {
      const along = reverse ? extent - r : r
      return vertical ? { x: o, y: along } : { x: along, y: o }
    }
    const rects = Object.create(null) as Record<string, Rect.Rect>
    for (const [i, id] of ids.entries()) {
      rects[id] = toRect(placement.nodes[i] as LogicalBox)
    }
    // The ports as placed, on the physical sides of their faces. Each route
    // runs straight out of its port as far as the flow adornments packed
    // there reach, then through the slots its dummies sit in, across the
    // flow there, and in to its other port the same way.
    const physical = ({ face, at }: PlacedPort): [side: number, at: number] => [
      sides[face] as number,
      reverse && (face === ORDER_START || face === ORDER_END) ? 1 - at : at,
    ]
    // The way a route heads through the slots of its dummies: with the
    // flow, or against it on an edge reversed to break a cycle.
    const flow: Point.PointLike = vertical
      ? { x: 0, y: reverse ? -1 : 1 }
      : { x: reverse ? -1 : 1, y: 0 }
    const routes: Array<Edge.Edge<string>> = []
    const constraints: Array<Connector.ConnectorEdgeOptions> = []
    for (const [i, edge] of edges.entries()) {
      const [source, target] = placement.ports[i] as readonly [PlacedPort, PlacedPort]
      const [sourceSide, sourceAt] = physical(source)
      const [targetSide, targetAt] = physical(target)
      routes.push(
        edge.pipe(
          Edge.setSourcePort(sourceSide, sourceAt),
          Edge.setTargetPort(targetSide, targetAt),
        ),
      )
      const [sourceStub, targetStub] = placement.stubs[i] as readonly [number, number]
      const via: Array<Connector.ConnectorWaypoint> = []
      if (sourceStub > 0) {
        via.push(stubEnd(rects[edge.source] as Rect.Rect, sourceSide, sourceAt, sourceStub, 1))
      }
      const arriving = placement.reversed[i] ? { x: -flow.x, y: -flow.y } : flow
      for (const point of placement.vias[i] ?? []) {
        via.push({ ...toPoint(point), arriving })
      }
      if (targetStub > 0) {
        via.push(stubEnd(rects[edge.target] as Rect.Rect, targetSide, targetAt, targetStub, -1))
      }
      constraints.push({ via })
    }
    routed = Connector.apply(rects, routes, spec, {
      edges: constraints,
      shapes: options.shapes as Readonly<Partial<Record<string, Polygon>>> | undefined,
    })
    if (round + 1 === ROUNDS) {
      break
    }
    const grown = grow(routed.notes, placement, growth, index, solveEdges, frames.length, vertical)
    if (grown === undefined) {
      break
    }
    growth = grown
  }
  const extent = placement.rankExtent
  const nodeRects = placement.nodes.map((box) => {
    const r = reverse ? extent - (box.r + box.rSize) : box.r
    return vertical
      ? Rect.make(box.o, r, box.oSize, box.rSize)
      : Rect.make(r, box.o, box.rSize, box.oSize)
  })

  // The bounds hold every node, every adornment as turned, and every route
  // point.
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const include = (x0: number, y0: number, x1: number, y1: number): void => {
    minX = Math.min(minX, x0)
    minY = Math.min(minY, y0)
    maxX = Math.max(maxX, x1)
    maxY = Math.max(maxY, y1)
  }
  for (const rect of nodeRects) {
    include(rect.left, rect.top, rect.right, rect.bottom)
  }
  for (const route of routed.edges) {
    for (const { rect, angle } of route?.adornments ?? []) {
      const [halfX, halfY] = turnedHalves(rect, angle)
      include(
        rect.centerX - halfX,
        rect.centerY - halfY,
        rect.centerX + halfX,
        rect.centerY + halfY,
      )
    }
    for (const { x, y } of route?.points ?? []) {
      include(x, y, x, y)
    }
  }

  const rect = (r: Rect.Rect): Rect.Rect => Rect.make(r.x - minX, r.y - minY, r.width, r.height)
  const point = (p: Point.Point): Point.Point => Point.make(p.x - minX, p.y - minY)

  for (const [i, frame] of frames.entries()) {
    layoutNodes[frame.id as K] = rect(nodeRects[i] as Rect.Rect)
  }

  return {
    nodes: layoutNodes,
    edges: routed.edges.map((route, i): HierarchyRoute => {
      if (route === undefined) {
        return {
          points: [],
          radii: [],
          outsets: [],
          adornments: (edges[i] as Edge.Edge<string>).adornments.map(() => ({
            rect: Rect.make(),
            angle: 0,
            along: Interval.make(0, 0),
          })),
        }
      }
      return {
        points: route.points.map(point),
        radii: route.radii,
        outsets: route.outsets,
        adornments: route.adornments.map((placed) => ({
          rect: rect(placed.rect),
          angle: placed.angle,
          along: placed.along,
        })),
      }
    }),
    bounds: Rect.make(0, 0, maxX - minX, maxY - minY),
    notes: routed.notes as ReadonlyArray<Connector.ConnectorNote<K>>,
  }
}

// What a placement grows for the routes' notes, or `undefined` when the
// notes ask for nothing a placement can give. A channel too narrow for its
// routes along the flow grows by what the routes need: the channel between
// the ranks of the nodes on either side, or, with a node on one side only
// or none (the routes crowd between their own ports), the channel past the
// upper node of each crowded edge. Room too narrow across the flow,
// between nodes of one rank, grows between each two of those nodes.
function grow(
  notes: ReadonlyArray<Connector.ConnectorNote<string>>,
  placement: Placement,
  growth: Growth,
  index: ReadonlyMap<string, number>,
  edges: ReadonlyArray<SolveEdge>,
  nodeCount: number,
  vertical: boolean,
): Growth | undefined {
  const channels = new Map(growth.channels)
  const pairs = new Map(growth.pairs)
  const beside = new Map(growth.beside)
  const flowAxis = vertical ? 1 : 0
  let changed = false
  // Each place grows by the most any note needs there this round.
  const bump = (
    map: Map<number, number>,
    was: ReadonlyMap<number, number>,
    key: number,
    need: number,
  ): void => {
    if (need > 0 && Number.isFinite(need)) {
      map.set(key, Math.max(map.get(key) ?? 0, (was.get(key) ?? 0) + need))
      changed = true
    }
  }
  const rankOf = (node: number) => placement.ranks[node] as number
  for (const note of notes) {
    if (note.kind !== Connector.note.crowded) {
      continue
    }
    const rects = note.rects.flatMap((id) => {
      const node = index.get(id)
      return node === undefined ? [] : [node]
    })
    const ranks = [...new Set(rects.map(rankOf))].toSorted((a, b) => a - b)
    if (note.axis === flowAxis) {
      if (ranks.length === 2) {
        bump(channels, growth.channels, ranks[0] as number, note.need)
      } else {
        // The crowded edges jog past the node, in the channel on the side
        // their other end lies, or past their upper node.
        const rank = ranks[0]
        for (const edge of note.edges) {
          const { source, target } = edges[edge] as SolveEdge
          const low = Math.min(rankOf(source), rankOf(target))
          const high = Math.max(rankOf(source), rankOf(target))
          if (low === high) {
            continue
          }
          if (rank === undefined || low === rank) {
            bump(channels, growth.channels, low, note.need)
          } else if (high === rank) {
            bump(channels, growth.channels, rank - 1, note.need)
          }
        }
      }
    } else if (ranks.length === 1 && rects.length >= 2) {
      const sorted = [...new Set(rects)].toSorted((a, b) => a - b)
      for (let k = 1; k < sorted.length; k++) {
        const key = (sorted[k - 1] as number) * nodeCount + (sorted[k] as number)
        bump(pairs, growth.pairs, key, note.need)
      }
    } else {
      // Crowded beside nodes of different ranks, or beside one node against
      // something that is no node: the room on both sides of each grows.
      for (const node of new Set(rects)) {
        bump(beside, growth.beside, node, note.need)
      }
    }
  }
  return changed ? { channels, pairs, beside } : undefined
}

// The point `stub` straight out from a port `at` of the way along a side
// of a rect, which the route runs straight between the port and: it
// reaches the point heading out of the side at its source (`sign` 1), and
// leaves it heading into the side at its target (-1), so that it turns
// past the adornments packed at the port.
function stubEnd(
  rect: Rect.Rect,
  side: number,
  at: number,
  stub: number,
  sign: number,
): Connector.ConnectorWaypoint {
  const [x, y, outward]: [number, number, Point.PointLike] =
    side === Edge.side.top
      ? [rect.left + at * rect.width, rect.top - stub, { x: 0, y: -1 }]
      : side === Edge.side.right
        ? [rect.right + stub, rect.top + at * rect.height, { x: 1, y: 0 }]
        : side === Edge.side.bottom
          ? [rect.left + at * rect.width, rect.bottom + stub, { x: 0, y: 1 }]
          : [rect.left - stub, rect.top + at * rect.height, { x: -1, y: 0 }]
  return sign > 0
    ? { x, y, arriving: outward }
    : { x, y, leaving: { x: -outward.x, y: -outward.y } }
}

// The half extents of an adornment's upright rect turned by `angle` about
// its center. Routes run along the axes, so the angle is a quarter turn,
// and the near-zero cosine or sine it gives is zero.
function turnedHalves(rect: Rect.Rect, angle: number): [number, number] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const dx = coincident(c, 0) ? 0 : c
  const dy = coincident(s, 0) ? 0 : s
  return [
    (Math.abs(dx) * rect.width + Math.abs(dy) * rect.height) / 2,
    (Math.abs(dy) * rect.width + Math.abs(dx) * rect.height) / 2,
  ]
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

// Whether each direction maps logical space onto physical space by a
// reflection: `up` mirrors the rank axis, and `right` swaps the axes.
const mirrors: Record<HierarchyDirection, boolean> = {
  [direction.down]: false,
  [direction.up]: true,
  [direction.right]: true,
  [direction.left]: false,
}

// Resolves an adornment into logical terms (see `resolveAdornment`), for
// the room it takes in the placement.
function resolveEdgeAdornment(adornment: Adornment, hierarchy: Hierarchy): SolveAdornment {
  return resolveAdornment(
    adornment,
    hierarchy.isVertical,
    hierarchy.isReverse,
    hierarchy.alignAdornments,
  )
}

// The logical face of each physical side (top, right, bottom, left), per
// flow direction.
const portFaces: Record<HierarchyDirection, ReadonlyArray<number>> = {
  [direction.down]: [RANK_START, ORDER_END, RANK_END, ORDER_START],
  [direction.up]: [RANK_END, ORDER_END, RANK_START, ORDER_START],
  [direction.right]: [ORDER_START, RANK_END, ORDER_END, RANK_START],
  [direction.left]: [ORDER_START, RANK_START, ORDER_END, RANK_END],
}

// The physical side of each logical face (rank start, order end, rank end,
// order start), per flow direction: the inverse of `portFaces`.
const faceSides: Record<HierarchyDirection, ReadonlyArray<number>> = {
  [direction.down]: [Edge.side.top, Edge.side.right, Edge.side.bottom, Edge.side.left],
  [direction.up]: [Edge.side.bottom, Edge.side.right, Edge.side.top, Edge.side.left],
  [direction.right]: [Edge.side.left, Edge.side.bottom, Edge.side.right, Edge.side.top],
  [direction.left]: [Edge.side.right, Edge.side.bottom, Edge.side.left, Edge.side.top],
}

// Maps a physical port side to a logical face, and its position along the
// physical side to a position along the face in increasing logical
// coordinates. The order axis never mirrors. The rank axis mirrors in the
// reversed directions, which flips positions along the order faces.
function resolvePort(side: number, at: number, flow: HierarchyDirection): SolvePort {
  const face = Number.isInteger(side) ? (portFaces[flow][side] ?? -1) : -1
  const reverse = flow % 2 === 1

  if (face === -1 || !Number.isFinite(at)) {
    return { face, at: Number.POSITIVE_INFINITY }
  }

  const isOrderFace = face === ORDER_START || face === ORDER_END
  return { face, at: isOrderFace && reverse ? 1 - at : at }
}
