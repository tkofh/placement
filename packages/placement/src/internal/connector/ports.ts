import { coincident } from 'curvy/number'
import { atMost, before, overlaps } from '../../utils/tolerance.ts'
import type { Obstacle } from '../graph/graph.ts'
import { type XY, hi, lo, other, pointOn, positiveLength, sideAxis } from '../orient.ts'
import { routeOf } from './route.ts'

// Straightened ports. Auto ports spread out along their sides before the
// routes are nudged, so a route can leave its port only to jog a hair
// across right away, a kink too short for its corners. Where the port can
// slide along its side to the line past the jog, the route runs straight
// instead: the port stays clear of the side's ends by the gap, and its leg
// keeps clear of the rects and, by the gap, of the routes alongside it (the
// merge gap, for those in a group with it). A route across the leg crosses
// it wherever it slides. A jog a little longer than half of what its
// corners need slides only part of the way, and the residue it leaves
// slants into an S.
//
// The ports of a group slide only together, as one, keeping their offsets,
// after the lone ports have slid: as far as the short jog right past one of
// them would slide it alone, where the others can follow without a run of
// theirs turning back or growing into a short jog, and with the same room
// kept for every leg. Of the ways a group could slide, it takes the one
// that slides the most of its ports as their own jogs would, then the
// shortest. A group with less room than that slides as far as it has.

/** An end of a route whose port may slide along its side. */
export interface SlidingEnd {
  /** The rect the port sits on. */
  readonly rect: Obstacle
  /** The index of the rect's grown obstacle, which the route may cross. */
  readonly own: number
  /** The side the port sits on: `0` top, `1` right, `2` bottom, `3` left. */
  readonly side: number
}

/** How far ports slide, and what they keep clear of. */
export interface StraightenOptions {
  /** The space between the strokes of routes. */
  readonly gap: number
  /**
   * How far each route's corners reach. A jog shorter than its two corners
   * need slides away.
   */
  readonly reach: ReadonlyArray<number>
  /** How thick each route draws. */
  readonly thickness: ReadonlyArray<number>
  /** The points each route must pass through. */
  readonly anchors: ReadonlyArray<ReadonlyArray<XY>>
  /**
   * The length the adornments at each route's ends pack into at the port,
   * as `[source, target]`. The corner at the port end of a jog has no more
   * of the port's leg than the pack leaves it, so it needs less of the jog.
   */
  readonly packs?: ReadonlyArray<readonly [number, number]> | undefined
  /**
   * The merges each route's start and end lead into, as ids shared by the
   * routes of each merge, or `-1`. A leg keeps the merge gap, not the gap,
   * from the routes that share a merge with it.
   */
  readonly merges?: ReadonlyArray<readonly [number, number]> | undefined
  /** The space between the strokes of routes that share a merge. */
  readonly mergeGap?: number | undefined
}

/**
 * Slides auto ports along their sides to take out the short jogs right past
 * them.
 *
 * @param routes - The routes, as points with no repeats and no points in the
 * middle of a straight run, from source port to target port.
 * @param ends - Each route's ends that may slide, as `[source, target]`.
 * @param obstacles - The rects grown by their clearance, which the gained
 * stretch keeps out of.
 * @param options - The gap, and each route's reach, thickness, and anchors.
 * @returns The routes, with the jogs past the slid ports taken out.
 */
export function straightenPorts(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  ends: ReadonlyArray<readonly [SlidingEnd | undefined, SlidingEnd | undefined]>,
  obstacles: ReadonlyArray<Obstacle>,
  options: StraightenOptions,
): Array<Array<XY>> {
  const result = routes.map((route) => [...route])
  // The routes as they stand, for their segment boxes: a port that slides
  // reads the routes slid before it, so a slid route is taken anew.
  const boxed = result.map((points) => routeOf(points))
  const spacing = positiveLength(options.gap)
  const keep = keeper(options)
  for (const [route, pair] of ends.entries()) {
    for (const [end, sliding] of pair.entries()) {
      const points = result[route] as Array<XY>
      if (sliding === undefined) {
        continue
      }
      const found = shortJog(points, end, sliding.side, route, options, spacing)
      if (found === undefined) {
        continue
      }
      const { jog, slide: wanted } = found
      const sign = Math.sign(jog)
      const room = roomOf(
        points,
        end,
        sliding,
        sign,
        obstacles,
        boxed,
        (k) => keep(route, k),
        (k, segment, count) => k === route && (end === 0 ? segment <= 2 : segment >= count - 3),
        spacing,
      )
      const slide = Math.min(wanted, room)
      if (!(slide > 0) || coincident(slide, 0)) {
        continue
      }
      slideEnd(points, end, sliding.side, sign * slide, coincident(slide, Math.abs(jog)))
      boxed[route] = routeOf([...points])
    }
  }
  return result
}

/** Ends that group on one side of a rect, whose auto ports slide as one. */
export interface SlidingGroup extends SlidingEnd {
  /** The route and end of each member, in port order. */
  readonly members: ReadonlyArray<{ readonly route: number; readonly end: number }>
}

/**
 * Slides groups of auto ports along their sides, each as one, its ports
 * keeping their offsets, to take out the short jogs right past them.
 *
 * A group slides as far as the short jog right past one of its ports
 * slides that port alone (see `straightenPorts`), when its other members
 * can follow: no other jog right past a member's port turns back or grows
 * into a short one. Of the ways a group could slide, it takes the one
 * that slides the most members as their own jogs would, then the
 * shortest. Every member's leg keeps clear of the side's ends by the gap,
 * of the rects, and of the other routes alongside by the gap (the merge
 * gap, for those it shares a group with). A route across a leg crosses it
 * wherever it slides.
 *
 * @param routes - The routes, as points with no repeats and no points in
 * the middle of a straight run, from source port to target port.
 * @param groups - The groups whose ports may slide.
 * @param obstacles - The rects grown by their clearance, which the legs
 * keep out of.
 * @param options - The gap, and each route's reach, thickness, anchors,
 * packs, and groups.
 * @returns The routes, with the groups slid.
 */
export function slideGroups(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  groups: ReadonlyArray<SlidingGroup>,
  obstacles: ReadonlyArray<Obstacle>,
  options: StraightenOptions,
): Array<Array<XY>> {
  const result = routes.map((route) => [...route])
  const boxed = result.map((points) => routeOf(points))
  const spacing = positiveLength(options.gap)
  const keep = keeper(options)
  for (const group of groups) {
    const along = sideAxis(group.side)
    const members = group.members.map(({ route, end }) => {
      const points = result[route] as Array<XY>
      const at = (k: number) => points[end === 0 ? k : points.length - 1 - k] as XY
      const across = other(along)
      const [port, near, far, next] = [at(0), at(1), at(2), at(3)]
      return {
        route,
        end,
        points,
        // The run past the leg, along the side, which the slide shortens,
        // and whether the route goes on the way the leg left past it, so
        // that taking the run out runs the port straight on.
        run: points.length < 4 ? 0 : far[along] - near[along],
        z: points.length >= 4 && (near[across] - port[across]) * (next[across] - far[across]) > 0,
        jog: shortJog(points, end, group.side, route, options, spacing),
      }
    })
    // Every member needs a leg and a run past it, which a route of fewer
    // than four points, or one held at its leg by an anchor, lacks.
    if (
      members.some(
        ({ points, end, route }) =>
          points.length < 4 ||
          (options.anchors[route] ?? []).some((point) =>
            onPath(point, end === 0 ? points.slice(0, 3) : points.slice(-3)),
          ),
      )
    ) {
      continue
    }
    // The ways the group could slide: as far as each member's short jog
    // would slide its port alone.
    const candidates = members.flatMap(({ jog }) =>
      jog === undefined ? [] : [Math.sign(jog.jog) * jog.slide],
    )
    let best: { shift: number; count: number } | undefined
    for (const wanted of candidates) {
      if (coincident(wanted, 0)) {
        continue
      }
      const sign = Math.sign(wanted)
      // Each member's leg slides past its own route's leg, jog, and the
      // run past them, and past the legs of the other members. A group
      // with less room than the jog needs slides as far as it has, and
      // the residue slants, as a lone port's does.
      const legOf = new Map(members.map(({ route, end }) => [route, end]))
      const room = Math.min(
        ...members.map(({ points, end, route }) =>
          roomOf(
            points,
            end,
            group,
            sign,
            obstacles,
            boxed,
            (k) => keep(route, k),
            (k, segment, count) => {
              const other = legOf.get(k)
              if (other === undefined) {
                return false
              }
              const held = k === route ? 2 : 0
              return other === 0 ? segment <= held : segment >= count - 1 - held
            },
            spacing,
          ),
        ),
      )
      const shift = atMost(Math.abs(wanted), room) ? wanted : sign * room
      if (!(Math.abs(shift) > 0) || coincident(shift, 0)) {
        continue
      }
      // No member's run turns back, or grows into a short jog.
      const worse = members.some(({ run, z, jog }) => {
        const left = run - shift
        if (coincident(left, 0)) {
          return !z
        }
        return (
          Math.sign(left) !== Math.sign(run) ||
          (jog !== undefined && Math.abs(left) > Math.abs(run) && before(Math.abs(left), jog.short))
        )
      })
      if (worse) {
        continue
      }
      // The members whose own jogs would slide their ports this way, as far.
      const count = members.filter(
        ({ jog }) => jog !== undefined && coincident(Math.sign(jog.jog) * jog.slide, wanted),
      ).length
      if (
        best === undefined ||
        count > best.count ||
        (count === best.count && before(Math.abs(shift), Math.abs(best.shift)))
      ) {
        best = { shift, count }
      }
    }
    if (best === undefined) {
      continue
    }
    for (const { route, end, points, run } of members) {
      slideEnd(points, end, group.side, best.shift, coincident(run, best.shift))
      boxed[route] = routeOf([...points])
    }
  }
  return result
}

// What a route keeps from another alongside it: the gap, or the merge gap
// for routes that share a group, and half of each stroke.
function keeper(options: StraightenOptions): (route: number, other: number) => number {
  const spacing = positiveLength(options.gap)
  const tight = Math.min(positiveLength(options.mergeGap ?? options.gap), spacing)
  const partners = (a: number, b: number) => {
    const [p, q] = [options.merges?.[a], options.merges?.[b]]
    return p !== undefined && q !== undefined && p.some((id) => id >= 0 && q.includes(id))
  }
  const width = (route: number) => positiveLength(options.thickness[route])
  return (route, other) =>
    (other !== route && partners(route, other) ? tight : spacing) +
    (width(route) + width(other)) / 2
}

// A short jog right past a port: the route leaves the port, turns along
// the side for less than its two corners need, and turns on the way it
// left. `jog` is the run along the side, signed, `short` the length below
// which a jog is short, and `slide` how far the port slides toward the
// jog's far line: all the way for a jog up to half the short length, then
// less, down to none at the short length, so the slide never jumps as the
// jog grows. The rest of the jog stays for a slant: just past half the
// short length it is a residue as short as can be, which a slant always
// takes while it is shorter than the gap (see `slants.ts`).
function shortJog(
  points: ReadonlyArray<XY>,
  end: number,
  side: number,
  route: number,
  options: StraightenOptions,
  spacing: number,
): { readonly jog: number; readonly short: number; readonly slide: number } | undefined {
  if (points.length < 4) {
    return undefined
  }
  // The port, the corner past its leg, the jog's far corner, and the point
  // past that, walked from this end.
  const at = (k: number) => points[end === 0 ? k : points.length - 1 - k] as XY
  const [port, near, far, next] = [at(0), at(1), at(2), at(3)]
  // Along the side, and across it.
  const along = sideAxis(side)
  const across = other(along)
  const jog = far[along] - near[along]
  const reach = positiveLength(options.reach[route])
  // The jog is short when it is shorter than its two corners need: the far
  // one its reach, and the one at the port end no more of the leg out of
  // the port than the pack there leaves it.
  const pack = positiveLength(options.packs?.[route]?.[end])
  const leg = Math.abs(near[across] - port[across])
  const short = Math.max(reach + Math.min(reach, Math.max(leg - pack, 0)), spacing)
  const z =
    near[along] === port[along] &&
    far[across] === near[across] &&
    next[along] === far[along] &&
    (near[across] - port[across]) * (next[across] - far[across]) > 0
  if (!z || jog === 0 || !before(Math.abs(jog), short)) {
    return undefined
  }
  if ((options.anchors[route] ?? []).some((point) => onPath(point, [port, near, far]))) {
    return undefined
  }
  const length = Math.abs(jog)
  const full = short / 2
  const slide = length <= full ? length : (full * (short - length)) / (short - full)
  return { jog, short, slide }
}

// How far the leg at an end of a route may slide `sign`-ward along its
// side: short of the side's ends by the gap, and of whatever ahead of it
// it would come too near, the rects and the segments of the routes that
// run alongside it, by what it keeps from each (`keep`). A route that
// crosses the leg crosses it wherever it slides. `skip` names the segments that slide
// with the leg, by route, index, and the route's count of segments.
function roomOf(
  points: ReadonlyArray<XY>,
  end: number,
  sliding: SlidingEnd,
  sign: number,
  obstacles: ReadonlyArray<Obstacle>,
  boxed: ReadonlyArray<ReturnType<typeof routeOf>>,
  keep: (route: number) => number,
  skip: (route: number, segment: number, count: number) => boolean,
  spacing: number,
): number {
  const at = (k: number) => points[end === 0 ? k : points.length - 1 - k] as XY
  const [port, near] = [at(0), at(1)]
  const along = sideAxis(sliding.side)
  const across = other(along)
  // The leg, across the side, at its spot along it.
  const from = port[along]
  const [legLow, legHigh] = [
    Math.min(port[across], near[across]),
    Math.max(port[across], near[across]),
  ]
  // It stops short of the side's ends by the gap.
  const [low, high] = [lo(sliding.rect, along), hi(sliding.rect, along)]
  const margin = Math.min(spacing, (high - low) / 2)
  let room = Math.max(sign > 0 ? high - margin - from : from - low - margin, 0)
  const stop = (box: Obstacle, gap: number, crossing = false) => {
    const [a0, a1] = [lo(box, along), hi(box, along)]
    // A route across the leg crosses it wherever it slides, and whatever
    // lies wholly behind the leg only falls farther behind.
    if ((crossing && a1 > a0) || (sign > 0 ? atMost(a1, from) : atMost(from, a0))) {
      return
    }
    const [c0, c1] = [lo(box, across), hi(box, across)]
    if (!overlaps(c0 - gap, c1 + gap, legLow, legHigh)) {
      return
    }
    const [near0, far0] =
      sign > 0 ? [a0 - gap - from, a1 + gap - from] : [from - a1 - gap, from - a0 + gap]
    if (!before(0, far0)) {
      return
    }
    room = Math.min(room, Math.max(near0, 0))
  }
  for (const [k, box] of obstacles.entries()) {
    if (k !== sliding.own) {
      stop(box, 0)
    }
  }
  for (const [k, other] of boxed.entries()) {
    const boxes = other.boxes()
    for (const [s, box] of boxes.entries()) {
      if (!skip(k, s, boxes.length)) {
        stop(box, keep(k), true)
      }
    }
  }
  return room
}

// Slides the port at an end of a route, and its leg, `shift` along its
// side, in place. A slide that takes out the jog past the leg runs the
// port straight on past it.
function slideEnd(
  points: Array<XY>,
  end: number,
  side: number,
  shift: number,
  whole: boolean,
): void {
  const along = sideAxis(side)
  const across = other(along)
  const move = (point: XY): XY => pointOn(along, point[along] + shift, point[across])
  const [first, second] = end === 0 ? [0, 1] : [points.length - 1, points.length - 2]
  if (whole) {
    // The jog is gone: the port runs straight on past it.
    const moved = move(points[first] as XY)
    if (end === 0) {
      points.splice(0, 3, moved)
    } else {
      points.splice(points.length - 3, 3, moved)
    }
  } else {
    points[first] = move(points[first] as XY)
    points[second] = move(points[second] as XY)
  }
}

// Whether a point lies on the polyline through `points`.
function onPath(point: XY, points: ReadonlyArray<XY>): boolean {
  return points.slice(1).some((b, k) => {
    const a = points[k] as XY
    return (
      (point[0] - a[0]) * (b[1] - a[1]) === (point[1] - a[1]) * (b[0] - a[0]) &&
      point[0] >= Math.min(a[0], b[0]) &&
      point[0] <= Math.max(a[0], b[0]) &&
      point[1] >= Math.min(a[1], b[1]) &&
      point[1] <= Math.max(a[1], b[1])
    )
  })
}
