import { Pipeable } from 'curvy/utils'
import type { Edge } from './edge.ts'
import type { Frame } from './frame.ts'
import {
  type LogicalBox,
  type LogicalPoint,
  ORDER_END,
  ORDER_START,
  RANK_END,
  RANK_START,
  type SolveEdge,
  type SolveLabel,
  type SolveNode,
  type SolvePort,
  solve,
} from './internal/hierarchy/layout.ts'
import * as Point from './point.ts'
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
 * The edge routing styles, encoded as numbers: `polyline` is `0`,
 * `orthogonal` is `1`.
 *
 * - `polyline` runs each edge straight between its waypoints, so an edge
 *   that shifts across the flow does so on a diagonal.
 * - `orthogonal` draws every segment along or across the flow. An edge
 *   that shifts across the flow does so on a jog between two ranks, and
 *   jogs that share the space between two ranks get their own lanes,
 *   ordered to avoid crossings. That space grows to fit its lanes,
 *   `edgeGap` apart.
 */
export const routing = {
  polyline: 0,
  orthogonal: 1,
} as const

/** An edge routing style, one of the `routing` encodings. */
export type HierarchyRouting = (typeof routing)[keyof typeof routing]

/**
 * The configuration that `make` accepts. Every property is optional. An
 * empty input flows downward with no gaps, nodes centered in their ranks,
 * and labels centered on their edges.
 */
export interface HierarchyInput {
  /** The flow direction, one of the `direction` encodings. Defaults to `direction.down`. */
  readonly direction?: HierarchyDirection
  /** The edge routing style, one of the `routing` encodings. Defaults to `routing.orthogonal`. */
  readonly routing?: HierarchyRouting
  /**
   * The space between adjacent ranks of nodes, along the flow. An edge
   * label adds its own size on top. Defaults to `0`.
   */
  readonly rankGap?: number
  /** The space between adjacent nodes in a rank, across the flow. Defaults to `0`. */
  readonly nodeGap?: number
  /**
   * The space between adjacent edges, between an edge and a node (half of
   * it, plus half of `nodeGap`), between ports that share a side, and
   * between nested self loops. Defaults to `0`.
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
   * Which side of its edge each label sits on: `0` on the left (or above,
   * in a horizontal flow), `0.5` centered on the line, `1` on the right (or
   * below). A label frame with a finite `align` overrides it. Defaults to
   * `0.5`.
   */
  readonly alignLabels?: number
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
  /** The edge routing style, one of the `routing` encodings. */
  readonly routing: HierarchyRouting
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
  /** Which side of its edge each label sits on: `0` left or above, `1` right or below. */
  readonly alignLabels: number

  constructor(input: HierarchyInput) {
    super()

    this.direction = input.direction ?? direction.down
    this.routing = input.routing ?? routing.orthogonal
    this.rankGap = input.rankGap ?? 0
    this.nodeGap = input.nodeGap ?? 0
    this.edgeGap = input.edgeGap ?? 0
    this.alignItems = input.alignItems ?? 0.5
    this.stretchItems = input.stretchItems ?? 0
    this.alignLabels = input.alignLabels ?? 0.5
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
      routing: this.routing,
      rankGap: this.rankGap,
      nodeGap: this.nodeGap,
      edgeGap: this.edgeGap,
      alignItems: this.alignItems,
      stretchItems: this.stretchItems,
      alignLabels: this.alignLabels,
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
 * The solved geometry of one edge.
 *
 * - `points`: the polyline from the source port to the target port, with
 *   at least two points. The first and last segments give the direction to
 *   draw arrowheads along.
 * - `labels`: one rect per input label, in the edge's label order.
 */
export interface HierarchyRoute {
  /** The polyline from the source port to the target port. */
  readonly points: ReadonlyArray<Point.Point>
  /** One rect per label, in the edge's label order. */
  readonly labels: ReadonlyArray<Rect.Rect>
}

/**
 * The result of `apply`.
 *
 * - `nodes`: one rect per frame, keyed by frame `id`. The record has no
 *   prototype, so any id is safe as a key. Its key order is the JavaScript
 *   property order, which lists integer-like ids first. Iterate the input
 *   frames for input order.
 * - `edges`: one route per edge, in input order.
 * - `bounds`: the rect enclosing every node, label, and route point. Its
 *   origin is always `(0, 0)`.
 */
export interface HierarchyLayout<K extends string> {
  /** One rect per frame, keyed by frame `id`. */
  readonly nodes: Readonly<Record<K, Rect.Rect>>
  /** One route per edge, in input order. */
  readonly edges: ReadonlyArray<HierarchyRoute>
  /** The rect enclosing the whole drawing, with its origin at `(0, 0)`. */
  readonly bounds: Rect.Rect
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
 *    edge lengths small. Each edge spans at least `minLength` ranks, and
 *    one more rank slot for each label beyond the first.
 * 3. It orders each rank to reduce crossings, by barycenter sweeps.
 * 4. It positions nodes across the flow by Brandes-Köpf, which keeps long
 *    edges straight.
 * 5. It stacks each rank's nodes inside the rank's thickness with the
 *    frames' `align` and `stretch`, and routes edges through their ports.
 *    Orthogonal routing (the default `routing`) gives each jog between two
 *    ranks its own lane and widens the space between the ranks to fit.
 *
 * Nodes are `Frame`s with an `id`, and edges reference them by it. The
 * types check both. The literal ids of `frames` form the allowed ids, so a
 * frame without an id is a type error, and so is an edge that names an id
 * no frame has. The result's `nodes` record has exactly those keys. Ids
 * known only at runtime widen to `string`, and the runtime checks still
 * apply.
 *
 * Frame sizes resolve as usual. Offsets across the flow add clearance. Offsets along the flow add clearance within the rank, and
 * auto (non-finite) offsets along the flow position the node in the rank as
 * auto margins do in flexbox. Auto offsets across the flow act as `0`. The
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
 * @returns The node rects, edge routes, and bounds.
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
 * ```
 */
export function apply<const T extends ReadonlyArray<Frame<string>>>(
  frames: T,
  edges: ReadonlyArray<Edge<NoInfer<T[number]['id']>>>,
  hierarchy: Hierarchy,
): HierarchyLayout<T[number]['id']> {
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
    const place = auto(frame.align, hierarchy.alignItems)
    return {
      oSize: vertical ? frame.width : frame.height,
      rSize: vertical ? frame.height : frame.width,
      rMin: vertical ? frame.minHeight : frame.minWidth,
      rMax: vertical ? frame.maxHeight : frame.maxWidth,
      oStart: finite(vertical ? frame.offsetLeft : frame.offsetTop),
      oEnd: finite(vertical ? frame.offsetRight : frame.offsetBottom),
      rStart: reverse ? rTrailing : rLeading,
      rEnd: reverse ? rLeading : rTrailing,
      place: reverse ? 1 - place : place,
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
      labels: edge.labels.map((label): SolveLabel => {
        const frame = label.frame
        const [rLeading, rTrailing] = vertical
          ? [frame.offsetTop, frame.offsetBottom]
          : [frame.offsetLeft, frame.offsetRight]
        return {
          oSize: vertical ? frame.width : frame.height,
          rSize: vertical ? frame.height : frame.width,
          oStart: finite(vertical ? frame.offsetLeft : frame.offsetTop),
          oEnd: finite(vertical ? frame.offsetRight : frame.offsetBottom),
          rStart: reverse ? rTrailing : rLeading,
          rEnd: reverse ? rLeading : rTrailing,
          align: auto(frame.align, hierarchy.alignLabels),
          at: label.at !== undefined && Number.isFinite(label.at) ? label.at : 0.5,
        }
      }),
    }
  })

  const layoutNodes = Object.create(null) as Record<T[number]['id'], Rect.Rect>

  if (frames.length === 0) {
    return { nodes: layoutNodes, edges: [], bounds: Rect.make() }
  }

  const result = solve(solveNodes, solveEdges, hierarchy)
  const extent = result.rankExtent

  const toRect = (box: LogicalBox): [number, number, number, number] => {
    const r = reverse ? extent - (box.r + box.rSize) : box.r
    return vertical ? [box.o, r, box.oSize, box.rSize] : [r, box.o, box.rSize, box.oSize]
  }
  const toPoint = ([o, r]: LogicalPoint): [number, number] => {
    const rank = reverse ? extent - r : r
    return vertical ? [o, rank] : [rank, o]
  }

  const nodeRects = result.nodes.map(toRect)
  const labelRects = result.labels.map((boxes) => boxes.map(toRect))
  const routePoints = result.routes.map((points) => points.map(toPoint))

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
  for (const [x, y, w, h] of [...nodeRects, ...labelRects.flat()]) {
    include(x, y, x + w, y + h)
  }
  for (const [x, y] of routePoints.flat()) {
    include(x, y, x, y)
  }

  const rect = ([x, y, w, h]: [number, number, number, number]): Rect.Rect =>
    Rect.make(x - minX, y - minY, w, h)
  const point = ([x, y]: [number, number]): Point.Point => Point.make(x - minX, y - minY)

  for (const [i, frame] of frames.entries()) {
    layoutNodes[frame.id as T[number]['id']] = rect(
      nodeRects[i] as [number, number, number, number],
    )
  }

  return {
    nodes: layoutNodes,
    edges: routePoints.map((points, i) => ({
      points: points.map(point),
      labels: (labelRects[i] as Array<[number, number, number, number]>).map(rect),
    })),
    bounds: Rect.make(0, 0, maxX - minX, maxY - minY),
  }
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

// The logical face of each physical side (top, right, bottom, left), per
// flow direction.
const portFaces: Record<HierarchyDirection, ReadonlyArray<number>> = {
  [direction.down]: [RANK_START, ORDER_END, RANK_END, ORDER_START],
  [direction.up]: [RANK_END, ORDER_END, RANK_START, ORDER_START],
  [direction.right]: [ORDER_START, RANK_END, ORDER_END, RANK_START],
  [direction.left]: [ORDER_START, RANK_START, ORDER_END, RANK_END],
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
