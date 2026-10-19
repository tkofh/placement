import { coincident } from 'curvy/number'
import { before } from '../../utils/tolerance.ts'
import { resolveRadii } from '../adornments.ts'
import { type XY, positiveLength } from '../orient.ts'
import type { Route } from './route.ts'

// The sizes of the corners of orthogonal routes. A route's radius is the
// least its corners turn: each reaches that far along its two legs unless
// a leg is too short for it, never into a wall (a stretch that flow
// adornments take), and no more of a leg than its share (see
// `resolveRadii`). Nothing but its legs holds a corner smaller than its
// radius, so it falls to routing to leave the legs long enough.
//
// Routes that turn together, nested a small distance apart, keep that
// distance through the turn only when their corners share a center, like
// the curves of lines on a metro map. Corners nest only where the routes
// run alongside each other on both legs. The innermost corner of a nest
// keeps its radius, and each corner outside it grows: one that sits back
// from the corner inside it by `s` along the way in and over by `t` along
// the way out is larger than it by the larger of the two, so with `s` and
// `t` equal, which nudging gives routes that share a bend, the two share a
// center. A nest reaches less than both routes' radii together, and the
// growth tapers off past the outer route's radius, down to none at that
// reach, so that no corner jumps as routes drift apart. Where a leg is too
// short for an outer corner's grown size and the corner at its other end,
// that corner gives way, by no more than the leg has spare past the outer
// corner's radius and its own want (see `resolveRadii`): the nest holds
// together where its leg falls a little short, and lets go slowly where it
// falls far short, the two corners drifting apart through the turn. An
// inner corner never shrinks for the one outside it, and gives way to no
// other corner either, or the nests would chase each other.
//
// Once the routes take their final shape, an outer corner that turns less
// than a right angle, as at a slanted jog, draws an arc of radius its size
// over `tan(theta / 2)` for a turn `theta`. The corners nested inside it
// grow to that arc less how far they sit inside, where that is more than
// their radius, so the nest keeps its center through the slant.

/** What sizing the corners keeps as given, and the shape they end up in. */
export interface CornerOptions {
  /**
   * The corners whose size is set, by route and then point index. They
   * never grow, though corners may grow around them.
   */
  readonly fixed?: ReadonlyArray<ReadonlyMap<number, number>> | undefined
  /**
   * The routes as they are drawn, point for point, where corners may have
   * moved off the orthogonal routes: an outer corner that moved, with a set
   * size, grows its inner ones to the arc it draws, and an inner corner
   * that moved leaves its nest.
   */
  readonly shaped?: ReadonlyArray<Route> | undefined
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

// Whether a corner sits off its orthogonal route in the routes as drawn.
const moved = (shaped: ReadonlyArray<Route> | undefined, corner: Corner): boolean => {
  const point = shaped?.[corner.route]?.points[corner.index]
  return point !== undefined && (point[0] !== corner.x || point[1] !== corner.y)
}

/**
 * Sizes the corners of routes.
 *
 * @param routes - The orthogonal routes.
 * @param radii - The radius of each route, the least its corners turn.
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
  const { fixed = [], shaped } = options
  const limits = routes.map((_, r) => positiveLength(radii[r]))
  const fixedAt = (route: number, index: number) => fixed[route]?.has(index) ?? false
  const isFixed = (corner: Corner) => fixedAt(corner.route, corner.index)
  // Every corner wants its radius, and a fixed one its size.
  const floors = routes.map((route, r) => {
    const list = route.points.map(() => limits[r] as number)
    for (const [index, size] of fixed[r] ?? []) {
      list[index] = size
    }
    return list
  })
  // The corners that others nest around (filled in below) give way to no
  // other, or the nests would chase each other; nor do fixed ones.
  const inners = routes.map(() => new Set<number>())
  // The corners at the sizes they want, as far as their legs allow, with a
  // corner grown past its radius taking from the one at the other end of a
  // leg too short for both.
  const settle = (targets: ReadonlyArray<ReadonlyArray<number>>) =>
    routes.map((route, r) => {
      const list = resolveRadii(
        route.points,
        route.cumulative,
        targets[r] as ReadonlyArray<number>,
        walls[r] ?? [],
        {
          floors: floors[r] as ReadonlyArray<number>,
          held: (index) => fixedAt(r, index) || (inners[r]?.has(index) ?? false),
        },
      )
      for (const [index, size] of fixed[r] ?? []) {
        list[index] = size
      }
      return list
    })
  let sizes = settle(floors)

  // The nests. An outer corner that moved grows the inner one to its arc
  // instead of growing itself; an inner corner that moved, or a fixed
  // outer one, nests with nothing, and a fixed inner one only has corners
  // grow around it.
  const links: Array<Link & { readonly arc: number | undefined; readonly grow: number }> = []
  for (const link of nestsWithin(routes, limits)) {
    const { outer, inner, by } = link
    const reach = (limits[outer.route] as number) + (limits[inner.route] as number)
    if (moved(shaped, inner)) {
      continue
    }
    if (moved(shaped, outer)) {
      if (isFixed(inner)) {
        continue
      }
      const size = (sizes[outer.route] as Array<number>)[outer.index] as number
      const drawn = (shaped as ReadonlyArray<Route>)[outer.route] as Route
      const half = halfTurnTan(drawn.points, outer.index)
      if (half > 0) {
        links.push({ ...link, arc: size / half, grow: 0 })
      }
    } else if (!isFixed(outer)) {
      links.push({ ...link, arc: undefined, grow: Math.min(by, reach - by) })
    }
  }
  if (links.length === 0) {
    return sizes
  }
  for (const { inner } of links) {
    inners[inner.route]?.add(inner.index)
  }

  // Grow the corners until every nest settles, from the innermost out,
  // which takes one pass per ring of a nest. Each pass sizes every corner
  // afresh from what the corners inside it came to, so that a corner held
  // short by its legs holds back nothing but the growth around it.
  for (let pass = 0; pass <= links.length; pass++) {
    const targets = floors.map((list) => list.slice())
    for (const { outer, inner, by, arc, grow } of links) {
      if (arc === undefined) {
        const list = targets[outer.route] as Array<number>
        const want = ((sizes[inner.route] as Array<number>)[inner.index] as number) + grow
        list[outer.index] = Math.max(list[outer.index] as number, want)
      } else {
        const list = targets[inner.route] as Array<number>
        list[inner.index] = Math.max(list[inner.index] as number, arc - by)
      }
    }
    const next = settle(targets)
    const same = next.every((list, r) =>
      list.every((size, i) => coincident(size, (sizes[r] as Array<number>)[i] as number)),
    )
    sizes = next
    if (same) {
      break
    }
  }
  return sizes
}

/**
 * How much larger than the innermost corner of its nest each corner is,
 * for the corners of nests whose members keep their right angle: how far
 * outside that corner it sits, where the nest keeps one center, and less
 * where a leg holds it short of its grown size. A renderer that draws such
 * a corner as the innermost one moved out by its outset keeps the nest
 * about one center, and as near to it as a held corner's size allows.
 *
 * @param routes - The orthogonal routes, as given to `cornerRadii`.
 * @param radii - The radius of each route, as given to `cornerRadii`.
 * @param sizes - Their corner sizes, from `cornerRadii`.
 * @param shaped - The routes as drawn, where corners that moved nest with
 * nothing.
 * @returns The outset of the corner at each point of each route, `0` for
 * one that does not nest, that is the innermost of its nest, or that is no
 * larger than it.
 */
export function cornerOutsets(
  routes: ReadonlyArray<Route>,
  radii: ReadonlyArray<number>,
  sizes: ReadonlyArray<ReadonlyArray<number>>,
  shaped?: ReadonlyArray<Route>,
): Array<Array<number>> {
  const outsets = routes.map(({ points }) => points.map(() => 0))
  const limits = routes.map((_, r) => positiveLength(radii[r]))
  const upright = nestsWithin(routes, limits).filter(
    ({ outer, inner }) => !moved(shaped, outer) && !moved(shaped, inner),
  )
  // Inner corners first, by settling one more ring of each nest per pass.
  for (let pass = 0; pass <= upright.length; pass++) {
    let changed = false
    for (const { outer, inner } of upright) {
      const outerSize = sizes[outer.route]?.[outer.index] ?? 0
      const innerSize = sizes[inner.route]?.[inner.index] ?? 0
      const inside = (outsets[inner.route] as Array<number>)[inner.index] as number
      const outset = Math.max(inside + outerSize - innerSize, 0)
      const list = outsets[outer.route] as Array<number>
      if (!coincident(list[outer.index] as number, outset)) {
        list[outer.index] = outset
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
  return outsets
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
// has its corners sized twice and outset once, and the routes never change.
const nests = new WeakMap<ReadonlyArray<Route>, ReadonlyArray<Link>>()

// The nests that size corners: pairs of routes with radii whose offset is
// within both radii together.
function nestsWithin(
  routes: ReadonlyArray<Route>,
  limits: ReadonlyArray<number>,
): ReadonlyArray<Link> {
  return nestLinks(routes).filter(({ outer, inner, by }) => {
    const [outerLimit, innerLimit] = [limits[outer.route] as number, limits[inner.route] as number]
    return outerLimit > 0 && innerLimit > 0 && before(by, outerLimit + innerLimit)
  })
}

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
