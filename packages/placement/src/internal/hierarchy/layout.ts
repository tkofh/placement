import { clamp, coincident } from 'curvy/number'
import * as Track from '../../track.ts'
import { findReversed } from '../graph/acyclic.ts'
import { cornerArcs, onArc } from '../polygon.ts'
import {
  type Axis,
  type RunItem,
  type Sign,
  type SolveAdornment,
  distanceAlong,
  lengths,
  measure,
  packRun,
  placeAbsolute,
  pointOnDrawn,
  resolveRadii,
  runLength,
} from './adornments.ts'
import type { LayeredGraph, Segment } from './graph.ts'
import { FAR, type Jog, NEAR, assignLanes } from './lanes.ts'
import { order } from './order.ts'
import { type Extent, position, separate } from './position.ts'
import { type RankEdge, rank } from './rank.ts'

// The layered layout solver. It works in logical coordinates: `o` runs along
// the order axis (across the flow) and `r` along the rank axis (with the
// flow, starting at 0). The public module resolves frames and edges into
// these logical inputs and maps the results back to physical space.
//
// Logical faces of a node, clockwise in logical space: 0 is the rank-start
// face (upstream), 1 the order-end face, 2 the rank-end face (downstream),
// and 3 the order-start face. A face of -1 is auto.
//
// Ranking doubles every edge's minimum length. Real nodes then sit on even
// ranks only, and the odd ranks between them hold edge dummies and the flow
// adornments that sit on them.
// Rank bands are spaced by half the rank gap, so two node ranks with an empty
// odd rank between them end up exactly one rank gap apart.

export const RANK_START = 0
export const ORDER_END = 1
export const RANK_END = 2
export const ORDER_START = 3

export interface SolveNode {
  readonly oSize: number
  readonly rSize: number
  readonly rMin: number
  readonly rMax: number
  // Order-axis margins, finite.
  readonly oStart: number
  readonly oEnd: number
  // Rank-axis margins. A non-finite margin is auto.
  readonly rStart: number
  readonly rEnd: number
  // Resolved band placement and stretch.
  readonly place: number
  readonly stretch: number
  // The node's shape in its box, or undefined for the box itself. Ports
  // sit on it.
  readonly shape: ((box: LogicalBox) => SolveShape) | undefined
}

// A node's shape: closed outlines of corners in logical coordinates, and
// the radius of the circular arcs that round every corner, which they fit
// whole.
export interface SolveShape {
  readonly outlines: ReadonlyArray<ReadonlyArray<LogicalPoint>>
  readonly radius: number
}

export interface SolvePort {
  // A logical face, or -1 for auto.
  readonly face: number
  // The position along the face in increasing logical coordinates, as a
  // fraction. Non-finite is auto.
  readonly at: number
}

export interface SolveEdge {
  readonly source: number
  readonly target: number
  readonly weight: number
  readonly minLength: number
  readonly sourcePort: SolvePort
  readonly targetPort: SolvePort
  // The most and the least each corner reaches along its legs, finite and
  // with 0 <= minRadius <= radius.
  readonly radius: number
  readonly minRadius: number
  readonly adornments: ReadonlyArray<SolveAdornment>
}

// The back edge encodings of `placement/hierarchy`.
export const LOOP = 1

export interface SolveOptions {
  readonly rankGap: number
  readonly nodeGap: number
  readonly edgeGap: number
  readonly backEdges: number
  // Whether logical space maps to physical space by a reflection.
  readonly mirror: boolean
}

export interface LogicalBox {
  readonly o: number
  readonly r: number
  readonly oSize: number
  readonly rSize: number
}

export type LogicalPoint = readonly [o: number, r: number]

// Where an adornment landed: its center, the logical direction of its local
// x axis when it turns, and the stretch of the route it covers, as lengths
// along the route's polyline.
export interface PlacedAdornment {
  readonly center: LogicalPoint
  readonly direction: LogicalPoint | undefined
  readonly along: readonly [start: number, end: number]
}

export interface SolveResult {
  readonly nodes: ReadonlyArray<LogicalBox>
  readonly routes: ReadonlyArray<ReadonlyArray<LogicalPoint>>
  // The size of each route's corner at each point, 0 at its ends.
  readonly radii: ReadonlyArray<ReadonlyArray<number>>
  readonly adornments: ReadonlyArray<ReadonlyArray<PlacedAdornment>>
  // The end of the last rank band. Reversed directions mirror against it.
  readonly rankExtent: number
}

interface Band {
  readonly start: number
  readonly end: number
}

export function solve(
  nodes: ReadonlyArray<SolveNode>,
  edges: ReadonlyArray<SolveEdge>,
  options: SolveOptions,
): SolveResult {
  const nodeCount = nodes.length
  const { rankGap, nodeGap, edgeGap } = options

  // Self loops never enter the layered graph. They route around their node.
  const flow: Array<number> = []
  const loops: Array<Array<number>> = nodes.map(() => [])
  for (const [index, edge] of edges.entries()) {
    if (edge.source === edge.target) {
      loops[edge.source]?.push(index)
    } else {
      flow.push(index)
    }
  }

  const flowEdges = flow.map((index) => edges[index] as SolveEdge)
  const reversed = findReversed(nodeCount, flowEdges)

  // The ports at the upper and lower ends of each edge's chain. With back
  // loops, the auto faces of a reversed edge point along the flow: the edge
  // leaves its source downstream and enters its target from upstream.
  const loopBack = options.backEdges === LOOP
  const chainPorts = flowEdges.map((edge, j): readonly [SolvePort, SolvePort] => {
    if (!reversed[j]) {
      return [edge.sourcePort, edge.targetPort]
    }
    const upper = edge.targetPort
    const lower = edge.sourcePort
    if (!loopBack) {
      return [upper, lower]
    }
    return [
      upper.face === -1 ? { ...upper, face: RANK_START } : upper,
      lower.face === -1 ? { ...lower, face: RANK_END } : lower,
    ]
  })

  const rankEdges: Array<RankEdge> = flowEdges.map((edge, j) => ({
    tail: reversed[j] ? edge.target : edge.source,
    head: reversed[j] ? edge.source : edge.target,
    weight: edge.weight,
    minLength: 2 * edge.minLength,
  }))
  const nodeRanks = rank(nodeCount, rankEdges)

  // Build the layered graph: real nodes, then one dummy per inner rank of
  // each edge. Each flow adornment joins the run nearest its position along
  // the edge: the stub at either end, or the run through an odd rank, which
  // the adornment's dummy then sizes.
  const ranks: Array<number> = [...nodeRanks]
  const dummy: Array<boolean> = nodes.map(() => false)
  const dummyItems: Array<ReadonlyArray<RunItem>> = nodes.map(() => [])
  const stubItems: Array<readonly [upper: ReadonlyArray<RunItem>, lower: ReadonlyArray<RunItem>]> =
    []
  const segments: Array<Segment> = []
  const up: Array<Array<number>> = nodes.map(() => [])
  const down: Array<Array<number>> = nodes.map(() => [])
  const chains: Array<Array<number>> = []

  for (const [j, edge] of flowEdges.entries()) {
    const isReversed = reversed[j] as boolean
    const upper = isReversed ? edge.target : edge.source
    const lower = isReversed ? edge.source : edge.target
    const [upperPort, lowerPort] = chainPorts[j] as readonly [SolvePort, SolvePort]
    const upperRank = nodeRanks[upper] as number
    const lowerRank = nodeRanks[lower] as number

    const runs = assignRuns(edge.adornments, isReversed, upperRank, lowerRank)
    const items = (indices: ReadonlyArray<number>, axis: Axis, sign: Sign): Array<RunItem> =>
      indices.map((index) => {
        const adornment = edge.adornments[index] as SolveAdornment
        return {
          index,
          at: adornment.at,
          layer: adornment.layer,
          measured: measure(adornment, axis, sign, options.mirror),
        }
      })
    // A stub runs straight out of its port's face. The route heads along it
    // away from the source and toward the target.
    const stub = (indices: ReadonlyArray<number>, face: number, source: boolean) => {
      const [axis, away] = faceNormal(face)
      return items(indices, axis, source ? away : (-away as Sign))
    }
    stubItems.push([
      stub(runs.upper, upperPort.face >= 0 ? upperPort.face : RANK_END, !isReversed),
      stub(runs.lower, lowerPort.face >= 0 ? lowerPort.face : RANK_START, isReversed),
    ])

    const chain = [upper]
    for (let r = upperRank + 1; r < lowerRank; r++) {
      const element = ranks.length
      ranks.push(r)
      dummy.push(true)
      dummyItems.push(items(runs.ranks.get(r) ?? [], 1, isReversed ? -1 : 1))
      up.push([])
      down.push([])
      chain.push(element)
    }
    chain.push(lower)
    chains.push(chain)

    for (let i = 0; i + 1 < chain.length; i++) {
      const a = chain[i] as number
      const b = chain[i + 1] as number
      const segment = segments.length
      segments.push({
        upper: a,
        lower: b,
        weight: edge.weight,
        upperShift:
          i === 0 ? portShift(isReversed ? edge.targetPort : edge.sourcePort, RANK_START) : 0,
        lowerShift:
          i + 2 === chain.length
            ? portShift(isReversed ? edge.sourcePort : edge.targetPort, RANK_END)
            : 0,
        alignable:
          (i > 0 || isCentered(upperPort, RANK_END)) &&
          (i + 2 < chain.length || isCentered(lowerPort, RANK_START)),
      })
      down[a]?.push(segment)
      up[b]?.push(segment)
    }
  }

  let rankCount = 0
  for (const r of ranks) {
    rankCount = Math.max(rankCount, r + 1)
  }

  const graph: LayeredGraph = { rankCount, ranks, dummy, segments, up, down }
  const layers = order(graph)

  // Self loops reserve room on the order faces they wrap around: one
  // `edgeGap` per loop at the node, on each order face a loop visits.
  const loopsBefore: Array<number> = []
  const loopsAfter: Array<number> = []
  for (const list of loops) {
    let before = 0
    let after = 0
    for (const edgeIndex of list) {
      const edge = edges[edgeIndex] as SolveEdge
      const visited = facesBetween(
        edge.sourcePort.face >= 0 ? edge.sourcePort.face : ORDER_END,
        edge.targetPort.face >= 0 ? edge.targetPort.face : ORDER_END,
      )
      if (visited.includes(ORDER_START)) {
        before = list.length
      }
      if (visited.includes(ORDER_END)) {
        after = list.length
      }
    }
    loopsBefore.push(before)
    loopsAfter.push(after)
  }

  // The order-axis extent of each element. Nodes reserve room beside them
  // for self loops and for their columns.
  const makeExtents = (columns: Columns | undefined): Array<Extent> =>
    ranks.map((_, element) => {
      if (element < nodeCount) {
        const node = nodes[element] as SolveNode
        const before = (loopsBefore[element] as number) * edgeGap + (columns?.before[element] ?? 0)
        const after = (loopsAfter[element] as number) * edgeGap + (columns?.after[element] ?? 0)
        return {
          before: node.oSize / 2 + node.oStart + before,
          after: node.oSize / 2 + node.oEnd + after,
          gap: nodeGap / 2,
        }
      }
      // A dummy reserves room across the flow for its adornments.
      let before = 0
      let after = 0
      for (const { measured } of dummyItems[element] ?? []) {
        before = Math.max(before, -measured.outerLo)
        after = Math.max(after, measured.outerHi)
      }
      return { before, after, gap: edgeGap / 2 }
    })

  let extents = makeExtents(undefined)
  let anchors = position(graph, layers, extents)

  // The ends of each chain: the node, its port face and position, the
  // direction the edge leaves it in (1 downstream from the upper end, -1
  // upstream from the lower end), and the order-axis position of the next
  // element along the edge, which orders ports that share a face.
  const makeEnds = (): Array<[upper: End, lower: End]> =>
    flowEdges.map((edge, j) => {
      const chain = chains[j] as Array<number>
      const [upperPort, lowerPort] = chainPorts[j] as readonly [SolvePort, SolvePort]
      const [upperItems, lowerItems] = stubItems[j] as readonly [
        ReadonlyArray<RunItem>,
        ReadonlyArray<RunItem>,
      ]
      return [
        {
          j,
          node: chain[0] as number,
          face: upperPort.face >= 0 ? upperPort.face : RANK_END,
          at: upperPort.at,
          stub: runLength(upperItems),
          corner: edge.minRadius,
          direction: 1,
          toward: anchors[chain[1] as number] as number,
        },
        {
          j,
          node: chain[chain.length - 1] as number,
          face: lowerPort.face >= 0 ? lowerPort.face : RANK_START,
          at: lowerPort.at,
          stub: runLength(lowerItems),
          corner: edge.minRadius,
          direction: -1,
          toward: anchors[chain[chain.length - 2] as number] as number,
        },
      ]
    })

  // A node's box across the flow only. Ports on rank faces and the points
  // where edges leave their node's band depend on nothing else.
  const orderBox = (node: number): LogicalBox => {
    const { oSize } = nodes[node] as SolveNode
    return { o: (anchors[node] as number) - oSize / 2, r: 0, oSize, rSize: 0 }
  }

  // Every edge that leaves a node through an order face, or around it from
  // the face pointing away, gets a column of its own
  // beside the node. A wrap (an end on the face pointing away) goes around
  // the node on the side of the next element along its edge, decided once
  // from a first positioning. The columns then reserve room, and positioning
  // runs again.
  const wrapSides: Array<[upper: number, lower: number]> = flowEdges.map(() => [-1, -1])
  const sideOf = (end: End): number =>
    isRankFace(end.face)
      ? (wrapSides[end.j] as [number, number])[end.direction > 0 ? 0 : 1]
      : end.face
  // Columns on one side of a node run from the inside out in the order of
  // where their edges head next, as crossing reduction ordered the elements
  // they continue through. The port orders follow it.
  const columnOrder = (a: End, b: End): number => {
    const outward = (end: End) => (sideOf(end) === ORDER_END ? end.toward : -end.toward)
    return coincident(a.toward, b.toward) ? a.j - b.j : outward(a) - outward(b)
  }
  // On a rank face, wraps sit at the end nearest the side they go around,
  // and their turns nest: the port nearest the side takes the inner column.
  const rankOrder = (a: End, b: End): number => {
    const rankA = wrapRank(a, sideOf)
    const rankB = wrapRank(b, sideOf)
    if (rankA !== rankB) {
      return rankA - rankB
    }
    if (rankA === 0) {
      return byToward(a, b)
    }
    return rankA > 0 ? columnOrder(b, a) : columnOrder(a, b)
  }
  // On an order face, edges heading upstream take the upper ports and edges
  // heading downstream the lower ones. In each group the port nearest the
  // group's band edge takes the inner column, so the stubs never cross.
  const sideOrder = (a: End, b: End): number => {
    if (a.direction !== b.direction) {
      return a.direction - b.direction
    }
    return a.direction < 0 ? columnOrder(a, b) : columnOrder(b, a)
  }

  {
    const ends = makeEnds()
    for (const pair of ends) {
      for (const end of pair) {
        if (isWrap(end)) {
          const center = anchors[end.node] as number
          const before = end.toward < center && !coincident(end.toward, center)
          ;(wrapSides[end.j] as [number, number])[end.direction > 0 ? 0 : 1] = before
            ? ORDER_START
            : ORDER_END
        }
      }
    }
    const columns = assignColumns(ends, sideOf, columnOrder, loopsBefore, loopsAfter, {
      nodeCount,
      nodeGap,
      edgeGap,
    })
    if (columns.used) {
      extents = makeExtents(columns)
      anchors = position(graph, layers, extents)
    }
  }

  // Where an edge leaves its node's band across the flow: at its port on the
  // face toward the edge, otherwise at its column.
  const exitOf = (end: End, box: LogicalBox, along: number | undefined, cols: Columns): number => {
    if (end.face === towardFace(end)) {
      return along as number
    }
    const offset = (cols.offsets[end.j] as [number, number])[end.direction > 0 ? 0 : 1]
    return sideOf(end) === ORDER_END ? box.o + box.oSize + offset : box.o - offset
  }

  // The rank neighbors of each element, for the room beside a node.
  const neighbors = (): [before: Map<number, number>, after: Map<number, number>] => {
    const before = new Map<number, number>()
    const after = new Map<number, number>()
    for (const layer of layers) {
      for (let i = 1; i < layer.length; i++) {
        before.set(layer[i] as number, layer[i - 1] as number)
        after.set(layer[i - 1] as number, layer[i] as number)
      }
    }
    return [before, after]
  }
  const [neighborBefore, neighborAfter] = neighbors()

  // Moves columns out to where their edges continue, so an edge that runs
  // on past its node's column takes no extra turn beside the node. A column
  // moves only outward, only as far as the room before the node's rank
  // neighbor allows (the clearance an edge passing there would need), and
  // never past the column outside it.
  const extendColumns = (
    ends: ReadonlyArray<[End, End]>,
    rankAlong: ReadonlyMap<End, number>,
    cols: Columns,
  ): Columns => {
    const offsets = cols.offsets.map(([upper, lower]): [number, number] => [upper, lower])
    const offsetOf = (end: End) => (offsets[end.j] as [number, number])[end.direction > 0 ? 0 : 1]

    // Where the edge crosses into the channel beyond its node's band: at the
    // next element, or at the other end's exit for an edge between adjacent
    // ranks.
    const next = (end: End): number => {
      const chain = chains[end.j] as Array<number>
      if (chain.length > 2) {
        return end.toward
      }
      const other = (ends[end.j] as [End, End])[end.direction > 0 ? 1 : 0]
      return exitOf(other, orderBox(other.node), rankAlong.get(other), cols)
    }

    for (const { node, side, ends: stack } of cols.stacks) {
      const box = orderBox(node)
      const after = side === ORDER_END
      const neighbor = (after ? neighborAfter : neighborBefore).get(node)
      let limit = Number.POSITIVE_INFINITY
      if (neighbor !== undefined) {
        const extent = extents[neighbor] as Extent
        const clearance = (after ? extent.before : extent.after) + extent.gap + edgeGap / 2
        const x = anchors[neighbor] as number
        limit = after ? x - clearance - (box.o + box.oSize) : box.o - (x + clearance)
      }
      for (let k = stack.length - 1; k >= 0; k--) {
        const end = stack[k] as End
        const offset = offsetOf(end)
        const x = next(end)
        const desired = after ? x - (box.o + box.oSize) : box.o - x
        if (
          desired > offset &&
          !coincident(desired, offset) &&
          (desired <= limit || coincident(desired, limit))
        ) {
          ;(offsets[end.j] as [number, number])[end.direction > 0 ? 0 : 1] = desired
        }
        limit = offsetOf(end) - edgeGap
      }
    }
    return { ...cols, offsets }
  }

  // Resolves the ports on rank faces, the columns, and where each edge
  // leaves its upper node's band and enters its lower node's band. Columns
  // extend only once straightening has settled where edges continue.
  const resolveOrthogonal = (ends: ReadonlyArray<[End, End]>, extend: boolean) => {
    const rankAlong = placePorts(ends, orderBox, true, edgeGap, rankOrder, isWrap)
    const assigned = assignColumns(ends, sideOf, columnOrder, loopsBefore, loopsAfter, {
      nodeCount,
      nodeGap,
      edgeGap,
    })
    const cols = extend ? extendColumns(ends, rankAlong, assigned) : assigned
    const attach = ends.map(
      ([upper, lower]) =>
        [
          exitOf(upper, orderBox(upper.node), rankAlong.get(upper), cols),
          exitOf(lower, orderBox(lower.node), rankAlong.get(lower), cols),
        ] as const,
    )
    return { rankAlong, cols, attach }
  }

  // Straighten toward the actual ports, so that a run aligns with the port
  // its edge leaves or enters through and needs one jog. The jog sits by
  // the end that fans out: below a node with several edges leaving it,
  // above a node with several edges entering it.
  {
    const { attach } = resolveOrthogonal(makeEnds(), false)
    straighten(
      layers,
      anchors,
      extents,
      chains.map((chain, j) => {
        const [upper, lower] = attach[j] as readonly [number, number]
        const fansOut = (down[chain[0] as number] as Array<number>).length > 1
        const fansIn = (up[chain[chain.length - 1] as number] as Array<number>).length > 1
        return { chain, upper, lower, preferUpper: fansIn && !fansOut }
      }),
    )
  }

  // Ports. Fixed positions resolve directly. Auto positions on a shared face
  // spread around the face's center, ordered by where their edges head.
  // Ports on rank faces depend only on positions across the flow, so they
  // resolve before the rank bands do.
  const ends = makeEnds()
  const resolved = resolveOrthogonal(ends, true)
  const rankAlong = resolved.rankAlong

  // Rank bands. Each band is as thick as the outer size of its largest
  // element, and its elements stack inside it.
  const thicknesses: Array<number> = []
  const placements = new Map<number, { start: number; size: number }>()

  for (const layer of layers) {
    const items: Array<Track.StackItem> = []
    const owners: Array<number> = []
    let thickness = 0

    for (const element of layer) {
      const item = stackItem(element, nodeCount, nodes, dummyItems)
      if (item === undefined) {
        continue
      }
      items.push(item)
      owners.push(element)
      const size = clamp(item.basis ?? 0, item.min ?? 0, item.max ?? Number.POSITIVE_INFINITY)
      thickness = Math.max(thickness, size + finite(item.start) + finite(item.end))
    }

    thicknesses.push(thickness)
    if (items.length > 0) {
      const track = Track.stack(items, { size: thickness })
      for (const [i, interval] of track.intervals.entries()) {
        placements.set(owners[i] as number, { start: interval.start, size: interval.size })
      }
    }
  }

  // How far inside its band a node's face sits: the downstream face for
  // `direction` 1, the upstream face for -1.
  const faceInset = (node: number, direction: 1 | -1): number => {
    const placement = placements.get(node) as { start: number; size: number }
    return direction > 0
      ? (thicknesses[ranks[node] as number] as number) - (placement.start + placement.size)
      : placement.start
  }
  // The room a dummy's band leaves free on its downstream side (`direction`
  // 1) or upstream side (-1) for the corners beside it: what its
  // adornments leave, or half the band without them.
  const freeRoom = (element: number, direction: 1 | -1): number => {
    const thickness = thicknesses[ranks[element] as number] as number
    const placement = placements.get(element)
    if (placement === undefined) {
      return thickness / 2
    }
    return direction > 0 ? thickness - (placement.start + placement.size) : placement.start
  }

  // The order-axis position of each chain at every rank boundary, the lane
  // of each jog between two ranks, and the lane of each wrap's turn. Channel
  // `k` lies after rank `k`, so channel -1 is before the first rank; the
  // arrays below hold channel `k` at index `k + 1`. A lane keeps room from
  // each side of its channel for the corner there, and a lane where a
  // route's first or last segment ends keeps room for its port's stub too.
  const crossings: Array<Array<number>> = []
  const jogLanes: Array<Array<number>> = []
  const wrapLanes: Array<[upper: number, lower: number]> = flowEdges.map(() => [-1, -1])
  interface Placed {
    readonly jog: Jog
    readonly near: number
    readonly far: number
    readonly assign: (lane: number) => void
  }
  const channelJogs = new Map<number, Array<Placed>>()
  const minSizes = new Map<number, number>()
  const addJog = (channel: number, placed: Placed): void => {
    let list = channelJogs.get(channel)
    if (list === undefined) {
      list = []
      channelJogs.set(channel, list)
    }
    list.push(placed)
  }

  for (const [j, chain] of chains.entries()) {
    const [upperEnd, lowerEnd] = ends[j] as [End, End]
    const [upper, lower] = resolved.attach[j] as readonly [number, number]
    const xs = [upper]
    for (let i = 1; i + 1 < chain.length; i++) {
      xs.push(anchors[chain[i] as number] as number)
    }
    xs.push(lower)
    crossings.push(xs)
    const lanes = xs.slice(1).map(() => -1)
    jogLanes.push(lanes)

    // The room a straight end's stub needs from the side of its channel.
    const upperStub = upperEnd.face === RANK_END ? upperEnd.stub - faceInset(upperEnd.node, 1) : 0
    const lowerStub =
      lowerEnd.face === RANK_START ? lowerEnd.stub - faceInset(lowerEnd.node, -1) : 0
    const corner = upperEnd.corner
    const last = xs.length - 2
    const jogs = xs.slice(1).map((end, i) => !coincident(xs[i] as number, end))
    // An edge that never turns and carries nothing else along its line
    // needs no room for its stubs: they fit on its one straight run.
    const alone =
      !jogs.includes(true) &&
      upperEnd.face === RANK_END &&
      lowerEnd.face === RANK_START &&
      (coincident(upperEnd.stub, 0) || coincident(lowerEnd.stub, 0)) &&
      chain.every((element) => (dummyItems[element] ?? []).length === 0)

    // The room a corner at the lane of jog `i` has beyond its channel,
    // through the dummy toward the upper end (`toward` -1) or the lower end
    // (1). A dummy that carries nothing and that the route runs straight on
    // through gives its whole band and the least room of the channel after
    // it, less any stub there. Otherwise the corner keeps to its side of the
    // band.
    const roomBeyond = (i: number, toward: 1 | -1): number => {
      const element = chain[toward > 0 ? i + 1 : i] as number
      const onward = toward > 0 ? i + 1 : i - 1
      if ((dummyItems[element] ?? []).length > 0 || jogs[onward] === true) {
        return freeRoom(element, toward > 0 ? -1 : 1)
      }
      const endStub = onward === 0 ? upperStub : onward === last ? lowerStub : 0
      return (thicknesses[ranks[element] as number] as number) + Math.max(rankGap / 2 - endStub, 0)
    }

    for (let i = 0; i + 1 < xs.length; i++) {
      const start = xs[i] as number
      const end = xs[i + 1] as number
      const channel = ranks[chain[i] as number] as number
      if (jogs[i] === true) {
        addJog(channel, {
          jog: { start, end },
          near: i === 0 ? upperStub + corner : corner - roomBeyond(i, -1),
          far: i === last ? lowerStub + corner : corner - roomBeyond(i, 1),
          assign: (lane) => {
            lanes[i] = lane
          },
        })
      } else if (!alone && (i === 0 || i === last)) {
        // A straight end keeps its stub inside its own channel, clear of
        // whatever else the line carries.
        const need = Math.max(i === 0 ? upperStub : 0, i === last ? lowerStub : 0)
        minSizes.set(channel, Math.max(minSizes.get(channel) ?? 0, need))
      }
    }

    // A wrap turns in the channel beside its port's face, from the port to
    // its column. Both of its connections lead to the node: to the far side
    // of the channel above an upper end, to the near side of the channel
    // below a lower end.
    for (const end of [upperEnd, lowerEnd]) {
      if (!isWrap(end)) {
        continue
      }
      const slot = end.direction > 0 ? 0 : 1
      const side = end.direction > 0 ? FAR : NEAR
      const nodeRank = ranks[end.node] as number
      const need = end.stub + end.corner - faceInset(end.node, end.direction > 0 ? -1 : 1)
      addJog(end.direction > 0 ? nodeRank - 1 : nodeRank, {
        jog: {
          start: rankAlong.get(end) as number,
          end: (resolved.attach[j] as readonly [number, number])[slot],
          startSide: side,
          endSide: side,
        },
        near: end.direction > 0 ? 0 : need,
        far: end.direction > 0 ? need : 0,
        assign: (lane) => {
          ;(wrapLanes[j] as [number, number])[slot] = lane
        },
      })
    }
  }

  // Each channel grows to fit its lanes, `edgeGap` apart and from its
  // bands, and is at least half a rank gap. The channels before the first
  // band and after the last one only hold the turns of wraps, and take no
  // room without them.
  const channelLayouts: Array<ChannelLayout> = []
  for (let channel = -1; channel < rankCount; channel++) {
    const list = channelJogs.get(channel) ?? []
    const assigned = assignLanes(list.map(({ jog }) => jog))
    const near = Array.from({ length: assigned.count }, () => 0)
    const far = Array.from({ length: assigned.count }, () => 0)
    for (const [k, placed] of list.entries()) {
      const lane = assigned.lanes[k] as number
      placed.assign(lane)
      near[lane] = Math.max(near[lane] as number, placed.near)
      far[lane] = Math.max(far[lane] as number, placed.far)
    }
    const outer = channel === -1 || channel === rankCount - 1
    const base =
      outer && assigned.count === 0 ? 0 : Math.max(rankGap / 2, (assigned.count + 1) * edgeGap)
    channelLayouts.push(
      layoutChannel(near, far, Math.max(base, minSizes.get(channel) ?? 0), edgeGap),
    )
  }

  // The bands and channels alternate along the flow.
  const items: Array<{ basis: number }> = []
  for (let channel = -1; channel < rankCount; channel++) {
    items.push({ basis: (channelLayouts[channel + 1] as ChannelLayout).size })
    if (channel + 1 < rankCount) {
      items.push({ basis: thicknesses[channel + 1] as number })
    }
  }
  const track = Track.sequence(items, { gap: 0 })
  const bands: Array<Band> = []
  const channels: Array<Band> = []
  for (const [k, interval] of track.intervals.entries()) {
    ;(k % 2 === 0 ? channels : bands).push({ start: interval.start, end: interval.end })
  }
  const rankExtent = track.end

  const band = (element: number): Band => bands[ranks[element] as number] as Band

  const nodeBoxes: Array<LogicalBox> = nodes.map((node, element) => {
    const placement = placements.get(element) as { start: number; size: number }
    return {
      o: (anchors[element] as number) - node.oSize / 2,
      r: band(element).start + placement.start,
      oSize: node.oSize,
      rSize: placement.size,
    }
  })

  // Ports on order faces run along the rank axis, so they resolve now.
  const orderAlong = placePorts(
    ends,
    (node) => nodeBoxes[node] as LogicalBox,
    false,
    edgeGap,
    sideOrder,
  )
  // Each node's shape in its box, resolved once.
  const shapes = new Map<number, SolveShape | undefined>()
  const shapeOf = (node: number): SolveShape | undefined => {
    if (!shapes.has(node)) {
      shapes.set(node, (nodes[node] as SolveNode).shape?.(nodeBoxes[node] as LogicalBox))
    }
    return shapes.get(node)
  }
  const portPoint = (end: End): LogicalPoint =>
    facePoint(
      nodeBoxes[end.node] as LogicalBox,
      end.face,
      (rankAlong.get(end) ?? orderAlong.get(end)) as number,
      shapeOf(end.node),
    )

  // The lane of channel `channel` at `lane`, along the rank axis.
  const laneR = (channel: number, lane: number): number =>
    (channels[channel + 1] as Band).start +
    ((channelLayouts[channel + 1] as ChannelLayout).lanes[lane] as number)

  // The path from a port to the edge of its node's band, on the side its
  // edge travels toward: straight out of a face toward the edge, across to
  // the column from an order face, and around through a turn in the channel
  // beside the face from a wrap.
  const endPath = (end: End): Array<LogicalPoint> => {
    const nodeBand = band(end.node)
    const bandEdge = end.direction > 0 ? nodeBand.end : nodeBand.start
    const port = portPoint(end)
    const [o, r] = port
    const slot = end.direction > 0 ? 0 : 1
    const exit = (resolved.attach[end.j] as readonly [number, number])[slot]
    if (end.face === towardFace(end)) {
      return [port, [o, bandEdge]]
    }
    if (!isRankFace(end.face)) {
      return [port, [exit, r], [exit, bandEdge]]
    }
    const nodeRank = ranks[end.node] as number
    const turn = laneR(
      end.direction > 0 ? nodeRank - 1 : nodeRank,
      (wrapLanes[end.j] as [number, number])[slot],
    )
    return [port, [o, turn], [exit, turn], [exit, bandEdge]]
  }

  const routes: Array<ReadonlyArray<LogicalPoint>> = edges.map(() => [])

  for (const [j, chain] of chains.entries()) {
    const [upperEnd, lowerEnd] = ends[j] as [End, End]

    const middle: Array<LogicalPoint> = []
    for (let i = 0; i + 1 < chain.length; i++) {
      const lane = (jogLanes[j] as Array<number>)[i] as number
      if (lane >= 0) {
        const xs = crossings[j] as Array<number>
        const r = laneR(ranks[chain[i] as number] as number, lane)
        middle.push([xs[i] as number, r], [xs[i + 1] as number, r])
      }
      if (i + 2 < chain.length) {
        const element = chain[i + 1] as number
        const x = anchors[element] as number
        const elementBand = band(element)
        middle.push([x, elementBand.start], [x, elementBand.end])
      }
    }

    const points = simplify([...endPath(upperEnd), ...middle, ...endPath(lowerEnd).toReversed()])
    routes[flow[j] as number] = reversed[j] ? points.toReversed() : points
  }

  for (const [node, list] of loops.entries()) {
    const box = nodeBoxes[node] as LogicalBox
    for (const [k, edgeIndex] of list.entries()) {
      routes[edgeIndex] = selfLoop(
        box,
        shapeOf(node),
        edges[edgeIndex] as SolveEdge,
        k,
        list.length,
        edgeGap,
      )
    }
  }

  // Adornments. Flow adornments line up on their runs, and the stretches
  // they cover, gaps included, become walls that corners keep clear of.
  // Corners then take their size, and absolute adornments find their place
  // on the route as drawn.
  const cumulative = routes.map((route) => lengths(route))
  const placed: Array<Array<PlacedAdornment>> = edges.map((edge) =>
    edge.adornments.map(() => unplaced),
  )
  const walls: Array<Array<readonly [number, number]>> = edges.map(() => [])

  // Lines up the adornments of a run along `axis` at `line` across it. The
  // route heads along it by `sign`, and `place` gives where each layer
  // starts from its length.
  const placeRun = (
    edgeIndex: number,
    items: ReadonlyArray<RunItem>,
    axis: Axis,
    sign: Sign,
    line: number,
    place: (total: number) => number,
  ): void => {
    const route = routes[edgeIndex] as ReadonlyArray<LogicalPoint>
    const along = cumulative[edgeIndex] as ReadonlyArray<number>
    for (const [item, center] of packRun(items, sign, place)) {
      const { size, start, end, lo, hi, direction } = item.measured
      const across = line + (lo + hi) / 2
      const distance = distanceAlong(route, along, axis === 0 ? [center, line] : [line, center])
      const [before, after] = sign > 0 ? [start, end] : [end, start]
      ;(placed[edgeIndex] as Array<PlacedAdornment>)[item.index] = {
        center: axis === 0 ? [center, across] : [across, center],
        direction,
        along: [distance - size / 2, distance + size / 2],
      }
      ;(walls[edgeIndex] as Array<readonly [number, number]>).push([
        distance - size / 2 - before,
        distance + size / 2 + after,
      ])
    }
  }

  // A stub packs its adornments against its port. A run through a rank
  // centers them in the room its dummy took in the band.
  for (const [j, chain] of chains.entries()) {
    const edgeIndex = flow[j] as number
    const isReversed = reversed[j] as boolean
    const [upperItems, lowerItems] = stubItems[j] as readonly [
      ReadonlyArray<RunItem>,
      ReadonlyArray<RunItem>,
    ]
    for (const [end, items] of [
      [ends[j]?.[0], upperItems],
      [ends[j]?.[1], lowerItems],
    ] as const) {
      if (end === undefined || items.length === 0) {
        continue
      }
      const [axis, away] = faceNormal(end.face)
      const port = portPoint(end)
      const source = end.direction > 0 !== isReversed
      placeRun(
        edgeIndex,
        items,
        axis,
        source ? away : (-away as Sign),
        port[1 - axis] as number,
        (total) => (away > 0 ? port[axis] : port[axis] - total),
      )
    }
    for (let i = 1; i + 1 < chain.length; i++) {
      const element = chain[i] as number
      const placement = placements.get(element)
      if (placement === undefined) {
        continue
      }
      const start = band(element).start + placement.start
      placeRun(
        edgeIndex,
        dummyItems[element] ?? [],
        1,
        isReversed ? -1 : 1,
        anchors[element] as number,
        (total) => start + (placement.size - total) / 2,
      )
    }
  }

  // A self loop has no runs of its own size. Its flow adornments line up on
  // the segment where their position along the loop falls, around the mean
  // of those positions, and inside the segment where they fit.
  for (const list of loops) {
    for (const edgeIndex of list) {
      const edge = edges[edgeIndex] as SolveEdge
      const route = routes[edgeIndex] as ReadonlyArray<LogicalPoint>
      const along = cumulative[edgeIndex] as ReadonlyArray<number>
      const total = along[along.length - 1] as number
      const bySegment = new Map<number, Array<number>>()
      for (const [index, adornment] of edge.adornments.entries()) {
        if (!adornment.flow) {
          continue
        }
        let segment = 0
        while (
          segment + 2 < route.length &&
          (along[segment + 1] as number) < adornment.at * total
        ) {
          segment++
        }
        const indices = bySegment.get(segment) ?? []
        indices.push(index)
        bySegment.set(segment, indices)
      }
      for (const [segment, indices] of bySegment) {
        const a = route[segment] as LogicalPoint
        const b = route[segment + 1] as LogicalPoint
        const axis: Axis = coincident(a[0], b[0]) ? 1 : 0
        const sign: Sign = b[axis] >= a[axis] ? 1 : -1
        let mean = 0
        const items = indices.map((index): RunItem => {
          const adornment = edge.adornments[index] as SolveAdornment
          mean += a[axis] + sign * (adornment.at * total - (along[segment] as number))
          return {
            index,
            at: adornment.at,
            layer: adornment.layer,
            measured: measure(adornment, axis, sign, options.mirror),
          }
        })
        mean /= indices.length
        const from = Math.min(a[axis], b[axis])
        const to = Math.max(a[axis], b[axis])
        placeRun(edgeIndex, items, axis, sign, a[1 - axis] as number, (length) =>
          clamp(mean - length / 2, from, Math.max(from, to - length)),
        )
      }
    }
  }

  const radii = routes.map((route, edgeIndex) =>
    resolveRadii(
      route,
      cumulative[edgeIndex] as ReadonlyArray<number>,
      (edges[edgeIndex] as SolveEdge).radius,
      walls[edgeIndex] as ReadonlyArray<readonly [number, number]>,
    ),
  )

  for (const [edgeIndex, edge] of edges.entries()) {
    for (const [index, adornment] of edge.adornments.entries()) {
      if (adornment.flow) {
        continue
      }
      const drawn = pointOnDrawn(
        routes[edgeIndex] as ReadonlyArray<LogicalPoint>,
        cumulative[edgeIndex] as ReadonlyArray<number>,
        radii[edgeIndex] as ReadonlyArray<number>,
        adornment.at,
      )
      ;(placed[edgeIndex] as Array<PlacedAdornment>)[index] = placeAbsolute(
        adornment,
        drawn,
        options.mirror,
      )
    }
  }

  return { nodes: nodeBoxes, routes, radii, adornments: placed, rankExtent }
}

const unplaced: PlacedAdornment = { center: [0, 0], direction: undefined, along: [0, 0] }

// The axis a face's outward normal runs along, and its sign.
function faceNormal(face: number): readonly [Axis, Sign] {
  switch (face) {
    case RANK_START:
      return [1, -1]
    case RANK_END:
      return [1, 1]
    case ORDER_START:
      return [0, -1]
    default:
      return [0, 1]
  }
}

interface ChannelLayout {
  // The size of the channel along the flow.
  readonly size: number
  // The position of each lane from the near side of the channel.
  readonly lanes: ReadonlyArray<number>
}

// Lays out the lanes of a channel. Lanes sit `gap` apart and from both
// sides, and lane `k` sits at least `near[k]` from the near side and
// `far[k]` from the far side. The channel takes the least size that fits
// them, and at least `base`. Within that size the lanes spread evenly, then
// move as little as the bounds require, which keeps them `gap` apart.
function layoutChannel(
  near: ReadonlyArray<number>,
  far: ReadonlyArray<number>,
  base: number,
  gap: number,
): ChannelLayout {
  const count = near.length
  // The least distance of each lane from the near side, and from the far one.
  const fromNear: Array<number> = []
  for (let k = 0; k < count; k++) {
    fromNear.push(Math.max((k === 0 ? 0 : (fromNear[k - 1] as number)) + gap, near[k] as number))
  }
  const fromFar: Array<number> = Array.from({ length: count }, () => 0)
  for (let k = count - 1; k >= 0; k--) {
    fromFar[k] = Math.max(
      (k === count - 1 ? 0 : (fromFar[k + 1] as number)) + gap,
      far[k] as number,
    )
  }
  let size = base
  for (let k = 0; k < count; k++) {
    size = Math.max(size, (fromNear[k] as number) + (fromFar[k] as number))
  }
  const lanes = fromNear.map((low, k) =>
    Math.min(Math.max(((k + 1) * size) / (count + 1), low), size - (fromFar[k] as number)),
  )
  return { size, lanes }
}

function finite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0
}

function stackItem(
  element: number,
  nodeCount: number,
  nodes: ReadonlyArray<SolveNode>,
  dummyItems: ReadonlyArray<ReadonlyArray<RunItem>>,
): Track.StackItem | undefined {
  if (element < nodeCount) {
    const node = nodes[element] as SolveNode
    return {
      basis: node.rSize,
      min: node.rMin,
      max: node.rMax,
      start: node.rStart,
      end: node.rEnd,
      place: node.place,
      stretch: node.stretch,
    }
  }
  const items = dummyItems[element] ?? []
  if (items.length === 0) {
    return undefined
  }
  return { basis: runLength(items), place: 0.5, stretch: 0 }
}

// Picks the run of each flow adornment: the one nearest its position along
// the edge. Along the chain, the upper stub sits at 0, the lower stub at 1,
// and the run through odd rank `r` at its share of the span. Ties go to the
// run through a rank. Every chain has at least one odd rank.
function assignRuns(
  adornments: ReadonlyArray<SolveAdornment>,
  isReversed: boolean,
  upperRank: number,
  lowerRank: number,
): {
  readonly upper: ReadonlyArray<number>
  readonly lower: ReadonlyArray<number>
  readonly ranks: ReadonlyMap<number, ReadonlyArray<number>>
} {
  const upper: Array<number> = []
  const lower: Array<number> = []
  const ranks = new Map<number, Array<number>>()
  const span = lowerRank - upperRank
  for (const [index, adornment] of adornments.entries()) {
    if (!adornment.flow) {
      continue
    }
    const at = isReversed ? 1 - adornment.at : adornment.at
    const slot = Math.min(Math.max(Math.round((at * span - 1) / 2), 0), span / 2 - 1)
    const rank = upperRank + 1 + 2 * slot
    const inner = Math.abs(upperRank + at * span - rank)
    const toUpper = at * span
    const toLower = (1 - at) * span
    if (toUpper < inner && !coincident(toUpper, inner)) {
      upper.push(index)
    } else if (toLower < inner && !coincident(toLower, inner)) {
      lower.push(index)
    } else {
      const list = ranks.get(rank) ?? []
      list.push(index)
      ranks.set(rank, list)
    }
  }
  return { upper, lower, ranks }
}

// Whether a port attaches at the center of the face that points along the
// edge, so that coordinate assignment can align the edge with the node.
function isCentered(port: SolvePort, towardFace: number): boolean {
  return (
    (port.face === -1 || port.face === towardFace) &&
    (!Number.isFinite(port.at) || coincident(port.at, 0.5))
  )
}

interface ChainAttachment {
  readonly chain: ReadonlyArray<number>
  // Where the edge attaches to its upper and lower nodes, across the flow.
  readonly upper: number
  readonly lower: number
  // Whether a run aligns with its upper neighbor before its lower one.
  readonly preferUpper: boolean
}

const STRAIGHTEN_PASSES = 4

// Edge straightening after coordinate assignment. Brandes-Köpf leaves a run
// of dummies that aligns with neither end of its edge wherever the four
// candidate layouts disagree, often far out in free space. Each such run
// moves toward the midpoint of the edge's attachment points, as far as the
// separation from its rank neighbors allows. Runs aligned with an end stay,
// so long edges stay straight. Moves never break separation, so the result
// stays valid.
//
// A run that can align with one of its neighbors does so instead (the
// preferred one first), so its edge needs one jog rather than two.
function straighten(
  layers: ReadonlyArray<ReadonlyArray<number>>,
  xs: Array<number>,
  extents: ReadonlyArray<Extent>,
  chains: ReadonlyArray<ChainAttachment>,
): void {
  const left = new Map<number, number>()
  const right = new Map<number, number>()
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) {
      const element = layer[i] as number
      if (i > 0) {
        left.set(element, layer[i - 1] as number)
      }
      if (i + 1 < layer.length) {
        right.set(element, layer[i + 1] as number)
      }
    }
  }

  const neighborX = (chain: ChainAttachment, index: number): number => {
    if (index === 0) {
      return chain.upper
    }
    if (index === chain.chain.length - 1) {
      return chain.lower
    }
    return xs[chain.chain[index] as number] as number
  }

  for (let pass = 0; pass < STRAIGHTEN_PASSES; pass++) {
    for (const attached of chains) {
      const chain = attached.chain
      let start = 1
      while (start < chain.length - 1) {
        const x = xs[chain[start] as number] as number
        let end = start
        while (
          end + 1 < chain.length - 1 &&
          coincident(xs[chain[end + 1] as number] as number, x)
        ) {
          end++
        }

        const above = neighborX(attached, start - 1)
        const below = neighborX(attached, end + 1)
        if (!coincident(x, above) && !coincident(x, below)) {
          let low = Number.NEGATIVE_INFINITY
          let high = Number.POSITIVE_INFINITY
          for (let i = start; i <= end; i++) {
            const element = chain[i] as number
            const before = left.get(element)
            const after = right.get(element)
            if (before !== undefined) {
              low = Math.max(
                low,
                (xs[before] as number) + separate(extents, before, element, false),
              )
            }
            if (after !== undefined) {
              high = Math.min(
                high,
                (xs[after] as number) - separate(extents, element, after, false),
              )
            }
          }
          if (low <= high) {
            let target = clamp((above + below) / 2, low, high)
            const first = attached.preferUpper ? above : below
            const second = attached.preferUpper ? below : above
            if (first >= low && first <= high) {
              target = first
            } else if (second >= low && second <= high) {
              target = second
            }
            for (let i = start; i <= end; i++) {
              xs[chain[i] as number] = target
            }
          }
        }

        start = end + 1
      }
    }
  }
}

// The order-axis shift that crossing reduction applies at a port. An edge
// from an auto port on the face pointing away (`awayFace`) wraps around its
// node, on the order-end side unless positions say otherwise, so it shifts
// there.
function portShift(port: SolvePort, awayFace: number): number {
  if (port.face === awayFace && !Number.isFinite(port.at)) {
    return 0.5
  }
  if (port.face === ORDER_END) {
    return 0.5
  }
  if (port.face === ORDER_START) {
    return -0.5
  }
  if ((port.face === RANK_START || port.face === RANK_END) && Number.isFinite(port.at)) {
    return Math.min(Math.max(port.at, 0), 1) - 0.5
  }
  return 0
}

// The faces a loop passes walking clockwise from `from` to `to`.
function facesBetween(from: number, to: number): Array<number> {
  const faces = [from]
  let face = from
  while (face !== to) {
    face = (face + 1) % 4
    faces.push(face)
  }
  return faces
}

function isRankFace(face: number): boolean {
  return face === RANK_START || face === RANK_END
}

function faceStart(box: LogicalBox, face: number): number {
  return isRankFace(face) ? box.o : box.r
}

function faceLength(box: LogicalBox, face: number): number {
  return isRankFace(face) ? box.oSize : box.rSize
}

// The port at `along` on `face`: where the line through it across the face
// first meets the node's shape, coming in from the face. Without a shape,
// or where the line misses it, the port sits on the face. A shape whose
// rounded corners grew it past the box can only bring the port in, never
// out past the face.
function facePoint(
  box: LogicalBox,
  face: number,
  along: number,
  shape: SolveShape | undefined,
): LogicalPoint {
  const rank = isRankFace(face)
  // The axis the line runs along, and the one it holds at `along`.
  const axis = rank ? 1 : 0
  const held = rank ? 0 : 1
  const fromStart = face === RANK_START || face === ORDER_START
  const edge =
    face === RANK_START
      ? box.r
      : face === RANK_END
        ? box.r + box.rSize
        : face === ORDER_START
          ? box.o
          : box.o + box.oSize
  let hit: number | undefined
  const meet = (value: number): void => {
    if (hit === undefined || (fromStart ? value < hit : value > hit)) {
      hit = value
    }
  }
  for (const corners of shape?.outlines ?? []) {
    const arcs = cornerArcs(corners, (shape as SolveShape).radius)
    for (const [i, corner] of corners.entries()) {
      const next = (i + 1) % corners.length
      // The side from this corner to the next, between their arcs. An end
      // on the line meets it. Otherwise the side meets it where its ends
      // lie on either side.
      const a = arcs[i]?.end ?? corner
      const b = arcs[next]?.start ?? (corners[next] as LogicalPoint)
      const aOn = coincident(a[held], along)
      const bOn = coincident(b[held], along)
      if (aOn) {
        meet(a[axis])
      }
      if (bOn) {
        meet(b[axis])
      }
      if (!aOn && !bOn && a[held] < along !== b[held] < along) {
        meet(a[axis] + ((along - a[held]) * (b[axis] - a[axis])) / (b[held] - a[held]))
      }
      // The arc that rounds this corner meets the line where its circle
      // does, on the corner's side of its tangent points. A line that
      // grazes the circle touches it.
      const arc = arcs[i]
      if (arc !== undefined) {
        const offset = along - arc.center[held]
        const squared = arc.radius * arc.radius - offset * offset
        if (squared >= 0 || coincident(Math.abs(offset), arc.radius)) {
          const root = Math.sqrt(Math.max(squared, 0))
          for (const value of [arc.center[axis] - root, arc.center[axis] + root]) {
            if (onArc(arc, axis === 0 ? [value, along] : [along, value])) {
              meet(value)
            }
          }
        }
      }
    }
  }
  const depth = hit === undefined ? edge : fromStart ? Math.max(hit, edge) : Math.min(hit, edge)
  return rank ? [along, depth] : [depth, along]
}

// Positions for `count` ports on a face: `gap` apart around the center when
// they fit, otherwise evenly spread over the face.
function spread(count: number, start: number, length: number, gap: number): Array<number> {
  const center = start + length / 2
  const span = (count - 1) * gap
  const fits = span <= length || coincident(span, length)
  const positions: Array<number> = []
  for (let i = 0; i < count; i++) {
    positions.push(
      fits ? center + (i - (count - 1) / 2) * gap : start + ((i + 1) * length) / (count + 1),
    )
  }
  return positions
}

// One end of an edge's chain: the node, its port face and position, its
// stub (the length its flow adornments take straight out of the port), the
// least size of the edge's corners, the direction the edge leaves it in (1
// downstream from the upper end, -1 upstream from the lower end), and the
// order-axis position of the next element along the edge.
interface End {
  readonly j: number
  readonly node: number
  readonly face: number
  readonly at: number
  readonly stub: number
  readonly corner: number
  readonly direction: 1 | -1
  readonly toward: number
}

// The face of an end's node that points along its edge.
function towardFace(end: End): number {
  return end.direction > 0 ? RANK_END : RANK_START
}

// Whether an end sits on the face pointing away from its edge, so that the
// edge wraps around the node.
function isWrap(end: End): boolean {
  return isRankFace(end.face) && end.face !== towardFace(end)
}

// Orders ports that share a face by where their edges head, then by edge
// order.
function byToward(a: End, b: End): number {
  return coincident(a.toward, b.toward) ? a.j - b.j : a.toward - b.toward
}

// Sorts wraps to the end of a rank face nearest the side they go around: -1
// for the order-start side, 1 for the order-end side, 0 for other ports.
function wrapRank(end: End, sideOf: (end: End) => number): number {
  if (!isWrap(end)) {
    return 0
  }
  return sideOf(end) === ORDER_START ? -1 : 1
}

// The position along its face of each port on rank faces (`rankFaces`) or on
// order faces. Fixed positions resolve directly. Auto positions on a shared
// face spread around its center in the order `compare` gives. Ports that
// `aside` picks spread on past the others, so the others stay centered,
// when that still fits on the face. On a face with fixed ports, the spread
// counts them too: each fixed port claims the free slot nearest it, and the
// auto ports take the rest, so no auto port lands on a fixed one.
function placePorts(
  ends: ReadonlyArray<readonly [End, End]>,
  boxOf: (node: number) => LogicalBox,
  rankFaces: boolean,
  gap: number,
  compare: (a: End, b: End) => number,
  aside: (end: End) => boolean = () => false,
): Map<End, number> {
  const along = new Map<End, number>()
  const groups = new Map<string, { auto: Array<End>; fixed: Array<number> }>()
  for (const pair of ends) {
    for (const end of pair) {
      if (isRankFace(end.face) !== rankFaces) {
        continue
      }
      const key = `${end.node}:${end.face}`
      let group = groups.get(key)
      if (group === undefined) {
        group = { auto: [], fixed: [] }
        groups.set(key, group)
      }
      if (Number.isFinite(end.at)) {
        const box = boxOf(end.node)
        const position = faceStart(box, end.face) + end.at * faceLength(box, end.face)
        along.set(end, position)
        group.fixed.push(position)
      } else {
        group.auto.push(end)
      }
    }
  }
  for (const { auto, fixed } of groups.values()) {
    const first = auto[0]
    if (first === undefined) {
      continue
    }
    auto.sort(compare)
    const box = boxOf(first.node)
    const start = faceStart(box, first.face)
    const length = faceLength(box, first.face)
    let positions = spread(auto.length + fixed.length, start, length, gap)

    if (fixed.length > 0) {
      for (const position of fixed.toSorted((a, b) => a - b)) {
        let nearest = 0
        for (let i = 1; i < positions.length; i++) {
          const distance = Math.abs((positions[i] as number) - position)
          if (distance < Math.abs((positions[nearest] as number) - position)) {
            nearest = i
          }
        }
        positions.splice(nearest, 1)
      }
    } else {
      const core = auto.flatMap((end, i) => (aside(end) ? [] : [i]))
      if (core.length > 0 && core.length < auto.length) {
        const low = positions[core[0] as number] as number
        const high = positions[core[core.length - 1] as number] as number
        const shift = start + length / 2 - (low + high) / 2
        const shifted = positions.map((position) => position + shift)
        const from = shifted[0] as number
        const to = shifted[shifted.length - 1] as number
        if (
          (from >= start || coincident(from, start)) &&
          (to <= start + length || coincident(to, start + length))
        ) {
          positions = shifted
        }
      }
    }

    for (const [i, end] of auto.entries()) {
      along.set(end, positions[i] as number)
    }
  }
  return along
}

interface Columns {
  // The room the columns take beside each node, before and after it across
  // the flow.
  readonly before: ReadonlyArray<number>
  readonly after: ReadonlyArray<number>
  // The distance from its node's face of each end's column, per edge, for
  // the upper and lower end. Ends without a column hold `NaN`.
  readonly offsets: ReadonlyArray<readonly [number, number]>
  // The columns on each side of each node that stack outward, each from the
  // inside out. Columns in different stacks never share a run.
  readonly stacks: ReadonlyArray<{
    readonly node: number
    readonly side: number
    readonly ends: ReadonlyArray<End>
  }>
  // Whether any node has a column.
  readonly used: boolean
}

// Assigns the columns beside each node, the runs of orthogonal routes that
// leave the node through an order face or wrap around it. On each side,
// `compare` orders them from the inside out. Edges from ports on the order
// face that head upstream run above their ports and edges heading
// downstream below, so with only auto ports on the face (which keep the
// upstream group above the downstream one) the two groups share columns.
// Wraps run the whole length of the node and take columns of their own, as
// does every edge beside a fixed port, which can sit anywhere on the face.
// The first column sits half of `nodeGap` plus half of `edgeGap` out from
// the face, outside any self loops, and the columns sit `edgeGap` apart. A
// column moves farther out to keep its port's stub straight, and room for
// the corner after it.
function assignColumns(
  ends: ReadonlyArray<readonly [End, End]>,
  sideOf: (end: End) => number,
  compare: (a: End, b: End) => number,
  loopsBefore: ReadonlyArray<number>,
  loopsAfter: ReadonlyArray<number>,
  sizes: { readonly nodeCount: number; readonly nodeGap: number; readonly edgeGap: number },
): Columns {
  const before = Array.from({ length: sizes.nodeCount }, () => 0)
  const after = Array.from({ length: sizes.nodeCount }, () => 0)
  const offsets = ends.map((): [number, number] => [Number.NaN, Number.NaN])

  const groups = new Map<string, { node: number; side: number; members: Array<End> }>()
  for (const pair of ends) {
    for (const end of pair) {
      if (isRankFace(end.face) && !isWrap(end)) {
        continue
      }
      const side = sideOf(end)
      const key = `${end.node}:${side}`
      let group = groups.get(key)
      if (group === undefined) {
        group = { node: end.node, side, members: [] }
        groups.set(key, group)
      }
      group.members.push(end)
    }
  }

  let used = false
  const stacks: Array<{ node: number; side: number; ends: Array<End> }> = []
  for (const { node, side, members } of groups.values()) {
    const sorted = members.toSorted(compare)
    const shared = sorted.every((end) => !isWrap(end) && !Number.isFinite(end.at))
    const loopCount = (side === ORDER_END ? loopsAfter : loopsBefore)[node] as number
    const base = (sizes.nodeGap + sizes.edgeGap) / 2 + loopCount * sizes.edgeGap
    let outer = base - sizes.edgeGap
    for (const stack of shared
      ? [sorted.filter((end) => end.direction < 0), sorted.filter((end) => end.direction > 0)]
      : [sorted]) {
      let offset = base - sizes.edgeGap
      for (const end of stack) {
        offset = Math.max(offset + sizes.edgeGap, isWrap(end) ? 0 : end.stub + end.corner)
        ;(offsets[end.j] as [number, number])[end.direction > 0 ? 0 : 1] = offset
      }
      outer = Math.max(outer, offset)
    }
    ;(side === ORDER_END ? after : before)[node] = outer + sizes.edgeGap - base
    if (shared) {
      stacks.push(
        { node, side, ends: sorted.filter((end) => end.direction < 0) },
        { node, side, ends: sorted.filter((end) => end.direction > 0) },
      )
    } else {
      stacks.push({ node, side, ends: sorted })
    }
    used = true
  }

  return { before, after, offsets, stacks, used }
}

function selfLoop(
  box: LogicalBox,
  shape: SolveShape | undefined,
  edge: SolveEdge,
  k: number,
  count: number,
  edgeGap: number,
): Array<LogicalPoint> {
  const inflate = (k + 1) * edgeGap
  const fraction = (k + 1) / (count + 1)
  const sourceFace = edge.sourcePort.face >= 0 ? edge.sourcePort.face : ORDER_END
  const targetFace = edge.targetPort.face >= 0 ? edge.targetPort.face : ORDER_END
  const sameFace = sourceFace === targetFace

  const portAlong = (port: SolvePort, face: number, sign: -1 | 1): number => {
    const start = faceStart(box, face)
    const length = faceLength(box, face)
    if (Number.isFinite(port.at)) {
      return start + port.at * length
    }
    return start + length / 2 + (sameFace ? (sign * fraction * length) / 2 : 0)
  }

  const source = facePoint(box, sourceFace, portAlong(edge.sourcePort, sourceFace, -1), shape)
  const target = facePoint(box, targetFace, portAlong(edge.targetPort, targetFace, 1), shape)

  const o0 = box.o - inflate
  const o1 = box.o + box.oSize + inflate
  const r0 = box.r - inflate
  const r1 = box.r + box.rSize + inflate

  const stubFor = ([o, r]: LogicalPoint, face: number): LogicalPoint => {
    switch (face) {
      case RANK_START:
        return [o, r0]
      case RANK_END:
        return [o, r1]
      case ORDER_END:
        return [o1, r]
      default:
        return [o0, r]
    }
  }
  const corners: ReadonlyArray<LogicalPoint> = [
    [o1, r0],
    [o1, r1],
    [o0, r1],
    [o0, r0],
  ]

  const points: Array<LogicalPoint> = [source, stubFor(source, sourceFace)]
  for (let face = sourceFace; face !== targetFace; face = (face + 1) % 4) {
    points.push(corners[face] as LogicalPoint)
  }
  points.push(stubFor(target, targetFace), target)

  return simplify(points)
}

// Drops repeated points and the middle point of axis-aligned runs. Both
// checks use `coincident`, as they decide whether two computed coordinates
// are the same. A route always keeps both of its ends, even when they
// coincide (a zero rank gap can put touching ports at one point).
function simplify(points: ReadonlyArray<LogicalPoint>): Array<LogicalPoint> {
  const result: Array<LogicalPoint> = []
  for (const point of points) {
    const last = result[result.length - 1]
    if (last !== undefined && coincident(last[0], point[0]) && coincident(last[1], point[1])) {
      continue
    }
    const previous = result[result.length - 2]
    if (
      previous !== undefined &&
      last !== undefined &&
      ((coincident(previous[0], last[0]) && coincident(last[0], point[0])) ||
        (coincident(previous[1], last[1]) && coincident(last[1], point[1])))
    ) {
      result[result.length - 1] = point
      continue
    }
    result.push(point)
  }
  const end = points[points.length - 1]
  if (result.length === 1 && end !== undefined) {
    result.push(end)
  }
  return result
}
