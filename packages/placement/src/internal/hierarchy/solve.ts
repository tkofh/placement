import { coincident } from 'curvy/number'
import type { Adornment } from '../../adornment.ts'
import * as Alignment from '../../alignment.ts'
import * as Connector from '../../connector.ts'
import * as Edge from '../../edge.ts'
import type { Frame } from '../../frame.ts'
import type {
  Hierarchy,
  HierarchyApplyOptions,
  HierarchyDirection,
  HierarchyLayout,
  HierarchyRoute,
} from '../../hierarchy.ts'
import * as Interval from '../../interval.ts'
import * as Point from '../../point.ts'
import type { Polygon } from '../../polygon.ts'
import * as Rect from '../../rect.ts'
import * as Sizing from '../../sizing.ts'
import { type SolveAdornment, resolveAdornment } from '../adornments.ts'
import { SizingOf } from '../sizing.ts'
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
} from './layout.ts'

// The body of `Hierarchy.apply`, with the router it routes the edges with
// passed in: `Connector.apply` there, which routes them in several orders
// and keeps the best, and one solve in the canonical order in tests that
// check a property of the layout rather than how good its routes are.

/** Routes edges between placed rects, as `Connector.apply` does. */
export type Router = (
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge.Edge<string>>,
  connector: Connector.Connector,
  options: Connector.ConnectorApplyOptions,
) => Connector.ConnectorLayout

// How many times the layout places the nodes and routes the edges at most:
// once, and then once more each time the routes needed more room.
const ROUNDS = 3

/**
 * Lays out a directed graph in ranks (see `Hierarchy.apply`), routing the
 * edges with `router`.
 *
 * @param nodes - The nodes, each a `Frame`, keyed by id.
 * @param edges - The edges, referencing nodes by id.
 * @param hierarchy - The layout spec.
 * @param options - The shapes of the nodes.
 * @param router - Routes the edges between the placed nodes.
 * @returns The layout.
 * @throws `RangeError` when an edge references an id that no node has.
 */
export function solveHierarchy<const K extends string>(
  nodes: Readonly<Record<K, Frame>>,
  edges: ReadonlyArray<Edge.Edge<NoInfer<K>>>,
  hierarchy: Hierarchy,
  options: HierarchyApplyOptions<NoInfer<K>>,
  router: Router,
): HierarchyLayout<K> {
  const ids = Object.keys(nodes) as Array<K>
  const frames = ids.map((id) => nodes[id])
  const index = new Map<string, number>(ids.map((id, i) => [id, i]))

  const vertical = hierarchy.isVertical
  const reverse = hierarchy.isReverse

  const solveNodes: Array<SolveNode> = frames.map((frame) => {
    const [rLeading, rTrailing] = vertical
      ? [frame.marginTop, frame.marginBottom]
      : [frame.marginLeft, frame.marginRight]
    // A frame's alignment is along the flow, within its rank's thickness.
    const { align: placeAt, stretch } = Alignment.resolve(frame, {
      align: hierarchy.alignItems,
      stretch: hierarchy.stretchItems,
    })
    // An unset order-axis size follows a stretched rank-axis size through
    // the ratio.
    const sizing = frame[SizingOf]
    const oDimension = vertical ? 'width' : 'height'
    const oFor =
      sizing.aspectRatio !== undefined && Number.isNaN(sizing[oDimension])
        ? (rSize: number): number =>
            Sizing.resolve(
              sizing,
              vertical
                ? { width: 0, height: rSize, definiteHeight: true }
                : { width: rSize, height: 0, definiteWidth: true },
            )[oDimension]
        : undefined
    return {
      oSize: vertical ? frame.width : frame.height,
      rSize: vertical ? frame.height : frame.width,
      rMin: vertical ? frame.minHeight : frame.minWidth,
      rMax: vertical ? frame.maxHeight : frame.maxWidth,
      oStart: finite(vertical ? frame.marginLeft : frame.marginTop),
      oEnd: finite(vertical ? frame.marginRight : frame.marginBottom),
      rStart: reverse ? rTrailing : rLeading,
      rEnd: reverse ? rLeading : rTrailing,
      place: reverse ? 1 - placeAt : placeAt,
      stretch,
      oFor,
    }
  })

  const solveEdges: Array<SolveEdge> = edges.map((edge, i) => {
    const source = index.get(edge.source)
    const target = index.get(edge.target)
    if (source === undefined || target === undefined) {
      throw new RangeError(`Edge ${i} references an id that no node has`)
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
    routed = router(rects, routes, spec, {
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

  for (const [i, id] of ids.entries()) {
    layoutNodes[id] = rect(nodeRects[i] as Rect.Rect)
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
// reflection: `up` mirrors the rank axis, and `right` swaps the axes. The
// tables here are keyed by the codes of `direction`: down `0`, up `1`,
// right `2`, left `3`.
const mirrors: Record<HierarchyDirection, boolean> = {
  0: false,
  1: true,
  2: true,
  3: false,
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
  0: [RANK_START, ORDER_END, RANK_END, ORDER_START],
  1: [RANK_END, ORDER_END, RANK_START, ORDER_START],
  2: [ORDER_START, RANK_END, ORDER_END, RANK_START],
  3: [ORDER_START, RANK_START, ORDER_END, RANK_END],
}

// The physical side of each logical face (rank start, order end, rank end,
// order start), per flow direction: the inverse of `portFaces`.
const faceSides: Record<HierarchyDirection, ReadonlyArray<number>> = {
  0: [Edge.side.top, Edge.side.right, Edge.side.bottom, Edge.side.left],
  1: [Edge.side.bottom, Edge.side.right, Edge.side.top, Edge.side.left],
  2: [Edge.side.left, Edge.side.bottom, Edge.side.right, Edge.side.top],
  3: [Edge.side.right, Edge.side.bottom, Edge.side.left, Edge.side.top],
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
