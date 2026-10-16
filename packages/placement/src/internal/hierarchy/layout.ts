import { clamp, coincident } from 'curvy/number'
import * as Track from '../../track.ts'
import { findReversed } from './acyclic.ts'
import type { LayeredGraph, Segment } from './graph.ts'
import { type Jog, assignLanes } from './lanes.ts'
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
// ranks only, and the odd ranks between them hold edge dummies and labels.
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

export interface SolveLabel {
  readonly oSize: number
  readonly rSize: number
  readonly oStart: number
  readonly oEnd: number
  readonly rStart: number
  readonly rEnd: number
  // The side of the line: 0 before it, 1 after it, 0.5 centered on it.
  readonly align: number
  // The position along the edge, from the source (0) to the target (1).
  readonly at: number
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
  readonly labels: ReadonlyArray<SolveLabel>
}

// The routing encodings of `placement/hierarchy`.
export const ORTHOGONAL = 1

export interface SolveOptions {
  readonly rankGap: number
  readonly nodeGap: number
  readonly edgeGap: number
  readonly routing: number
}

export interface LogicalBox {
  readonly o: number
  readonly r: number
  readonly oSize: number
  readonly rSize: number
}

export type LogicalPoint = readonly [o: number, r: number]

export interface SolveResult {
  readonly nodes: ReadonlyArray<LogicalBox>
  readonly labels: ReadonlyArray<ReadonlyArray<LogicalBox>>
  readonly routes: ReadonlyArray<ReadonlyArray<LogicalPoint>>
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

  const rankEdges: Array<RankEdge> = flowEdges.map((edge, j) => ({
    tail: reversed[j] ? edge.target : edge.source,
    head: reversed[j] ? edge.source : edge.target,
    weight: edge.weight,
    minLength: 2 * Math.max(edge.minLength, edge.labels.length),
  }))
  const nodeRanks = rank(nodeCount, rankEdges)

  // Build the layered graph: real nodes, then one dummy per inner rank of
  // each edge. Label dummies take odd ranks along the chain.
  const ranks: Array<number> = [...nodeRanks]
  const dummy: Array<boolean> = nodes.map(() => false)
  const dummyLabel: Array<SolveLabel | undefined> = nodes.map(() => undefined)
  const segments: Array<Segment> = []
  const up: Array<Array<number>> = nodes.map(() => [])
  const down: Array<Array<number>> = nodes.map(() => [])
  const chains: Array<Array<number>> = []
  const labelElements: Array<Array<number>> = edges.map((edge) => edge.labels.map(() => -1))

  for (const [j, edge] of flowEdges.entries()) {
    const edgeIndex = flow[j] as number
    const isReversed = reversed[j] as boolean
    const upper = isReversed ? edge.target : edge.source
    const lower = isReversed ? edge.source : edge.target
    const upperPort = isReversed ? edge.targetPort : edge.sourcePort
    const lowerPort = isReversed ? edge.sourcePort : edge.targetPort
    const upperRank = nodeRanks[upper] as number
    const lowerRank = nodeRanks[lower] as number

    const slots = assignLabelSlots(edge.labels, isReversed, upperRank, lowerRank)

    const chain = [upper]
    for (let r = upperRank + 1; r < lowerRank; r++) {
      const element = ranks.length
      ranks.push(r)
      dummy.push(true)
      const labelIndex = slots.get(r)
      dummyLabel.push(labelIndex === undefined ? undefined : edge.labels[labelIndex])
      if (labelIndex !== undefined) {
        ;(labelElements[edgeIndex] as Array<number>)[labelIndex] = element
      }
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
        upperShift: i === 0 ? portShift(upperPort) : 0,
        lowerShift: i + 2 === chain.length ? portShift(lowerPort) : 0,
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

  // Self loops reserve room on the order faces they wrap around.
  const loopFaces = loops.map((list) =>
    list.map((edgeIndex) => {
      const edge = edges[edgeIndex] as SolveEdge
      return [
        edge.sourcePort.face >= 0 ? edge.sourcePort.face : ORDER_END,
        edge.targetPort.face >= 0 ? edge.targetPort.face : ORDER_END,
      ] as const
    }),
  )

  const extents: Array<Extent> = ranks.map((_, element) => {
    if (element < nodeCount) {
      const node = nodes[element] as SolveNode
      let reserveBefore = 0
      let reserveAfter = 0
      const faces = loopFaces[element] as ReadonlyArray<readonly [number, number]>
      const reserve = faces.length * edgeGap
      for (const [from, to] of faces) {
        const visited = facesBetween(from, to)
        if (visited.includes(ORDER_START)) {
          reserveBefore = reserve
        }
        if (visited.includes(ORDER_END)) {
          reserveAfter = reserve
        }
      }
      return {
        before: node.oSize / 2 + node.oStart + reserveBefore,
        after: node.oSize / 2 + node.oEnd + reserveAfter,
        gap: nodeGap / 2,
      }
    }
    const label = dummyLabel[element]
    if (label === undefined) {
      return { before: 0, after: 0, gap: edgeGap / 2 }
    }
    const outer = label.oStart + label.oSize + label.oEnd
    return { before: (1 - label.align) * outer, after: label.align * outer, gap: edgeGap / 2 }
  })

  const anchors = position(graph, layers, extents)

  const orthogonal = options.routing === ORTHOGONAL
  const stub = nodeGap / 2

  // The ends of each chain: the node, its port face and position, and the
  // order-axis position of the next element along the edge, which orders
  // ports that share a face.
  interface End {
    readonly j: number
    readonly node: number
    readonly face: number
    readonly at: number
    readonly toward: number
  }
  const makeEnds = (): Array<[upper: End, lower: End]> =>
    flowEdges.map((edge, j) => {
      const chain = chains[j] as Array<number>
      const isReversed = reversed[j] as boolean
      const upperPort = isReversed ? edge.targetPort : edge.sourcePort
      const lowerPort = isReversed ? edge.sourcePort : edge.targetPort
      return [
        {
          j,
          node: chain[0] as number,
          face: upperPort.face >= 0 ? upperPort.face : RANK_END,
          at: upperPort.at,
          toward: anchors[chain[1] as number] as number,
        },
        {
          j,
          node: chain[chain.length - 1] as number,
          face: lowerPort.face >= 0 ? lowerPort.face : RANK_START,
          at: lowerPort.at,
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

  // Where each edge leaves its upper node's band and enters its lower
  // node's band, across the flow.
  const exits = (ends: ReadonlyArray<[End, End]>, along: ReadonlyMap<End, number>) =>
    ends.map(
      ([upper, lower]) =>
        [
          exitO(orderBox(upper.node), upper.face, along.get(upper), 1, upper.toward, stub),
          exitO(orderBox(lower.node), lower.face, along.get(lower), -1, lower.toward, stub),
        ] as const,
    )

  if (orthogonal) {
    // Straighten toward the actual ports, so that a run aligns with the
    // port its edge leaves or enters through and needs one jog. The jog sits
    // by the end that fans out: below a node with several edges leaving it,
    // above a node with several edges entering it.
    const ends = makeEnds()
    const attach = exits(ends, placePorts(ends, orderBox, true, edgeGap))
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
      true,
    )
  } else {
    // Attachment points across the flow, for straightening. An edge
    // attaches to a node at its port when the port is fixed or on a side
    // face, and at the node's center otherwise.
    const attachment = (node: number, port: SolvePort, towardFace: number): number => {
      const center = anchors[node] as number
      const half = (nodes[node] as SolveNode).oSize / 2
      const face = port.face >= 0 ? port.face : towardFace
      if (face === ORDER_END) {
        return center + half + stub
      }
      if (face === ORDER_START) {
        return center - half - stub
      }
      if (face === towardFace && Number.isFinite(port.at)) {
        return center - half + port.at * 2 * half
      }
      return center
    }

    straighten(
      layers,
      anchors,
      extents,
      chains.map((chain, j) => {
        const edge = flowEdges[j] as SolveEdge
        const isReversed = reversed[j] as boolean
        return {
          chain,
          upper: attachment(
            chain[0] as number,
            isReversed ? edge.targetPort : edge.sourcePort,
            RANK_END,
          ),
          lower: attachment(
            chain[chain.length - 1] as number,
            isReversed ? edge.sourcePort : edge.targetPort,
            RANK_START,
          ),
          preferUpper: false,
        }
      }),
      false,
    )
  }

  // Ports. Fixed positions resolve directly. Auto positions on a shared face
  // spread around the face's center, ordered by where their edges head.
  // Ports on rank faces depend only on positions across the flow, so they
  // resolve before the rank bands do.
  const ends = makeEnds()
  const rankAlong = placePorts(ends, orderBox, true, edgeGap)

  // Orthogonal routing: the order-axis position of each chain at every rank
  // boundary, and the lane of each jog between two ranks.
  const crossings: Array<Array<number>> = []
  const jogLanes: Array<Array<number>> = []
  const laneCounts: Array<number> = []
  if (orthogonal) {
    const attach = exits(ends, rankAlong)
    const channelJogs = new Map<number, Array<{ j: number; i: number; jog: Jog }>>()
    for (const [j, chain] of chains.entries()) {
      const [upper, lower] = attach[j] as readonly [number, number]
      const xs = [upper]
      for (let i = 1; i + 1 < chain.length; i++) {
        xs.push(anchors[chain[i] as number] as number)
      }
      xs.push(lower)
      crossings.push(xs)
      jogLanes.push(xs.slice(1).map(() => -1))
      for (let i = 0; i + 1 < xs.length; i++) {
        const start = xs[i] as number
        const end = xs[i + 1] as number
        if (coincident(start, end)) {
          continue
        }
        const channel = ranks[chain[i] as number] as number
        let list = channelJogs.get(channel)
        if (list === undefined) {
          list = []
          channelJogs.set(channel, list)
        }
        list.push({ j, i, jog: { start, end } })
      }
    }
    for (let channel = 0; channel + 1 < rankCount; channel++) {
      const list = channelJogs.get(channel) ?? []
      const assigned = assignLanes(list.map(({ jog }) => jog))
      laneCounts.push(assigned.count)
      for (const [k, { j, i }] of list.entries()) {
        ;(jogLanes[j] as Array<number>)[i] = assigned.lanes[k] as number
      }
    }
  }

  // Rank bands. Each band is as thick as the outer size of its largest
  // element, and its elements stack inside it.
  const thicknesses: Array<number> = []
  const placements = new Map<number, { start: number; size: number }>()

  for (const layer of layers) {
    const items: Array<Track.StackItem> = []
    const owners: Array<number> = []
    let thickness = 0

    for (const element of layer) {
      const item = stackItem(element, nodeCount, nodes, dummyLabel)
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

  // The bands sit half a rank gap apart. With orthogonal routing, the space
  // between two bands is a channel that grows to fit its lanes, `edgeGap`
  // apart and from its bands.
  let bands: Array<Band>
  const channels: Array<Band> = []
  let rankExtent: number
  if (orthogonal) {
    const items: Array<{ basis: number }> = []
    for (const [r, basis] of thicknesses.entries()) {
      if (r > 0) {
        const lanes = laneCounts[r - 1] as number
        items.push({ basis: Math.max(rankGap / 2, (lanes + 1) * edgeGap) })
      }
      items.push({ basis })
    }
    const track = Track.sequence(items, { gap: 0 })
    bands = []
    for (const [k, interval] of track.intervals.entries()) {
      ;(k % 2 === 0 ? bands : channels).push({ start: interval.start, end: interval.end })
    }
    rankExtent = track.end
  } else {
    const bandTrack = Track.sequence(
      thicknesses.map((basis) => ({ basis })),
      { gap: rankGap / 2 },
    )
    bands = bandTrack.intervals.map((interval) => ({
      start: interval.start,
      end: interval.end,
    }))
    rankExtent = bandTrack.end
  }

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

  const labelBoxes: Array<Array<LogicalBox>> = edges.map((edge) => edge.labels.map(() => zeroBox))
  for (const [edgeIndex, elements] of labelElements.entries()) {
    for (const [labelIndex, element] of elements.entries()) {
      if (element === -1) {
        continue
      }
      const label = dummyLabel[element] as SolveLabel
      const extent = extents[element] as Extent
      const placement = placements.get(element) as { start: number; size: number }
      ;(labelBoxes[edgeIndex] as Array<LogicalBox>)[labelIndex] = {
        o: (anchors[element] as number) - extent.before + label.oStart,
        r: band(element).start + placement.start,
        oSize: label.oSize,
        rSize: placement.size,
      }
    }
  }

  // Ports on order faces run along the rank axis, so they resolve now.
  const orderAlong = placePorts(ends, (node) => nodeBoxes[node] as LogicalBox, false, edgeGap)
  const portPoint = (end: End): LogicalPoint =>
    facePoint(
      nodeBoxes[end.node] as LogicalBox,
      end.face,
      (rankAlong.get(end) ?? orderAlong.get(end)) as number,
    )

  const routes: Array<ReadonlyArray<LogicalPoint>> = edges.map(() => [])

  for (const [j, chain] of chains.entries()) {
    const [upperEnd, lowerEnd] = ends[j] as [End, End]
    const upperPath = endpointPath(
      nodeBoxes[upperEnd.node] as LogicalBox,
      band(upperEnd.node),
      upperEnd.face,
      portPoint(upperEnd),
      1,
      upperEnd.toward,
      options,
    )
    const lowerPath = endpointPath(
      nodeBoxes[lowerEnd.node] as LogicalBox,
      band(lowerEnd.node),
      lowerEnd.face,
      portPoint(lowerEnd),
      -1,
      lowerEnd.toward,
      options,
    )

    const middle: Array<LogicalPoint> = []
    for (let i = 0; i + 1 < chain.length; i++) {
      if (orthogonal) {
        const lane = (jogLanes[j] as Array<number>)[i] as number
        if (lane >= 0) {
          const xs = crossings[j] as Array<number>
          const channel = channels[ranks[chain[i] as number] as number] as Band
          const count = laneCounts[ranks[chain[i] as number] as number] as number
          const r = channel.start + ((lane + 1) * (channel.end - channel.start)) / (count + 1)
          middle.push([xs[i] as number, r], [xs[i + 1] as number, r])
        }
      }
      if (i + 2 < chain.length) {
        const element = chain[i + 1] as number
        const x = anchors[element] as number
        const elementBand = band(element)
        middle.push([x, elementBand.start], [x, elementBand.end])
      }
    }

    const points = simplify([...upperPath, ...middle, ...lowerPath.toReversed()])
    routes[flow[j] as number] = reversed[j] ? points.toReversed() : points
  }

  for (const [node, list] of loops.entries()) {
    const box = nodeBoxes[node] as LogicalBox
    for (const [k, edgeIndex] of list.entries()) {
      const edge = edges[edgeIndex] as SolveEdge
      const [route, labels] = selfLoop(box, edge, k, list.length, edgeGap)
      routes[edgeIndex] = route
      labelBoxes[edgeIndex] = labels
    }
  }

  return { nodes: nodeBoxes, labels: labelBoxes, routes, rankExtent }
}

const zeroBox: LogicalBox = { o: 0, r: 0, oSize: 0, rSize: 0 }

function finite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0
}

function stackItem(
  element: number,
  nodeCount: number,
  nodes: ReadonlyArray<SolveNode>,
  dummyLabel: ReadonlyArray<SolveLabel | undefined>,
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
  const label = dummyLabel[element]
  if (label === undefined) {
    return undefined
  }
  return {
    basis: label.rSize,
    start: label.rStart,
    end: label.rEnd,
    place: 0.5,
    stretch: 0,
  }
}

// Picks a distinct odd rank for each label, as close as possible to its
// position along the edge. Ranking guarantees at least one odd rank per
// label.
function assignLabelSlots(
  labels: ReadonlyArray<SolveLabel>,
  isReversed: boolean,
  upperRank: number,
  lowerRank: number,
): Map<number, number> {
  const slots = new Map<number, number>()
  if (labels.length === 0) {
    return slots
  }

  const length = lowerRank - upperRank
  const slotCount = length / 2
  const sorted = labels
    .map((label, index) => ({ index, at: isReversed ? 1 - label.at : label.at }))
    .toSorted((a, b) => a.at - b.at)

  let previous = -1
  for (const [i, { index, at }] of sorted.entries()) {
    const ideal = Math.round((Math.min(Math.max(at, 0), 1) * length - 1) / 2)
    const highest = slotCount - (sorted.length - i)
    const slot = Math.min(Math.max(ideal, previous + 1, 0), highest)
    slots.set(upperRank + 1 + 2 * slot, index)
    previous = slot
  }

  return slots
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
  // With orthogonal routing, whether a run aligns with its upper neighbor
  // before its lower one.
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
// For orthogonal routing, a run that can align with one of its neighbors
// does so instead (the preferred one first), so its edge needs one jog
// rather than two.
function straighten(
  layers: ReadonlyArray<ReadonlyArray<number>>,
  xs: Array<number>,
  extents: ReadonlyArray<Extent>,
  chains: ReadonlyArray<ChainAttachment>,
  orthogonal: boolean,
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
            if (orthogonal) {
              const first = attached.preferUpper ? above : below
              const second = attached.preferUpper ? below : above
              if (first >= low && first <= high) {
                target = first
              } else if (second >= low && second <= high) {
                target = second
              }
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

// The order-axis shift that crossing reduction applies at a port.
function portShift(port: SolvePort): number {
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

function facePoint(box: LogicalBox, face: number, along: number): LogicalPoint {
  switch (face) {
    case RANK_START:
      return [along, box.r]
    case RANK_END:
      return [along, box.r + box.rSize]
    case ORDER_END:
      return [box.o + box.oSize, along]
    default:
      return [box.o, along]
  }
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

// Where an edge leaves its node's rank band across the flow, on the side it
// travels toward (`direction` 1 is downstream, -1 upstream): at the port on
// the face toward that side, beside the node for ports on order faces, and
// around the node for ports on the face pointing away.
function exitO(
  box: LogicalBox,
  face: number,
  along: number | undefined,
  direction: 1 | -1,
  toward: number,
  stub: number,
): number {
  const towardFace = direction > 0 ? RANK_END : RANK_START
  if (face === towardFace) {
    return along as number
  }
  if (face === ORDER_END) {
    return box.o + box.oSize + stub
  }
  if (face === ORDER_START) {
    return box.o - stub
  }
  const center = box.o + box.oSize / 2
  const goEnd = !(toward < center && !coincident(toward, center))
  return goEnd ? box.o + box.oSize + stub : box.o - stub
}

interface PortEnd {
  readonly j: number
  readonly node: number
  readonly face: number
  readonly at: number
  readonly toward: number
}

// The position along its face of each port on rank faces (`rankFaces`) or on
// order faces. Fixed positions resolve directly. Auto positions on a shared
// face spread around its center, ordered by where their edges head, then by
// edge order.
function placePorts<E extends PortEnd>(
  ends: ReadonlyArray<readonly [E, E]>,
  boxOf: (node: number) => LogicalBox,
  rankFaces: boolean,
  gap: number,
): Map<E, number> {
  const along = new Map<E, number>()
  const groups = new Map<string, Array<E>>()
  for (const pair of ends) {
    for (const end of pair) {
      if (isRankFace(end.face) !== rankFaces) {
        continue
      }
      const box = boxOf(end.node)
      if (Number.isFinite(end.at)) {
        along.set(end, faceStart(box, end.face) + end.at * faceLength(box, end.face))
        continue
      }
      const key = `${end.node}:${end.face}`
      let group = groups.get(key)
      if (group === undefined) {
        group = []
        groups.set(key, group)
      }
      group.push(end)
    }
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (coincident(a.toward, b.toward) ? a.j - b.j : a.toward - b.toward))
    const first = group[0] as E
    const box = boxOf(first.node)
    const positions = spread(
      group.length,
      faceStart(box, first.face),
      faceLength(box, first.face),
      gap,
    )
    for (const [i, end] of group.entries()) {
      along.set(end, positions[i] as number)
    }
  }
  return along
}

// The path from a port to the edge of its node's rank band, on the side the
// edge travels toward (`direction` 1 is downstream, -1 upstream). Ports on
// the order faces step sideways first, and ports on the face pointing away
// from the edge step out and around the node.
function endpointPath(
  box: LogicalBox,
  band: Band,
  face: number,
  port: LogicalPoint,
  direction: 1 | -1,
  toward: number,
  options: SolveOptions,
): Array<LogicalPoint> {
  const towardFace = direction > 0 ? RANK_END : RANK_START
  const bandEdge = direction > 0 ? band.end : band.start
  const [o, r] = port
  const exit = exitO(box, face, o, direction, toward, options.nodeGap / 2)

  if (face === towardFace) {
    return [port, [o, bandEdge]]
  }

  if (face === ORDER_END || face === ORDER_START) {
    return [port, [exit, r], [exit, bandEdge]]
  }

  const awayEdge = direction > 0 ? band.start : band.end
  const stubR = awayEdge - (direction * options.rankGap) / 4
  return [port, [o, stubR], [exit, stubR], [exit, bandEdge]]
}

function selfLoop(
  box: LogicalBox,
  edge: SolveEdge,
  k: number,
  count: number,
  edgeGap: number,
): [Array<LogicalPoint>, Array<LogicalBox>] {
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

  const source = facePoint(box, sourceFace, portAlong(edge.sourcePort, sourceFace, -1))
  const target = facePoint(box, targetFace, portAlong(edge.targetPort, targetFace, 1))

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

  const route = simplify(points)
  const labels = edge.labels.map((label) => {
    const [o, r] = pointAlong(route, label.at)
    return {
      o: o - label.oSize / 2,
      r: r - label.rSize / 2,
      oSize: label.oSize,
      rSize: label.rSize,
    }
  })

  return [route, labels]
}

// The point at a fraction of a polyline's length.
function pointAlong(points: ReadonlyArray<LogicalPoint>, at: number): LogicalPoint {
  const lengths: Array<number> = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const [ao, ar] = points[i - 1] as LogicalPoint
    const [bo, br] = points[i] as LogicalPoint
    const length = Math.hypot(bo - ao, br - ar)
    lengths.push(length)
    total += length
  }

  let remaining = Math.min(Math.max(at, 0), 1) * total
  for (const [i, length] of lengths.entries()) {
    if (remaining <= length && length > 0) {
      const [ao, ar] = points[i] as LogicalPoint
      const [bo, br] = points[i + 1] as LogicalPoint
      const t = remaining / length
      return [ao + (bo - ao) * t, ar + (br - ar) * t]
    }
    remaining -= length
  }
  return points[points.length - 1] as LogicalPoint
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
