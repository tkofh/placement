import { atMost, before, overlaps } from '../../utils/tolerance.ts'
import { type Axis, hi, lo, other } from '../orient.ts'
import type { Graph, Obstacle } from './graph.ts'
import type { Congestion, Path } from './search.ts'

// The channels of a visibility graph: the room the obstacles leave across
// each half-edge, shared by every half-edge that runs through the same
// room. A half-edge runs along one axis, at a coordinate across it, over a
// stretch along it. Its walls are the nearest obstacles on either side of
// its line among those beside the stretch, which overlap it by more than a
// point, as `passage` finds them for the connector. The parallel half-edges
// over one stretch between one pair of walls are one slot: the nudge
// spreads the routes on any of them across the whole room, so what fills a
// slot is how many routes run through it, not which of its lines each takes.
// Parallel half-edges between the same two perpendicular lines come from
// one sweep and have identical ends, so a slot is keyed by exact
// coordinates. A half-edge that runs inside an obstacle, out of a pin
// through its owner, or that has no length, belongs to no slot.
//
// A slot fills with the routes through it, each with its stroke, and with
// the gaps between them. Routes that merge run as lanes of one bundle, a
// merge gap apart, alongside each other out of their shared port, and
// past where they part each is a route of its own, as the nudge spaces
// them. So each half-edge of a route counts under a group: the merge's, on
// the straight run out of a merged end, and the route's own elsewhere. A
// group fills a slot with its strokes, one gap toward the other groups, and
// a merge gap between each two of its half-edges there: the fill of a slot
// is a sum over its groups, which counts a route in or out exactly in
// whatever order the routes come and go.

/**
 * The channels of a graph: the slot of each half-edge, the parallel
 * half-edges over one stretch between one pair of walls, and the room
 * across each slot.
 */
export interface Channels {
  // The slot of each half-edge, or `-1` where it runs free.
  readonly slotOf: Int32Array
  // The room across each slot, between its walls, or `Infinity` with no
  // wall on one side.
  readonly width: Float64Array
}

const cache = new WeakMap<Graph, Map<ReadonlyArray<Obstacle>, Channels>>()

/**
 * The channels of a graph whose edges are horizontal or vertical among
 * obstacles, kept with the graph for the next call with the same
 * obstacles.
 *
 * @param graph - The graph.
 * @param obstacles - The obstacles the graph was built among. An obstacle
 * with a non-finite field is ignored.
 * @returns The slot of each half-edge and the width of each slot.
 */
export function channelsOf(graph: Graph, obstacles: ReadonlyArray<Obstacle>): Channels {
  let found = cache.get(graph)
  if (found === undefined) {
    found = new Map()
    cache.set(graph, found)
  }
  let channels = found.get(obstacles)
  if (channels === undefined) {
    channels = slotsOf(graph, obstacles)
    found.set(obstacles, channels)
  }
  return channels
}

function slotsOf(graph: Graph, obstacles: ReadonlyArray<Obstacle>): Channels {
  const { xs, ys, sources, targets } = graph
  const kept = obstacles.filter(
    (o) =>
      Number.isFinite(o.left) &&
      Number.isFinite(o.top) &&
      Number.isFinite(o.right) &&
      Number.isFinite(o.bottom),
  )
  const slotOf = new Int32Array(targets.length).fill(-1)
  const widths: Array<number> = []
  const keys = new Map<string, number>()
  for (let e = 0; e < targets.length; e++) {
    const [a, b] = [sources[e] as number, targets[e] as number]
    const [x1, y1, x2, y2] = [xs[a], ys[a], xs[b], ys[b]] as [number, number, number, number]
    // The axis across the half-edge, which its line sits on, and the one
    // along it. A half-edge that is neither horizontal nor vertical, or
    // has no length, belongs to no slot. Exact equality is safe here: the
    // sweep of the visibility graph merges coincident lines onto one
    // coordinate, which `passage` relies on too.
    if ((x1 === x2) === (y1 === y2)) {
      continue
    }
    const across: Axis = x1 === x2 ? 0 : 1
    const along = other(across)
    const at = across === 0 ? x1 : y1
    const [from, to] =
      across === 0 ? [Math.min(y1, y2), Math.max(y1, y2)] : [Math.min(x1, x2), Math.max(x1, x2)]
    if (!before(from, to)) {
      continue
    }
    let low = Number.NEGATIVE_INFINITY
    let high = Number.POSITIVE_INFINITY
    let buried = false
    for (const o of kept) {
      if (!overlaps(lo(o, along), hi(o, along), from, to)) {
        continue
      }
      const [near, far] = [lo(o, across), hi(o, across)]
      if (atMost(far, at)) {
        low = Math.max(low, far)
      } else if (atMost(at, near)) {
        high = Math.min(high, near)
      } else {
        buried = true
        break
      }
    }
    if (buried) {
      continue
    }
    const key = `${across} ${from} ${to} ${low} ${high}`
    let slot = keys.get(key)
    if (slot === undefined) {
      slot = widths.length
      keys.set(key, slot)
      widths.push(high - low)
    }
    slotOf[e] = slot
  }
  return { slotOf, width: Float64Array.from(widths) }
}

/** What the routes on a graph take of the room in each of its slots. */
export interface Fill {
  // What each slot's routes take of its room: per group, its strokes, one
  // gap, and a merge gap between each two of its routes.
  readonly load: Float64Array
  // How many groups run through each slot.
  readonly groups: Int32Array
  // How many half-edges of each group run through each slot, at
  // `slot * groupCount + group`, where any do.
  readonly members: Map<number, number>
  readonly groupCount: number
  readonly gap: number
  readonly mergeGap: number
}

/**
 * The groups a route's half-edges fill the slots under: its own, alone,
 * and the groups of the merges at its source and target, or `-1` for an
 * end that does not merge.
 */
export interface RouteGroups {
  readonly own: number
  readonly source: number
  readonly target: number
}

/**
 * The groups of route `k` of `count` routes: its own is `k`, and the
 * merge with id `m` is `count + m`, so a fill of `3 * count` groups holds
 * them all.
 *
 * @param count - How many routes there are.
 * @param k - The route.
 * @param merges - The ids of the merges at the route's source and target,
 * from `0` to one less than twice the count, or `-1` for an end that does
 * not merge.
 * @returns The route's groups.
 */
export function groupsOf(
  count: number,
  k: number,
  [source, target]: readonly [number, number],
): RouteGroups {
  return {
    own: k,
    source: source < 0 ? -1 : count + source,
    target: target < 0 ? -1 : count + target,
  }
}

/**
 * The fill of a graph's slots with no route in them.
 *
 * @param slots - How many slots there are.
 * @param groupCount - How many groups there may be, numbered from `0`.
 * @param gap - The gap between the routes of different groups.
 * @param mergeGap - The gap between the routes of one group.
 * @returns The empty fill.
 */
export function emptyFill(slots: number, groupCount: number, gap: number, mergeGap: number): Fill {
  return {
    load: new Float64Array(slots),
    groups: new Int32Array(slots),
    members: new Map(),
    groupCount,
    gap,
    mergeGap,
  }
}

/**
 * Counts a route's path into, or out of, the fill of the slots it runs
 * through, once for each of its half-edges in a slot (see
 * `forEachGroupSlot` for the group each counts under): its stroke, and a
 * gap where its group was not in the slot, or a merge gap where it was.
 * The groups are a function of the path, so counting a path out undoes
 * counting it in, whatever came between.
 *
 * @param graph - The graph the path runs on.
 * @param slotOf - The slot of each half-edge, or `-1` (see `channelsOf`).
 * @param fill - The fill, which this updates.
 * @param path - The path, or `undefined` for none.
 * @param groups - The route's groups.
 * @param stroke - The route's stroke.
 * @param by - `1` to count the path in, `-1` to count it out.
 */
export function fillPath(
  graph: Graph,
  slotOf: Int32Array,
  fill: Fill,
  path: Path | undefined,
  groups: RouteGroups,
  stroke: number,
  by: 1 | -1,
): void {
  const { load, members, groupCount, gap, mergeGap } = fill
  forEachGroupSlot(graph, slotOf, path, groups, (slot, group) => {
    const key = slot * groupCount + group
    const before = members.get(key) ?? 0
    const after = before + by
    // The half-edge that brings its group into the slot, or takes the
    // last of it away, brings or takes the gap toward the others.
    const first = (by > 0 ? before : after) === 0
    const taken = load[slot] as number
    load[slot] = taken + by * (stroke + (first ? gap : mergeGap))
    if (first) {
      const count = fill.groups[slot] as number
      fill.groups[slot] = count + by
    }
    if (after === 0) {
      members.delete(key)
    } else {
      members.set(key, after)
    }
  })
}

/**
 * The room a slot needs for its routes and one more half-edge of `stroke`
 * under `group`, with the gaps between them, or `-Infinity` where that
 * group would be alone in the slot, which never crowds it: one route, or
 * one bundle, through a seam that the clearance leaves narrow is a squeeze
 * the clearance chose.
 *
 * @param fill - The fill.
 * @param slot - The slot.
 * @param group - The group the half-edge counts under.
 * @param stroke - The stroke of the route.
 * @returns The room needed.
 */
export function needAt(fill: Fill, slot: number, group: number, stroke: number): number {
  const present = group >= 0 && fill.members.has(slot * fill.groupCount + group)
  const others = (fill.groups[slot] as number) - (present ? 1 : 0)
  return others > 0
    ? (fill.load[slot] as number) + stroke + (present ? fill.mergeGap : fill.gap) - fill.gap
    : Number.NEGATIVE_INFINITY
}

/**
 * How full the slots would be with one more route of `stroke`, for its
 * search (see `SearchOptions.congestion`). Where the runs of its partners
 * out of the port of one of its merges are, it counts as joining them, a
 * merge gap beside them, since that is where its own run out of the port
 * would be; elsewhere it counts on its own, a gap from the others. A
 * route that comes back alongside its partners' runs out of the port with
 * a later run of its own is charged a merge gap there rather than a gap,
 * which is rare.
 *
 * @param channels - The channels.
 * @param fill - What the other routes take of them.
 * @param groups - The route's groups.
 * @param stroke - The stroke of the route.
 * @param pressure - How much more a unit of length costs per route a slot
 * is over by.
 * @returns The congestion the route's search reads.
 */
export function congestionFor(
  channels: Channels,
  fill: Fill,
  groups: RouteGroups,
  stroke: number,
  pressure: number,
): Congestion {
  const present = (slot: number, group: number) =>
    group >= 0 && fill.members.has(slot * fill.groupCount + group)
  const need = new Float64Array(fill.load.length)
  for (let slot = 0; slot < need.length; slot++) {
    const group = present(slot, groups.source)
      ? groups.source
      : present(slot, groups.target)
        ? groups.target
        : groups.own
    need[slot] = needAt(fill, slot, group, stroke)
  }
  return { slotOf: channels.slotOf, width: channels.width, need, unit: stroke + fill.gap, pressure }
}

/**
 * Calls `visit` with the slot of each half-edge a path runs along that
 * belongs to one, and the group it counts under: the group of the merge at
 * the source for the half-edges of the straight run out of the source pin,
 * that of the merge at the target for those of the run into the target
 * pin, and the route's own otherwise. A path of one run counts under the
 * source's merge where it merges, and the target's where only that does.
 * Merged routes run as lanes of one bundle only alongside each other out
 * of their shared port, as the nudge spaces them; past where they part,
 * each is a route of its own.
 *
 * @param graph - The graph the path runs on.
 * @param slotOf - The slot of each half-edge, or `-1` (see `channelsOf`).
 * @param path - The path, or `undefined` for none.
 * @param groups - The route's groups.
 * @param visit - Hears each slot and group, once per half-edge in a slot.
 */
export function forEachGroupSlot(
  graph: Graph,
  slotOf: Int32Array,
  path: Path | undefined,
  groups: RouteGroups,
  visit: (slot: number, group: number) => void,
): void {
  const { xs, ys } = graph
  const nodes = path?.nodes ?? []
  const last = nodes.length - 1
  // The heading of the half-edge from node `k` to the next.
  const heading = (k: number) => {
    const [a, b] = [nodes[k] as number, nodes[k + 1] as number]
    return (
      3 * Math.sign((xs[b] as number) - (xs[a] as number)) +
      Math.sign((ys[b] as number) - (ys[a] as number))
    )
  }
  // The half-edges of the run out of the source, `0` up to `head`, and of
  // the run into the target, `tail` up to the last.
  let head = 0
  while (head + 1 < last && heading(head + 1) === heading(0)) {
    head++
  }
  let tail = last - 1
  while (tail > 0 && heading(tail - 1) === heading(last - 1)) {
    tail--
  }
  const single = head === last - 1
  forEachSlot(graph, slotOf, path, (slot, step) => {
    let group = groups.own
    if (single) {
      group = groups.source >= 0 ? groups.source : groups.target >= 0 ? groups.target : groups.own
    } else if (step <= head && groups.source >= 0) {
      group = groups.source
    } else if (step >= tail && groups.target >= 0) {
      group = groups.target
    }
    visit(slot, group)
  })
}

/**
 * Calls `visit` with the slot of each half-edge a path runs along that
 * belongs to one.
 *
 * @param graph - The graph the path runs on.
 * @param slotOf - The slot of each half-edge, or `-1` (see `channelsOf`).
 * @param path - The path, or `undefined` for none.
 * @param visit - Hears each slot, once per half-edge in it, with the
 * half-edge's place along the path, from `0`.
 */
export function forEachSlot(
  graph: Graph,
  slotOf: Int32Array,
  path: Path | undefined,
  visit: (slot: number, step: number) => void,
): void {
  const { offsets, targets } = graph
  const nodes = path?.nodes ?? []
  for (let k = 1; k < nodes.length; k++) {
    const [from, to] = [nodes[k - 1] as number, nodes[k] as number]
    for (let e = offsets[from] as number; e < (offsets[from + 1] as number); e++) {
      if (targets[e] === to) {
        const slot = slotOf[e] as number
        if (slot >= 0) {
          visit(slot, k - 1)
        }
        break
      }
    }
  }
}
