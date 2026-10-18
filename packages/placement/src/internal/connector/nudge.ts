import { coincident } from 'curvy/number'
import { type DirectedEdge, preferredOrder } from '../graph/acyclic.ts'
import type { Obstacle } from '../graph/graph.ts'
import { type Separation, type Variable, placeSeparated } from '../separation.ts'

// Nudging, the last step of orthogonal connector routing (Wybrow, Marriott,
// and Stuckey 2009). Routes found one at a time share the lines of the
// visibility graph, so segments of different routes overlap. Nudging moves
// each segment sideways, vertical segments first and then horizontal ones,
// so that overlapping segments sit a gap apart.
//
// The order of overlapping segments decides where routes cross. Two routes
// that share a path stay on the same side of each other along all of it, so
// their order is decided where the shared path ends: the route that turns
// left of the other there runs on its left. When the two ends disagree, one
// crossing is unavoidable, and the end the first route reaches first wins.
// The orders of a line's segments come from these pairwise sides, with
// cycles broken.
//
// The new positions come from a separation solver (see `separation.ts`). A
// segment wants to stay where it is, and moves no further than the obstacles
// beside it allow. A jog wants its spot along the run it shifts, and may
// first leap over the segments of other routes that run alongside all of
// it, since that moves a crossing from one of its legs to the other. The
// segments at the ends of a route attach to its pins and stay put, and the
// segment past each keeps to its side of the port, so the route still leaves
// and enters straight. A jog that shares its line with another route leaps
// only toward the side it parts to. Routes
// that leave one merge on lanes stay coupled, the merge gap apart instead
// of the full gap, for as long as they run alongside each other from it,
// turning the same ways, and a coupled jog sits beside the rest of its
// bundle rather than at `jogAt`, so the bundle turns together. A jog where a
// route parts from its bundle goes as far from the merge as its corners
// leave room for, so the bundle stays together as long as it can. Where a
// channel is too narrow for the full gap, the gaps of the segments that
// crowd it shrink until they fit, down to none.

export type XY = readonly [number, number]

type Point = [number, number]

export interface RouteConstraints {
  // Points the route must still pass through. The segments through them do
  // not move.
  readonly anchors?: ReadonlyArray<XY> | undefined
  // Rects that only this route's segments may not move into.
  readonly avoid?: ReadonlyArray<Obstacle> | undefined
  // Where each jog wants to sit along the run it shifts, from 0 at the end
  // toward the route's start to 1 at the end toward its target. Defaults
  // to 0.5.
  readonly jogAt?: number | undefined
  // The merges the route's start and end lead into, as ids shared by the
  // routes of each merge, or -1 for an end that does not merge.
  readonly merges?: readonly [source: number, target: number] | undefined
  // How thick the route draws. Gaps keep its stroke, not its line, apart
  // from the others: half of it widens each gap on either side.
  readonly thickness?: number | undefined
  // How far the route's corners reach, and the length of the adornments
  // packed at each end, which a jog that parts from a bundle keeps clear
  // of at the far end of its run.
  readonly corner?: number | undefined
  readonly packs?: readonly [source: number, target: number] | undefined
  // How far a short jog's corners slide apart into an S, as a multiple of
  // what keeps the shape continuous (see `slants.ts`), which a parting jog
  // that slants keeps room for.
  readonly slant?: number | undefined
}

interface Segment {
  readonly route: number
  readonly index: number
  // The coordinate of the line it runs along, and its extent along it.
  readonly at: number
  // Where it wants to be.
  readonly desired: number
  readonly low: number
  readonly high: number
  readonly fixed: boolean
  // For a jog between turns that go opposite ways, the lines of the
  // segments on either side, between which it may sit.
  readonly run?: readonly [number, number] | undefined
  // For a jog that parts from a bundle, which way along its run is later:
  // where it wants to be is as far as it may go that way.
  readonly late?: number | undefined
}

// A jog where a route parts from its bundle: which end of its run is far
// from the merge, `0` for the start, and whether the route leaves a group
// that goes on, which turns it tight and upright.
interface Split {
  readonly far: number
  readonly leaving: boolean
}

// How many times the gaps of crowded channels shrink before they give way.
const SHRINK_STEPS = 12

// How many times the segments of other routes go past the bundles they
// come out inside, and the solve runs again, at most.
const KEEP_OUT_ROUNDS = 3

// How many times the two passes repeat at most.
const ROUNDS = 3

/**
 * Moves the overlapping segments of orthogonal routes apart.
 *
 * @param routes - The routes, as points from start to end. The first and
 * last segment of each route attach to its pins and do not move. A segment
 * that is neither horizontal nor vertical does not move, nor do its
 * neighbors.
 * @param obstacles - The rects that segments may not move into.
 * @param gap - The space between the strokes of overlapping segments: their
 * lines sit this far apart plus half of each route's thickness.
 * @param constraints - What each route keeps, by route index.
 * @param mergeGap - The distance between the coupled segments of routes
 * that leave one merge. Defaults to `gap`.
 * @returns The routes with their segments moved, without repeated points or
 * points in the middle of a straight run.
 */
export function nudge(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  obstacles: ReadonlyArray<Obstacle>,
  gap: number,
  constraints: ReadonlyArray<RouteConstraints | undefined> = [],
  mergeGap = gap,
): Array<Array<XY>> {
  const paths = routes.map(simplify)
  const spacing = Number.isFinite(gap) && gap > 0 ? gap : 0
  const tight = Number.isFinite(mergeGap) && mergeGap > 0 ? Math.min(mergeGap, spacing) : 0
  const thickness = paths.map((_, route) => {
    const value = constraints[route]?.thickness ?? 0
    return Number.isFinite(value) && value > 0 ? value : 0
  })
  const mergesOf = (route: number) => constraints[route]?.merges ?? []
  const steps: Array<Array<XY>> = paths.map(() => [])
  // The ends of other routes step out from among the lanes of a merge,
  // which hold still like they do, and the steps stay put: those among the
  // lanes as found, then, once more, those the passes leave among them.
  for (let attempt = 0; attempt < 2; attempt++) {
    const stepped = stepOut(paths, bundlesOf(paths, mergesOf).lanes, obstacles, {
      thickness,
      spacing,
      tight,
    })
    if (attempt > 0 && stepped.every((points) => points.length === 0)) {
      break
    }
    for (const [route, points] of stepped.entries()) {
      ;(steps[route] as Array<XY>).push(...points)
    }
    const held = paths.map((_, route): RouteConstraints | undefined => {
      const given = constraints[route]
      const points = steps[route] ?? []
      return points.length === 0
        ? given
        : { ...given, anchors: [...(given?.anchors ?? []), ...points] }
    })
    // The passes move points but never add or drop them, so the couples
    // found before them hold throughout. A jog where a route parts from its
    // bundle wants the far end of its run from the merge, so the bundle
    // stays together as long as it can.
    const { couples, groups, losses, leaves } = bundlesOf(paths, mergesOf)
    const splits = new Map<string, Split>()
    for (const [list, leaving] of [
      [losses, false],
      [leaves, true],
    ] as const) {
      for (const [route, entries] of list.entries()) {
        const count = (paths[route] as Array<Point>).length - 1
        for (const { start, k } of entries) {
          const index = start ? k : count - 1 - k
          if (index > 0 && index < count - 1) {
            splits.set(`${route}:${index}`, { far: start ? 1 : 0, leaving })
          }
        }
      }
    }
    const packed = (a: Segment, b: Segment) =>
      tight + ((thickness[a.route] as number) + (thickness[b.route] as number)) / 2
    const gapOf = (a: Segment, b: Segment) =>
      couples.has(`${a.route}:${a.index}:${b.route}:${b.index}`)
        ? packed(a, b)
        : spacing + ((thickness[a.route] as number) + (thickness[b.route] as number)) / 2
    // Moving one axis changes the extents of the other's segments, which
    // can make them overlap, so the passes repeat until neither moves
    // anything.
    for (let round = 0; round < ROUNDS; round++) {
      const bundles = { couples, groups, packed }
      const movedX = nudgeAxis(paths, obstacles, gapOf, bundles, splits, 0, held)
      const movedY = nudgeAxis(paths, obstacles, gapOf, bundles, splits, 1, held)
      if (!movedX && !movedY) {
        break
      }
    }
  }
  return paths.map(simplify)
}

// How the routes that leave one merge run together.
interface Bundles {
  // The segments of routes that still run together, as keys of both orders
  // of each pair.
  readonly couples: Set<string>
  // Each merge's lanes, the segments its routes come off it on, which stay
  // where their pins are, and its couples, as keys of both orders of each
  // pair alongside each other. Each reads as one line to the other routes.
  readonly groups: Array<Set<string>>
  // Each merge's lanes, by route and index.
  readonly lanes: Array<Set<string>>
  // Where each route loses a partner it ran with: the merge end it is
  // walked from, and how many segments from the merge.
  readonly losses: Array<Array<{ readonly start: boolean; readonly k: number }>>
  // Where each route leaves a group that goes on without it: it goes on
  // alone, and at least two of the routes it ran with go on together. A
  // pair that parts, or a route whose last partner ends, leaves no group.
  readonly leaves: Array<Array<{ readonly start: boolean; readonly k: number }>>
}

// Walked from the merge, the lanes are the first segments, and two routes
// stay coupled while each next pair of segments heads the same way
// alongside each other: they turn the same ways and their extents overlap,
// wherever the nudge puts them across. Each loses the other at the first
// segment past the last they share.
function bundlesOf(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  merges: (route: number) => ReadonlyArray<number>,
): Bundles {
  const couples = new Set<string>()
  const groups: Array<Set<string>> = []
  const lanes: Array<Set<string>> = []
  const losses: Bundles['losses'] = paths.map(() => [])
  const leaves: Bundles['leaves'] = paths.map(() => [])
  const byMerge = new Map<number, Array<[route: number, start: boolean]>>()
  for (const [route] of paths.entries()) {
    for (const [end, id] of merges(route).entries()) {
      if (id >= 0) {
        const list = byMerge.get(id) ?? []
        list.push([route, end === 0])
        byMerge.set(id, list)
      }
    }
  }
  for (const list of byMerge.values()) {
    const group = new Set<string>()
    groups.push(group)
    lanes.push(
      new Set(list.map(([route, start]) => `${route}:${start ? 0 : paths[route]!.length - 2}`)),
    )
    // How many segments from the merge each pair shares, by their places
    // in the list.
    const shared = new Map<string, number>()
    for (const [i, [p, fromStart]] of list.entries()) {
      for (const [j, [q, toStart]] of list.entries()) {
        if (j <= i) {
          continue
        }
        const a = paths[p] as ReadonlyArray<Point>
        const b = paths[q] as ReadonlyArray<Point>
        const count = Math.min(a.length, b.length) - 1
        let last = 0
        for (let k = 0; k < count; k++) {
          const ia = fromStart ? k : a.length - 2 - k
          const ib = toStart ? k : b.length - 2 - k
          const axis = axisOf(a, ia)
          const da = direction(a, ia, fromStart ? 1 : -1)
          const db = direction(b, ib, toStart ? 1 : -1)
          const same =
            axis >= 0 &&
            axis === axisOf(b, ib) &&
            Math.sign(da[0]) === Math.sign(db[0]) &&
            Math.sign(da[1]) === Math.sign(db[1])
          if (!same) {
            break
          }
          const along = 1 - axis
          const [a0, a1] = [coord(a[ia] as Point, along), coord(a[ia + 1] as Point, along)]
          const [b0, b1] = [coord(b[ib] as Point, along), coord(b[ib + 1] as Point, along)]
          const from = Math.max(Math.min(a0, a1), Math.min(b0, b1))
          const to = Math.min(Math.max(a0, a1), Math.max(b0, b1))
          const overlaps = from < to || coincident(from, to)
          if (k === 0) {
            if (overlaps) {
              group.add(`${p}:${ia}:${q}:${ib}`).add(`${q}:${ib}:${p}:${ia}`)
            }
            continue
          }
          if (!overlaps) {
            break
          }
          couples.add(`${p}:${ia}:${q}:${ib}`).add(`${q}:${ib}:${p}:${ia}`)
          group.add(`${p}:${ia}:${q}:${ib}`).add(`${q}:${ib}:${p}:${ia}`)
          last = k
        }
        ;(losses[p] as Array<{ start: boolean; k: number }>).push({ start: fromStart, k: last + 1 })
        ;(losses[q] as Array<{ start: boolean; k: number }>).push({ start: toStart, k: last + 1 })
        shared.set(`${i}:${j}`, last).set(`${j}:${i}`, last)
      }
    }
    const along = (a: number, b: number) => shared.get(`${a}:${b}`) ?? -1
    for (const [i, [p, start]] of list.entries()) {
      const others = [...list.keys()].filter((j) => j !== i)
      for (const k of new Set(others.map((j) => along(i, j) + 1))) {
        // Alone past k, from a group of which two go on together.
        const before = others.filter((j) => along(i, j) >= k - 1)
        const alone = others.every((j) => along(i, j) < k)
        const goesOn = before.some((a) => before.some((b) => a < b && along(a, b) >= k))
        if (alone && goesOn) {
          ;(leaves[p] as Array<{ start: boolean; k: number }>).push({ start, k })
        }
      }
    }
  }
  return { couples, groups, lanes, losses, leaves }
}

/**
 * The segments of routes that leave one merge and still run alongside
 * another of them, turning the same ways.
 *
 * @param routes - The routes, as points with no repeats and no points in
 * the middle of a straight run.
 * @param merges - The merges each route's start and end lead into, as ids
 * shared by the routes of each merge, or `-1` for an end that does not
 * merge.
 * @returns The indices of each route's coupled segments.
 */
export function coupledSegments(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  merges: ReadonlyArray<readonly [number, number]>,
): Array<Set<number>> {
  const paths = routes.map(simplify)
  const { couples } = bundlesOf(paths, (route) => merges[route] ?? [])
  const result = paths.map(() => new Set<number>())
  for (const key of couples) {
    const [route, index] = key.split(':').map(Number) as [number, number]
    result[route]?.add(index)
  }
  return result
}

/**
 * The corners where routes that leave one merge go on alone from a group
 * that goes on without them, which turn as tight as the merge allows.
 *
 * @param routes - The routes, as points with no repeats and no points in
 * the middle of a straight run.
 * @param merges - The merges each route's start and end lead into, as ids
 * shared by the routes of each merge, or `-1` for an end that does not
 * merge.
 * @returns The indices of each route's parting corners.
 */
export function partingCorners(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  merges: ReadonlyArray<readonly [number, number]>,
): Array<Set<number>> {
  const paths = routes.map(simplify)
  const { leaves } = bundlesOf(paths, (route) => merges[route] ?? [])
  return paths.map((path, route) => {
    const corners = new Set<number>()
    for (const { start, k } of leaves[route] ?? []) {
      // The corner between the last segment shared and the next.
      const corner = start ? k : path.length - 1 - k
      if (corner > 0 && corner < path.length - 1) {
        corners.add(corner)
      }
    }
    return corners
  })
}

// Coupled segments want to sit together, as one bundle, each the merge gap
// from the next in their current order: against a member that is not a
// jog, which stays put, or else about the mean of where the jogs want to
// be. A jog in a bundle wants the bundle's spot rather than its own, within
// its run. Other members keep their spot, since moving the bottom of a U
// lengthens the route and drags both legs across what lies between.
function cohere(
  segments: Array<Segment>,
  couples: ReadonlySet<string>,
  gapOf: (a: Segment, b: Segment) => number,
  order: (a: number, b: number) => number = (a, b) =>
    (segments[a] as Segment).at - (segments[b] as Segment).at,
): Array<Segment> {
  if (couples.size === 0) {
    return segments
  }
  const result = [...segments]
  for (const members of bundlesIn(segments, couples)) {
    members.sort((a, b) => order(a, b) || a - b)
    // Each member's place in the packed bundle, from the first.
    const offsets = [0]
    for (let k = 1; k < members.length; k++) {
      const gap = gapOf(
        segments[members[k - 1] as number] as Segment,
        segments[members[k] as number] as Segment,
      )
      offsets.push((offsets[k - 1] as number) + gap)
    }
    const anchor = members.findIndex((m) => (segments[m] as Segment).run === undefined)
    // Jogs that part from a bundle together go as late as the least of them
    // may.
    const late = (segments[members[0] as number] as Segment).late
    const together =
      late !== undefined && late !== 0 && members.every((m) => segments[m]?.late === late)
    const starts = members.map((m, k) => (segments[m] as Segment).desired - (offsets[k] as number))
    const start =
      anchor >= 0
        ? (segments[members[anchor] as number] as Segment).at - (offsets[anchor] as number)
        : together
          ? late > 0
            ? Math.min(...starts)
            : Math.max(...starts)
          : starts.reduce((sum, value) => sum + value, 0) / members.length
    for (const [k, m] of members.entries()) {
      const segment = segments[m] as Segment
      if (segment.run !== undefined) {
        const [low, high] = segment.run
        const packed = start + (offsets[k] as number)
        result[m] = { ...segment, desired: Math.min(Math.max(packed, low), high) }
      }
    }
  }
  return result
}

// The bundles among the segments of one axis: the groups of two or more
// that couples join, by their indices.
function bundlesIn(
  segments: ReadonlyArray<Segment>,
  couples: ReadonlySet<string>,
): Array<Array<number>> {
  if (couples.size === 0) {
    return []
  }
  const group = segments.map((_, i) => i)
  const find = (i: number): number => {
    let root = i
    while (group[root] !== root) {
      root = group[root] as number
    }
    group[i] = root
    return root
  }
  const index = new Map(segments.map((segment, i) => [`${segment.route}:${segment.index}`, i]))
  for (const key of couples) {
    const [p, i, q, k] = key.split(':')
    const a = index.get(`${p}:${i}`)
    const b = index.get(`${q}:${k}`)
    if (a !== undefined && b !== undefined) {
      const [ra, rb] = [find(a), find(b)]
      if (ra !== rb) {
        group[Math.max(ra, rb)] = Math.min(ra, rb)
      }
    }
  }
  const bundles = new Map<number, Array<number>>()
  for (const i of segments.keys()) {
    const root = find(i)
    bundles.set(root, [...(bundles.get(root) ?? []), i])
  }
  return [...bundles.values()].filter((members) => members.length > 1)
}

// Takes the segments of other routes out from between the segments of a
// bundle, in `order`, the order across the lines: a bundle reads as one
// line, so nothing runs inside it. Only the members that sit `packed` apart
// or closer at `positions`, next to each other, read as one: a segment
// between two of those that both run alongside it, and each other, goes
// past whichever side has fewer of them alongside it, or the one nearer
// where it wants to be, and sits next to the last of them. It moves in place in `order`. Returns
// whether any segment moved.
function keepOut(
  segments: ReadonlyArray<Segment>,
  bundles: ReadonlyArray<ReadonlyArray<number>>,
  packed: (a: Segment, b: Segment) => number,
  order: Array<number>,
  positions: ArrayLike<number>,
): boolean {
  const tight: Array<Array<number>> = []
  for (const bundle of bundles) {
    const sorted = bundle.toSorted(
      (a, b) =>
        (positions[a] as number) - (positions[b] as number) || order.indexOf(a) - order.indexOf(b),
    )
    let run = [sorted[0] as number]
    for (const m of sorted.slice(1)) {
      const last = run.at(-1) as number
      const apart = (positions[m] as number) - (positions[last] as number)
      const most = packed(segments[last] as Segment, segments[m] as Segment)
      if (apart < most || coincident(apart, most)) {
        run.push(m)
      } else {
        tight.push(run)
        run = [m]
      }
    }
    tight.push(run)
  }
  let moved = false
  for (const members of tight.filter((run) => run.length > 1)) {
    const routes = new Set(members.map((m) => (segments[m] as Segment).route))
    for (const [s, segment] of segments.entries()) {
      if (routes.has(segment.route)) {
        continue
      }
      const alongside = members.filter((m) => overlaps(segment, segments[m] as Segment))
      const place = order.indexOf(s)
      const before = alongside.filter((m) => order.indexOf(m) < place)
      const after = alongside.filter((m) => order.indexOf(m) > place)
      const inside = before.some((a) =>
        after.some((b) => overlaps(segments[a] as Segment, segments[b] as Segment)),
      )
      if (!inside) {
        continue
      }
      const mean =
        alongside.reduce((sum, m) => sum + (positions[m] as number), 0) / alongside.length
      const low =
        before.length !== after.length ? before.length < after.length : segment.desired <= mean
      const places = alongside.map((m) => order.indexOf(m))
      order.splice(place, 1)
      const edge = low ? Math.min(...places) : Math.max(...places)
      // Past the removed segment, the places after it shift down by one.
      const at = edge > place ? edge - 1 : edge
      order.splice(low ? at : at + 1, 0, s)
      moved = true
    }
  }
  return moved
}

// Steps the end segments of routes out from among the lanes of a merge.
// The lanes hold still, as the segments at the ends of every route do, so
// nothing else takes an end out from among the lanes that sit packed, next
// to each other, when it runs alongside one of them, no further from the
// line than the lanes reach. The end leaves its port straight as far as the
// obstacles around the port reach, then steps past those lanes to the side
// with fewer of them, or the nearer one, a gap from the last. The rest of
// the segment runs on there, so the segment past it moves its corner. An
// end that meets the lanes within the obstacles, or whose step would turn
// the segment past it back, stays as it is. Changes the paths in place, and
// returns the corners where each route steps out, which hold the steps
// still.
function stepOut(
  paths: Array<Array<Point>>,
  merges: ReadonlyArray<ReadonlySet<string>>,
  obstacles: ReadonlyArray<Obstacle>,
  {
    thickness,
    spacing,
    tight,
  }: {
    readonly thickness: ReadonlyArray<number>
    readonly spacing: number
    readonly tight: number
  },
): Array<Array<XY>> {
  const steps: Array<Array<XY>> = paths.map(() => [])
  const width = (route: number) => thickness[route] ?? 0
  interface Lane {
    readonly route: number
    readonly axis: number
    readonly at: number
    readonly low: number
    readonly high: number
  }
  for (const merge of merges) {
    const members = new Set<number>()
    const lanes: Array<Lane> = []
    for (const key of merge) {
      const [route, index] = key.split(':').map(Number) as [number, number]
      const path = paths[route] as Array<Point>
      members.add(route)
      const axis = axisOf(path, index)
      const along = 1 - axis
      const [a, b] = [coord(path[index] as Point, along), coord(path[index + 1] as Point, along)]
      const at = coord(path[index] as Point, axis)
      lanes.push({ route, axis, at, low: Math.min(a, b), high: Math.max(a, b) })
    }
    // The lanes that sit packed, next to each other, by the axis they run
    // across.
    const runs: Array<Array<Lane>> = []
    for (const axis of [0, 1]) {
      const parallel = lanes.filter((lane) => lane.axis === axis).toSorted((a, b) => a.at - b.at)
      let run: Array<Lane> = []
      for (const lane of parallel) {
        const last = run.at(-1)
        const most = last === undefined ? 0 : tight + (width(last.route) + width(lane.route)) / 2
        if (
          last !== undefined &&
          !(lane.at - last.at < most || coincident(lane.at - last.at, most))
        ) {
          runs.push(run)
          run = []
        }
        run.push(lane)
      }
      runs.push(run)
    }
    for (const [route, path] of paths.entries()) {
      if (members.has(route) || path.length < 3) {
        continue
      }
      for (const end of [0, 1]) {
        const index = end === 0 ? 0 : path.length - 2
        const axis = axisOf(path, index)
        const along = 1 - axis
        const port = (end === 0 ? path[0] : path.at(-1)) as Point
        const corner = (end === 0 ? path[1] : path.at(-2)) as Point
        const at = coord(port, axis)
        const [from, to] = [coord(port, along), coord(corner, along)]
        const extent = { low: Math.min(from, to), high: Math.max(from, to) }
        const run = runs.find(
          (list) =>
            list.length > 1 &&
            (list[0] as Lane).axis === axis &&
            between(at, (list[0] as Lane).at, (list.at(-1) as Lane).at) &&
            list.some((lane) => overlaps(extent, lane)),
        )
        if (run === undefined) {
          continue
        }
        const before = run.filter((lane) => lane.at < at && !coincident(lane.at, at))
        const after = run.filter((lane) => lane.at > at && !coincident(lane.at, at))
        const mean = run.reduce((sum, lane) => sum + lane.at, 0) / run.length
        const lower = before.length !== after.length ? before.length < after.length : at <= mean
        const outer = (lower ? run[0] : run.at(-1)) as Lane
        const line =
          outer.at + (lower ? -1 : 1) * (spacing + (width(route) + width(outer.route)) / 2)
        // How far the end runs straight: out of the obstacles around its
        // port, and short of the lanes.
        const heading = Math.sign(to - from)
        let reach = 0
        for (const o of obstacles) {
          const [near, far, start, stop] =
            axis === 0 ? [o.left, o.right, o.top, o.bottom] : [o.top, o.bottom, o.left, o.right]
          if (between(at, near, far) && between(from, start, stop)) {
            reach = Math.max(reach, heading * ((heading > 0 ? stop : start) - from))
          }
        }
        const meets = Math.min(
          ...run
            .filter((lane) => overlaps(extent, lane))
            .map((lane) => heading * ((heading > 0 ? lane.low : lane.high) - from)),
        )
        const next = (end === 0 ? path[2] : path.at(-3)) as Point
        const turn = coord(next, axis) - coord(corner, axis)
        if (
          !(reach > 0) ||
          reach >= meets ||
          coincident(reach, meets) ||
          turn === 0 ||
          Math.sign(coord(next, axis) - line) !== Math.sign(turn)
        ) {
          continue
        }
        const point = (a: number, b: number): Point => (axis === 0 ? [a, b] : [b, a])
        const step = point(at, from + heading * reach)
        const out = point(line, from + heading * reach)
        const moved = point(line, to)
        if (end === 0) {
          path.splice(0, 2, port, step, out, moved)
        } else {
          path.splice(-2, 2, moved, out, step, port)
        }
        ;(steps[route] as Array<XY>).push(step)
      }
    }
  }
  return steps
}

// Whether two extents along a line overlap by more than a point.
function overlaps(
  a: { readonly low: number; readonly high: number },
  b: { readonly low: number; readonly high: number },
): boolean {
  const from = Math.max(a.low, b.low)
  const to = Math.min(a.high, b.high)
  return from < to && !coincident(from, to)
}

// Drops repeated points and the points in the middle of a straight run.
function simplify(route: ReadonlyArray<XY>): Array<Point> {
  const result: Array<Point> = []
  for (const [x, y] of route) {
    const last = result.at(-1)
    if (last !== undefined && coincident(last[0], x) && coincident(last[1], y)) {
      continue
    }
    const before = result.at(-2)
    if (before !== undefined && last !== undefined) {
      const ax = last[0] - before[0]
      const ay = last[1] - before[1]
      const bx = x - last[0]
      const by = y - last[1]
      const straight = (ax === 0 && bx === 0) || (ay === 0 && by === 0)
      if (straight && ax * bx + ay * by > 0) {
        result.pop()
      }
    }
    result.push([x, y])
  }
  return result
}

const coord = (point: Point, axis: number) => (axis === 0 ? point[0] : point[1])

// Whether `x` lies in [low, high], within rounding.
const between = (x: number, low: number, high: number) =>
  (x >= low || coincident(x, low)) && (x <= high || coincident(x, high))

// The axis a segment runs across: 0 for a vertical segment, whose x the
// x pass moves, 1 for a horizontal one, and -1 for a diagonal one.
function axisOf(route: ReadonlyArray<Point>, index: number): number {
  const [x0, y0] = route[index] as Point
  const [x1, y1] = route[index + 1] as Point
  return x0 === x1 ? 0 : y0 === y1 ? 1 : -1
}

// Moves the segments that run across `axis`: vertical ones for axis 0,
// horizontal ones for axis 1. Returns whether any segment moved.
function nudgeAxis(
  paths: Array<Array<Point>>,
  obstacles: ReadonlyArray<Obstacle>,
  gapOf: (a: Segment, b: Segment) => number,
  {
    couples,
    groups,
    packed,
  }: {
    readonly couples: ReadonlySet<string>
    // Each merge's lanes and couples, and how far apart their segments
    // pack.
    readonly groups: ReadonlyArray<ReadonlySet<string>>
    readonly packed: (a: Segment, b: Segment) => number
  },
  splits: ReadonlyMap<string, Split>,
  axis: number,
  constraints: ReadonlyArray<RouteConstraints | undefined>,
): boolean {
  let collected = collect(paths, axis, constraints, splits)
  let segments = cohere(collected, couples, gapOf)
  if (leap(paths, obstacles, segments, axis, constraints)) {
    collected = collect(paths, axis, constraints, splits)
    segments = cohere(collected, couples, gapOf)
  }
  if (segments.length === 0) {
    return false
  }

  // Segments of different routes that overlap on one line, or touch end to
  // end there.
  const byLine = [...segments.keys()]
  byLine.sort((a, b) => (segments[a] as Segment).at - (segments[b] as Segment).at || a - b)
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < byLine.length; i++) {
    const a = byLine[i] as number
    const sa = segments[a] as Segment
    for (let j = i + 1; j < byLine.length; j++) {
      const b = byLine[j] as number
      const sb = segments[b] as Segment
      if (!coincident(sa.at, sb.at)) {
        break
      }
      const from = Math.max(sa.low, sb.low)
      const to = Math.min(sa.high, sb.high)
      if (sa.route !== sb.route && (from < to || coincident(from, to))) {
        pairs.push(a < b ? [a, b] : [b, a])
      }
    }
  }

  // Lines of overlapping segments, each ordered by the sides of its pairs.
  const group = segments.map((_, i) => i)
  const find = (i: number): number => {
    let root = i
    while (group[root] !== root) {
      root = group[root] as number
    }
    group[i] = root
    return root
  }
  for (const [a, b] of pairs) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) {
      group[Math.max(ra, rb)] = Math.min(ra, rb)
    }
  }
  const members = new Map<number, Array<number>>()
  for (let i = 0; i < segments.length; i++) {
    const root = find(i)
    const list = members.get(root)
    if (list === undefined) {
      members.set(root, [i])
    } else {
      list.push(i)
    }
  }
  const preferences = new Map<number, Array<DirectedEdge>>()
  for (const [a, b] of pairs) {
    const sa = segments[a] as Segment
    const sb = segments[b] as Segment
    const first = goesFirst(paths, sa, sb, axis) ? [a, b] : [b, a]
    const root = find(a)
    const list = preferences.get(root) ?? []
    list.push({ source: first[0] as number, target: first[1] as number })
    preferences.set(root, list)
  }
  const rank = new Int32Array(segments.length)
  for (const [root, list] of members) {
    const local = new Map(list.map((segment, i) => [segment, i]))
    const position = preferredOrder(
      list.length,
      (preferences.get(root) ?? []).map(({ source, target }) => ({
        source: local.get(source) as number,
        target: local.get(target) as number,
      })),
    )
    for (const [i, segment] of list.entries()) {
      rank[segment] = position[i] as number
    }
  }
  // Bundles pack in the order the routes keep: on one line, the order they
  // part in.
  segments = cohere(collected, couples, gapOf, (a, b) => {
    const [sa, sb] = [collected[a] as Segment, collected[b] as Segment]
    return coincident(sa.at, sb.at) ? (rank[a] as number) - (rank[b] as number) : sa.at - sb.at
  })
  // The order across the lines: by line, then along each line.
  const groupAt = (s: number) => (segments[find(s)] as Segment).at
  const order = [...segments.keys()].toSorted(
    (a, b) => groupAt(a) - groupAt(b) || (rank[a] as number) - (rank[b] as number) || a - b,
  )
  const placeOf = (list: ReadonlyArray<number>) => {
    const result = new Int32Array(segments.length)
    for (const [k, s] of list.entries()) {
      result[s] = k
    }
    return result
  }
  let place = placeOf(order)

  // Solves for the positions with the segments in `place` across the lines.
  const solve = (place: Int32Array): Float64Array => {
    // The variables: one per segment, then the walls that obstacles put
    // beside the segments that move.
    const variables: Array<Variable> = segments.map((s) => ({ desired: s.desired, fixed: s.fixed }))
    // Each separation keeps `right` at least `scale * gap` past `left`. The
    // current positions keep every order, so they meet every separation at
    // scale 0.
    const separations: Array<{ left: number; right: number; gap: number }> = []
    const separate = (left: number, right: number, full: number) => {
      if (!(segments[left] as Segment).fixed || !(segments[right] as Segment).fixed) {
        separations.push({ left, right, gap: full })
      }
    }

    for (const [s, segment] of segments.entries()) {
      if (segment.fixed) {
        continue
      }
      const own = constraints[segment.route]?.avoid ?? []
      const [low, high] = walls(
        own.length === 0 ? obstacles : [...obstacles, ...own],
        segment,
        axis,
      )
      // The stroke keeps off the walls too, where there is room.
      const thickness = constraints[segment.route]?.thickness ?? 0
      const half = Number.isFinite(thickness) && thickness > 0 ? thickness / 2 : 0
      if (low !== undefined) {
        variables.push({ desired: low, fixed: true })
        separations.push({ left: variables.length - 1, right: s, gap: half })
      }
      if (high !== undefined) {
        variables.push({ desired: high, fixed: true })
        separations.push({ left: s, right: variables.length - 1, gap: half })
      }
    }

    // Overlapping segments on one line, a full gap apart in their order, or
    // the merge gap for coupled ones.
    const gap = (a: number, b: number) => gapOf(segments[a] as Segment, segments[b] as Segment)
    for (const [a, b] of pairs) {
      const [left, right] = (place[a] as number) < (place[b] as number) ? [a, b] : [b, a]
      separate(left, right, gap(left, right))
    }

    // Segments on different lines keep their order where their extents
    // overlap or touch, and a gap apart when they can. A sweep along the
    // extents keeps the segments it crosses in order, and each segment is held
    // apart from its neighbors there. Two segments of one route only keep
    // their order: where they touch, a jog joins them.
    const before = (a: number, b: number) => (place[a] as number) - (place[b] as number)
    const events: Array<[at: number, open: boolean, segment: number]> = []
    for (const [s, segment] of segments.entries()) {
      events.push([segment.low, true, s], [segment.high, false, s])
    }
    // Opens come before closes at one place, so segments that touch meet.
    events.sort((a, b) => a[0] - b[0] || Number(b[1]) - Number(a[1]) || a[2] - b[2])
    const active: Array<number> = []
    const seen = new Set<number>()
    const neighbors = (left: number | undefined, right: number | undefined) => {
      if (left === undefined || right === undefined || find(left) === find(right)) {
        return
      }
      const key = left * segments.length + right
      if (!seen.has(key)) {
        seen.add(key)
        const sameRoute = (segments[left] as Segment).route === (segments[right] as Segment).route
        separate(left, right, sameRoute ? 0 : gap(left, right))
      }
    }
    for (const [, open, s] of events) {
      if (open) {
        let at = 0
        while (at < active.length && before(active[at] as number, s) < 0) {
          at++
        }
        active.splice(at, 0, s)
        neighbors(active[at - 1], s)
        neighbors(s, active[at + 1])
      } else {
        const at = active.indexOf(s)
        active.splice(at, 1)
        neighbors(active[at - 1], active[at])
      }
    }

    // The segments of a route on either side of a jog keep their order, so
    // the jog never turns back.
    const at = new Map(segments.map((segment, s) => [`${segment.route}:${segment.index}`, s]))
    for (const [s, segment] of segments.entries()) {
      const next = at.get(`${segment.route}:${segment.index + 2}`)
      if (next !== undefined) {
        const other = segments[next] as Segment
        if (segment.at < other.at) {
          separate(s, next, 0)
        } else if (other.at < segment.at) {
          separate(next, s, 0)
        }
      }
    }

    // The segment past each end of a route stays on its side of the port, so
    // the route still leaves and enters it straight out from its side.
    for (const [s, segment] of segments.entries()) {
      const path = paths[segment.route] as Array<Point>
      const ends = [
        ...(segment.index === 1 ? [path[0] as Point] : []),
        ...(segment.index === path.length - 3 ? [path[path.length - 1] as Point] : []),
      ]
      for (const end of segment.fixed ? [] : ends) {
        const port = coord(end, axis)
        if (port !== segment.at) {
          variables.push({ desired: port, fixed: true })
          const wall = variables.length - 1
          separations.push(
            port < segment.at ? { left: wall, right: s, gap: 0 } : { left: s, right: wall, gap: 0 },
          )
        }
      }
    }

    // Solve, and shrink the gaps that crowd a channel until everything fits.
    // A conflict names the chain of constraints that puts two fixed segments
    // or walls too far apart, and the gaps that push along it shrink by one
    // factor, just enough to fit, so the segments between spread evenly.
    const scale = new Float64Array(separations.length).fill(1)
    let positions: Float64Array = new Float64Array(0)
    for (let attempt = 0; attempt <= SHRINK_STEPS; attempt++) {
      const constraints: Array<Separation> = separations.map(({ left, right, gap: full }, k) => ({
        left,
        right,
        gap: (scale[k] as number) * full,
      }))
      const { positions: placed, conflicts } = placeSeparated(variables, constraints)
      positions = placed
      if (conflicts.length === 0) {
        break
      }
      let changed = false
      for (const { variables: list, chain, excess } of conflicts) {
        let pushing = 0
        for (const { constraint, along } of chain ?? []) {
          if (along && (separations[constraint] as { gap: number }).gap > 0) {
            pushing += (constraints[constraint] as Separation).gap
          }
        }
        if (chain !== undefined && excess !== undefined && pushing > 0 && attempt < SHRINK_STEPS) {
          const factor = Math.max(0, 1 - excess / pushing)
          for (const { constraint, along } of chain) {
            if (along && (separations[constraint] as { gap: number }).gap > 0) {
              const current = scale[constraint] as number
              scale[constraint] = current * factor
              changed = true
            }
          }
          continue
        }
        // Without a chain to shrink, or after too many attempts, the gaps
        // among the crowded variables give way.
        const crowded = new Set(list)
        for (const [k, { left, right, gap: full }] of separations.entries()) {
          if (full > 0 && crowded.has(left) && crowded.has(right) && scale[k] !== 0) {
            scale[k] = attempt >= SHRINK_STEPS - 1 ? 0 : (scale[k] as number) / 2
            changed = true
          }
        }
      }
      if (!changed) {
        break
      }
    }
    return positions
  }
  let positions = solve(place)
  // A segment of another route that comes out between two segments of a
  // bundle that sit packed goes past the bundle, and the solve runs again.
  const bundles = groups.flatMap((group) => bundlesIn(segments, group))
  for (let round = 0; round < KEEP_OUT_ROUNDS; round++) {
    if (!keepOut(segments, bundles, packed, order, positions)) {
      break
    }
    place = placeOf(order)
    positions = solve(place)
  }

  let anyMoved = false
  for (const [s, segment] of segments.entries()) {
    const moved = positions[s] as number
    // A move within rounding is no move, so the rounds can end.
    if (segment.fixed || coincident(moved, segment.at)) {
      continue
    }
    anyMoved = true
    const path = paths[segment.route] as Array<Point>
    ;(path[segment.index] as Point)[axis === 0 ? 0 : 1] = moved
    ;(path[segment.index + 1] as Point)[axis === 0 ? 0 : 1] = moved
  }
  return anyMoved
}

// The segments that run across `axis`, with where each wants to be.
function collect(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  axis: number,
  constraints: ReadonlyArray<RouteConstraints | undefined>,
  splits: ReadonlyMap<string, Split> = new Map(),
): Array<Segment> {
  const along = 1 - axis
  const segments: Array<Segment> = []
  for (const [route, path] of paths.entries()) {
    const last = path.length - 2
    for (let index = 0; index <= last; index++) {
      if (axisOf(path, index) !== axis) {
        continue
      }
      const a = coord(path[index] as Point, along)
      const b = coord(path[index + 1] as Point, along)
      const at = coord(path[index] as Point, axis)
      const anchored = (constraints[route]?.anchors ?? []).some((point) => {
        const across = axis === 0 ? point[0] : point[1]
        const on = axis === 0 ? point[1] : point[0]
        return coincident(across, at) && between(on, Math.min(a, b), Math.max(a, b))
      })
      const fixed =
        index === 0 ||
        index === last ||
        anchored ||
        axisOf(path, index - 1) === -1 ||
        axisOf(path, index + 1) === -1
      // A jog between turns that go opposite ways wants its spot along the
      // run it shifts, between where the segments on either side of it
      // start and end: the middle, unless the route says otherwise. Other
      // segments want to stay put.
      let desired = at
      let run: readonly [number, number] | undefined
      let late: number | undefined
      if (!fixed) {
        const before = coord(path[index - 1] as Point, axis)
        const after = coord(path[index + 2] as Point, axis)
        if ((before - at) * (after - at) < 0) {
          const split = splits.get(`${route}:${index}`)
          if (split === undefined) {
            desired = before + jogAtOf(constraints[route]) * (after - before)
          } else {
            // As far from the merge as leaves room for the corner past it,
            // or for the S of a short jog that slants, and for the
            // adornments at the port when that is next, but never short of
            // the middle.
            const [near, far] = split.far === 1 ? [before, after] : [after, before]
            const next = split.far === 1 ? index + 2 === path.length - 1 : index === 1
            const pack = next ? (constraints[route]?.packs?.[split.far] ?? 0) : 0
            const corner = Math.max(constraints[route]?.corner ?? 0, 0)
            const slant = Math.max(constraints[route]?.slant ?? 0, 0)
            const d = Math.abs(b - a)
            const spread =
              !split.leaving && slant > 0 && d < 2 * corner
                ? slant * corner - ((slant - 1) * d) / 2
                : 0
            const room = Math.max(corner, spread) + Math.max(pack, 0)
            const keep = Math.min(Number.isFinite(room) ? room : 0, Math.abs(far - near) / 2)
            desired = far - Math.sign(far - near) * keep
            late = Math.sign(far - near)
          }
          run = [Math.min(before, after), Math.max(before, after)]
        }
      }
      segments.push({
        route,
        index,
        run,
        late,
        at,
        desired,
        low: Math.min(a, b),
        high: Math.max(a, b),
        fixed,
      })
    }
  }
  return segments
}

function jogAtOf(constraints: RouteConstraints | undefined): number {
  const value = constraints?.jogAt
  return value !== undefined && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.5
}

// Moves each jog that wants to be elsewhere past the segments of other
// routes that run alongside all of it, toward where it wants to be, before
// the solve. The separations keep every segment on its side of the others,
// so without this a jog stays behind a line that it could cross for free:
// its legs go opposite ways, so one leg's crossing with that line moves to
// the other. The jog stops before any segment that overlaps only part of
// it, or belongs to its own route, and before the walls. Returns whether
// any jog moved.
function leap(
  paths: Array<Array<Point>>,
  obstacles: ReadonlyArray<Obstacle>,
  segments: ReadonlyArray<Segment>,
  axis: number,
  constraints: ReadonlyArray<RouteConstraints | undefined>,
): boolean {
  const moves: Array<[Segment, number]> = []
  for (const jog of segments) {
    if (jog.fixed || coincident(jog.desired, jog.at)) {
      continue
    }
    const own = constraints[jog.route]?.avoid ?? []
    const [low, high] = walls(own.length === 0 ? obstacles : [...obstacles, ...own], jog, axis)
    const step = jog.desired > jog.at ? 1 : -1
    // A jog that shares its line with another route keeps to its side of
    // it, the side it parts toward, so it leaps only that way.
    const holds = segments.some(
      (other) =>
        other.route !== jog.route &&
        coincident(other.at, jog.at) &&
        (other.low < jog.high || coincident(other.low, jog.high)) &&
        (other.high > jog.low || coincident(other.high, jog.low)) &&
        goesFirst(paths, jog, other, axis) !== step < 0,
    )
    if (holds) {
      continue
    }
    const limit =
      step > 0
        ? Math.min(jog.desired, high ?? jog.desired)
        : Math.max(jog.desired, low ?? jog.desired)
    const ahead = segments
      .filter((other) => {
        const distance = step * (other.at - jog.at)
        return (
          other !== jog &&
          distance > 0 &&
          !coincident(other.at, jog.at) &&
          (step * (limit - other.at) > 0 || coincident(other.at, limit)) &&
          (other.low < jog.high || coincident(other.low, jog.high)) &&
          (other.high > jog.low || coincident(other.high, jog.low))
        )
      })
      .toSorted((a, b) => step * (a.at - b.at))
    let passed: number | undefined
    let target = limit
    for (const other of ahead) {
      const alongside =
        other.route !== jog.route &&
        other.low < jog.low &&
        !coincident(other.low, jog.low) &&
        other.high > jog.high &&
        !coincident(other.high, jog.high)
      if (!alongside) {
        // Halfway to the segment that stops it, which the solve then moves
        // the jog toward.
        target = ((passed ?? jog.at) + other.at) / 2
        break
      }
      passed = other.at
    }
    if (passed !== undefined) {
      moves.push([jog, target])
    }
  }
  for (const [jog, target] of moves) {
    const path = paths[jog.route] as Array<Point>
    ;(path[jog.index] as Point)[axis === 0 ? 0 : 1] = target
    ;(path[jog.index + 1] as Point)[axis === 0 ? 0 : 1] = target
  }
  return moves.length > 0
}

// The nearest obstacle edges on each side of a segment, among the obstacles
// whose extent overlaps the segment's.
function walls(
  obstacles: ReadonlyArray<Obstacle>,
  segment: Segment,
  axis: number,
): [number | undefined, number | undefined] {
  let low: number | undefined
  let high: number | undefined
  for (const o of obstacles) {
    const [near, far, start, end] =
      axis === 0 ? [o.left, o.right, o.top, o.bottom] : [o.top, o.bottom, o.left, o.right]
    const overlaps =
      start < segment.high &&
      !coincident(start, segment.high) &&
      end > segment.low &&
      !coincident(end, segment.low)
    if (!overlaps) {
      continue
    }
    if (far < segment.at || coincident(far, segment.at)) {
      low = low === undefined ? far : Math.max(low, far)
    } else if (near > segment.at || coincident(near, segment.at)) {
      high = high === undefined ? near : Math.min(high, near)
    }
  }
  // An obstacle edge a hair past the segment still holds it in place.
  if (low !== undefined && low > segment.at) {
    low = segment.at
  }
  if (high !== undefined && high < segment.at) {
    high = segment.at
  }
  return [low, high]
}

// Whether segment `a` takes the lower coordinate of the two. The routes go
// apart at each end of the path they share, and each runs on the side it
// turns toward there. Without a side at either end, the earlier route goes
// first.
function goesFirst(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  a: Segment,
  b: Segment,
  axis: number,
): boolean {
  const p = paths[a.route] as ReadonlyArray<Point>
  const q = paths[b.route] as ReadonlyArray<Point>
  const [dx, dy] = direction(p, a.index, 1)
  const [ex, ey] = direction(q, b.index, 1)
  const together = dx * ex + dy * ey > 0 ? 1 : -1
  const ahead = side(p, a.index, 1, q, b.index, together)
  // Behind, left and right swap.
  const left = ahead !== 0 ? ahead : -side(p, a.index, -1, q, b.index, -together)
  if (left === 0) {
    return a.route < b.route
  }
  // The left of travel along (dx, dy), with the Y axis down, is (dy, -dx).
  const leftward = axis === 0 ? Math.sign(dy) : Math.sign(-dx)
  // On the left, `a` takes the higher coordinate when left points that way.
  return left * leftward < 0
}

/**
 * Which side of one route another runs on, where they part, for routes that
 * leave one point heading the same way.
 *
 * @param p - The route whose side is asked.
 * @param q - The route it is compared with.
 * @returns `1` when `p` parts to the left of `q`, as seen along their
 * travel, `-1` when it parts to the right, and `0` when they end together
 * or part without a side.
 */
export function partingSide(p: ReadonlyArray<XY>, q: ReadonlyArray<XY>): number {
  const a = simplify(p)
  const b = simplify(q)
  return a.length < 2 || b.length < 2 ? 0 : side(a, 0, 1, b, 0, 1)
}

/**
 * The way a route makes its first turn.
 *
 * @param p - The route.
 * @returns `-1` for a turn to the left, `1` for one to the right, as seen
 * along its travel with the Y axis down, and `0` for a route that never
 * turns.
 */
export function firstTurn(p: ReadonlyArray<XY>): number {
  const a = simplify(p)
  return a.length < 3 ? 0 : turn(direction(a, 0, 1), direction(a, 1, 1))
}

// The direction of segment `index` when the route is walked forward (`step`
// 1) or backward (-1).
function direction(path: ReadonlyArray<Point>, index: number, step: number): [number, number] {
  const [x0, y0] = path[index] as Point
  const [x1, y1] = path[index + 1] as Point
  return [step * (x1 - x0), step * (y1 - y0)]
}

// Whether a turn from one direction to the next is to the left (-1), to the
// right (1), or straight on (0). With the Y axis down, a positive cross
// product turns clockwise, to the right.
function turn(from: [number, number], to: [number, number]): number {
  return Math.sign(from[0] * to[1] - from[1] * to[0])
}

// Which side of route q route p runs on, 1 for the left of travel and -1 for
// the right, decided where they part when walked from their overlapping
// segments in the direction `stepP` of p (q walks `stepQ`). 0 when they end
// together or part without a side.
function side(
  p: ReadonlyArray<Point>,
  i: number,
  stepP: number,
  q: ReadonlyArray<Point>,
  k: number,
  stepQ: number,
): number {
  let pi = i
  let qk = k
  for (let guard = p.length + q.length; guard > 0; guard--) {
    const travel = direction(p, pi, stepP)
    const unit = [Math.sign(travel[0]), Math.sign(travel[1])] as const
    const endP = p[stepP > 0 ? pi + 1 : pi] as Point
    const endQ = q[stepQ > 0 ? qk + 1 : qk] as Point
    const reachP = endP[0] * unit[0] + endP[1] * unit[1]
    const reachQ = endQ[0] * unit[0] + endQ[1] * unit[1]
    const nextP = pi + stepP
    const nextQ = qk + stepQ
    const hasP = nextP >= 0 && nextP < p.length - 1
    const hasQ = nextQ >= 0 && nextQ < q.length - 1
    let rankP = 0
    let rankQ = 0
    if (!coincident(reachP, reachQ)) {
      // The one that ends first turns there, and the other runs straight on.
      if (reachQ > reachP) {
        rankP = hasP ? turn(travel, direction(p, nextP, stepP)) : 0
      } else {
        rankQ = hasQ ? turn(travel, direction(q, nextQ, stepQ)) : 0
      }
    } else {
      if (!hasP && !hasQ) {
        return 0
      }
      const turnP = hasP ? direction(p, nextP, stepP) : undefined
      const turnQ = hasQ ? direction(q, nextQ, stepQ) : undefined
      if (
        turnP !== undefined &&
        turnQ !== undefined &&
        Math.sign(turnP[0]) === Math.sign(turnQ[0]) &&
        Math.sign(turnP[1]) === Math.sign(turnQ[1])
      ) {
        // Both turn the same way: the shared path goes on.
        pi = nextP
        qk = nextQ
        continue
      }
      rankP = turnP === undefined ? 0 : turn(travel, turnP)
      rankQ = turnQ === undefined ? 0 : turn(travel, turnQ)
    }
    // A left turn runs on the left of a straight run or a right turn.
    return rankP === rankQ ? 0 : rankP < rankQ ? 1 : -1
  }
  return 0
}
