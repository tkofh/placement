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
// beside it allow. The segments at the ends of a route attach to its pins and
// stay put. Where a channel is too narrow for the full gap, the gaps of the
// segments that crowd it shrink until they fit, down to none.

export type XY = readonly [number, number]

type Point = [number, number]

interface Segment {
  readonly route: number
  readonly index: number
  // The coordinate of the line it runs along, and its extent along it.
  readonly at: number
  readonly low: number
  readonly high: number
  readonly fixed: boolean
}

// How many times a crowded channel halves its gaps before it gives them up.
const SHRINK_STEPS = 6

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
 * @param gap - The distance between overlapping segments.
 * @returns The routes with their segments moved, without repeated points or
 * points in the middle of a straight run.
 */
export function nudge(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  obstacles: ReadonlyArray<Obstacle>,
  gap: number,
): Array<Array<XY>> {
  const paths = routes.map(simplify)
  if (Number.isFinite(gap) && gap > 0) {
    // Moving one axis changes the extents of the other's segments, which can
    // make them overlap, so the passes repeat until neither moves anything.
    for (let round = 0; round < ROUNDS; round++) {
      const movedX = nudgeAxis(paths, obstacles, gap, 0)
      const movedY = nudgeAxis(paths, obstacles, gap, 1)
      if (!movedX && !movedY) {
        break
      }
    }
  }
  return paths.map(simplify)
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
  gap: number,
  axis: number,
): boolean {
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
      const fixed =
        index === 0 ||
        index === last ||
        axisOf(path, index - 1) === -1 ||
        axisOf(path, index + 1) === -1
      segments.push({
        route,
        index,
        at: coord(path[index] as Point, axis),
        low: Math.min(a, b),
        high: Math.max(a, b),
        fixed,
      })
    }
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

  // The variables: one per segment, then the walls that obstacles put
  // beside the segments that move.
  const variables: Array<Variable> = segments.map((s) => ({ desired: s.at, fixed: s.fixed }))
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
    const [low, high] = walls(obstacles, segment, axis)
    if (low !== undefined) {
      variables.push({ desired: low, fixed: true })
      separations.push({ left: variables.length - 1, right: s, gap: 0 })
    }
    if (high !== undefined) {
      variables.push({ desired: high, fixed: true })
      separations.push({ left: s, right: variables.length - 1, gap: 0 })
    }
  }

  // Overlapping segments on one line, a full gap apart in their order.
  for (const [a, b] of pairs) {
    const [left, right] = (rank[a] as number) < (rank[b] as number) ? [a, b] : [b, a]
    separate(left, right, gap)
  }

  // Segments on different lines keep their order where their extents
  // overlap or touch, and a gap apart when they can. A sweep along the
  // extents keeps the segments it crosses in order, and each segment is held
  // apart from its neighbors there. Two segments of one route only keep
  // their order: where they touch, a jog joins them.
  const groupAt = (s: number) => (segments[find(s)] as Segment).at
  const before = (a: number, b: number) =>
    groupAt(a) - groupAt(b) || (rank[a] as number) - (rank[b] as number) || a - b
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
      separate(left, right, sameRoute ? 0 : gap)
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

  // Solve, and halve the gaps that crowd a channel until everything fits.
  const scale = new Float64Array(separations.length).fill(1)
  let positions: Float64Array | undefined
  for (let attempt = 0; attempt <= SHRINK_STEPS + 1; attempt++) {
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
    const crowded = new Set(conflicts.flatMap(({ variables: list }) => list))
    let changed = false
    for (const [k, { left, right, gap: full }] of separations.entries()) {
      if (full > 0 && crowded.has(left) && crowded.has(right) && scale[k] !== 0) {
        scale[k] = attempt >= SHRINK_STEPS ? 0 : (scale[k] as number) / 2
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }

  let anyMoved = false
  for (const [s, segment] of segments.entries()) {
    const moved = (positions as Float64Array)[s] as number
    if (segment.fixed || moved === segment.at) {
      continue
    }
    anyMoved = true
    const path = paths[segment.route] as Array<Point>
    ;(path[segment.index] as Point)[axis === 0 ? 0 : 1] = moved
    ;(path[segment.index + 1] as Point)[axis === 0 ? 0 : 1] = moved
  }
  return anyMoved
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
