import { Pipeable } from 'curvy/utils'
import type { Adornment } from './adornment.ts'
import type { Edge } from './edge.ts'
import type { Frame } from './frame.ts'
import { type AxisFrame, type SolveAdornment } from './internal/hierarchy/adornments.ts'
import {
  type LogicalBox,
  type LogicalPoint,
  ORDER_END,
  ORDER_START,
  RANK_END,
  RANK_START,
  type SolveEdge,
  type SolveNode,
  type SolvePort,
  solve,
} from './internal/hierarchy/layout.ts'
import * as Interval from './interval.ts'
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
   * adornments on an edge add their own size on top. Defaults to `0`.
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
 * Where an adornment landed.
 *
 * - `rect`: the adornment's frame, upright. Turn it by `angle` about its
 *   center to draw it.
 * - `angle`: the direction its local x axis points, in radians (atan2
 *   convention, with the y axis down). `0` for an upright adornment.
 * - `along`: the stretch of the route it covers, as lengths along the
 *   route's polyline from its first point. An absolute adornment on a
 *   rounded corner maps the corner's arc evenly onto the two stretches of
 *   polyline the corner replaces.
 */
export interface HierarchyAdornment {
  /** The adornment's frame before it turns. */
  readonly rect: Rect.Rect
  /** How far it turns about the rect's center, in radians. */
  readonly angle: number
  /** The stretch of the route it covers, as lengths along the polyline. */
  readonly along: Interval.Interval
}

/**
 * The solved geometry of one edge.
 *
 * - `points`: the polyline from the source port to the target port, with
 *   at least two points. Every segment runs along an axis, and every inner
 *   point is a right-angled corner.
 * - `radii`: how far the corner at each point reaches along its two legs,
 *   one per point, `0` at both ends. Each is at most the edge's `radius`,
 *   and the corners on a segment never reach past each other or into a
 *   flow adornment. A renderer that rounds corners draws circular corners
 *   of these radii, or any corner that reaches no farther.
 * - `adornments`: where each adornment landed, in the edge's adornment
 *   order.
 */
export interface HierarchyRoute {
  /** The polyline from the source port to the target port. */
  readonly points: ReadonlyArray<Point.Point>
  /** The size of the corner at each point, `0` at both ends. */
  readonly radii: ReadonlyArray<number>
  /** Where each adornment landed, in the edge's adornment order. */
  readonly adornments: ReadonlyArray<HierarchyAdornment>
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
 *    edge lengths small. Each edge spans at least `minLength` ranks.
 * 3. It orders each rank to reduce crossings, by barycenter sweeps.
 * 4. It positions nodes across the flow by Brandes-Köpf, which keeps long
 *    edges straight.
 * 5. It stacks each rank's nodes inside the rank's thickness with the
 *    frames' `align` and `stretch`, and routes edges through their ports.
 *
 * Routes are orthogonal: every segment runs along or across the flow. An
 * edge that shifts across the flow does so on a jog between two ranks, and
 * jogs that share the space between two ranks get their own lanes, ordered
 * to avoid crossings. That space grows to fit its lanes, `edgeGap` apart,
 * to keep room for corners of each edge's `minRadius`, and to keep the
 * flow adornments at each end of an edge on a straight run. An
 * edge that leaves a node through a side across the flow, or around the
 * node from the side facing away, runs in a column of its own beside the
 * node, and step 4 reserves room for the columns. An edge that goes around
 * its node turns in a lane before or after the rank, which adds space
 * before the first rank or after the last one when needed.
 *
 * Nodes are `Frame`s with an `id`, and edges reference them by it. The
 * types check both. The literal ids of `frames` form the allowed ids, so a
 * frame without an id is a type error, and so is an edge that names an id
 * no frame has. The result's `nodes` record has exactly those keys. Ids
 * known only at runtime widen to `string`, and the runtime checks still
 * apply.
 *
 * Edges carry adornments (see `placement/adornment`). A flow adornment sits
 * on the straight run nearest its `at`: a stub, the run out of a port,
 * which packs it against the port, or the run through a rank between the
 * two nodes, which centers it there. Each run grows to fit its flow
 * adornments, layer by layer, and lanes and columns keep clear of them. An
 * absolute adornment sits at `at` of the way along the route as drawn, with
 * corners of the solved `radii`, and takes no room.
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
 * layout.edges[0]?.radii // [0, 0]
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
    const radius = finite(Math.max(edge.radius, 0))
    return {
      source,
      target,
      weight: Number.isFinite(edge.weight) ? Math.max(edge.weight, 0) : 0,
      minLength: Number.isFinite(edge.minLength) ? Math.max(Math.ceil(edge.minLength), 1) : 1,
      sourcePort: resolvePort(edge.sourceSide, edge.sourceAt, hierarchy.direction),
      targetPort: resolvePort(edge.targetSide, edge.targetAt, hierarchy.direction),
      radius,
      minRadius: Math.min(finite(Math.max(edge.minRadius, 0)), radius),
      adornments: edge.adornments.map((adornment) => resolveAdornment(adornment, hierarchy)),
    }
  })

  const layoutNodes = Object.create(null) as Record<T[number]['id'], Rect.Rect>

  if (frames.length === 0) {
    return { nodes: layoutNodes, edges: [], bounds: Rect.make() }
  }

  const result = solve(solveNodes, solveEdges, {
    rankGap: hierarchy.rankGap,
    nodeGap: hierarchy.nodeGap,
    edgeGap: hierarchy.edgeGap,
    backEdges: hierarchy.backEdges,
    mirror: mirrors[hierarchy.direction],
  })
  const extent = result.rankExtent

  const toRect = (box: LogicalBox): [number, number, number, number] => {
    const r = reverse ? extent - (box.r + box.rSize) : box.r
    return vertical ? [box.o, r, box.oSize, box.rSize] : [r, box.o, box.rSize, box.oSize]
  }
  const toPoint = ([o, r]: LogicalPoint): [number, number] => {
    const rank = reverse ? extent - r : r
    return vertical ? [o, rank] : [rank, o]
  }

  // A logical direction, as a physical one.
  const toDirection = ([o, r]: LogicalPoint): [number, number] => {
    const rank = reverse ? -r : r
    return vertical ? [o, rank] : [rank, o]
  }

  const nodeRects = result.nodes.map(toRect)
  const routePoints = result.routes.map((points) => points.map(toPoint))
  // Each adornment's upright rect, the physical direction it faces, and
  // the half extents of its turned box.
  const adornmentShapes = result.adornments.map((placed, i) =>
    placed.map((adornment, k) => {
      const { frame } = (edges[i] as Edge<string>).adornments[k] as Adornment
      const width = frameSize(frame.width, frame.minWidth, frame.maxWidth)
      const height = frameSize(frame.height, frame.minHeight, frame.maxHeight)
      const [x, y] = toPoint(adornment.center)
      const direction =
        adornment.direction === undefined ? undefined : toDirection(adornment.direction)
      const [dx, dy] = direction ?? [1, 0]
      return {
        rect: [x - width / 2, y - height / 2, width, height] as [number, number, number, number],
        angle: direction === undefined ? 0 : Math.atan2(dy, dx),
        halfX: (Math.abs(dx) * width + Math.abs(dy) * height) / 2,
        halfY: (Math.abs(dy) * width + Math.abs(dx) * height) / 2,
        center: [x, y] as const,
        along: adornment.along,
      }
    }),
  )

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
  for (const [x, y, w, h] of nodeRects) {
    include(x, y, x + w, y + h)
  }
  for (const { center, halfX, halfY } of adornmentShapes.flat()) {
    include(center[0] - halfX, center[1] - halfY, center[0] + halfX, center[1] + halfY)
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
      radii: result.radii[i] as ReadonlyArray<number>,
      adornments: (adornmentShapes[i] ?? []).map((shape) => ({
        rect: rect(shape.rect),
        angle: shape.angle,
        along: Interval.make(shape.along[0], shape.along[1] - shape.along[0]),
      })),
    })),
    bounds: Rect.make(0, 0, maxX - minX, maxY - minY),
  }
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

// A frame's size along one axis, clamped to its finite limits. Unset sizes
// are `0`.
function frameSize(size: number, min: number, max: number): number {
  let result = finite(Math.max(size, 0))
  if (Number.isFinite(max)) {
    result = Math.min(result, max)
  }
  if (Number.isFinite(min)) {
    result = Math.max(result, min)
  }
  return result
}

// Whether each direction maps logical space onto physical space by a
// reflection: `up` mirrors the rank axis, and `right` swaps the axes.
const mirrors: Record<HierarchyDirection, boolean> = {
  [direction.down]: false,
  [direction.up]: true,
  [direction.right]: true,
  [direction.left]: false,
}

// Resolves an adornment into logical terms. Upright frames map their
// physical axes to the logical ones, mirroring the rank axis in the
// reversed directions. Turned frames keep their own axes.
function resolveAdornment(adornment: Adornment, hierarchy: Hierarchy): SolveAdornment {
  const { frame } = adornment
  const vertical = hierarchy.isVertical
  const reverse = hierarchy.isReverse
  const width = frameSize(frame.width, frame.minWidth, frame.maxWidth)
  const height = frameSize(frame.height, frame.minHeight, frame.maxHeight)
  const top = finite(frame.offsetTop)
  const right = finite(frame.offsetRight)
  const bottom = finite(frame.offsetBottom)
  const left = finite(frame.offsetLeft)
  const align = auto(frame.align, hierarchy.alignAdornments)
  const [leading, trailing] = vertical ? [top, bottom] : [left, right]
  const o: AxisFrame = vertical
    ? { size: width, start: left, end: right, align }
    : { size: height, start: top, end: bottom, align }
  const r: AxisFrame = {
    size: vertical ? height : width,
    start: reverse ? trailing : leading,
    end: reverse ? leading : trailing,
    align: reverse ? 1 - align : align,
  }
  const at = Number.isFinite(adornment.at) ? Math.min(Math.max(adornment.at, 0), 1) : 0.5
  return {
    at,
    flow: adornment.position !== 1,
    layer: Number.isFinite(adornment.layer) ? Math.trunc(adornment.layer) : 0,
    orient: adornment.orient === 1 || adornment.orient === 2 ? adornment.orient : 0,
    o,
    r,
    x: { size: width, start: left, end: right, align: 0.5 },
    y: { size: height, start: top, end: bottom, align },
  }
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
