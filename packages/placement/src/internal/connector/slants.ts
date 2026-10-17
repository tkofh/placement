import { coincident } from 'curvy/number'
import type { Obstacle } from '../graph/graph.ts'
import type { XY } from './nudge.ts'

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
// the next corner (or of the next short jog's S, up to half the leg), of
// the stretches flow adornments wall off, and of anything inside the band
// between the two legs: the other routes, and the rects grown by their
// clearance. What dips into the band only from an edge holds the S back by
// how deep it reaches. With less room, the corners take a smaller reach,
// down to the orthogonal corners that share the jog. Every limit moves
// with the geometry, so the S grows and shrinks without jumping.

/** A route with its short jogs slanted. */
export interface SlantedRoute {
  /** The points, with each slanted jog's two corners moved apart. */
  readonly points: ReadonlyArray<XY>
  /** How far the corner at each point reaches along its legs. */
  readonly radii: ReadonlyArray<number>
  /**
   * Maps a length along the orthogonal route, outside any slant, to the
   * length along the slanted one.
   */
  readonly remap: (distance: number) => number
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
 * @param routes - The routes, as points with no repeats and no points in the
 * middle of a straight run.
 * @param sizes - The size of each route's corners (see `cornerRadii`).
 * @param radii - The reach of each route's corners at a right angle.
 * @param slant - How far apart a jog's corners slide, as a multiple of what
 * keeps the shape continuous. `0` slants nothing.
 * @param walls - The stretches of each route that its flow adornments take.
 * @param obstacles - The rects, grown by the clearance.
 * @returns Each route with its short jogs slanted.
 */
export function slantJogs(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  sizes: ReadonlyArray<ReadonlyArray<number>>,
  radii: ReadonlyArray<number>,
  slant: number,
  walls: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  obstacles: ReadonlyArray<Obstacle>,
): Array<SlantedRoute> {
  // Everything a slant keeps clear of: each route's segments, by route, and
  // the obstacles, as boxes.
  const boxes = routes.map((points) =>
    points.slice(1).map((b, i): Obstacle => {
      const a = points[i] as XY
      return {
        left: Math.min(a[0], b[0]),
        right: Math.max(a[0], b[0]),
        top: Math.min(a[1], b[1]),
        bottom: Math.max(a[1], b[1]),
      }
    }),
  )

  return routes.map((points, route) => {
    const size = sizes[route] as ReadonlyArray<number>
    const reach = radii[route] ?? 0
    const identity: SlantedRoute = { points, radii: size, remap: (distance) => distance }
    if (!(slant > 0) || !(reach > 0) || points.length < 4) {
      return identity
    }
    const count = points.length
    const cumulative = [0]
    for (let i = 1; i < count; i++) {
      cumulative.push((cumulative[i - 1] as number) + length(points[i - 1] as XY, points[i] as XY))
    }

    // The short jogs: segments between inner corners that turn opposite
    // ways, too short for both corners at full reach.
    const short = new Map<number, number>()
    for (let i = 1; i + 2 < count; i++) {
      const d = length(points[i] as XY, points[i + 1] as XY)
      const same = heading(points, i - 1)
      const next = heading(points, i + 1)
      if (
        same[0] === next[0] &&
        same[1] === next[1] &&
        d < 2 * reach &&
        !coincident(d, 2 * reach)
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
      const u = heading(points, i - 1)
      // The axis along the legs, and the one across them.
      const along = u[0] !== 0 ? 0 : 1
      const across = 1 - along
      const sign = along === 0 ? u[0] : u[1]

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
        if (
          a < (to as number) &&
          b > (from as number) &&
          !coincident(a, to as number) &&
          !coincident(b, from as number)
        ) {
          before = 0
        }
      }

      // Anything inside the band between the legs, by how far it sits from
      // the jog along them, and how deep it reaches into the band. One that
      // reaches the middle stops the S where it begins. One that only
      // dips in from an edge lets the S reach past it, by its full spread
      // at the edge itself, so a rect or route that slides in from the side
      // shortens the S gradually.
      const low = Math.min(p[across] as number, q[across] as number)
      const high = Math.max(p[across] as number, q[across] as number)
      const jogAt = p[along] as number
      const full = spread(d)
      const clear = (box: Obstacle) => {
        const [lo, hi] = across === 0 ? [box.left, box.right] : [box.top, box.bottom]
        const from = Math.max(lo, low)
        const to = Math.min(hi, high)
        if (!(to > from) || coincident(to, from)) {
          return
        }
        const middle = (low + high) / 2
        const depth =
          from <= middle && to >= middle
            ? d / 2
            : Math.max(Math.min(from - low, high - from), Math.min(to - low, high - to))
        const past = full * (1 - Math.min(depth / (d / 2), 1))
        const [start, end] = along === 0 ? [box.left, box.right] : [box.top, box.bottom]
        const [near, far] = sign > 0 ? [start - jogAt, end - jogAt] : [jogAt - end, jogAt - start]
        if (near > 0 || coincident(near, 0)) {
          after = Math.min(after, near + past)
        } else if (far < 0 || coincident(far, 0)) {
          before = Math.min(before, -far + past)
        } else {
          before = Math.min(before, past)
          after = Math.min(after, past)
        }
      }
      for (const [other, list] of boxes.entries()) {
        for (const [segment, box] of list.entries()) {
          if (other !== route || segment < i - 1 || segment > i + 1) {
            clear(box)
          }
        }
      }
      for (const box of obstacles) {
        clear(box)
      }

      const room = Math.min(before, after)
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
      const u = heading(points, index - 1)
      const p = points[index] as XY
      const q = points[index + 1] as XY
      moved[index] = [p[0] - (u[0] * w) / 2, p[1] - (u[1] * w) / 2]
      moved[index + 1] = [q[0] + (u[0] * w) / 2, q[1] + (u[1] * w) / 2]
      resized[index] = corner
      resized[index + 1] = corner
      const d = length(p, q)
      cuts.push([(cumulative[index + 1] as number) + w / 2, w + d - Math.hypot(w, d)])
    }
    return {
      points: moved,
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

// The heading of segment `index`, as signs.
function heading(points: ReadonlyArray<XY>, index: number): XY {
  const a = points[index] as XY
  const b = points[index + 1] as XY
  return [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]
}

// The corners' distance apart along the legs, `w`, and how far each
// reaches, for a jog `d` long with `room` free on each side, or `undefined`
// when the jog stays upright. The S spans `2 * slant * r - (slant - 1) * d`
// along the legs for corners that reach `r` at a right angle: the largest
// `r` up to `reach` that fits the room. At `r = d / 2` the span is `d` and
// the corners are the upright ones.
function fit(d: number, reach: number, slant: number, room: number) {
  const r = Math.min((2 * room + (slant - 1) * d) / (2 * slant), reach)
  if (!(r > d / 2) || coincident(r, d / 2)) {
    return undefined
  }
  const span = 2 * slant * r - (slant - 1) * d
  // The two arcs each turn `theta`, with tan(theta / 2) = d / span.
  const theta = 2 * Math.atan(d / span)
  const corner = d / (2 * Math.sin(theta))
  const w = span - 2 * corner
  return w > 0 && !coincident(w, 0) ? { w, reach: corner } : undefined
}
