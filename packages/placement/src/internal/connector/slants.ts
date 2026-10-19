import { coincident, minMax } from 'curvy/number'
import { atMost, before, inside, overlaps } from '../../utils/tolerance.ts'
import type { Obstacle } from '../graph/graph.ts'
import { type Axis, type XY, hi, lo, other, positiveLength } from '../orient.ts'
import { type Route, routeOf } from './route.ts'

// Slanted jogs. A jog is the segment between two corners that turn opposite
// ways, the rise of a Z. When it is shorter than its two corners need, the
// corners shrink to share it, and a short jog draws as a kink. Instead, the
// corners slide apart along the legs and turn less than a right angle, so
// the route crosses over in an S: two arcs that meet halfway, with no
// straight between them.
//
// With corners that reach `reach` at a right angle, a jog `d` long, and a
// slant `k`, the S spans `2 * k * reach - (k - 1) * d` along the legs,
// centered on the jog. At `d = 2 * reach` that is `2 * reach`, the span of
// the two full corners, and the S is exactly them; as `d` shrinks the S
// flattens toward a straight line over the same span (or `k` times it, as
// `d` reaches 0). At `k = 0` the span is `d`, the upright jog. Every end
// meets the orthogonal shape, so the slant never jumps as the routes
// around it move.
//
// The S takes only free length. On each side of the jog it stops short of
// the next corner (or of the next short jog's S, up to half the leg), and
// of the stretches flow adornments wall off. It starts and ends past
// anything its legs pass through, such as the rect a port leaves or a
// route that crosses a leg, and stays upright for anything on the jog. And
// the curve itself keeps the gap from the strokes of the routes alongside
// its legs (the merge gap from those that share a merge with it), ends
// short of the strokes of those across them, and keeps half its own stroke
// from the rects grown by their clearance: a wider S
// reaches farther into the band between the legs at every point, so the
// widest that clears them is found by halving. With less room, the corners
// take a smaller reach, down to the orthogonal corners that share the jog.
// Every limit moves with the geometry, so the S grows and shrinks without
// jumping, though it shrinks fast for something near the end of a leg,
// where the arc runs close along it.
//
// A jog shorter than the gap is a residue, such as what a port that slides
// part of the way leaves (see `ports.ts`), not a turn of its own, and must
// never draw as an upright kink. Its S strays off the legs by at most half
// of it, as far as the upright corners do, so it keeps that much less than
// the gap from the routes alongside them, and a neighbor that the legs
// clear by the gap never holds it upright.
//
// A jog in a bundle, or where a route leaves a group, is the merge's, and
// stays upright (see `exempt`), unless it is shorter than the gap (see
// `bundled` in `nudge.ts`).

/** A route with its short jogs slanted. */
export interface SlantedRoute {
  /** The route, with each slanted jog's two corners moved apart. */
  readonly route: Route
  /** How far the corner at each point reaches along its legs. */
  readonly radii: ReadonlyArray<number>
  /**
   * Maps a length along the orthogonal route, outside any slant, to the
   * length along the slanted one.
   */
  readonly remap: (distance: number) => number
}

/** The space an S keeps from the strokes around it. */
export interface Strokes {
  /** The space between the strokes of routes. */
  readonly gap?: number | undefined
  /** How thick each route draws. */
  readonly thickness?: ReadonlyArray<number> | undefined
  /**
   * The merges each route's start and end lead into, as ids shared by the
   * routes of each merge, or `-1`. Routes that share one keep the merge gap
   * instead of the gap.
   */
  readonly merges?: ReadonlyArray<readonly [number, number]> | undefined
  /** The space between the strokes of routes that share a merge. */
  readonly mergeGap?: number | undefined
}

// How many times the room for an S halves while it looks for the widest
// that clears everything.
const HALVINGS = 24

// A box around a jog: its extent along the legs, from the jog, toward the
// route's end, and across them.
interface Box {
  readonly u0: number
  readonly u1: number
  readonly c0: number
  readonly c1: number
}

// How far an S may reach for a box that touches the upright jog or its
// legs: short of the box along the leg it touches, and none for one on the
// jog. `undefined` for a box that touches neither.
function touches(box: Box, from: number, to: number): number | undefined {
  const [low, high] = minMax(from, to)
  if (inside(0, box.u0, box.u1) && overlaps(box.c0, box.c1, low, high)) {
    return 0
  }
  let reach: number | undefined
  if (before(box.u0, 0) && inside(from, box.c0, box.c1)) {
    reach = Math.max(-box.u1, 0)
  }
  if (before(0, box.u1) && inside(to, box.c0, box.c1)) {
    reach = Math.min(reach ?? Number.POSITIVE_INFINITY, Math.max(box.u0, 0))
  }
  return reach
}

// Whether an S of half-span `half` crossing `d` from `from`, toward the
// side `toward`, passes through a box. Its two arcs leave each leg along it
// and meet halfway, so across it moves one way all along: the stretch of it
// alongside the box spans across between its two ends there.
function crosses(box: Box, half: number, d: number, from: number, toward: number): boolean {
  if (!overlaps(box.u0, box.u1, -half, half)) {
    return false
  }
  const u0 = Math.max(box.u0, -half)
  const u1 = Math.min(box.u1, half)
  // Each arc turns `theta`, with tan(theta / 2) = d / (2 * half).
  const theta = 2 * Math.atan(d / (2 * half))
  const radius = half / Math.sin(theta)
  const across = (u: number) =>
    u <= 0
      ? from + toward * (radius - Math.sqrt(Math.max(radius * radius - (u + half) ** 2, 0)))
      : from + toward * (d - radius + Math.sqrt(Math.max(radius * radius - (half - u) ** 2, 0)))
  const [a, b] = [across(u0), across(u1)]
  return overlaps(box.c0, box.c1, Math.min(a, b), Math.max(a, b))
}

interface Slant {
  // The index of the jog's first point.
  readonly index: number
  // The corners' distance apart along the legs, and their reach.
  readonly w: number
  readonly reach: number
}

/**
 * Slants the short jogs of routes.
 *
 * @param routes - The routes.
 * @param sizes - The size of each route's corners (see `cornerRadii`).
 * @param radii - The reach of each route's corners at a right angle.
 * @param slant - How far apart a jog's corners slide, as a multiple of what
 * keeps the shape continuous. `0` slants nothing.
 * @param walls - The stretches of each route that its flow adornments take.
 * @param obstacles - The rects, grown by the clearance.
 * @param exempt - The jogs of each route, by the index of their first point,
 * to leave as they are, such as the steps of merged lanes onto their
 * shared line.
 * @param strokes - The gap between the strokes of routes, and how thick
 * each route draws, which an S keeps clear by.
 * @returns Each route with its short jogs slanted.
 */
export function slantJogs(
  routes: ReadonlyArray<Route>,
  sizes: ReadonlyArray<ReadonlyArray<number>>,
  radii: ReadonlyArray<number>,
  slant: number,
  walls: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  obstacles: ReadonlyArray<Obstacle>,
  exempt: ReadonlyArray<ReadonlySet<number>> = [],
  strokes: Strokes = {},
): Array<SlantedRoute> {
  const spacing = positiveLength(strokes.gap)
  const width = (route: number) => positiveLength(strokes.thickness?.[route])
  const tight = Math.min(positiveLength(strokes.mergeGap), spacing)
  const partners = (a: number, b: number) => {
    const [p, q] = [strokes.merges?.[a], strokes.merges?.[b]]
    return p !== undefined && q !== undefined && p.some((id) => id >= 0 && q.includes(id))
  }
  // Everything a slant keeps clear of: each route's segments, by route, and
  // the obstacles, as boxes.
  const boxes = routes.map((route) => route.boxes())

  return routes.map((current, route) => {
    const { points } = current
    const size = sizes[route] as ReadonlyArray<number>
    const reach = radii[route] ?? 0
    const identity: SlantedRoute = { route: current, radii: size, remap: (distance) => distance }
    if (!(slant > 0) || !(reach > 0) || points.length < 4) {
      return identity
    }
    const { headings, cumulative } = current
    const count = points.length

    // The short jogs: segments between inner corners that turn opposite
    // ways, too short for both corners at full reach.
    const short = new Map<number, number>()
    for (let i = 1; i + 2 < count; i++) {
      const d = length(points[i] as XY, points[i + 1] as XY)
      const same = headings[i - 1] as XY
      const next = headings[i + 1] as XY
      if (
        !(exempt[route]?.has(i) ?? false) &&
        same[0] === next[0] &&
        same[1] === next[1] &&
        before(d, 2 * reach)
      ) {
        short.set(i, d)
      }
    }

    const slants: Array<Slant> = []
    // How far along each leg the S of a short jog `d` long reaches, with
    // room to spare.
    const spread = (d: number) => slant * reach - ((slant - 1) * d) / 2
    for (const i of short.keys()) {
      const p = points[i] as XY
      const q = points[i + 1] as XY
      const d = length(p, q)
      const u = headings[i - 1] as XY
      // The axis along the legs, and the one across them.
      const along: Axis = u[0] !== 0 ? 0 : 1
      const across = other(along)
      const sign = u[along]

      // The free length before the jog, back along the first leg, and
      // after it, on along the second. The corner at the leg's other end
      // keeps its reach. When it belongs to another short jog, that jog's S
      // keeps what it reaches, up to half the leg, so the two never meet.
      const leg = (from: number, to: number, neighbor: number, jog: number) => {
        const full = (cumulative[to] as number) - (cumulative[from] as number)
        const other = short.get(jog)
        return (
          full -
          (other === undefined ? (size[neighbor] as number) : Math.min(spread(other), full / 2))
        )
      }
      let before = leg(i - 1, i, i - 1, i - 2)
      let after = leg(i + 1, i + 2, i + 2, i + 2)
      // A flow adornment on the jog itself keeps it upright.
      const [start, from, to, end] = [i - 1, i, i + 1, i + 2].map((k) => cumulative[k] as number)
      for (const [a, b] of walls[route] ?? []) {
        if (b > (start as number) && a < (from as number)) {
          before = Math.min(before, (from as number) - b)
        }
        if (a < (end as number) && b > (to as number)) {
          after = Math.min(after, a - (to as number))
        }
        if (overlaps(a, b, from as number, to as number)) {
          before = 0
        }
      }

      // The S may not come within reach of anything else: the other
      // routes and the route's own far stretches, by the gap between their
      // strokes, and the rects, by half its own. Each, as a box grown by
      // that, is checked against the S as drawn: two arcs from the leg
      // before the jog to the leg after it. A wider S reaches farther into
      // the band between the legs at every point, so the widest that clears
      // everything is found by halving, and it moves with the geometry
      // around it.
      const launch = p[across]
      const finish = q[across]
      const toward = Math.sign(finish - launch)
      const jogAt = p[along]
      let most = Math.min(before, after)
      const own = width(route)
      const near: Array<Box> = []
      const consider = (box: Obstacle, keep: number) => {
        const [a0, a1] = [lo(box, along), hi(box, along)]
        const [c0, c1] = [lo(box, across), hi(box, across)]
        const grown: Box = {
          u0: (sign > 0 ? a0 - jogAt : jogAt - a1) - keep,
          u1: (sign > 0 ? a1 - jogAt : jogAt - a0) + keep,
          c0: c0 - keep,
          c1: c1 + keep,
        }
        if (!overlaps(grown.u0, grown.u1, -most, most)) {
          return
        }
        // The S starts and ends past anything its legs pass through, such
        // as the rect a port leaves or a route that crosses a leg, and
        // stays upright for anything on the jog itself.
        const upright = touches(grown, launch, finish)
        if (upright === undefined) {
          near.push(grown)
        } else {
          most = Math.min(most, upright)
        }
      }
      // A jog shorter than the gap is a residue, such as what a port that
      // slides part of the way leaves, rather than a turn of its own. Its S
      // strays at most half of it off the legs, toward the other one, so it
      // keeps that much less than the gap from the routes alongside them:
      // where the legs keep the gap, the S does too, less than half the gap
      // nearer, and the residue never draws as an upright kink for a
      // neighbor that the legs already clear.
      const stray = atMost(spacing, d) ? 0 : d / 2
      for (const [other, list] of boxes.entries()) {
        const strokes = (own + width(other)) / 2
        const keep = (other !== route && partners(route, other) ? tight : spacing) + strokes
        for (const [segment, box] of list.entries()) {
          if (other !== route || segment < i - 1 || segment > i + 1) {
            // A route across the legs needs only the S to end short of its
            // stroke; one alongside them keeps the gap.
            const across = lo(box, along) === hi(box, along)
            consider(box, across ? strokes : Math.max(keep - stray, strokes))
          }
        }
      }
      for (const box of obstacles) {
        consider(box, own / 2)
      }
      const clears = (room: number) => {
        const fitted = fit(d, reach, slant, room)
        if (fitted === undefined) {
          return true
        }
        const half = fitted.w / 2 + fitted.reach
        return near.every((box) => !crosses(box, half, d, launch, toward))
      }
      let room = most
      if (!clears(most)) {
        let [low, high] = [0, most]
        for (let step = 0; step < HALVINGS; step++) {
          const middle = (low + high) / 2
          if (clears(middle)) {
            low = middle
          } else {
            high = middle
          }
        }
        room = low
      }
      const fitted = fit(d, reach, slant, room)
      if (fitted !== undefined) {
        slants.push({ index: i, ...fitted })
      }
    }
    if (slants.length === 0) {
      return identity
    }

    // Move each slanted jog's corners apart, and note how much shorter the
    // route gets past it.
    const moved = points.map((point): XY => [point[0], point[1]])
    const resized = [...size]
    const cuts: Array<readonly [at: number, by: number]> = []
    for (const { index, w, reach: corner } of slants) {
      const p = points[index] as XY
      const q = points[index + 1] as XY
      const u = headings[index - 1] as XY
      moved[index] = [p[0] - (u[0] * w) / 2, p[1] - (u[1] * w) / 2]
      moved[index + 1] = [q[0] + (u[0] * w) / 2, q[1] + (u[1] * w) / 2]
      resized[index] = corner
      resized[index + 1] = corner
      const d = length(p, q)
      cuts.push([(cumulative[index + 1] as number) + w / 2, w + d - Math.hypot(w, d)])
    }
    return {
      route: routeOf(moved),
      radii: resized,
      remap: (distance) => {
        let shift = 0
        for (const [at, by] of cuts) {
          if (distance > at || coincident(distance, at)) {
            shift += by
          }
        }
        return distance - shift
      },
    }
  })
}

const length = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1])

// The corners' distance apart along the legs, `w`, and how far each
// reaches, for a jog `d` long with `room` free on each side, or `undefined`
// when the jog stays upright. The S spans `2 * slant * r - (slant - 1) * d`
// along the legs for corners that reach `r` at a right angle: the largest
// `r` up to `reach` that fits the room. At `r = d / 2` the span is `d` and
// the corners are the upright ones.
function fit(d: number, reach: number, slant: number, room: number) {
  const r = Math.min((2 * room + (slant - 1) * d) / (2 * slant), reach)
  if (!before(d / 2, r)) {
    return undefined
  }
  const span = 2 * slant * r - (slant - 1) * d
  // The two arcs each turn `theta`, with tan(theta / 2) = d / span.
  const theta = 2 * Math.atan(d / span)
  const corner = d / (2 * Math.sin(theta))
  const w = span - 2 * corner
  return before(0, w) ? { w, reach: corner } : undefined
}
