import { clamp, coincident } from 'curvy/number'
import * as Track from '../../track.ts'
import {
  type Axis,
  type LogicalPoint,
  type RunItem,
  type Sign,
  type SolveAdornment,
  measure,
  runLength,
} from '../adornments.ts'
import { findReversed } from '../graph/acyclic.ts'
import type { LayeredGraph, Segment } from './graph.ts'
import { order } from './order.ts'
import { type Extent, position, separate } from './position.ts'
import { type RankEdge, rank } from './rank.ts'

// The placement half of the layered layout. It works in logical
// coordinates: `o` runs along the order axis (across the flow) and `r`
// along the rank axis (with the flow, starting at 0). The public module
// resolves frames and edges into these logical inputs, maps the placed
// boxes back to physical space, and routes the edges with the connector,
// which takes the boxes as obstacles, the waypoints through the slots that
// ordering reserved for each edge, and the faces its ports sit on. Where
// the connector's notes say a channel or a gap between nodes was too
// narrow for its routes, the public module grows it and places again.
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
  // The least each corner reaches along its legs, finite and at least 0,
  // which the channels keep room for.
  readonly radius: number
  // The adornments in logical terms, for the room they take.
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

export type { LogicalPoint }

/**
 * What a placement grew, past what its inputs ask for, to fit the routes
 * of the placement before it.
 */
export interface Growth {
  /**
   * The extra size of each channel, by channel index: channel `k` follows
   * rank `k`, and channel `-1` precedes the first rank.
   */
  readonly channels: ReadonlyMap<number, number>
  /**
   * The extra separation between two nodes in one rank, keyed by
   * `a * nodeCount + b` for node indices `a < b`.
   */
  readonly pairs: ReadonlyMap<number, number>
  /** The extra room on both sides of a node, by node index. */
  readonly beside: ReadonlyMap<number, number>
}

/** No growth. */
export const noGrowth: Growth = { channels: new Map(), pairs: new Map(), beside: new Map() }

/** A port, placed: its face, and its position along the face as a fraction. */
export interface PlacedPort {
  readonly face: number
  readonly at: number
}

/** The placed boxes, and what the routes need to know about the layering. */
export interface Placement {
  readonly nodes: ReadonlyArray<LogicalBox>
  /** The source and target port of each edge. */
  readonly ports: ReadonlyArray<readonly [PlacedPort, PlacedPort]>
  /**
   * How far each edge runs straight out of each of its ports, as
   * `[source, target]`: the length its flow adornments take there, and the
   * least its corner past them reaches.
   */
  readonly stubs: ReadonlyArray<readonly [number, number]>
  /**
   * The waypoints of each edge's route, from its source to its target: the
   * start and end of each band that the edge's dummies sit in, at the
   * dummy's position across the flow. Self loops have none.
   */
  readonly vias: ReadonlyArray<ReadonlyArray<LogicalPoint>>
  /** Whether each edge was reversed to break a cycle. */
  readonly reversed: ReadonlyArray<boolean>
  /** The rank of each node. */
  readonly ranks: ReadonlyArray<number>
  /** The end of the last rank band. Reversed directions mirror against it. */
  readonly rankExtent: number
}

interface Band {
  readonly start: number
  readonly end: number
}

/**
 * Places the nodes of a layered graph: ranks them, orders each rank,
 * positions them across the flow, and stacks each rank into a band along
 * it, with channels between the bands for the routes to jog in.
 *
 * @param nodes - The nodes.
 * @param edges - The edges, between nodes by index.
 * @param options - The gaps and the back edge style.
 * @param growth - What to grow past the gaps, from the routes of the
 * placement before.
 * @returns The placement.
 */
export function place(
  nodes: ReadonlyArray<SolveNode>,
  edges: ReadonlyArray<SolveEdge>,
  options: SolveOptions,
  growth: Growth = noGrowth,
): Placement {
  const nodeCount = nodes.length
  const { rankGap, nodeGap, edgeGap } = options
  // How far a route keeps from a node, which is where a route that leaves
  // a node sideways turns.
  const clearance = (nodeGap + edgeGap) / 2
  // How far past its port a route with a stub turns at the earliest: it
  // runs straight through the end of the stub and an edge gap on.
  const past = (stub: number): number => (stub > 0 ? stub + edgeGap : 0)
  // How far a route runs straight out of a port with a stub of `stub` and
  // corners that reach `corner` at least, so that the corner past the stub
  // has its room: the gap the turn keeps past the run covers a corner up
  // to the gap.
  const straightFor = (stub: number, corner: number): number => stub + Math.max(corner - edgeGap, 0)
  const straightOut = (end: End): number => straightFor(end.stub, end.corner)

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

  // The routes that run beside each node, on each of its order faces, and
  // the room they need there: each takes an edge gap, and the stub out of
  // a port on the face, with the corner after it, reaches past the
  // clearance where it is longer. Self loops wrap around their node on the
  // order faces they visit. The edges that leave a node sideways join
  // once a first positioning says which side each wrap goes around.
  interface Beside {
    readonly count: number
    readonly reach: number
  }
  const beside: Array<[before: Beside, after: Beside]> = nodes.map(() => [
    { count: 0, reach: 0 },
    { count: 0, reach: 0 },
  ])
  const runBeside = (node: number, side: number, out: number): void => {
    const pair = beside[node] as [Beside, Beside]
    const slot = side === ORDER_END ? 1 : 0
    const { count, reach } = pair[slot]
    pair[slot] = { count: count + 1, reach: Math.max(reach, out) }
  }
  const stubOf = (edge: SolveEdge, end: number, face: number): number =>
    packOf(edge.adornments, end, face, end === 0, options.mirror)
  for (const [node, list] of loops.entries()) {
    for (const edgeIndex of list) {
      const edge = edges[edgeIndex] as SolveEdge
      const sourceFace = edge.sourcePort.face >= 0 ? edge.sourcePort.face : ORDER_END
      const targetFace = edge.targetPort.face >= 0 ? edge.targetPort.face : ORDER_END
      for (const face of facesBetween(sourceFace, targetFace)) {
        if (!isRankFace(face)) {
          const stub = Math.max(
            face === sourceFace ? stubOf(edge, 0, face) : 0,
            face === targetFace ? stubOf(edge, 1, face) : 0,
          )
          runBeside(node, face, past(straightFor(stub, edge.radius)))
        }
      }
    }
  }
  // The edges that leave a node sideways run beside it in columns, outside
  // its loops, an edge gap apart from the inside out: each at least as far
  // out as its stub and the corner after it reach. The column of each end,
  // as how far past the clearance it runs, by edge and end.
  const columns = new Map<number, number>()
  const loopRoom = ({ count, reach }: Beside): number =>
    count * edgeGap + Math.max(reach - clearance, 0)
  const roomBeside: Array<[before: number, after: number]> = beside.map(([before, after]) => [
    loopRoom(before),
    loopRoom(after),
  ])

  // The room the routes of the placement before needed between two nodes
  // of a rank, split between the two.
  const placeIn = new Map<number, number>()
  for (const layer of layers) {
    for (const [k, element] of layer.entries()) {
      placeIn.set(element, k)
    }
  }
  const pairBefore: Array<number> = nodes.map(() => 0)
  const pairAfter: Array<number> = nodes.map(() => 0)
  for (const [key, extra] of growth.pairs) {
    const a = Math.floor(key / nodeCount)
    const b = key % nodeCount
    if (a >= nodeCount || b >= nodeCount || ranks[a] !== ranks[b]) {
      continue
    }
    const [left, right] = (placeIn.get(a) ?? 0) < (placeIn.get(b) ?? 0) ? [a, b] : [b, a]
    pairAfter[left] = (pairAfter[left] ?? 0) + extra / 2
    pairBefore[right] = (pairBefore[right] ?? 0) + extra / 2
  }
  for (const [node, extra] of growth.beside) {
    if (node < nodeCount) {
      pairBefore[node] = (pairBefore[node] ?? 0) + extra
      pairAfter[node] = (pairAfter[node] ?? 0) + extra
    }
  }

  // The order-axis extent of each element. Nodes reserve room beside them
  // for the routes that run there.
  const makeExtents = (): Array<Extent> =>
    ranks.map((_, element) => {
      if (element < nodeCount) {
        const node = nodes[element] as SolveNode
        const [before, after] = roomBeside[element] as [number, number]
        return {
          before: node.oSize / 2 + node.oStart + before + (pairBefore[element] as number),
          after: node.oSize / 2 + node.oEnd + after + (pairAfter[element] as number),
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

  let extents = makeExtents()
  let anchors = position(graph, layers, extents)

  // The ends of each chain: the node, its port face and position, the
  // length its flow adornments take straight out of the port, the least
  // size of its corners, the direction the edge leaves it in (1 downstream
  // from the upper end, -1 upstream from the lower end), and the order-axis
  // position of the next element along the edge.
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
          corner: edge.radius,
          direction: 1,
          toward: anchors[chain[1] as number] as number,
        },
        {
          j,
          node: chain[chain.length - 1] as number,
          face: lowerPort.face >= 0 ? lowerPort.face : RANK_START,
          at: lowerPort.at,
          stub: runLength(lowerItems),
          corner: edge.radius,
          direction: -1,
          toward: anchors[chain[chain.length - 2] as number] as number,
        },
      ]
    })

  // An edge that leaves a node through an order face, or around it from
  // the face pointing away, runs beside the node. A wrap (an end on the
  // face pointing away) goes around the node on the side of the next
  // element along its edge, decided once from a first positioning. The
  // edges beside a node reserve room there, an edge gap each, and
  // positioning runs again.
  const wrapSides: Array<[upper: number, lower: number]> = flowEdges.map(() => [-1, -1])
  const sideOf = (end: End): number =>
    isRankFace(end.face)
      ? (wrapSides[end.j] as [number, number])[end.direction > 0 ? 0 : 1]
      : end.face
  // Columns on one side of a node run from the inside out in the order of
  // where their edges head next, as crossing reduction ordered the elements
  // they continue through.
  const columnOrder = (a: End, b: End): number => {
    const outward = (end: End) => (sideOf(end) === ORDER_END ? end.toward : -end.toward)
    return coincident(a.toward, b.toward) ? a.j - b.j : outward(a) - outward(b)
  }
  {
    const ends = makeEnds()
    const stacks = new Map<number, Array<End>>()
    for (const pair of ends) {
      for (const end of pair) {
        if (isWrap(end)) {
          const center = anchors[end.node] as number
          const starts = end.toward < center && !coincident(end.toward, center)
          ;(wrapSides[end.j] as [number, number])[end.direction > 0 ? 0 : 1] = starts
            ? ORDER_START
            : ORDER_END
        }
        if (!isRankFace(end.face) || isWrap(end)) {
          const key = 2 * end.node + (sideOf(end) === ORDER_END ? 1 : 0)
          const stack = stacks.get(key) ?? []
          stack.push(end)
          stacks.set(key, stack)
        }
      }
    }
    // Edges from auto ports on an order face that head upstream run above
    // their ports and edges heading downstream below, so with only such
    // ports on the face the two groups share columns. Wraps run the whole
    // length of the node and take columns of their own, as does every
    // edge beside a fixed port, which can sit anywhere on the face.
    for (const [key, members] of stacks) {
      const node = Math.floor(key / 2)
      const slot = key % 2
      const sorted = members.toSorted(columnOrder)
      const shared = sorted.every((end) => !isWrap(end) && !Number.isFinite(end.at))
      const base = (roomBeside[node] as [number, number])[slot] as number
      let outer = base
      for (const stack of shared
        ? [sorted.filter((end) => end.direction < 0), sorted.filter((end) => end.direction > 0)]
        : [sorted]) {
        let offset = base - edgeGap
        for (const end of stack) {
          // A wrap's stub runs along the flow, so it turns at the clearance.
          const reach = isWrap(end) ? 0 : past(straightOut(end))
          offset = Math.max(offset + edgeGap, reach - clearance)
          columns.set(columnKey(end), offset)
        }
        outer = Math.max(outer, offset + edgeGap)
      }
      ;(roomBeside[node] as [number, number])[slot] = outer
    }
    if (stacks.size > 0) {
      extents = makeExtents()
      anchors = position(graph, layers, extents)
    }
  }

  // A node's box across the flow only. Ports on rank faces depend on
  // nothing else.
  const orderBox = (node: number): LogicalBox => {
    const { oSize } = nodes[node] as SolveNode
    return { o: (anchors[node] as number) - oSize / 2, r: 0, oSize, rSize: 0 }
  }
  // Ports on one face go in the order their edges head. On a rank face,
  // wraps sit at the end nearest the side they go around, and their turns
  // nest: the port nearest the side goes around first.
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
  // group's band edge goes out first, so the stubs never cross.
  const sideOrder = (a: End, b: End): number => {
    if (a.direction !== b.direction) {
      return a.direction - b.direction
    }
    return a.direction < 0 ? columnOrder(a, b) : columnOrder(b, a)
  }

  // Where an edge attaches to its node across the flow: at its port on the
  // face toward the edge, or at its column beside the node, out from the
  // face it leaves through, or the side it wraps around.
  const attachOf = (end: End, rankAlong: ReadonlyMap<End, number>): number => {
    if (end.face === towardFace(end)) {
      return rankAlong.get(end) as number
    }
    const center = anchors[end.node] as number
    const half = (nodes[end.node] as SolveNode).oSize / 2
    const out = half + clearance + (columns.get(columnKey(end)) ?? 0)
    return sideOf(end) === ORDER_END ? center + out : center - out
  }

  // Straighten toward the attachments, so that a run aligns with the port
  // its edge leaves or enters through and needs one jog. The jog sits by
  // the end that fans out: below a node with several edges leaving it,
  // above a node with several edges entering it.
  {
    const ends = makeEnds()
    const rankAlong = placePorts(ends, orderBox, true, edgeGap, rankOrder, isWrap)
    straighten(
      layers,
      anchors,
      extents,
      chains.map((chain, j) => {
        const [upper, lower] = ends[j] as [End, End]
        const fansOut = (down[chain[0] as number] as Array<number>).length > 1
        const fansIn = (up[chain[chain.length - 1] as number] as Array<number>).length > 1
        return {
          chain,
          upper: attachOf(upper, rankAlong),
          lower: attachOf(lower, rankAlong),
          preferUpper: fansIn && !fansOut,
        }
      }),
    )
  }

  // Ports. Fixed positions resolve directly. Auto positions on a shared face
  // spread around the face's center, ordered by where their edges head.
  // Ports on rank faces depend only on positions across the flow, so they
  // resolve before the rank bands do.
  const ends = makeEnds()
  const rankAlong = placePorts(ends, orderBox, true, edgeGap, rankOrder, isWrap)

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

  // The least size of each channel: room past each face for the straight
  // run out of every port on it, which the route turns an edge gap past,
  // and room beside each face a wrap turns past, with the clearance its
  // turn keeps from the node. Channel `k` lies after rank `k`, so channel
  // -1 is before the first rank.
  const minSizes = new Map<number, number>()
  const need = (channel: number, size: number): void => {
    minSizes.set(channel, Math.max(minSizes.get(channel) ?? 0, size))
  }
  for (const [j, chain] of chains.entries()) {
    const [upperEnd, lowerEnd] = ends[j] as [End, End]
    const xs = [attachOf(upperEnd, rankAlong)]
    for (let i = 1; i + 1 < chain.length; i++) {
      xs.push(anchors[chain[i] as number] as number)
    }
    xs.push(attachOf(lowerEnd, rankAlong))
    const upperRank = ranks[upperEnd.node] as number
    const lowerRank = ranks[lowerEnd.node] as number
    if (upperEnd.face === RANK_END) {
      need(upperRank, past(straightOut(upperEnd)) - faceInset(upperEnd.node, 1))
    }
    if (lowerEnd.face === RANK_START) {
      need(lowerRank - 1, past(straightOut(lowerEnd)) - faceInset(lowerEnd.node, -1))
    }
    if (isWrap(upperEnd)) {
      need(upperRank - 1, past(straightOut(upperEnd)) - faceInset(upperEnd.node, -1) + clearance)
    }
    if (isWrap(lowerEnd)) {
      need(lowerRank, past(straightOut(lowerEnd)) - faceInset(lowerEnd.node, 1) + clearance)
    }
  }
  // A self loop's stub out of a rank face turns in the channel past it.
  for (const [node, list] of loops.entries()) {
    for (const edgeIndex of list) {
      const edge = edges[edgeIndex] as SolveEdge
      for (const [end, port] of [edge.sourcePort, edge.targetPort].entries()) {
        const face = port.face >= 0 ? port.face : ORDER_END
        const out = straightFor(stubOf(edge, end, face), edge.radius)
        if (face === RANK_START) {
          need((ranks[node] as number) - 1, past(out) - faceInset(node, -1))
        } else if (face === RANK_END) {
          need(ranks[node] as number, past(out) - faceInset(node, 1))
        }
      }
    }
  }

  // Each channel is at least half a rank gap, and at least the clearance
  // the routes keep from the nodes of the rank before it, so that a stub
  // into the channel after it stays clear of them; and at least what its
  // stubs and corners need, and what the routes of the placement before
  // needed. The channels before the first band and after the last one take
  // no room unless a wrap turns there or the routes needed it.
  const channelSizes: Array<number> = []
  for (let channel = -1; channel < rankCount; channel++) {
    const outer = channel === -1 || channel === rankCount - 1
    const base = outer ? 0 : Math.max(rankGap / 2, clearance)
    channelSizes.push(
      Math.max(base, minSizes.get(channel) ?? 0) + (growth.channels.get(channel) ?? 0),
    )
  }

  // The bands and channels alternate along the flow.
  const items: Array<{ basis: number }> = []
  for (let channel = -1; channel < rankCount; channel++) {
    items.push({ basis: channelSizes[channel + 1] as number })
    if (channel + 1 < rankCount) {
      items.push({ basis: thicknesses[channel + 1] as number })
    }
  }
  const track = Track.sequence(items, { gap: 0 })
  const bands: Array<Band> = []
  for (const [k, interval] of track.intervals.entries()) {
    if (k % 2 === 1) {
      bands.push({ start: interval.start, end: interval.end })
    }
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
  const portOf = (end: End): PlacedPort => {
    if (Number.isFinite(end.at)) {
      return { face: end.face, at: end.at }
    }
    const box = nodeBoxes[end.node] as LogicalBox
    const along = (rankAlong.get(end) ?? orderAlong.get(end)) as number
    return { face: end.face, at: (along - faceStart(box, end.face)) / faceLength(box, end.face) }
  }

  // The waypoints of each edge: the start and end of the band of each of
  // its dummies that carries flow adornments, at the dummy's position, so
  // the route runs straight through the room the band keeps for them. The
  // other dummies steer nothing that the nodes around them do not: the
  // route is free there, and the routes beside it move it apart.
  const ports: Array<readonly [PlacedPort, PlacedPort]> = edges.map(() => [auto, auto])
  const stubs: Array<readonly [number, number]> = edges.map(() => [0, 0])
  const vias: Array<Array<LogicalPoint>> = edges.map(() => [])
  const edgeReversed: Array<boolean> = edges.map(() => false)
  for (const [j, chain] of chains.entries()) {
    const list: Array<LogicalPoint> = []
    for (let i = 1; i + 1 < chain.length; i++) {
      const element = chain[i] as number
      if ((dummyItems[element] ?? []).length === 0) {
        continue
      }
      const x = anchors[element] as number
      const { start, end } = band(element)
      list.push([x, start], [x, end])
    }
    const isReversed = reversed[j] as boolean
    const [upperEnd, lowerEnd] = ends[j] as [End, End]
    const index = flow[j] as number
    const [source, target] = isReversed ? [lowerEnd, upperEnd] : [upperEnd, lowerEnd]
    ports[index] = [portOf(source), portOf(target)]
    stubs[index] = [straightOut(source), straightOut(target)]
    vias[index] = isReversed ? list.toReversed() : list
    edgeReversed[index] = isReversed
  }

  // A self loop leaves and enters the order-end face unless told otherwise,
  // and the loops on one face of a node spread out from its center, each
  // farther than the one before, so they nest.
  for (const list of loops) {
    for (const [k, index] of list.entries()) {
      const edge = edges[index] as SolveEdge
      const sourceFace = edge.sourcePort.face >= 0 ? edge.sourcePort.face : ORDER_END
      const targetFace = edge.targetPort.face >= 0 ? edge.targetPort.face : ORDER_END
      const fraction = sourceFace === targetFace ? (k + 1) / (list.length + 1) : 0
      const at = (port: SolvePort, sign: number) =>
        Number.isFinite(port.at) ? port.at : 0.5 + (sign * fraction) / 2
      ports[index] = [
        { face: sourceFace, at: at(edge.sourcePort, -1) },
        { face: targetFace, at: at(edge.targetPort, 1) },
      ]
      stubs[index] = [
        straightFor(packOf(edge.adornments, 0, sourceFace, true, options.mirror), edge.radius),
        straightFor(packOf(edge.adornments, 1, targetFace, false, options.mirror), edge.radius),
      ]
    }
  }

  return {
    nodes: nodeBoxes,
    ports,
    stubs,
    vias,
    reversed: edgeReversed,
    ranks: nodeRanks,
    rankExtent,
  }
}

const auto: PlacedPort = { face: -1, at: Number.POSITIVE_INFINITY }

// The length the flow adornments at an end of an edge take straight out
// of a port on `face`.
function packOf(
  adornments: ReadonlyArray<SolveAdornment>,
  end: number,
  face: number,
  source: boolean,
  mirror: boolean,
): number {
  const [axis, away] = faceNormal(face)
  const sign = source ? away : (-away as Sign)
  return runLength(
    adornments.flatMap(
      (adornment, index): Array<RunItem> =>
        adornment.flow && coincident(adornment.at, end)
          ? [
              {
                index,
                at: adornment.at,
                layer: adornment.layer,
                measured: measure(adornment, axis, sign, mirror),
              },
            ]
          : [],
    ),
  )
}

function faceStart(box: LogicalBox, face: number): number {
  return isRankFace(face) ? box.o : box.r
}

function faceLength(box: LogicalBox, face: number): number {
  return isRankFace(face) ? box.oSize : box.rSize
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
  for (const { auto: free, fixed } of groups.values()) {
    const first = free[0]
    if (first === undefined) {
      continue
    }
    free.sort(compare)
    const box = boxOf(first.node)
    const start = faceStart(box, first.face)
    const length = faceLength(box, first.face)
    let positions = spread(free.length + fixed.length, start, length, gap)

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
      const core = free.flatMap((end, i) => (aside(end) ? [] : [i]))
      if (core.length > 0 && core.length < free.length) {
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

    for (const [i, end] of free.entries()) {
      along.set(end, positions[i] as number)
    }
  }
  return along
}

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

// The key of an end's column, by its edge and which end it is.
function columnKey(end: End): number {
  return 2 * end.j + (end.direction > 0 ? 0 : 1)
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
