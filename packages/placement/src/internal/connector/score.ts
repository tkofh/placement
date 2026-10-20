import { coincident } from 'curvy/number'
import type { ConnectorLayout } from '../../connector.ts'
import type * as Rect from '../../rect.ts'
import { before, inside } from '../../utils/tolerance.ts'
import type { Axis, XY } from '../orient.ts'
import type { Problem, ProblemEdge } from './problem.ts'

// The score of a finished layout: what the routes cost as drawn, after
// nudging, port slides, slants, and corners, on the search's own cost
// scale, so that layouts routed different ways compare, and a change to
// the router can be judged by what it draws. The search prices the routes
// it finds, and cannot see what the passes after it squeeze; the score
// reads the routes and notes that come out.
//
// Lower is better. Each term says one thing:
//
// - `length`: each route's length, as a polyline through its points, at
//   one per pixel, whatever the edge's weight, which routing does not read
//   either. Rounding a corner shortens a route by less than a
//   pixel per pixel of radius, so the corners are left to `tight`.
// - `turning`: each corner by how far it turns, a right angle costing a
//   bend. The two gentle turns of a slanted jog cost what they turn, far
//   less than the two right angles of an upright one.
// - `tight`: each corner drawn smaller than its edge's radius, which looks
//   harsh, by its share of the radius it lacks, and by how far it turns,
//   up to the problem's `tightCost`, what the search charges an end
//   without room for its corner.
// - `crossings`: each crossing between two routes, at the problem's
//   `crossingCost`.
// - `squeeze`: each stretch where two routes run alongside each other
//   closer than the gap and their strokes allow (the merge gap, for
//   partners of a group), by how much of that room they lack and how long
//   they run so, read from the routes as drawn rather than from the notes,
//   so a squeeze nudging could not undo, and did not report, costs too.
//   Slanted segments are left out.
// - `crowding`: the `need` of each `shared` and `overflow` note, a bend
//   for each gap and stroke of it.
// - `unrouted`: each edge without a route, more than any route it could
//   have had.
//
// The weights are those of the search (`problem.ts`) where it has one;
// the rest trade against them as each says. They were checked against
// judgements of earlier renders: where the score and the eye disagree, a
// term is missing, and the weights do not bend to make up for it. One is
// known: a route that hooks round a rect's corner into its side, rather
// than coming straight into the side it faces, costs only its tight
// corner, and the eye charges it more.
//
// Two routes cross where each passes from one side of the other to the
// other side, at a point inside a segment of both, or at a corner of one
// inside a segment of the other. Routes that touch, at a corner, an end, or
// a corner of each, cross nothing there, and neither do routes that run
// along each other: those are squeezes, which `squeeze` prices. Two routes
// are partners where ends of theirs that may merge, at one rect with one
// key, come out of the side of it their ports sit nearest. Every decision
// about which side of a line a point is on, whether a segment runs along
// an axis, and whether two runs overlap goes through the tolerant
// predicates (see PRECISION.md).
//
// The score does not depend on the order of the edges: each term sums its
// parts from the least, whatever order they came in, and so does each
// edge's share.

/**
 * How many bends the `need` of a `shared` or `overflow` note costs per gap
 * and stroke of it: the room one more route takes. A side or run short of
 * that much puts a route or an adornment onto its neighbor, which costs a
 * bend, about what a route pays to go round instead.
 */
export const CROWDING_SHARE = 1

/**
 * How many bends two routes drawn on one line cost for each gap and stroke
 * of length they share, the room one more route takes, in proportion to
 * the share of their room they lack: routes on one line read as one for
 * that long, which costs the eye about a corner, so a long overlap costs
 * far more than a crossing, and a short graze, or a squeeze a little
 * short, costs little.
 */
export const SQUEEZE_SHARE = 1

/**
 * How many times an edge without a route goes round the rects' bounding
 * box, at its perimeter, in its cost: more than any route between them
 * runs.
 */
export const UNROUTED_LAPS = 2

/**
 * How many bends an edge without a route costs on top of its laps: more
 * than any route between the rects turns and crosses.
 */
export const UNROUTED_BENDS = 10

/** The terms of a score. */
export type Term =
  | 'length'
  | 'turning'
  | 'tight'
  | 'crossings'
  | 'squeeze'
  | 'crowding'
  | 'unrouted'

const TERMS: ReadonlyArray<Term> = [
  'length',
  'turning',
  'tight',
  'crossings',
  'squeeze',
  'crowding',
  'unrouted',
]

/** The score of a layout. Lower is better. */
export interface Score {
  /** The sum of the terms. */
  readonly total: number
  /** Each term, in the units of `total`, so they show what drove it. */
  readonly terms: Readonly<Record<Term, number>>
  /**
   * Each edge's share of the total: what its route costs, half of each of
   * its crossings and squeezes, and its share of each note that names it.
   */
  readonly byEdge: Float64Array
}

const RIGHT_ANGLE = Math.PI / 2

// A sum that does not depend on the order of its parts: from the least.
const sumOf = (parts: ReadonlyArray<number>): number => {
  let sum = 0
  for (const part of Float64Array.from(parts).toSorted()) {
    sum += part
  }
  return sum
}

// The axis a segment runs along most, which reads it best.
const mainAxis = (a: XY, b: XY): Axis => (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1)

// Which side of the line through `a` and `b` the point `p` is on: `1` or
// `-1`, the same for points on one side, and `0` on the line. The line's
// coordinate across its main axis at `p` compares with `p`'s.
function sideOf(a: XY, b: XY, p: XY): number {
  const along = mainAxis(a, b)
  const across = along === 0 ? 1 : 0
  const line = a[across] + ((p[along] - a[along]) * (b[across] - a[across])) / (b[along] - a[along])
  return before(line, p[across]) ? 1 : before(p[across], line) ? -1 : 0
}

// Whether a point on the line through `a` and `b` lies strictly between
// them.
function between(a: XY, b: XY, p: XY): boolean {
  const along = mainAxis(a, b)
  return inside(p[along], Math.min(a[along], b[along]), Math.max(a[along], b[along]))
}

// The crossings of `p` through the corners of `q`.
function throughCorners(p: ReadonlyArray<XY>, q: ReadonlyArray<XY>): number {
  let count = 0
  for (let k = 1; k + 1 < q.length; k++) {
    const corner = q[k] as XY
    for (let i = 1; i < p.length; i++) {
      const [a, b] = [p[i - 1] as XY, p[i] as XY]
      if (
        sideOf(a, b, corner) === 0 &&
        between(a, b, corner) &&
        sideOf(a, b, q[k - 1] as XY) * sideOf(a, b, q[k + 1] as XY) < 0
      ) {
        count++
      }
    }
  }
  return count
}

/**
 * Counts the crossings between two polylines: where each passes from one
 * side of the other to the other side, inside a segment of both or at a
 * corner of one inside a segment of the other. Touching and running along
 * each other cross nothing.
 *
 * @param p - One polyline's points.
 * @param q - The other's.
 * @returns How many times they cross.
 */
export function crossingsOf(p: ReadonlyArray<XY>, q: ReadonlyArray<XY>): number {
  let count = 0
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1] as XY, p[i] as XY]
    for (let j = 1; j < q.length; j++) {
      const [c, d] = [q[j - 1] as XY, q[j] as XY]
      if (sideOf(a, b, c) * sideOf(a, b, d) < 0 && sideOf(c, d, a) * sideOf(c, d, b) < 0) {
        count++
      }
    }
  }
  return count + throughCorners(p, q) + throughCorners(q, p)
}

/**
 * Scores a finished layout (see the module comment for the terms).
 *
 * @param problem - The problem the layout solves, with its edges in the
 *   order of the layout's.
 * @param layout - The layout: its routes as drawn, with their corner
 *   sizes, and its notes.
 * @returns The score.
 */
export function scoreLayout(problem: Problem, layout: ConnectorLayout): Score {
  const { edges, bendCost, crossingCost, tightCost } = problem
  const parts: Record<Term, Array<number>> = {
    length: [],
    turning: [],
    tight: [],
    crossings: [],
    squeeze: [],
    crowding: [],
    unrouted: [],
  }
  const shares: Array<Array<number>> = edges.map(() => [])
  // Charges a term, split evenly between the edges `among`.
  const charge = (term: Term, cost: number, among: ReadonlyArray<number>) => {
    parts[term].push(cost)
    for (const i of among) {
      shares[i]?.push(cost / among.length)
    }
  }

  const lines = layout.edges.map((route) => route?.points.map(({ x, y }): XY => [x, y]))
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const box of problem.boxes) {
    left = Math.min(left, box.left)
    top = Math.min(top, box.top)
    right = Math.max(right, box.right)
    bottom = Math.max(bottom, box.bottom)
  }
  const unrouted = UNROUTED_LAPS * 2 * (right - left + bottom - top) + UNROUTED_BENDS * bendCost

  for (const [i, edge] of edges.entries()) {
    const line = lines[i]
    const radii = layout.edges[i]?.radii ?? []
    if (line === undefined) {
      charge('unrouted', unrouted, [i])
      continue
    }
    let length = 0
    for (let k = 1; k < line.length; k++) {
      const [a, b] = [line[k - 1] as XY, line[k] as XY]
      length += Math.hypot(b[0] - a[0], b[1] - a[1])
    }
    charge('length', length, [i])
    for (let k = 1; k + 1 < line.length; k++) {
      const corner = cornerOf(edge, line, k, radii[k] ?? 0)
      if (corner !== undefined) {
        const { turn, short } = corner
        charge('turning', bendCost * turn, [i])
        if (short > 0) {
          charge('tight', tightCost * turn * short, [i])
        }
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [p, q] = [lines[i], lines[j]]
      const count = p === undefined || q === undefined ? 0 : crossingsOf(p, q)
      if (count > 0) {
        charge('crossings', count * crossingCost, [i, j])
      }
    }
  }

  const runs = lines.map((line) => (line === undefined ? [] : runsOf(line)))
  const { gap } = problem.settings
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const strokes = (stroke(edges[i] as ProblemEdge) + stroke(edges[j] as ProblemEdge)) / 2
      // The room one more route takes, the length a squeeze is priced by.
      const room = gap + strokes
      const need = (partners(problem, layout, i, j) ? problem.mergeGap : gap) + strokes
      if (!(room > 0 && need > 0)) {
        continue
      }
      for (const a of runs[i] as Array<Run>) {
        for (const b of runs[j] as Array<Run>) {
          const [low, high] = [Math.max(a.low, b.low), Math.min(a.high, b.high)]
          const apart = Math.abs(a.at - b.at)
          if (a.axis === b.axis && before(low, high) && before(apart, need)) {
            const short = (need - apart) / need
            charge('squeeze', (SQUEEZE_SHARE * bendCost * short * (high - low)) / room, [i, j])
          }
        }
      }
    }
  }

  for (const note of layout.notes) {
    if (note.kind !== 2 && note.kind !== 3) {
      continue
    }
    const among = note.kind === 3 ? [note.edge] : note.edges
    const room =
      problem.settings.gap + Math.max(0, ...among.map((i) => stroke(edges[i] as ProblemEdge)))
    if (room > 0) {
      charge('crowding', (CROWDING_SHARE * bendCost * note.need) / room, among)
    }
  }

  const terms = {} as Record<Term, number>
  for (const term of TERMS) {
    terms[term] = sumOf(parts[term])
  }
  return {
    total: sumOf(TERMS.map((term) => terms[term])),
    terms,
    byEdge: Float64Array.from(shares, sumOf),
  }
}

// The corner of a route at point `k`: how far it turns, in right angles,
// and the share of its edge's radius that the arc it draws lacks. A corner
// that reaches `reach` along its legs and turns `theta` draws an arc of
// radius `reach / tan(theta / 2)`. A point where the route runs straight
// on is no corner.
function cornerOf(
  edge: ProblemEdge,
  line: ReadonlyArray<XY>,
  k: number,
  reach: number,
): { readonly turn: number; readonly short: number } | undefined {
  const [a, p, b] = [line[k - 1] as XY, line[k] as XY, line[k + 1] as XY]
  const [ux, uy] = [p[0] - a[0], p[1] - a[1]]
  const [vx, vy] = [b[0] - p[0], b[1] - p[1]]
  const cross = Math.abs(ux * vy - uy * vx)
  const dot = ux * vx + uy * vy
  const turn = Math.atan2(cross, dot) / RIGHT_ANGLE
  if (!(turn > 0)) {
    return undefined
  }
  // tan(theta / 2), from the legs, which is exact for a right angle.
  const drawn = reach / (cross / (Math.hypot(ux, uy) * Math.hypot(vx, vy) + dot))
  return { turn, short: drawn < edge.radius ? 1 - drawn / edge.radius : 0 }
}

// A route's stroke, which a negative thickness leaves at none.
const stroke = (edge: ProblemEdge): number => Math.max(0, edge.thickness)

// A straight stretch of a route along an axis: the coordinate across it,
// and where it starts and ends along it. Slants are left out.
interface Run {
  readonly axis: Axis
  readonly at: number
  readonly low: number
  readonly high: number
}

// The runs of a route, each of its segments that lies along an axis.
function runsOf(line: ReadonlyArray<XY>): Array<Run> {
  const runs: Array<Run> = []
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1] as XY, line[k] as XY]
    for (const axis of [0, 1] as const) {
      const across = axis === 0 ? 1 : 0
      if (coincident(a[across], b[across]) && !coincident(a[axis], b[axis])) {
        const [low, high] = [Math.min(a[axis], b[axis]), Math.max(a[axis], b[axis])]
        runs.push({ axis, at: a[across], low, high })
      }
    }
  }
  return runs
}

// The side of a rect a port sits on, `0` to `3` from the top, clockwise:
// the side it is nearest.
function portSide(box: Rect.Rect, p: XY): number {
  const away = [
    Math.abs(p[1] - box.top),
    Math.abs(p[0] - box.right),
    Math.abs(p[1] - box.bottom),
    Math.abs(p[0] - box.left),
  ]
  return away.indexOf(Math.min(...away))
}

// The port at one end of a route.
const portOf = (points: ReadonlyArray<{ x: number; y: number }>, end: number): XY => {
  const { x, y } = points[end === 0 ? 0 : points.length - 1] as { x: number; y: number }
  return [x, y]
}

// Whether two routes are partners in a group: ends of theirs that may merge
// (at one rect, with one key) come out of one side of it.
function partners(problem: Problem, layout: ConnectorLayout, i: number, j: number): boolean {
  const [p, q] = [problem.edges[i] as ProblemEdge, problem.edges[j] as ProblemEdge]
  const [r, t] = [layout.edges[i]?.points, layout.edges[j]?.points]
  if (r === undefined || t === undefined) {
    return false
  }
  for (const [e, a] of p.ends.entries()) {
    for (const [f, b] of q.ends.entries()) {
      if (a.key !== undefined && a.key === b.key && a.rect === b.rect) {
        const box = problem.boxes[a.rect] as Rect.Rect
        const side = portSide(box, portOf(r, e))
        if (side === portSide(box, portOf(t, f))) {
          return true
        }
      }
    }
  }
  return false
}
