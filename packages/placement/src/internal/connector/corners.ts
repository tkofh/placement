import { coincident } from 'curvy/number'
import { before } from '../../utils/tolerance.ts'
import { resolveRadii } from '../adornments.ts'
import { type XY, positiveLength } from '../orient.ts'
import type { Route } from './route.ts'

// The sizes of the corners of orthogonal routes. Each corner reaches at most
// its route's radius, never into a wall (a stretch that flow adornments
// take), and no more of a leg than its share (see `resolveRadii`).
//
// Routes that turn together, nested a small distance apart, keep that
// distance through the turn only when their corners share a center, like the
// curves of lines on a metro map. Corners nest only where the routes run
// alongside each other on both legs. Corners of one size drift apart at the
// turn, and a large outer corner beside a small inner one, which short legs
// can force, cuts across it. An inner corner sits back from its outer one by
// `s` along the way in and over by `t` along the way out. While the larger
// of the two is less than both routes' radii together, the inner corner is
// at most the distance between the outer's size and it: the outer's size
// less it, down to none, while the inner corner sits inside the outer's
// center, and as much as it sits past the center beyond, so that no corner
// jumps as the routes move. The outer one is at most the inner's size plus
// it. With `s` and `t` equal, which nudging gives routes that share a bend,
// the two corners share a center. Whether corners nest depends on the
// radii and not on how far the outer corner reaches, so an inner corner
// follows its outer one smoothly as a leg shortens.
// Corners only shrink, so each stays within its route's radius. A nest
// shrinks no corner below half its route's thickness, where the inside of
// the stroke would fold over, unless its legs hold it smaller already.
//
// Once the routes take their final shape, an outer corner that turns less
// than a right angle, as at a slanted jog, draws an arc of radius its size
// over `tan(theta / 2)` for a turn `theta`. Its inner corner is then bound
// by that radius in place of the size, growing back as the turn flattens.

/** What sizing the corners keeps as given, and the shape they end up in. */
export interface CornerOptions {
  /**
   * The corners whose size is set, by route and then point index. They take
   * no part in nests.
   */
  readonly fixed?: ReadonlyArray<ReadonlyMap<number, number>> | undefined
  /**
   * The routes as they are drawn, point for point, where corners may have
   * moved off the orthogonal routes: an outer corner that moved, with a set
   * size, bounds its inner one by the arc it draws, and an inner corner that
   * moved leaves its nest.
   */
  readonly shaped?: ReadonlyArray<Route> | undefined
  /** How thick each route draws. */
  readonly thickness?: ReadonlyArray<number> | undefined
  /**
   * The corners, by route, where a route parts from a bundle it ran with,
   * which turn at most `turning`, or that plus the offsets of the parting
   * corners nested inside them.
   */
  readonly exits?: ReadonlyArray<ReadonlySet<number>> | undefined
  /** The tightest each route turns, for its parting corners. */
  readonly turning?: ReadonlyArray<number> | undefined
}

interface Corner {
  readonly route: number
  readonly index: number
  readonly x: number
  readonly y: number
  // The headings in and out, as signs.
  readonly ax: number
  readonly ay: number
  readonly bx: number
  readonly by: number
  // Where the leg in starts, and where the leg out ends.
  readonly from: XY
  readonly to: XY
}

interface Link {
  readonly outer: Corner
  readonly inner: Corner
  readonly by: number
}

const key = (corner: Corner) => `${corner.route}:${corner.index}`

// Whether a corner sits off its orthogonal route in the routes as drawn.
const moved = (shaped: ReadonlyArray<Route> | undefined, corner: Corner): boolean => {
  const point = shaped?.[corner.route]?.points[corner.index]
  return point !== undefined && (point[0] !== corner.x || point[1] !== corner.y)
}

/**
 * Sizes the corners of routes.
 *
 * @param routes - The orthogonal routes.
 * @param radii - The radius of each route.
 * @param walls - The stretches of each route that its flow adornments
 * take, as lengths along it.
 * @param options - The corners whose size is set, and the routes as drawn.
 * @returns The size of the corner at each point of each route, `0` at both
 * ends.
 */
export function cornerRadii(
  routes: ReadonlyArray<Route>,
  radii: ReadonlyArray<number>,
  walls: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [],
  options: CornerOptions = {},
): Array<Array<number>> {
  const { fixed = [], shaped, thickness = [], exits = [], turning = [] } = options
  const limits = routes.map((_, r) => positiveLength(radii[r]))
  const sizes = routes.map((route, r) => {
    const list = resolveRadii(route.points, route.cumulative, limits[r] as number, walls[r] ?? [])
    for (const [index, size] of fixed[r] ?? []) {
      list[index] = size
    }
    return list
  })
  // The least each corner shrinks to in a nest.
  const floors = sizes.map((list, r) => {
    const half = positiveLength(thickness[r]) / 2
    return list.map((size) => Math.min(size, half))
  })
  const isFixed = (corner: Corner) => fixed[corner.route]?.has(corner.index) ?? false

  // The nests: pairs whose offset is within the outer route's radius, that
  // neither leaves. An outer corner that moved bounds its inner one by its
  // arc; any other fixed corner takes no part.
  const links: Array<Link & { readonly arc: number | undefined }> = []
  for (const link of nestLinks(routes)) {
    const { outer, inner, by } = link
    // Past both radii, the inner corner's bound is past its own.
    const reach = (limits[outer.route] as number) + (limits[inner.route] as number)
    if (!before(by, reach) || moved(shaped, inner) || isFixed(inner)) {
      continue
    }
    if (moved(shaped, outer)) {
      const size = (sizes[outer.route] as Array<number>)[outer.index] as number
      const drawn = (shaped as ReadonlyArray<Route>)[outer.route] as Route
      const half = halfTurnTan(drawn.points, outer.index)
      links.push({ ...link, arc: half > 0 ? size / half : Number.POSITIVE_INFINITY })
    } else if (!isFixed(outer)) {
      links.push({ ...link, arc: undefined })
    }
  }

  // Parting corners turn tight, and those nested around others grow out
  // from the innermost by their offsets, so a nest that parts together
  // keeps one center.
  const isExit = (corner: Corner) =>
    (exits[corner.route]?.has(corner.index) ?? false) && !isFixed(corner) && !moved(shaped, corner)
  const caps = new Map<string, number>()
  for (const [route, list] of exits.entries()) {
    const tightest = positiveLength(turning[route])
    for (const index of list) {
      caps.set(`${route}:${index}`, tightest)
    }
  }
  const outward = links.filter(({ outer, inner }) => isExit(outer) && isExit(inner))
  for (let pass = 0; pass <= outward.length; pass++) {
    let changed = false
    for (const { outer, inner, by } of outward) {
      const around = (caps.get(key(inner)) ?? 0) + by
      if (before(caps.get(key(outer)) ?? 0, around)) {
        caps.set(key(outer), around)
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
  for (const [route, list] of exits.entries()) {
    const routeSizes = sizes[route] as Array<number>
    for (const index of list) {
      if (!(fixed[route]?.has(index) ?? false) && index > 0 && index < routeSizes.length - 1) {
        const cap = caps.get(`${route}:${index}`) ?? 0
        routeSizes[index] = Math.min(routeSizes[index] as number, cap)
      }
    }
  }

  // Shrink corners until every nested pair fits, which settles at least one
  // more ring of a nest each pass.
  for (let pass = 0; pass <= links.length; pass++) {
    let changed = false
    for (const { outer, inner, by, arc } of links) {
      const outerSizes = sizes[outer.route] as Array<number>
      const innerSizes = sizes[inner.route] as Array<number>
      const floor = (floors[inner.route] as Array<number>)[inner.index] as number
      const base = arc ?? (outerSizes[outer.index] as number)
      const fits = Math.max(floor, Math.abs(base - by))
      if (fits < (innerSizes[inner.index] as number)) {
        innerSizes[inner.index] = fits
        changed = true
      }
      const around = (innerSizes[inner.index] as number) + by
      if (arc === undefined && around < (outerSizes[outer.index] as number)) {
        outerSizes[outer.index] = around
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
  return sizes
}

/**
 * How far inside the outermost corner of its nest each corner sits, for the
 * corners that a nest sized: those exactly the size of the corner outside
 * them less how far they sit inside it, where both keep their right angle.
 * A renderer that draws them as offsets of the outermost corner keeps the
 * nest about one center.
 *
 * @param routes - The orthogonal routes, as given to `cornerRadii`.
 * @param sizes - Their corner sizes, from `cornerRadii`.
 * @param shaped - The routes as drawn, where corners that moved nest with
 * nothing.
 * @returns The inset of the corner at each point of each route, `0` for
 * one that does not nest or that its nest left alone.
 */
export function cornerInsets(
  routes: ReadonlyArray<Route>,
  sizes: ReadonlyArray<ReadonlyArray<number>>,
  shaped?: ReadonlyArray<Route>,
): Array<Array<number>> {
  const insets = routes.map(({ points }) => points.map(() => 0))
  const tight = nestLinks(routes).filter(({ outer, inner, by }) => {
    const outerSize = sizes[outer.route]?.[outer.index] ?? 0
    const innerSize = sizes[inner.route]?.[inner.index] ?? 0
    return (
      !moved(shaped, outer) &&
      !moved(shaped, inner) &&
      before(by, outerSize) &&
      coincident(innerSize, outerSize - by)
    )
  })
  // Outer corners first, by settling one more ring of each nest per pass.
  for (let pass = 0; pass <= tight.length; pass++) {
    let changed = false
    for (const { outer, inner, by } of tight) {
      const inset = ((insets[outer.route] as Array<number>)[outer.index] as number) + by
      const list = insets[inner.route] as Array<number>
      if (!coincident(list[inner.index] as number, inset)) {
        list[inner.index] = inset
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
  return insets
}

// The tangent of half the turn at a point of a route.
function halfTurnTan(points: ReadonlyArray<XY>, index: number): number {
  const [px, py] = points[index - 1] as XY
  const [x, y] = points[index] as XY
  const [nx, ny] = points[index + 1] as XY
  const [ux, uy] = [x - px, y - py]
  const [vx, vy] = [nx - x, ny - y]
  const theta = Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy)
  return Math.tan(theta / 2)
}

// The nests of each set of routes, kept for the next pass over it: one set
// has its corners sized twice and inset once, and the routes never change.
const nests = new WeakMap<ReadonlyArray<Route>, ReadonlyArray<Link>>()

// Each corner's nearest inner corner among the others that turn the same
// way, by the larger of how far it sits back and over.
function nestLinks(routes: ReadonlyArray<Route>): ReadonlyArray<Link> {
  let links = nests.get(routes)
  if (links === undefined) {
    links = findNests(routes)
    nests.set(routes, links)
  }
  return links
}

function findNests(routes: ReadonlyArray<Route>): Array<Link> {
  // The right-angled corners, grouped by the turn they make.
  const turns = new Map<string, Array<Corner>>()
  for (const [route, { points, headings }] of routes.entries()) {
    for (let index = 1; index + 1 < points.length; index++) {
      const from = points[index - 1] as XY
      const point = points[index] as XY
      const to = points[index + 1] as XY
      const [x, y] = point
      const [ax, ay] = headings[index - 1] as XY
      const [bx, by] = headings[index] as XY
      const corner = { route, index, x, y, ax, ay, bx, by, from, to }
      const right =
        Math.abs(corner.ax) + Math.abs(corner.ay) === 1 &&
        Math.abs(corner.bx) + Math.abs(corner.by) === 1 &&
        corner.ax * corner.bx + corner.ay * corner.by === 0
      if (right) {
        const key = `${corner.ax},${corner.ay},${corner.bx},${corner.by}`
        const list = turns.get(key) ?? []
        list.push(corner)
        turns.set(key, list)
      }
    }
  }

  // Each corner's nearest inner corner among the others that turn the same
  // way: back by `s` along the way in, over by `t` along the way out. The
  // two must run alongside each other on both legs, so a hair of a jog
  // past one turns with nothing.
  const links: Array<Link> = []
  for (const list of turns.values()) {
    for (const outer of list) {
      let best: { inner: Corner; by: number; span: number } | undefined
      for (const inner of list) {
        if (inner.route === outer.route) {
          continue
        }
        const dx = inner.x - outer.x
        const dy = inner.y - outer.y
        const s = -(dx * outer.ax + dy * outer.ay)
        const t = dx * outer.bx + dy * outer.by
        if (
          before(0, s) &&
          before(0, t) &&
          alongside(outer, inner) &&
          (best === undefined || s + t < best.span)
        ) {
          best = { inner, by: Math.max(s, t), span: s + t }
        }
      }
      if (best !== undefined) {
        links.push({ outer, inner: best.inner, by: best.by })
      }
    }
  }
  return links
}

// Whether two corners that turn the same way have legs in that run
// alongside each other, and legs out too.
function alongside(a: Corner, b: Corner): boolean {
  const overlap = (dx: number, dy: number, a0: XY, a1: XY, b0: XY, b1: XY) => {
    const [p, q] = [a0[0] * dx + a0[1] * dy, a1[0] * dx + a1[1] * dy]
    const [r, s] = [b0[0] * dx + b0[1] * dy, b1[0] * dx + b1[1] * dy]
    return before(
      Math.max(Math.min(p, q), Math.min(r, s)),
      Math.min(Math.max(p, q), Math.max(r, s)),
    )
  }
  return (
    overlap(a.ax, a.ay, a.from, [a.x, a.y], b.from, [b.x, b.y]) &&
    overlap(a.bx, a.by, [a.x, a.y], a.to, [b.x, b.y], b.to)
  )
}
