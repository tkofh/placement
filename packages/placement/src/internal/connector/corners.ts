import { coincident } from 'curvy/number'
import type { XY } from './nudge.ts'

// The sizes of the corners of orthogonal routes. Each corner reaches at most
// its route's radius, and no more of a leg than its share: a leg between two
// corners splits evenly between them, and a leg from a port belongs to its
// one corner.
//
// Routes that turn together, nested a small distance apart, keep that
// distance through the turn only when their corners share a center, like the
// curves of lines on a metro map. Corners of one size drift apart at the
// turn, and a large outer corner beside a small inner one, which short legs
// can force, cuts across it. An inner corner sits back from its outer one by
// `s` along the way in and over by `t` along the way out. When both are less
// than the outer corner's size, the inner corner is at most the outer's size
// less the larger of the two, down to none, and the outer one at most the
// inner's size plus it. With `s` and `t` equal, which nudging gives routes
// that share a bend, the two corners share a center. Corners only shrink, so
// each stays within its route's radius.

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
}

const before = (a: number, b: number) => a < b && !coincident(a, b)

/**
 * Sizes the corners of routes.
 *
 * @param routes - The routes, as points with no repeats and no points in the
 * middle of a straight run.
 * @param radii - The radius of each route.
 * @returns The size of the corner at each point of each route, `0` at both
 * ends.
 */
export function cornerRadii(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  radii: ReadonlyArray<number>,
): Array<Array<number>> {
  const sizes = routes.map((points, r) => {
    const radius = radii[r] ?? 0
    const limit = Number.isFinite(radius) && radius > 0 ? radius : 0
    const legs = points.slice(1).map((point, i) => {
      const previous = points[i] as XY
      return Math.abs(point[0] - previous[0]) + Math.abs(point[1] - previous[1])
    })
    const last = points.length - 1
    return points.map((_, i) => {
      if (i === 0 || i === last) {
        return 0
      }
      const into = (legs[i - 1] as number) / (i - 1 === 0 ? 1 : 2)
      const out = (legs[i] as number) / (i === last - 1 ? 1 : 2)
      return Math.min(limit, into, out)
    })
  })

  // The right-angled corners, grouped by the turn they make.
  const turns = new Map<string, Array<Corner>>()
  for (const [route, points] of routes.entries()) {
    for (let index = 1; index + 1 < points.length; index++) {
      const [px, py] = points[index - 1] as XY
      const [x, y] = points[index] as XY
      const [nx, ny] = points[index + 1] as XY
      const corner = {
        route,
        index,
        x,
        y,
        ax: Math.sign(x - px),
        ay: Math.sign(y - py),
        bx: Math.sign(nx - x),
        by: Math.sign(ny - y),
      }
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
  // way: back by `s` along the way in, over by `t` along the way out.
  const links: Array<{ outer: Corner; inner: Corner; by: number }> = []
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
        if (before(0, s) && before(0, t) && (best === undefined || s + t < best.span)) {
          best = { inner, by: Math.max(s, t), span: s + t }
        }
      }
      if (best !== undefined) {
        links.push({ outer, inner: best.inner, by: best.by })
      }
    }
  }

  // Shrink corners until every nested pair fits, which settles at least one
  // more ring of a nest each pass. Corners farther apart than the outer one
  // reached before any shrinking do not meet.
  const reach = sizes.map((list) => [...list])
  for (let pass = 0; pass <= links.length; pass++) {
    let changed = false
    for (const { outer, inner, by } of links) {
      const outerSize = (sizes[outer.route] as Array<number>)[outer.index] as number
      const innerSizes = sizes[inner.route] as Array<number>
      const current = innerSizes[inner.index] as number
      if (!before(by, (reach[outer.route] as Array<number>)[outer.index] as number)) {
        continue
      }
      const fits = Math.max(0, outerSize - by)
      if (fits < current) {
        innerSizes[inner.index] = fits
        changed = true
      }
      const around = (innerSizes[inner.index] as number) + by
      if (around < outerSize) {
        ;(sizes[outer.route] as Array<number>)[outer.index] = around
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
  return sizes
}
