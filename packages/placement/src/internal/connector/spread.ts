import { coincident } from 'curvy/number'
import type * as Rect from '../../rect.ts'
import { type DirectedEdge, preferredOrder } from '../graph/acyclic.ts'
import { type XY, outward, sideAxis } from '../orient.ts'
import { firstTurn, partingSide } from './nudge.ts'
import { type Port, type Problem, type ProblemEdge, MERGE_NEAR, endId, portOf } from './problem.ts'
import { routeAll } from './routing.ts'
import type { Sides } from './sides.ts'

// The port placement phase. Fixed positions resolve directly. The auto
// positions that share a side spread out evenly along it, in the order the
// trial routes take: routed from the middle of the side, where two of them
// part, the one that parts toward an end of the side gets the port nearer
// that end, so the routes nest instead of crossing at the rect. Ends that
// merge take one spot among the others: those with the same adornments at
// the end, on one side, and, with `near`, next to each other in the order
// with routes that come in from the same way. Ends pinned to one spot with
// the same adornments merge there whenever merging is on.

/** An end of an edge on a side that other ends may share. */
export interface SharedEnd {
  readonly edge: number
  readonly end: number
  readonly rect: number
  readonly side: number
  /** Where the rect at the edge's other end sits along the side. */
  readonly key: number
}

/** Ends that merge, in the order of their lanes along the side, and their shared spot on it. */
export interface Merge {
  readonly ends: ReadonlyArray<SharedEnd>
  readonly at: number
}

/** The ports of every edge, and the groups and merges among them. */
export interface Ports {
  /** The source and target port of each edge. */
  readonly ports: Array<[Port, Port]>
  /** The auto position of each end that shares a side, by end id. */
  readonly positions: ReadonlyMap<number, number>
  /** The merges, with their ends in lane order. */
  readonly merges: ReadonlyArray<Merge>
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
 * @returns The ports, positions, merges, and shared sides.
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
  const pinnedMerges = pinned.filter((group) => group.ends.length > 1)

  // The ports, with auto positions spread along shared sides. Ends that
  // merge take one spot among the others. Edges on a shared side without a
  // trial route yet get one from the middle of their sides.
  const shared = sharedSides(problem, sides)
  const needed = new Set([
    ...[...shared.values()].flatMap((list) =>
      list.length > 1 ? list.map(({ edge }) => edge) : [],
    ),
    ...pinnedMerges.flatMap((group) => group.ends.map(({ edge }) => edge)),
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
  const { positions, merges } = spread(
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
  for (const group of pinnedMerges) {
    merges.push({ ends: orderEnds(group.ends, trial), at: group.at })
  }
  return { ports: portsAt(problem, sides, positions), positions, merges, shared, trial }
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

// The ends that take one spot along a side, and their places in its order.
interface Slot {
  readonly ends: Array<SharedEnd>
  readonly ranks: Array<number>
}

const rankSum = (slot: Slot) => slot.ranks.reduce((total, rank) => total + rank, 0)

// The auto positions of the ends that share a side, spread out evenly along
// it in their order (see `orderEnds`), keyed by end id, and the merges
// among them. Ends with the same merge key take one spot, at the mean of
// their places in the order, or, with `together`, only a run of them in a
// row whose routes come in together, each with the one before it.
function spread(
  shared: ReadonlyMap<number, ReadonlyArray<SharedEnd>>,
  trial: ReadonlyArray<ReadonlyArray<XY> | undefined>,
  mergeKey: (end: SharedEnd) => string | undefined,
  together: ((a: SharedEnd, b: SharedEnd) => boolean) | undefined,
): { positions: Map<number, number>; merges: Array<Merge> } {
  const positions = new Map<number, number>()
  const merges: Array<Merge> = []
  for (const group of shared.values()) {
    const ordered = orderEnds(group, trial)
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
    for (const [k, slot] of slots.entries()) {
      const at = (k + 1) / (slots.length + 1)
      for (const { edge, end } of slot.ends) {
        positions.set(endId(edge, end), at)
      }
      if (slot.ends.length > 1) {
        merges.push({ ends: slot.ends, at })
      }
    }
  }
  return { positions, merges }
}

// The ports of every edge, with auto positions from `positions`, or the
// middle of the side.
function portsAt(
  problem: Problem,
  sides: ReadonlyArray<readonly [number, number]>,
  positions: ReadonlyMap<number, number>,
): Array<[Port, Port]> {
  return problem.edges.map((edge, i) => {
    const [source, target] = sides[i] as readonly [number, number]
    const at = (end: number) =>
      (edge.ends[end] as ProblemEdge['ends'][number]).at ?? positions.get(endId(i, end)) ?? 0.5
    return [
      portOf(problem, edge.source, source, at(0)),
      portOf(problem, edge.target, target, at(1)),
    ]
  })
}
