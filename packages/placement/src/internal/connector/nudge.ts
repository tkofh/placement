import { clamp, coincident } from 'curvy/number'
import { atMost, before, inside, overlaps, touches, within } from '../../utils/tolerance.ts'
import { type DirectedEdge, preferredOrder } from '../graph/acyclic.ts'
import type { Obstacle } from '../graph/graph.ts'
import { type Axis, type XY, hi, lo, other, positiveLength, turnOf } from '../orient.ts'
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
// crossing is unavoidable, so the order is loose: the segments sit where
// they want to be, as a leap would put them, and the crossing falls on the
// leg that leaves. A segment that may only sit on one side of another, for
// the walls beside it or the anchors it keeps, goes there whatever the
// sides say. The orders of a line's segments come from these pairwise
// sides, the firmer first, and a cycle among them breaks at its loosest
// pair.
//
// The new positions come from a separation solver (see `separation.ts`). A
// segment wants to stay where it is, and moves no further than the obstacles
// beside it allow. A jog wants its spot along the run it shifts, and may
// first leap over the segments of other routes that run alongside all of
// it, since that moves a crossing from one of its legs to the other. A jog
// is the rise of a Z between two legs: a leg between two corners too short
// for them, or for the gap, is a kink that a slant or a sliding port takes
// care of, and the segment beside it stays put rather than balance the
// route into a staircase around the kink; a kink right past a port that
// may slide stays too, for the port to slide it away. The segments at the
// ends of a route attach to its pins and stay put, and the segment past
// each keeps to its side of the port, so the route still leaves and enters
// straight. A merged end's lane is the exception: the segment at that end
// moves across its axis, its end point with it, wanting the line out of the
// port and staying within the reach of its whisk. A jog right behind such a
// lane goes along its run no further than a gap short of the first other
// route in its way, so it never crosses one the search did not, nor presses
// a lane off its line. Other routes along the face where a merge's lanes
// end keep the gap from it across the lanes, as from the lanes themselves,
// since the whisks go on there. An end that runs among lanes that
// hold still holds up to a gap short of them, then steps past them, and the
// step stays out of every obstacle; lanes that move make room for it
// instead. A jog that shares its line with another route leaps only toward
// the side it parts to. Routes that leave one merge stay coupled, their
// lanes and the segments behind them the merge gap apart instead of the
// full gap, for as long as they run alongside each other from it, turning
// the same ways: the lanes pack as one bundle, in the order the routes part
// in, centered on the line where nothing is in the way. A coupled jog sits
// beside the rest of its bundle rather than at `jogAt`, so the bundle turns
// together. A jog where a route parts from its bundle goes as far from the
// merge as its corners leave room for, so the bundle stays together as long
// as it can, though it leaves the flow adornments between the route's ports
// a stretch of their own past it where its run has the room. Where a
// channel is too narrow for the full gap, the gaps of the segments that
// crowd it shrink until they fit, down to none, but no segment ever moves
// into a rect.

export type { XY }

type Point = [number, number]

export interface RouteConstraints {
  // Points the route must still pass through. The segments through them do
  // not move.
  readonly anchors?: ReadonlyArray<XY> | undefined
  // The anchors the route runs straight through, along the segment they
  // sit on: the segments beside that one keep the gap from them, so the
  // route never turns at one.
  readonly straight?: ReadonlyArray<XY> | undefined
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
  // The length the flow adornments between the route's ports take on a
  // run. A jog that parts from a bundle leaves them that much past it,
  // between its corner and the pack or corner beyond, where its run has
  // the room, so they get a stretch of their own, clear of the bundle.
  readonly flows?: number | undefined
  // How far a short jog's corners slide apart into an S, as a multiple of
  // what keeps the shape continuous (see `slants.ts`), which a parting jog
  // that slants keeps room for.
  readonly slant?: number | undefined
  // Whether the port at each end may slide along its side afterward (see
  // `ports.ts`). A jog right past such a port, too short for its two
  // corners, stays where it is for the port to slide it away, rather than
  // move along its run. Neither may by default.
  readonly sliding?: readonly [source: boolean, target: boolean] | undefined
  // The lane at each end that merges with room for its lanes, whose
  // segment moves across its axis rather than hold at its pin, or
  // `undefined` for an end that holds.
  readonly lanes?: readonly [source: Lane | undefined, target: Lane | undefined] | undefined
}

/**
 * The lane a merged end comes in on: the segment at that end, which moves
 * across its axis, its end point with it, to sit beside the lanes of its
 * partners.
 */
export interface Lane {
  /** The line out of the shared port, which the lane wants to sit on. */
  readonly line: number
  /** The least the lane may move to. */
  readonly low: number
  /** The most the lane may move to. */
  readonly high: number
  /**
   * The obstacle whose face the lane ends at, where its whisk starts past
   * the clearance, or `undefined` where it ends inside the clearance. Other
   * routes that run along that face across the lanes keep the gap from it,
   * as they would from the lanes, which the whisks continue there.
   */
  readonly rect?: number | undefined
}

// The face where the lanes of a merge end and their whisks start: its
// line, the way out of it, the band its lanes take along it, and the
// obstacle it belongs to.
interface Face {
  readonly merge: number
  readonly at: number
  readonly sign: number
  readonly low: number
  readonly high: number
  readonly rect: number
}

// The faces that the lanes of each merge end at, among the segments that
// run across `axis`: where a lane comes in along the other axis.
function facesOf(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  constraints: ReadonlyArray<Held | undefined>,
  axis: Axis,
): Array<Face> {
  const faces = new Map<number, Face>()
  for (const [route, path] of paths.entries()) {
    for (const end of [0, 1]) {
      const lane = constraints[route]?.lanes?.[end]
      const merge = constraints[route]?.merges?.[end] ?? -1
      if (lane?.rect === undefined || merge < 0 || path.length < 2) {
        continue
      }
      const point = (end === 0 ? path[0] : path.at(-1)) as Point
      const next = (end === 0 ? path[1] : path.at(-2)) as Point
      if (point[axis] === next[axis]) {
        continue
      }
      const at = point[axis]
      const sign = Math.sign(next[axis] - at)
      const along = point[other(axis)]
      const known = faces.get(merge)
      faces.set(merge, {
        merge,
        at: known === undefined ? at : sign > 0 ? Math.max(known.at, at) : Math.min(known.at, at),
        sign,
        low: Math.min(known?.low ?? along, along),
        high: Math.max(known?.high ?? along, along),
        rect: lane.rect,
      })
    }
  }
  return [...faces.values()]
}

/**
 * A channel too narrow for the gaps of the routes in it: what sits on
 * either side, which routes crowd it, and how much more room would fit
 * them at their gaps.
 */
export interface Crowded {
  /** The axis along which the room is short. */
  readonly axis: Axis
  /** The routes whose segments crowd the channel. */
  readonly routes: ReadonlyArray<number>
  /** The obstacles on either side of it, among those given to `nudge`. */
  readonly obstacles: ReadonlyArray<number>
  /** How much more room the routes need between them. */
  readonly need: number
}

/** What `nudgeRoutes` returns: the routes, and the channels that crowd. */
export interface Nudged {
  readonly routes: Array<Array<XY>>
  readonly crowded: ReadonlyArray<Crowded>
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
  // The least and most the segment may move to, where the segments on
  // either side of it pass through anchors: it never moves past one, so
  // the route still passes through them, and it keeps the gap from one
  // the route runs straight through. `bounds` are the anchors themselves,
  // which hold even where the channel leaves no room for the gap.
  readonly held?: readonly [low: number | undefined, high: number | undefined] | undefined
  readonly bounds?: readonly [low: number | undefined, high: number | undefined] | undefined
  // Whether it is a merged end's lane, which wants the line out of its
  // port.
  readonly lane: boolean
}

// A jog where a route parts from its bundle: which end of its run is far
// from the merge, `0` for the start, and whether the route leaves a group
// that goes on, which turns it tight and upright.
interface Split {
  readonly far: number
  readonly leaving: boolean
}

// Where an end that runs among the lanes of a merge steps past them (see
// `stepOut`): the end it is, and the least and most its step may move to
// along the lanes, with where it wants to be, as late as it may.
interface Step {
  readonly end: number
  readonly low: number
  readonly high: number
  readonly at: number
}

// What each route keeps through the passes: what it was given, and its
// steps.
interface Held extends RouteConstraints {
  readonly steps?: ReadonlyArray<Step> | undefined
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
 * last segment of each route attach to its pins and do not move, except
 * at the ends its constraints give `lanes`. A segment that is neither
 * horizontal nor vertical does not move, nor do its neighbors.
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
  return nudgeRoutes(routes, obstacles, gap, constraints, mergeGap).routes
}

/**
 * Moves the overlapping segments of orthogonal routes apart, as `nudge`
 * does, and reports the channels too narrow for their gaps.
 *
 * @param routes - The routes, as `nudge` takes them.
 * @param obstacles - The rects that segments may not move into.
 * @param gap - The space between the strokes of overlapping segments.
 * @param constraints - What each route keeps, by route index.
 * @param mergeGap - The distance between coupled segments.
 * @returns The routes with their segments moved, and the crowded channels,
 * each once, with the most room it was found to need.
 */
export function nudgeRoutes(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  obstacles: ReadonlyArray<Obstacle>,
  gap: number,
  constraints: ReadonlyArray<RouteConstraints | undefined> = [],
  mergeGap = gap,
): Nudged {
  const paths = routes.map(simplify)
  // The crowded channels, each once: the passes and rounds find the same
  // ones again, and the first finding of each is the fullest.
  const crowded = new Map<string, Crowded>()
  const report = (found: Crowded) => {
    const key = `${found.axis}|${found.routes.join(',')}|${found.obstacles.join(',')}`
    const known = crowded.get(key)
    if (known === undefined || known.need < found.need) {
      crowded.set(key, found)
    }
  }
  const spacing = positiveLength(gap)
  const tight = Math.min(positiveLength(mergeGap), spacing)
  const thickness = paths.map((_, route) => positiveLength(constraints[route]?.thickness))
  const mergesOf = (route: number) => constraints[route]?.merges ?? []
  const steps: Array<Array<Step>> = paths.map(() => [])
  // The ends of other routes step out from among the lanes of a merge
  // that hold still, as they do, and the steps stay between the obstacles
  // around the port and the lanes: those among the lanes as found, then,
  // once more, those the passes leave among them. Lanes that move make
  // room for such an end themselves.
  const holds = (route: number, index: number) =>
    (paths[route] as ReadonlyArray<Point>).length === 2 ||
    constraints[route]?.lanes?.[index === 0 ? 0 : 1] === undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    const found = bundlesOf(paths, mergesOf)
    const stepped = stepOut(paths, found.lanes, found.ids, obstacles, {
      holds,
      thickness,
      spacing,
      tight,
      corners: constraints.map((given) => Math.max(given?.corner ?? 0, 0)),
      slants: constraints.map((given) => Math.max(given?.slant ?? 0, 0)),
    })
    if (attempt > 0 && stepped.every((points) => points.length === 0)) {
      break
    }
    for (const [route, list] of stepped.entries()) {
      ;(steps[route] as Array<Step>).push(...list)
    }
    const held = paths.map((_, route): Held | undefined => {
      const given = constraints[route]
      const list = steps[route] ?? []
      return list.length === 0 ? given : { ...given, steps: list }
    })
    // The passes move points but never add or drop them, so the couples
    // found before them hold throughout. A jog where a route parts from its
    // bundle wants the far end of its run from the merge, so the bundle
    // stays together as long as it can.
    const { ids, couples, groups, losses, leaves } = bundlesOf(paths, mergesOf)
    const splits = paths.map(() => new Map<number, Split>())
    for (const [list, leaving] of [
      [losses, false],
      [leaves, true],
    ] as const) {
      for (const [route, entries] of list.entries()) {
        const count = (paths[route] as Array<Point>).length - 1
        for (const { start, k } of entries) {
          const index = start ? k : count - 1 - k
          if (index > 0 && index < count - 1) {
            ;(splits[route] as Map<number, Split>).set(index, { far: start ? 1 : 0, leaving })
          }
        }
      }
    }
    const packed = (a: Segment, b: Segment) =>
      tight + ((thickness[a.route] as number) + (thickness[b.route] as number)) / 2
    const gapOf = (a: Segment, b: Segment) =>
      couples.has(ids.pair(ids.segment(a.route, a.index), ids.segment(b.route, b.index)))
        ? packed(a, b)
        : spacing + ((thickness[a.route] as number) + (thickness[b.route] as number)) / 2
    // Moving one axis changes the extents of the other's segments, which
    // can make them overlap, so the passes repeat until neither moves
    // anything.
    for (let round = 0; round < ROUNDS; round++) {
      const bundles = { ids, couples, groups, packed }
      const movedX = nudgeAxis(paths, obstacles, gapOf, bundles, splits, 0, held, report, spacing)
      const movedY = nudgeAxis(paths, obstacles, gapOf, bundles, splits, 1, held, report, spacing)
      if (!movedX && !movedY) {
        break
      }
    }
  }
  return { routes: paths.map(simplify), crowded: [...crowded.values()] }
}

// The integer ids of segments and of pairs of them, for the paths of one
// nudge: a segment is `route * stride + index`, for a stride past the
// longest path, and a pair is `a * size + b`, for the size past every
// segment id. They hold while no path gains or loses points.
interface Ids {
  readonly stride: number
  readonly size: number
  readonly segment: (route: number, index: number) => number
  readonly pair: (a: number, b: number) => number
}

function idsOf(paths: ReadonlyArray<ReadonlyArray<Point>>): Ids {
  const stride = Math.max(1, ...paths.map((path) => path.length))
  const size = paths.length * stride
  return {
    stride,
    size,
    segment: (route, index) => route * stride + index,
    pair: (a, b) => a * size + b,
  }
}

// How the routes that leave one merge run together.
interface Bundles {
  // The ids of the segments and pairs below.
  readonly ids: Ids
  // The segments of routes that still run together, as the ids of both
  // orders of each pair.
  readonly couples: Set<number>
  // Each merge's lanes, the segments its routes come off it on, and its
  // couples, as the ids of both orders of each pair alongside each other.
  // Each reads as one line to the other routes.
  readonly groups: Array<Set<number>>
  // Each merge's lanes, as segment ids.
  readonly lanes: Array<Set<number>>
  // Where each route loses a partner it ran with: the merge end it is
  // walked from, and how many segments from the merge.
  readonly losses: Array<Array<{ readonly start: boolean; readonly k: number }>>
  // Where each route leaves a group that goes on without it: it goes on
  // alone, and at least two of the routes it ran with go on together. A
  // pair that parts, or a route whose last partner ends, leaves no group.
  readonly leaves: Array<Array<{ readonly start: boolean; readonly k: number }>>
}

// Walked from the merge, the lanes are the first segments, coupled where
// they meet, and two routes stay coupled while each next pair of segments
// heads the same way alongside each other: they turn the same ways and
// their extents overlap, wherever the nudge puts them across. Each loses
// the other at the first segment past the last they share.
function bundlesOf(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  merges: (route: number) => ReadonlyArray<number>,
): Bundles {
  const ids = idsOf(paths)
  const couples = new Set<number>()
  const groups: Array<Set<number>> = []
  const lanes: Array<Set<number>> = []
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
  // A couple, as the ids of both orders of the pair.
  const couple = (set: Set<number>, p: number, ia: number, q: number, ib: number) => {
    const a = ids.segment(p, ia)
    const b = ids.segment(q, ib)
    set.add(ids.pair(a, b)).add(ids.pair(b, a))
  }
  for (const list of byMerge.values()) {
    const group = new Set<number>()
    groups.push(group)
    lanes.push(
      new Set(
        list.map(([route, start]) =>
          ids.segment(route, start ? 0 : (paths[route] as ReadonlyArray<Point>).length - 2),
        ),
      ),
    )
    // How many segments from the merge each pair shares, by their places
    // in the list.
    const shared = new Map<number, number>()
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
          if (
            axis === -1 ||
            axis !== axisOf(b, ib) ||
            Math.sign(da[0]) !== Math.sign(db[0]) ||
            Math.sign(da[1]) !== Math.sign(db[1])
          ) {
            break
          }
          const along = other(axis)
          const [a0, a1] = [(a[ia] as Point)[along], (a[ia + 1] as Point)[along]]
          const [b0, b1] = [(b[ib] as Point)[along], (b[ib + 1] as Point)[along]]
          const meets = touches(
            Math.min(a0, a1),
            Math.max(a0, a1),
            Math.min(b0, b1),
            Math.max(b0, b1),
          )
          if (k === 0) {
            if (meets) {
              couple(couples, p, ia, q, ib)
              couple(group, p, ia, q, ib)
            }
            continue
          }
          if (!meets) {
            break
          }
          couple(couples, p, ia, q, ib)
          couple(group, p, ia, q, ib)
          last = k
        }
        ;(losses[p] as Array<{ start: boolean; k: number }>).push({ start: fromStart, k: last + 1 })
        ;(losses[q] as Array<{ start: boolean; k: number }>).push({ start: toStart, k: last + 1 })
        shared.set(i * list.length + j, last).set(j * list.length + i, last)
      }
    }
    const along = (a: number, b: number) => shared.get(a * list.length + b) ?? -1
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
  return { ids, couples, groups, lanes, losses, leaves }
}

/** Where the routes that leave one merge run together, and where they part. */
export interface Bundled {
  /**
   * The segments of each route that still run alongside another route of
   * its merge, turning the same ways, by index.
   */
  readonly coupled: Array<Set<number>>
  /**
   * The corners of each route where it goes on alone from a group that
   * goes on without it, which turn as tight as the merge allows, by index.
   */
  readonly parting: Array<Set<number>>
}

/**
 * Where the routes that leave one merge run together and where they part,
 * once the nudge has placed them.
 *
 * @param routes - The routes, as points with no repeats and no points in
 * the middle of a straight run.
 * @param merges - The merges each route's start and end lead into, as ids
 * shared by the routes of each merge, or `-1` for an end that does not
 * merge.
 * @param short - The length below which a segment is no visible turn of
 * the bundle, such as the gap: a coupled segment that short is left out,
 * and so is a parting corner whose segment away from the merge is that
 * short, so a residue of a port's slide is free to slant. Defaults to `0`.
 * @returns The coupled segments and parting corners of each route.
 */
export function bundled(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  merges: ReadonlyArray<readonly [number, number]>,
  short = 0,
): Bundled {
  const paths = routes.map(simplify)
  const { ids, couples, lanes, leaves } = bundlesOf(paths, (route) => merges[route] ?? [])
  // The lanes lead into the whisks, which keep their own corners.
  const lane = new Set<number>()
  for (const set of lanes) {
    for (const segment of set) {
      lane.add(segment)
    }
  }
  const visible = (path: ReadonlyArray<Point>, index: number) => {
    const [x0, y0] = path[index] as Point
    const [x1, y1] = path[index + 1] as Point
    return atMost(short, Math.abs(x1 - x0) + Math.abs(y1 - y0))
  }
  const coupled = paths.map(() => new Set<number>())
  // Both orders of each pair are in, so the first segment of each covers
  // every coupled segment.
  for (const key of couples) {
    const segment = Math.floor(key / ids.size)
    const [route, index] = [Math.floor(segment / ids.stride), segment % ids.stride]
    if (!lane.has(segment) && visible(paths[route] as ReadonlyArray<Point>, index)) {
      coupled[route]?.add(index)
    }
  }
  const parting = paths.map((path, route) => {
    const corners = new Set<number>()
    for (const { start, k } of leaves[route] ?? []) {
      // The corner between the last segment shared and the next.
      const corner = start ? k : path.length - 1 - k
      if (corner > 0 && corner < path.length - 1 && visible(path, start ? corner : corner - 1)) {
        corners.add(corner)
      }
    }
    return corners
  })
  return { coupled, parting }
}

/**
 * The corners where routes that leave one merge go on alone from a group
 * that goes on without them (see `bundled`).
 *
 * @param routes - The routes, as `bundled` takes them.
 * @param merges - The merges of each route's ends, as `bundled` takes them.
 * @returns The indices of each route's parting corners.
 */
export const partingCorners = (
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  merges: ReadonlyArray<readonly [number, number]>,
): Array<Set<number>> => bundled(routes, merges).parting

// Coupled segments want to sit together, as one bundle, each the merge gap
// from the next in their current order: against a member that is not a
// jog, which stays put, or else about the mean of where the jogs want to
// be. A jog in a bundle wants the bundle's spot rather than its own, within
// its run. Other members keep their spot, since moving the bottom of a U
// lengthens the route and drags both legs across what lies between.
function cohere(
  segments: Array<Segment>,
  ids: Ids,
  couples: ReadonlySet<number>,
  gapOf: (a: Segment, b: Segment) => number,
  order: (a: number, b: number) => number = (a, b) =>
    (segments[a] as Segment).at - (segments[b] as Segment).at,
): Array<Segment> {
  if (couples.size === 0) {
    return segments
  }
  const result = [...segments]
  for (const members of bundlesIn(segments, ids, couples)) {
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
  ids: Ids,
  couples: ReadonlySet<number>,
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
  const index = new Map(
    segments.map((segment, i) => [ids.segment(segment.route, segment.index), i]),
  )
  for (const key of couples) {
    const a = index.get(Math.floor(key / ids.size))
    const b = index.get(key % ids.size)
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
  ranges: ReadonlyArray<readonly [number, number]>,
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
      if (atMost(apart, most)) {
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
      const alongside = members.filter((m) => extentsOverlap(segment, segments[m] as Segment))
      const place = order.indexOf(s)
      const earlier = alongside.filter((m) => order.indexOf(m) < place)
      const later = alongside.filter((m) => order.indexOf(m) > place)
      const inside = earlier.some((a) =>
        later.some((b) => extentsOverlap(segments[a] as Segment, segments[b] as Segment)),
      )
      if (!inside) {
        continue
      }
      const mean =
        alongside.reduce((sum, m) => sum + (positions[m] as number), 0) / alongside.length
      // It goes past the side with fewer of the bundle's segments, or else
      // the nearer to where it wants to be, as long as its walls leave room
      // past the bundle there; with no room on either side, it stays, and
      // the crowding is reported.
      const [floor, ceiling] = ranges[s] as readonly [number, number]
      const placed = alongside.map((m) => positions[m] as number)
      const belowOpen = !Number.isFinite(floor) || before(floor, Math.min(...placed))
      const aboveOpen = !Number.isFinite(ceiling) || before(Math.max(...placed), ceiling)
      if (!belowOpen && !aboveOpen) {
        continue
      }
      const wanted =
        earlier.length !== later.length ? earlier.length < later.length : segment.desired <= mean
      const low = wanted ? belowOpen : !aboveOpen
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

// Steps the end segments of routes out from among the lanes of a merge
// that hold still, those `holds` names. Such lanes hold still as the
// segments at the ends of every route do, so nothing else takes an end out
// from among those that sit packed, next to each other, when it runs
// alongside one of them, no further from the line than the lanes reach.
// The end leaves its port straight, as held, up
// to a gap and the reach of the step's corners (or of its S) short of where
// it meets the first of those lanes, though at least out of the obstacles
// around the port, then steps past them to the side with fewer of them, or
// the nearer one, a gap from the last. The rest of the segment runs on
// there, so the segment past it moves its corner.
// The step and the run past it keep out of every obstacle: where the step
// would cross one, it comes back toward the port to the obstacle's near
// edge. An end that meets the lanes within the obstacles, whose step finds
// no room outside them, whose run past the step would lie in one, or whose
// step would turn the segment past it back, stays as it is. Changes the
// paths in place, and returns where each route steps out: the passes move
// a step no nearer the port than the obstacles around it, nor nearer the
// lanes than that gap and reach.
function stepOut(
  paths: Array<Array<Point>>,
  merges: ReadonlyArray<ReadonlySet<number>>,
  ids: Ids,
  obstacles: ReadonlyArray<Obstacle>,
  {
    holds,
    thickness,
    spacing,
    tight,
    corners,
    slants,
  }: {
    readonly holds: (route: number, index: number) => boolean
    readonly thickness: ReadonlyArray<number>
    readonly spacing: number
    readonly tight: number
    readonly corners: ReadonlyArray<number>
    readonly slants: ReadonlyArray<number>
  },
): Array<Array<Step>> {
  const steps: Array<Array<Step>> = paths.map(() => [])
  const width = (route: number) => thickness[route] ?? 0
  interface LaneSegment {
    readonly route: number
    readonly axis: Axis
    readonly at: number
    readonly low: number
    readonly high: number
  }
  for (const merge of merges) {
    const members = new Set<number>()
    const lanes: Array<LaneSegment> = []
    for (const key of merge) {
      const route = Math.floor(key / ids.stride)
      const index = key % ids.stride
      const path = paths[route] as Array<Point>
      members.add(route)
      const axis = axisOf(path, index)
      if (axis === -1 || !holds(route, index)) {
        continue
      }
      const along = other(axis)
      const [a, b] = [(path[index] as Point)[along], (path[index + 1] as Point)[along]]
      const at = (path[index] as Point)[axis]
      lanes.push({ route, axis, at, low: Math.min(a, b), high: Math.max(a, b) })
    }
    // The lanes that sit packed, next to each other, by the axis they run
    // across.
    const runs: Array<Array<LaneSegment>> = []
    for (const axis of [0, 1]) {
      const parallel = lanes.filter((lane) => lane.axis === axis).toSorted((a, b) => a.at - b.at)
      let run: Array<LaneSegment> = []
      for (const lane of parallel) {
        const last = run.at(-1)
        const most = last === undefined ? 0 : tight + (width(last.route) + width(lane.route)) / 2
        if (last !== undefined && !atMost(lane.at - last.at, most)) {
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
        if (axis === -1) {
          continue
        }
        const along = other(axis)
        const port = (end === 0 ? path[0] : path.at(-1)) as Point
        const corner = (end === 0 ? path[1] : path.at(-2)) as Point
        const at = port[axis]
        const [from, to] = [port[along], corner[along]]
        const extent = { low: Math.min(from, to), high: Math.max(from, to) }
        const run = runs.find(
          (list) =>
            list.length > 1 &&
            (list[0] as LaneSegment).axis === axis &&
            within(at, (list[0] as LaneSegment).at, (list.at(-1) as LaneSegment).at) &&
            list.some((lane) => extentsOverlap(extent, lane)),
        )
        if (run === undefined) {
          continue
        }
        const lanesBelow = run.filter((lane) => before(lane.at, at))
        const lanesAbove = run.filter((lane) => before(at, lane.at))
        const mean = run.reduce((sum, lane) => sum + lane.at, 0) / run.length
        const lower =
          lanesBelow.length !== lanesAbove.length
            ? lanesBelow.length < lanesAbove.length
            : at <= mean
        const outer = (lower ? run[0] : run.at(-1)) as LaneSegment
        const line =
          outer.at + (lower ? -1 : 1) * (spacing + (width(route) + width(outer.route)) / 2)
        // How far the end runs straight: out of the obstacles around its
        // port, and short of the lanes.
        const heading = Math.sign(to - from)
        let reach = 0
        for (const o of obstacles) {
          if (within(at, lo(o, axis), hi(o, axis)) && within(from, lo(o, along), hi(o, along))) {
            reach = Math.max(reach, heading * ((heading > 0 ? hi(o, along) : lo(o, along)) - from))
          }
        }
        // Where it meets the first of the lanes it runs alongside, and how
        // far short of it the step stays: the gap, and the reach of its
        // corners, or of the S they make when the step is short and slants
        // (see `slants.ts`).
        const rise = Math.abs(line - at)
        const bend = corners[route] ?? 0
        const slant = slants[route] ?? 0
        const spread = slant > 0 && rise < 2 * bend ? slant * bend - ((slant - 1) * rise) / 2 : 0
        let meets = Number.POSITIVE_INFINITY
        let room = 0
        for (const lane of run) {
          if (extentsOverlap(extent, lane)) {
            const distance = heading * ((heading > 0 ? lane.low : lane.high) - from)
            if (distance < meets) {
              meets = distance
              room = spacing + (width(route) + width(lane.route)) / 2 + Math.max(bend, spread)
            }
          }
        }
        const next = (end === 0 ? path[2] : path.at(-3)) as Point
        const turn = next[axis] - corner[axis]
        if (
          !(reach > 0) ||
          atMost(meets, reach) ||
          turn === 0 ||
          Math.sign(next[axis] - line) !== Math.sign(turn)
        ) {
          continue
        }
        // The step crosses from the end's line to the new one: an obstacle
        // it would cross brings it back toward the port, to that obstacle's
        // near edge, as long as that is still out of the obstacles around
        // the port.
        const [across0, across1] = [Math.min(at, line), Math.max(at, line)]
        let distance = Math.max(reach, meets - room)
        for (let guard = obstacles.length; guard >= 0; guard--) {
          const along0 = from + heading * distance
          const blocking = obstacles.find(
            (o) =>
              inside(along0, lo(o, along), hi(o, along)) &&
              overlaps(across0, across1, lo(o, axis), hi(o, axis)),
          )
          if (blocking === undefined) {
            break
          }
          distance = heading * ((heading > 0 ? lo(blocking, along) : hi(blocking, along)) - from)
        }
        const stepAt = from + heading * distance
        const [run0, run1] = [Math.min(stepAt, to), Math.max(stepAt, to)]
        if (
          before(distance, reach) ||
          obstacles.some(
            (o) =>
              (inside(stepAt, lo(o, along), hi(o, along)) &&
                overlaps(across0, across1, lo(o, axis), hi(o, axis))) ||
              (inside(line, lo(o, axis), hi(o, axis)) &&
                overlaps(run0, run1, lo(o, along), hi(o, along))),
          )
        ) {
          continue
        }
        const point = (a: number, b: number): Point => (axis === 0 ? [a, b] : [b, a])
        const step = point(at, stepAt)
        const out = point(line, stepAt)
        const moved = point(line, to)
        if (end === 0) {
          path.splice(0, 2, port, step, out, moved)
        } else {
          path.splice(-2, 2, moved, out, step, port)
        }
        const [early, late] = [from + heading * reach, from + heading * (meets - room)]
        ;(steps[route] as Array<Step>).push({
          end,
          low: Math.min(early, late, stepAt),
          high: Math.max(early, late, stepAt),
          at: stepAt,
        })
      }
    }
  }
  return steps
}

// Whether two extents along a line overlap by more than a point.
const extentsOverlap = (
  a: { readonly low: number; readonly high: number },
  b: { readonly low: number; readonly high: number },
): boolean => overlaps(a.low, a.high, b.low, b.high)

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

// The axis a segment runs across: 0 for a vertical segment, whose x the
// x pass moves, 1 for a horizontal one, and -1 for a diagonal one or one
// of no length, which neither pass moves.
function axisOf(route: ReadonlyArray<Point>, index: number): Axis | -1 {
  const [x0, y0] = route[index] as Point
  const [x1, y1] = route[index + 1] as Point
  return x0 === x1 ? (y0 === y1 ? -1 : 0) : y0 === y1 ? 1 : -1
}

// Whether a segment runs diagonally. One of no length does not: it is
// where a jog moved onto the line of the segment past it, and the
// segments on either side of it run on as one.
function slanted(route: ReadonlyArray<Point>, index: number): boolean {
  const [x0, y0] = route[index] as Point
  const [x1, y1] = route[index + 1] as Point
  return x0 !== x1 && y0 !== y1
}

// Moves the segments that run across `axis`: vertical ones for axis 0,
// horizontal ones for axis 1. Returns whether any segment moved.
function nudgeAxis(
  paths: Array<Array<Point>>,
  obstacles: ReadonlyArray<Obstacle>,
  gapOf: (a: Segment, b: Segment) => number,
  {
    ids,
    couples,
    groups,
    packed,
  }: {
    readonly ids: Ids
    readonly couples: ReadonlySet<number>
    // Each merge's lanes and couples, and how far apart their segments
    // pack.
    readonly groups: ReadonlyArray<ReadonlySet<number>>
    readonly packed: (a: Segment, b: Segment) => number
  },
  splits: ReadonlyArray<ReadonlyMap<number, Split>>,
  axis: Axis,
  constraints: ReadonlyArray<Held | undefined>,
  report: (found: Crowded) => void,
  keep: number,
): boolean {
  let collected = holdLaneJogs(
    paths,
    axis,
    collect(paths, axis, constraints, splits, keep),
    constraints,
    gapOf,
  )
  let segments = cohere(collected, ids, couples, gapOf)
  if (leap(paths, obstacles, segments, axis, constraints)) {
    collected = holdLaneJogs(
      paths,
      axis,
      collect(paths, axis, constraints, splits, keep),
      constraints,
      gapOf,
    )
    segments = cohere(collected, ids, couples, gapOf)
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
      if (sa.route !== sb.route && touches(sa.low, sa.high, sb.low, sb.high)) {
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
  // The range each segment may sit in: between the walls beside it and the
  // anchors on the segments beside it, or its line alone when it stays put.
  const ranges = segments.map((segment): readonly [number, number] => {
    if (segment.fixed) {
      return [segment.at, segment.at]
    }
    const own = constraints[segment.route]?.avoid ?? []
    const [low, high] = walls(own.length === 0 ? obstacles : [...obstacles, ...own], segment, axis)
    const [floor, ceiling] = segment.held ?? [undefined, undefined]
    return [
      Math.max(low ?? Number.NEGATIVE_INFINITY, floor ?? Number.NEGATIVE_INFINITY),
      Math.min(high ?? Number.POSITIVE_INFINITY, ceiling ?? Number.POSITIVE_INFINITY),
    ]
  })
  // Which of two segments must take the lower coordinate, `0` for neither:
  // one whose whole range sits at or below the other's, whatever the sides
  // say, as a segment that stays put on the line of a wall leaves no room
  // on that side. Two that stay put on one line force nothing, and nor does
  // a range open on the side in question.
  const below = (top: number, bottom: number) =>
    Number.isFinite(top) && Number.isFinite(bottom) && atMost(top, bottom)
  const forced = (a: number, b: number) => {
    const [ra, rb] = [
      ranges[a] as readonly [number, number],
      ranges[b] as readonly [number, number],
    ]
    const still = (segments[a] as Segment).fixed && (segments[b] as Segment).fixed
    if (ra[0] > ra[1] || rb[0] > rb[1]) {
      return 0
    }
    if (below(ra[1], rb[0]) && !(still && coincident(ra[1], rb[0]))) {
      return 1
    }
    if (below(rb[1], ra[0]) && !(still && coincident(rb[1], ra[0]))) {
      return -1
    }
    return 0
  }

  // The preferences of each line, with how firmly each holds: a cycle among
  // them breaks at the loosest, where a crossing is unavoidable anyway.
  const preferences = new Map<number, Array<DirectedEdge & { readonly firmness: number }>>()
  const prefer = (root: number, first: number, second: number, firmness: number) => {
    const list = preferences.get(root) ?? []
    list.push({ source: first, target: second, firmness })
    preferences.set(root, list)
  }
  const paired = new Set<number>()
  for (const [a, b] of pairs) {
    paired.add(a * segments.length + b)
    const sa = segments[a] as Segment
    const sb = segments[b] as Segment
    const { lower, firmness: sided } = goesFirst(paths, sa, sb, axis)
    let first = lower ? [a, b] : [b, a]
    let firmness = sided
    // Where a crossing is unavoidable either way, it falls on whichever leg
    // leaves the segments where they want to be, as a leap would put it.
    if (firmness === LOOSE && !coincident(sa.desired, sb.desired)) {
      first = sa.desired < sb.desired ? [a, b] : [b, a]
    }
    const must = forced(a, b)
    if (must !== 0) {
      first = must > 0 ? [a, b] : [b, a]
      firmness = FORCED
    }
    prefer(find(a), first[0] as number, first[1] as number, firmness)
  }
  // Segments of one line that never touch still order each other through
  // the segments between them, so where their ranges force an order, the
  // chain follows it.
  for (const [root, list] of members) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i] as number, list[j] as number]
        if (paired.has(a * segments.length + b)) {
          continue
        }
        const must = forced(a, b)
        if (must !== 0) {
          prefer(root, must > 0 ? a : b, must > 0 ? b : a, FORCED)
        }
      }
    }
  }
  const rank = new Int32Array(segments.length)
  for (const [root, list] of members) {
    const local = new Map(list.map((segment, i) => [segment, i]))
    const own = preferences.get(root) ?? []
    const position = preferredOrder(
      list.length,
      own.map(({ source, target }) => ({
        source: local.get(source) as number,
        target: local.get(target) as number,
      })),
      own.map(({ firmness }) => firmness),
    )
    for (const [i, segment] of list.entries()) {
      rank[segment] = position[i] as number
    }
  }
  // Bundles pack in the order the routes keep: on one line, the order they
  // part in.
  segments = cohere(collected, ids, couples, gapOf, (a, b) => {
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

  const faces = facesOf(paths, constraints, axis)
  // Solves for the positions with the segments in `place` across the lines.
  const solve = (place: Int32Array): Float64Array => {
    // The variables: one per segment, then the walls that obstacles put
    // beside the segments that move.
    const variables: Array<Variable> = segments.map((s) => ({ desired: s.desired, fixed: s.fixed }))
    // The obstacle each wall variable came from, or -1 for a port or a
    // rect only one route avoids.
    const wallOf: Array<number> = segments.map(() => -1)
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
      const [low, high, lowFrom, highFrom] = walls(
        own.length === 0 ? obstacles : [...obstacles, ...own],
        segment,
        axis,
      )
      // The stroke keeps off the walls too, where there is room.
      const half = positiveLength(constraints[segment.route]?.thickness) / 2
      if (low !== undefined) {
        variables.push({ desired: low, fixed: true })
        wallOf.push(lowFrom < obstacles.length ? lowFrom : -1)
        separations.push({ left: variables.length - 1, right: s, gap: half })
      }
      if (high !== undefined) {
        variables.push({ desired: high, fixed: true })
        wallOf.push(highFrom < obstacles.length ? highFrom : -1)
        separations.push({ left: s, right: variables.length - 1, gap: half })
      }
      // A segment along the face where a merge's lanes end, across them,
      // keeps the gap from it, as from the lanes; the merge's own do not.
      const merges: ReadonlyArray<number> = constraints[segment.route]?.merges ?? []
      for (const face of faces) {
        if (
          merges.includes(face.merge) ||
          !atMost(0, face.sign * (segment.at - face.at)) ||
          !overlaps(segment.low, segment.high, face.low, face.high)
        ) {
          continue
        }
        variables.push({ desired: face.at, fixed: true })
        wallOf.push(face.rect)
        const wall = variables.length - 1
        const clear = keep + half
        separations.push(
          face.sign > 0
            ? { left: wall, right: s, gap: clear }
            : { left: s, right: wall, gap: clear },
        )
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
    const at = new Map(segments.map((segment, s) => [ids.segment(segment.route, segment.index), s]))
    for (const [s, segment] of segments.entries()) {
      const next = at.get(ids.segment(segment.route, segment.index + 2))
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
    // the route still leaves and enters it straight out from its side, and
    // a segment stays short of the anchors on the segments beside it.
    for (const [s, segment] of segments.entries()) {
      const path = paths[segment.route] as Array<Point>
      const ends = [
        ...(segment.index === 1 ? [path[0] as Point] : []),
        ...(segment.index === path.length - 3 ? [path[path.length - 1] as Point] : []),
      ]
      // A segment on its port's line has no side of it to keep, but one at
      // a bound it holds keeps it.
      const bounds: Array<readonly [at: number, below: boolean]> = segment.fixed
        ? []
        : ends.flatMap((end) =>
            end[axis] === segment.at ? [] : [[end[axis], end[axis] < segment.at] as const],
          )
      if (!segment.fixed && segment.held !== undefined) {
        const [floor, ceiling] = segment.held
        if (floor !== undefined) {
          bounds.push([floor, true])
        }
        if (ceiling !== undefined) {
          bounds.push([ceiling, false])
        }
      }
      for (const [bound, below] of bounds) {
        variables.push({ desired: bound, fixed: true })
        wallOf.push(-1)
        const wall = variables.length - 1
        separations.push(
          below ? { left: wall, right: s, gap: 0 } : { left: s, right: wall, gap: 0 },
        )
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
        if (attempt === 0 && chain !== undefined && excess !== undefined) {
          report({
            axis,
            routes: [
              ...new Set(
                list.flatMap((v) => (v < segments.length ? [(segments[v] as Segment).route] : [])),
              ),
            ].toSorted((a, b) => a - b),
            obstacles: [
              ...new Set(
                list.flatMap((v) => ((wallOf[v] as number) >= 0 ? [wallOf[v] as number] : [])),
              ),
            ].toSorted((a, b) => a - b),
            need: excess,
          })
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
  const bundles = groups.flatMap((group) => bundlesIn(segments, ids, group))
  for (let round = 0; round < KEEP_OUT_ROUNDS; round++) {
    if (!keepOut(segments, bundles, packed, order, positions, ranges)) {
      break
    }
    place = placeOf(order)
    positions = solve(place)
  }

  let anyMoved = false
  for (const [s, segment] of segments.entries()) {
    // Where a crowded channel left the solve no room, the anchors on the
    // segments beside this one still hold, and so do its walls: the route
    // passes through its anchors and never into a rect.
    const [floor, ceiling] = segment.bounds ?? [undefined, undefined]
    const [low, high] = ranges[s] as readonly [number, number]
    const walled = low <= high
    const placed = clamp(
      positions[s] as number,
      Math.max(floor ?? Number.NEGATIVE_INFINITY, walled ? low : Number.NEGATIVE_INFINITY),
      Math.min(ceiling ?? Number.POSITIVE_INFINITY, walled ? high : Number.POSITIVE_INFINITY),
    )
    // A lane within rounding of its line sits on it, so its route runs
    // straight in.
    const moved = segment.lane && coincident(placed, segment.desired) ? segment.desired : placed
    if (segment.fixed || moved === segment.at) {
      continue
    }
    // A move within rounding is no move, so the rounds can end.
    const path = paths[segment.route] as Array<Point>
    if (coincident(moved, segment.at)) {
      if (segment.lane) {
        ;(path[segment.index] as Point)[axis] = moved
        ;(path[segment.index + 1] as Point)[axis] = moved
      }
      continue
    }
    anyMoved = true
    ;(path[segment.index] as Point)[axis] = moved
    ;(path[segment.index + 1] as Point)[axis] = moved
  }
  return anyMoved
}

// The segments that run across `axis`, with where each wants to be.
function collect(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  axis: Axis,
  constraints: ReadonlyArray<Held | undefined>,
  splits: ReadonlyArray<ReadonlyMap<number, Split>> = [],
  keep = 0,
): Array<Segment> {
  const along = other(axis)
  const segments: Array<Segment> = []
  for (const [route, path] of paths.entries()) {
    const last = path.length - 2
    for (let index = 0; index <= last; index++) {
      if (axisOf(path, index) !== axis) {
        continue
      }
      const a = (path[index] as Point)[along]
      const b = (path[index + 1] as Point)[along]
      const at = (path[index] as Point)[axis]
      const anchors = constraints[route]?.anchors ?? []
      const straight = constraints[route]?.straight ?? []
      // A segment through an anchor stays. One that ends on an anchor the
      // route runs straight through moves: the segment on the other side of
      // the anchor runs through it, and this one keeps the gap from it.
      const anchored = anchors.some((point) => {
        if (!coincident(point[axis], at)) {
          return false
        }
        const [low, high] = [Math.min(a, b), Math.max(a, b)]
        return straight.some((p) => p[0] === point[0] && p[1] === point[1])
          ? inside(point[along], low, high)
          : within(point[along], low, high)
      })
      // A merged end's lane moves; the segments at other ends hold at their
      // pins.
      const lane =
        last > 0 && (index === 0 || index === last)
          ? constraints[route]?.lanes?.[index === 0 ? 0 : 1]
          : undefined
      const fixed =
        lane === undefined
          ? index === 0 ||
            index === last ||
            anchored ||
            slanted(path, index - 1) ||
            slanted(path, index + 1)
          : anchored || slanted(path, index === 0 ? 1 : index - 1)
      // A jog between turns that go opposite ways wants its spot along the
      // run it shifts, between where the segments on either side of it
      // start and end: the middle, unless the route says otherwise. Other
      // segments want to stay put. A segment never moves past an anchor on
      // the segments on either side of it, which would take the anchor off
      // the route.
      let desired = at
      let run: readonly [number, number] | undefined
      let late: number | undefined
      let held: Segment['held']
      let bounds: Segment['bounds']
      // A step past the lanes of a merge sits between the obstacles around
      // its port and the lanes, as late as it may.
      const step = constraints[route]?.steps?.find(
        ({ end }) => index === (end === 0 ? 1 : last - 1),
      )
      if (!fixed && lane !== undefined) {
        // A lane wants the line out of its port, and stays within the
        // reach of its whisk.
        desired = lane.line
        held = [lane.low, lane.high]
        bounds = held
      } else if (!fixed && step !== undefined) {
        desired = step.at
        run = [step.low, step.high]
        held = run
        bounds = run
      } else if (!fixed) {
        const previous = (path[index - 1] as Point)[axis]
        const after = (path[index + 2] as Point)[axis]
        let low: number | undefined
        let high: number | undefined
        let floor: number | undefined
        let ceiling: number | undefined
        for (const [far, line] of [
          [previous, a],
          [after, b],
        ] as const) {
          for (const point of anchors) {
            if (
              coincident(point[along], line) &&
              within(point[axis], Math.min(at, far), Math.max(at, far))
            ) {
              const margin = straight.some((p) => p[0] === point[0] && p[1] === point[1]) ? keep : 0
              if (far > at) {
                high = Math.min(high ?? Number.POSITIVE_INFINITY, point[axis] - margin)
                ceiling = Math.min(ceiling ?? Number.POSITIVE_INFINITY, point[axis])
              } else {
                low = Math.max(low ?? Number.NEGATIVE_INFINITY, point[axis] + margin)
                floor = Math.max(floor ?? Number.NEGATIVE_INFINITY, point[axis])
              }
            }
          }
        }
        if (low !== undefined || high !== undefined) {
          held = [low, high]
          bounds = [floor, ceiling]
        }
        // A jog is the rise of a Z between two legs. A leg between two
        // corners too short for them, or for the gap, is a kink that a
        // slant or a sliding port takes care of, not a leg: the segment
        // beside it is part of an L, and stays put rather than move to
        // balance the two sides of the kink into a Z with real legs.
        const corner = Math.max(constraints[route]?.corner ?? 0, 0)
        const kink = (leg: number, k: number) =>
          k > 0 && k < last && before(leg, Math.max(2 * corner, keep))
        if (
          (previous - at) * (after - at) < 0 &&
          !kink(Math.abs(at - previous), index - 1) &&
          !kink(Math.abs(after - at), index + 1)
        ) {
          const split = splits[route]?.get(index)
          if (split === undefined) {
            // A jog right past a port that may slide, short enough for the
            // port to slide it all the way out (see `ports.ts`: up to half
            // of what its two corners need, the far one its reach and the
            // near one what the leg out of the port leaves it past the pack
            // there, or of the gap), stays for the port to do so.
            const sliding = constraints[route]?.sliding
            const stays = [previous, after].some((far, end) => {
              if (!(end === 0 ? index === 1 : index === last - 1) || !sliding?.[end]) {
                return false
              }
              const pack = Math.max(constraints[route]?.packs?.[end] ?? 0, 0)
              const leg = Math.abs(far - at)
              const short = Math.max(corner + Math.min(corner, Math.max(leg - pack, 0)), keep)
              return atMost(Math.abs(b - a), short / 2)
            })
            if (!stays) {
              desired = previous + jogAtOf(constraints[route]) * (after - previous)
            }
          } else {
            // As far from the merge as leaves room for the corner past it,
            // or for the S of a short jog that slants, and for the
            // adornments at the port when that is next, but never short of
            // the middle. Where the run has the room, it also leaves a
            // stretch for the flow adornments between the ports, between
            // its corner and the pack or corner beyond, so they sit clear
            // of the bundle.
            const [near, far] = split.far === 1 ? [previous, after] : [after, previous]
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
            const half = Math.abs(far - near) / 2
            const flows = Math.max(constraints[route]?.flows ?? 0, 0)
            const roomy = room + flows + (next ? 0 : corner)
            const wanted = flows > 0 && atMost(roomy, half) ? roomy : room
            const keep = Math.min(Number.isFinite(wanted) ? wanted : 0, half)
            desired = far - Math.sign(far - near) * keep
            late = Math.sign(far - near)
          }
          run = [Math.min(previous, after), Math.max(previous, after)]
        }
        if (held !== undefined) {
          const [floor, ceiling] = held
          desired = clamp(desired, floor ?? desired, ceiling ?? desired)
          if (run !== undefined) {
            run = [Math.max(run[0], floor ?? run[0]), Math.min(run[1], ceiling ?? run[1])]
          }
        }
      }
      segments.push({
        route,
        index,
        run,
        late,
        held,
        bounds,
        at,
        desired,
        low: Math.min(a, b),
        high: Math.max(a, b),
        fixed,
        lane: !fixed && lane !== undefined,
      })
    }
  }
  return segments
}

// A jog right behind a lane that moves wants no further along its run than
// the first segment of another route in its way, a gap short of it. A
// segment is in the way when it crosses the line of one of the jog's legs
// and not the other's, the lane's taken where it is and where it wants to
// be: past it, the jog would cross a route the search did not, or press
// the lane off its line where that route is a lane too. One that crosses
// both lines, or neither, the jog passes for free, as a leap does. The
// routes of its own merges are no such way: it parts from them as it likes.
function holdLaneJogs(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  axis: Axis,
  segments: Array<Segment>,
  constraints: ReadonlyArray<Held | undefined>,
  gapOf: (a: Segment, b: Segment) => number,
): Array<Segment> {
  const partners = (a: number, b: number) => {
    const p: ReadonlyArray<number> = constraints[a]?.merges ?? []
    const q: ReadonlyArray<number> = constraints[b]?.merges ?? []
    return p.some((id) => id >= 0 && q.includes(id))
  }
  return segments.map((jog) => {
    const path = paths[jog.route] as ReadonlyArray<Point>
    const lanes = constraints[jog.route]?.lanes
    const step = jog.desired - jog.at
    if (jog.fixed || jog.run === undefined || step === 0) {
      return jog
    }
    // The lines of the jog's legs across it, the lane's where it is and
    // where it wants to be.
    const along = other(axis)
    const start = (path[jog.index] as Point)[along]
    const end = (path[jog.index + 1] as Point)[along]
    const legs: Array<readonly [number, number]> = []
    if (jog.index === 1 && lanes?.[0] !== undefined) {
      legs.push([end, start], [end, lanes[0].line])
    }
    if (jog.index === path.length - 3 && lanes?.[1] !== undefined) {
      legs.push([start, end], [start, lanes[1].line])
    }
    if (legs.length === 0) {
      return jog
    }
    const sign = Math.sign(step)
    let desired = jog.desired
    for (const peer of segments) {
      const crosses = (line: number) => inside(line, peer.low, peer.high)
      if (
        peer.route === jog.route ||
        partners(peer.route, jog.route) ||
        !before(0, sign * (peer.at - jog.at)) ||
        legs.every(([leg, lane]) => crosses(leg) === crosses(lane))
      ) {
        continue
      }
      const stop = peer.at - sign * gapOf(jog, peer)
      if (sign * (desired - stop) > 0) {
        desired = sign * (stop - jog.at) > 0 ? stop : jog.at
      }
    }
    return desired === jog.desired ? jog : { ...jog, desired }
  })
}

function jogAtOf(constraints: RouteConstraints | undefined): number {
  const value = constraints?.jogAt
  return value !== undefined && Number.isFinite(value) ? clamp(value, 0, 1) : 0.5
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
  axis: Axis,
  constraints: ReadonlyArray<RouteConstraints | undefined>,
): boolean {
  const moves: Array<[Segment, number]> = []
  for (const jog of segments) {
    if (jog.fixed || jog.lane || coincident(jog.desired, jog.at)) {
      continue
    }
    const own = constraints[jog.route]?.avoid ?? []
    const [lowWall, highWall] = walls(
      own.length === 0 ? obstacles : [...obstacles, ...own],
      jog,
      axis,
    )
    const [floor, ceiling] = jog.held ?? [undefined, undefined]
    const low = floor === undefined ? lowWall : Math.max(lowWall ?? floor, floor)
    const high = ceiling === undefined ? highWall : Math.min(highWall ?? ceiling, ceiling)
    const step = jog.desired > jog.at ? 1 : -1
    // A jog that shares its line with another route keeps to its side of
    // it, the side it parts toward, so it leaps only that way. Where the
    // two part to different sides at the two ends, it has no side to keep.
    const holds = segments.some((peer) => {
      if (
        peer.route === jog.route ||
        !coincident(peer.at, jog.at) ||
        !touches(peer.low, peer.high, jog.low, jog.high)
      ) {
        return false
      }
      const { lower, firmness } = goesFirst(paths, jog, peer, axis)
      return firmness === FIRM && lower !== step < 0
    })
    if (holds) {
      continue
    }
    const limit =
      step > 0
        ? Math.min(jog.desired, high ?? jog.desired)
        : Math.max(jog.desired, low ?? jog.desired)
    const ahead = segments
      .filter((peer) => {
        const distance = step * (peer.at - jog.at)
        return (
          peer !== jog &&
          distance > 0 &&
          !coincident(peer.at, jog.at) &&
          (step * (limit - peer.at) > 0 || coincident(peer.at, limit)) &&
          touches(peer.low, peer.high, jog.low, jog.high)
        )
      })
      .toSorted((a, b) => step * (a.at - b.at))
    let passed: number | undefined
    let target = limit
    for (const peer of ahead) {
      const alongside =
        peer.route !== jog.route && before(peer.low, jog.low) && before(jog.high, peer.high)
      if (!alongside) {
        // Halfway to the segment that stops it, which the solve then moves
        // the jog toward.
        target = ((passed ?? jog.at) + peer.at) / 2
        break
      }
      passed = peer.at
    }
    if (passed !== undefined) {
      moves.push([jog, target])
    }
  }
  for (const [jog, target] of moves) {
    const path = paths[jog.route] as Array<Point>
    ;(path[jog.index] as Point)[axis] = target
    ;(path[jog.index + 1] as Point)[axis] = target
  }
  return moves.length > 0
}

// The nearest obstacle edges on each side of a segment, among the obstacles
// whose extent overlaps the segment's.
function walls(
  obstacles: ReadonlyArray<Obstacle>,
  segment: Segment,
  axis: Axis,
): [number | undefined, number | undefined, number, number] {
  const along = other(axis)
  let low: number | undefined
  let high: number | undefined
  let lowFrom = -1
  let highFrom = -1
  for (const [k, o] of obstacles.entries()) {
    if (!overlaps(lo(o, along), hi(o, along), segment.low, segment.high)) {
      continue
    }
    const near = lo(o, axis)
    const far = hi(o, axis)
    if (atMost(far, segment.at)) {
      if (low === undefined || far > low) {
        low = far
        lowFrom = k
      }
    } else if (atMost(segment.at, near)) {
      if (high === undefined || near < high) {
        high = near
        highFrom = k
      }
    }
  }
  // An obstacle edge a hair past the segment still holds it in place.
  if (low !== undefined && low > segment.at) {
    low = segment.at
  }
  if (high !== undefined && high < segment.at) {
    high = segment.at
  }
  return [low, high, lowFrom, highFrom]
}

// How firmly two segments on one line are ordered: by the ranges they may
// sit in, which leave no choice; by a side that the two ends of their
// shared path agree on, or that one end alone has; by a side the ends
// disagree on; or by nothing but the order of their routes.
const FORCED = 3
const FIRM = 2
const LOOSE = 1
const ARBITRARY = 0

// Whether segment `a` takes the lower coordinate of the two, and how firmly.
// The routes go apart at each end of the path they share, and each runs on
// the side it turns toward there. When the two ends agree, or only one has a
// side, the order is firm. When they disagree, one crossing is unavoidable
// whichever way the segments sit, so the order is loose, and the end the
// first route reaches first wins. Without a side at either end, the earlier
// route goes first, arbitrarily.
function goesFirst(
  paths: ReadonlyArray<ReadonlyArray<Point>>,
  a: Segment,
  b: Segment,
  axis: Axis,
): { readonly lower: boolean; readonly firmness: number } {
  const p = paths[a.route] as ReadonlyArray<Point>
  const q = paths[b.route] as ReadonlyArray<Point>
  const [dx, dy] = direction(p, a.index, 1)
  const [ex, ey] = direction(q, b.index, 1)
  const together = dx * ex + dy * ey > 0 ? 1 : -1
  const ahead = side(p, a.index, 1, q, b.index, together)
  // Behind, left and right swap.
  const behind = -side(p, a.index, -1, q, b.index, -together)
  const left = ahead !== 0 ? ahead : behind
  if (left === 0) {
    return { lower: a.route < b.route, firmness: ARBITRARY }
  }
  // The left of travel along (dx, dy), with the Y axis down, is (dy, -dx).
  const leftward = axis === 0 ? Math.sign(dy) : Math.sign(-dx)
  // On the left, `a` takes the higher coordinate when left points that way.
  return {
    lower: left * leftward < 0,
    firmness: ahead !== 0 && behind !== 0 && ahead !== behind ? LOOSE : FIRM,
  }
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
  return a.length < 3 ? 0 : turnOf(direction(a, 0, 1), direction(a, 1, 1))
}

// The direction of segment `index` when the route is walked forward (`step`
// 1) or backward (-1).
function direction(path: ReadonlyArray<Point>, index: number, step: number): [number, number] {
  const [x0, y0] = path[index] as Point
  const [x1, y1] = path[index + 1] as Point
  return [step * (x1 - x0), step * (y1 - y0)]
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
        rankP = hasP ? turnOf(travel, direction(p, nextP, stepP)) : 0
      } else {
        rankQ = hasQ ? turnOf(travel, direction(q, nextQ, stepQ)) : 0
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
      rankP = turnP === undefined ? 0 : turnOf(travel, turnP)
      rankQ = turnQ === undefined ? 0 : turnOf(travel, turnQ)
    }
    // A left turn runs on the left of a straight run or a right turn.
    return rankP === rankQ ? 0 : rankP < rankQ ? 1 : -1
  }
  return 0
}
