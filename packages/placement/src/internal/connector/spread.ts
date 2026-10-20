import { coincident } from 'curvy/number'
import type * as Rect from '../../rect.ts'
import { before } from '../../utils/tolerance.ts'
import { type DirectedEdge, preferredOrder } from '../graph/acyclic.ts'
import { type XY, outward, sideAxis } from '../orient.ts'
import { firstTurn, partingSide } from './nudge.ts'
import {
  type EdgeEnd,
  type Port,
  type Problem,
  type ProblemEdge,
  MERGE_NEAR,
  alongSide,
  endId,
  portAlong,
  portOf,
} from './problem.ts'
import { routeAll } from './routing.ts'
import type { Sides } from './sides.ts'

// The port placement phase. Fixed positions resolve directly. The auto
// positions that share a side spread out along it in the order the trial
// routes take: routed from the middle of the side, where two of them part,
// the one that parts toward an end of the side gets the port nearer that
// end, so the routes nest instead of crossing at the rect. Ends that merge
// group: those with the same adornments at the end, on one side, and,
// with `near`, next to each other in the order with routes that come in
// from the same way. Each end of a group keeps its own port, and the
// group's ports sit next to each other in that order, their strokes the
// merge gap apart. The groups and the lone ends spread along the side
// with as much free space between each two of them as at either end, as
// flex items do with `space-evenly`, so a side without groups spreads its
// ends evenly. Ends pinned to one spot with the same adornments group
// there whenever merging is on, centered on the spot as far as the side
// allows. A group too wide for its side packs its ports closer, in
// proportion, until it fits.

/** An end of an edge on a side that other ends may share. */
export interface SharedEnd {
  readonly edge: number
  readonly end: number
  readonly rect: number
  readonly side: number
  /** Where the rect at the edge's other end sits along the side. */
  readonly key: number
}

/** Ends that group on one side, in the order of their ports along it. */
export interface Group {
  readonly ends: ReadonlyArray<SharedEnd>
}

/** A group too wide for its side, whose ports pack closer to fit. */
export interface Cramped {
  /** The ends of the group. */
  readonly ends: ReadonlyArray<EdgeEnd>
  readonly rect: number
  readonly side: number
  /** How much longer the side would have to be for the group's gaps. */
  readonly need: number
}

/** The ports of every edge, and the groups among them. */
export interface Ports {
  /** The source and target port of each edge. */
  readonly ports: Array<[Port, Port]>
  /**
   * The coordinate along its side of each end that shares a side, or that
   * groups at a spot it is pinned to, by end id: x on the top and bottom,
   * y on the left and right.
   */
  readonly positions: ReadonlyMap<number, number>
  /** The groups, with their ends in port order. */
  readonly groups: ReadonlyArray<Group>
  /** The groups too wide for their sides. */
  readonly cramped: ReadonlyArray<Cramped>
  /** The ends with an auto position, by the rect and side they share. */
  readonly shared: ReadonlyMap<number, ReadonlyArray<SharedEnd>>
  /** The trial routes, with those found for the shared sides added. */
  readonly trial: ReadonlyArray<ReadonlyArray<XY> | undefined>
}

/**
 * Places the ports of a problem's edges on their chosen sides.
 *
 * @param problem - The problem.
 * @param chosen - The sides, and the trial routes found choosing them.
 * @returns The ports, positions, groups, and shared sides.
 */
export function placePorts(problem: Problem, chosen: Sides): Ports {
  const { edges, boxes, settings } = problem
  const { sides, tried } = chosen
  const trial = [...chosen.trial]
  const merging = settings.merge !== 0
  const keyOf = (end: SharedEnd) => (edges[end.edge] as ProblemEdge).ends[end.end]?.key

  // Ends pinned to one spot on a side, with the same adornments there.
  const pinned: Array<{ ends: Array<SharedEnd>; at: number }> = []
  if (merging) {
    for (const [i, edge] of edges.entries()) {
      for (const end of [0, 1]) {
        const { at, key } = edge.ends[end] as ProblemEdge['ends'][number]
        if (at === undefined || key === undefined) {
          continue
        }
        const side = (sides[i] as readonly [number, number])[end] as number
        const rect = (edge.ends[end] as ProblemEdge['ends'][number]).rect
        const far = boxes[(edge.ends[1 - end] as ProblemEdge['ends'][number]).rect] as Rect.Rect
        const shared: SharedEnd = {
          edge: i,
          end,
          rect,
          side,
          key: sideAxis(side) === 0 ? far.centerX : far.centerY,
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
  const pinnedGroups = pinned.filter((group) => group.ends.length > 1)

  // The ports, with auto positions spread along shared sides. Edges on a
  // shared side without a trial route yet get one from the middle of their
  // sides.
  const shared = sharedSides(problem, sides)
  const needed = new Set([
    ...[...shared.values()].flatMap((list) =>
      list.length > 1 ? list.map(({ edge }) => edge) : [],
    ),
    ...pinnedGroups.flatMap((group) => group.ends.map(({ edge }) => edge)),
  ])
  const missing = [...needed].filter((i) => !tried.has(i)).toSorted((a, b) => a - b)
  if (missing.length > 0) {
    const { routes: routed } = routeAll(problem, portsAt(problem, sides, new Map()), missing)
    for (const i of missing) {
      trial[i] = routed[i]
    }
  }
  const walkedOut = (end: SharedEnd) => {
    const route = trial[end.edge]
    return route === undefined || end.end === 0 ? route : [...route].toReversed()
  }
  const { positions, groups, cramped } = spread(
    problem,
    shared,
    trial,
    merging ? keyOf : () => undefined,
    settings.merge === MERGE_NEAR
      ? (a, b) => {
          const p = walkedOut(a)
          const q = walkedOut(b)
          return p !== undefined && q !== undefined && firstTurn(p) * firstTurn(q) >= 0
        }
      : undefined,
  )
  // A pinned group centers on its spot, as far as its side allows.
  for (const group of pinnedGroups) {
    const ends = orderEnds(group.ends, trial)
    const { rect, side } = ends[0] as SharedEnd
    const length = sideLength(boxes[rect] as Rect.Rect, side)
    const fit = fitted(problem, [ends], length)
    if (fit.need > 0) {
      cramped.push({ ends, rect, side, need: fit.need })
    }
    const [offsets] = fit.offsets as [Array<number>]
    const half = (offsets.at(-1) as number) / 2
    const box = boxes[rect] as Rect.Rect
    const low = alongSide(box, side, 0) + half
    const center = Math.min(Math.max(alongSide(box, side, group.at), low), low + length - 2 * half)
    for (const [k, { edge, end }] of ends.entries()) {
      positions.set(endId(edge, end), center - half + (offsets[k] as number))
    }
    groups.push({ ends })
  }
  return { ports: portsAt(problem, sides, positions), positions, groups, cramped, shared, trial }
}

// The ends with an auto position, by the rect and side they share.
function sharedSides(
  problem: Problem,
  sides: ReadonlyArray<readonly [number, number]>,
): Map<number, Array<SharedEnd>> {
  const shared = new Map<number, Array<SharedEnd>>()
  for (const [i, edge] of problem.edges.entries()) {
    for (const end of [0, 1]) {
      const { rect, at } = edge.ends[end] as ProblemEdge['ends'][number]
      if (at !== undefined) {
        continue
      }
      const side = (sides[i] as readonly [number, number])[end] as number
      const far = problem.boxes[
        (edge.ends[1 - end] as ProblemEdge['ends'][number]).rect
      ] as Rect.Rect
      const key = sideAxis(side) === 0 ? far.centerX : far.centerY
      const group = rect * 4 + side
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
  const walked = list.map(({ edge, end }) => {
    const route = trial[edge]
    return route === undefined || end === 0 ? route : [...route].toReversed()
  })
  const side = (list[0] as SharedEnd).side
  const [hx, hy] = outward(side)
  // The left of travel along the heading, with the Y axis down, is
  // (y, -x), and whether it points up or down the side's positions.
  const leftward = sideAxis(side) === 0 ? Math.sign(hy) : Math.sign(-hx)
  const preferred: Array<DirectedEdge> = []
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const p = walked[a]
      const q = walked[b]
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

// The ends that sit together along a side, a group or a lone end, and
// their places in its order.
interface Slot {
  readonly ends: Array<SharedEnd>
  readonly ranks: Array<number>
}

const rankSum = (slot: Slot) => slot.ranks.reduce((total, rank) => total + rank, 0)

// The length of a side of a rect.
const sideLength = (box: Rect.Rect, side: number) => (sideAxis(side) === 0 ? box.width : box.height)

// Where the ends of each group sit along a side `length` long, from the
// first: their strokes the merge gap apart, or, where the groups together
// are longer than the side, closer by the same share, so that they fit.
// `need` is how much longer the side would have to be, or `0`.
function fitted(
  problem: Problem,
  groups: ReadonlyArray<ReadonlyArray<SharedEnd>>,
  length: number,
): { offsets: Array<Array<number>>; need: number } {
  const stroke = (end: SharedEnd) => (problem.edges[end.edge] as ProblemEdge).thickness
  const spans = groups.map((ends) => {
    const offsets = [0]
    for (let k = 1; k < ends.length; k++) {
      const [a, b] = [ends[k - 1] as SharedEnd, ends[k] as SharedEnd]
      offsets.push((offsets[k - 1] as number) + problem.mergeGap + (stroke(a) + stroke(b)) / 2)
    }
    return offsets
  })
  const total = spans.reduce((sum, offsets) => sum + (offsets.at(-1) as number), 0)
  if (!before(length, total)) {
    return { offsets: spans, need: 0 }
  }
  const scale = (offset: number) => (length > 0 ? (offset * length) / total : 0)
  return { offsets: spans.map((offsets) => offsets.map(scale)), need: total - length }
}

// The coordinates along their side of the ends that share one, keyed by
// end id, the groups among them, and those too wide for their
// sides. Ends with the same merge key group, at the mean of their places
// in the order (see `orderEnds`), or, with `together`, only a run of them
// in a row whose routes come in together, each with the one before it.
// The groups and lone ends spread along the side with equal free space
// between each two and at both ends, a group as wide as its ports.
function spread(
  problem: Problem,
  shared: ReadonlyMap<number, ReadonlyArray<SharedEnd>>,
  trial: ReadonlyArray<ReadonlyArray<XY> | undefined>,
  mergeKey: (end: SharedEnd) => string | undefined,
  together: ((a: SharedEnd, b: SharedEnd) => boolean) | undefined,
): { positions: Map<number, number>; groups: Array<Group>; cramped: Array<Cramped> } {
  const positions = new Map<number, number>()
  const groups: Array<Group> = []
  const cramped: Array<Cramped> = []
  for (const list of shared.values()) {
    const ordered = orderEnds(list, trial)
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
    const { rect, side } = ordered[0] as SharedEnd
    const length = sideLength(problem.boxes[rect] as Rect.Rect, side)
    const fit = fitted(
      problem,
      slots.map(({ ends }) => ends),
      length,
    )
    const widths = fit.offsets.map((offsets) => offsets.at(-1) as number)
    // The free space between each two slots and at both ends: the whole
    // side, less the slots' widths, shared out evenly. Without groups, the
    // slots sit at `(k + 1) / (n + 1)` of the side.
    const width = widths.reduce((sum, w) => sum + w, 0)
    const box = problem.boxes[rect] as Rect.Rect
    const low = alongSide(box, side, 0)
    let taken = 0
    for (const [k, slot] of slots.entries()) {
      const start =
        width === 0
          ? alongSide(box, side, (k + 1) / (slots.length + 1))
          : low + ((k + 1) * (length - width)) / (slots.length + 1) + taken
      const offsets = fit.offsets[k] as Array<number>
      for (const [m, { edge, end }] of slot.ends.entries()) {
        positions.set(endId(edge, end), start + (offsets[m] as number))
      }
      taken += widths[k] as number
      if (slot.ends.length > 1) {
        groups.push({ ends: slot.ends })
        if (fit.need > 0) {
          cramped.push({ ends: slot.ends, rect, side, need: fit.need })
        }
      }
    }
  }
  return { positions, groups, cramped }
}

// The ports of every edge, at their coordinates in `positions`, or the
// positions the edges give, or the middle of the side.
function portsAt(
  problem: Problem,
  sides: ReadonlyArray<readonly [number, number]>,
  positions: ReadonlyMap<number, number>,
): Array<[Port, Port]> {
  return problem.edges.map((edge, i) => {
    const port = (end: number) => {
      const { rect, at } = edge.ends[end] as ProblemEdge['ends'][number]
      const side = (sides[i] as readonly [number, number])[end] as number
      const on = positions.get(endId(i, end))
      return on === undefined
        ? portOf(problem, rect, side, at ?? 0.5)
        : portAlong(problem, rect, side, on)
    }
    return [port(0), port(1)]
  })
}
