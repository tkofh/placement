import { coincident } from 'curvy/number'
import type { ConnectorLayout } from '../../connector.ts'
import type * as Rect from '../../rect.ts'
import { atMost, before, inside } from '../../utils/tolerance.ts'
import type { Axis, XY } from '../orient.ts'
import { type EdgeEnd, type Problem, type ProblemEdge, partnersAt, shareBudget } from './problem.ts'

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
// - `fan`: each crossing near a route's port, out of or into it, up to
//   `FAN_SHARE - 1` crossings more: all of that at the port, falling in
//   proportion to none at `FAN_FADE` of the route's length from it, and
//   paid for each of the two routes whose port it is near. A route that
//   cuts into the fan of a node's ports tangles that node's network with
//   its own. Partners crossing in their own group out of a port cross no
//   fan.
// - `squeeze`: each stretch where two routes run alongside each other
//   closer than the gap and their strokes allow (the merge gap, for
//   partners of a group), by how much of that room they lack and how long
//   they run so, read from the routes as drawn rather than from the notes,
//   so a squeeze nudging could not undo, and did not report, costs too.
//   Slanted segments are left out.
// - `unshared`: each end of a route with merge partners there, by the
//   length it could share with one, as their far ends lie (see
//   `shareBudget`), that it does not run in one bundle with any, at
//   `UNSHARED_SHARE` per pixel: routes that travel apart where their
//   directions agree draw two lines where one bundle would do. Sharing
//   more than that earns nothing, so no layout gains by a detour to ride
//   a partner, and a network that bundles as far as its geometry calls
//   for pays nothing.
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

/**
 * How many crossings a crossing at a route's port, out of or into it,
 * costs in all: a route that cuts through the fan of a node's ports
 * tangles that node's network with its own, and the eye, which reads a
 * node by the routes into it, has to stop and untangle them there, where
 * a crossing out between the nodes reads at a glance. The price past one
 * crossing fades along the route (see `FAN_FADE`), and a crossing near
 * the ports of both its routes pays it for each. At three, a crossing at
 * a fan costs a corner and a fifth, so a layout whose route goes round a
 * node's fan for a corner or so more scores better.
 */
export const FAN_SHARE = 3

/**
 * How far from a route's port, as a share of the route's length, a
 * crossing on the route pays any of the fan price (see `FAN_SHARE`): all
 * of it at the port, falling in proportion to none this far out. A run out
 * of a port is often most of its route, so it does not mark where the fan
 * ends, and a share of the length holds at any scale, as a distance does
 * not. A fifth keeps the price near the node. A third gives the judged
 * pairs a wider worst margin, by less than a third of a crossing, but
 * charges most crossings again, and a tenth lets a route cut through the
 * routes that converge on a node almost for free.
 */
export const FAN_FADE = 0.2

/**
 * What each pixel costs, of the length a route could share with a merge
 * partner and runs apart from it instead, as a share of a pixel of
 * length: routes that travel apart where their directions agree draw two
 * lines where one bundle would do. It matches the pull of the side search
 * (`MERGE_PULL`), so that a pixel ridden saves the search what a pixel
 * missed costs the score.
 */
export const UNSHARED_SHARE = 0.75

/** The terms of a score. */
export type Term =
  | 'length'
  | 'turning'
  | 'tight'
  | 'crossings'
  | 'fan'
  | 'squeeze'
  | 'unshared'
  | 'crowding'
  | 'unrouted'

const TERMS: ReadonlyArray<Term> = [
  'length',
  'turning',
  'tight',
  'crossings',
  'fan',
  'squeeze',
  'unshared',
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

// How far along a line each of its points lies from its first, the last
// being its length.
function distancesOf(line: ReadonlyArray<XY>): Array<number> {
  const distances = [0]
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1] as XY, line[k] as XY]
    distances.push((distances[k - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  return distances
}

// How far from `a`, along the segment from `a` to `b`, the segment meets
// the line through `c` and `d`: its length times the share of it before
// the meeting point, which the cross products of the legs give, multiplied
// before dividing so that a dyadic meeting point comes out exact.
function meeting(a: XY, b: XY, c: XY, d: XY): number {
  const [ux, uy] = [b[0] - a[0], b[1] - a[1]]
  const [wx, wy] = [d[0] - c[0], d[1] - c[1]]
  const cross = (c[0] - a[0]) * wy - (c[1] - a[1]) * wx
  return (cross * Math.hypot(ux, uy)) / (ux * wy - uy * wx)
}

/**
 * How much of the fan price a crossing on a route pays for being near its
 * port, as a share of `FAN_SHARE - 1` crossings: all of it at the port,
 * falling in proportion to none at `FAN_FADE` of the route's length from
 * it, by the port it is nearer.
 *
 * @param along - How far along the route from its source the crossing lies.
 * @param length - The route's length.
 * @returns The share, from `0` to `1`.
 */
export function fanFade(along: number, length: number): number {
  return Math.max(0, 1 - Math.min(along, length - along) / (FAN_FADE * length))
}

// The crossings of two polylines (see `crossingsOf`), each as what it pays
// of the fan price: the sum of its `fanFade` on both, by where it lies
// along each, at the meeting of segments of both or at a corner of one
// inside a segment of the other. `pd` and `qd` are the lines'
// `distancesOf`.
function crossingsAt(
  p: ReadonlyArray<XY>,
  q: ReadonlyArray<XY>,
  pd: ReadonlyArray<number>,
  qd: ReadonlyArray<number>,
): Array<number> {
  const fans: Array<number> = []
  const [pLength, qLength] = [pd[pd.length - 1] as number, qd[qd.length - 1] as number]
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1] as XY, p[i] as XY]
    for (let j = 1; j < q.length; j++) {
      const [c, d] = [q[j - 1] as XY, q[j] as XY]
      if (sideOf(a, b, c) * sideOf(a, b, d) < 0 && sideOf(c, d, a) * sideOf(c, d, b) < 0) {
        const onP = (pd[i - 1] as number) + meeting(a, b, c, d)
        const onQ = (qd[j - 1] as number) + meeting(c, d, a, b)
        fans.push(fanFade(onP, pLength) + fanFade(onQ, qLength))
      }
    }
  }
  const corners = (
    p: ReadonlyArray<XY>,
    q: ReadonlyArray<XY>,
    pd: ReadonlyArray<number>,
    qd: ReadonlyArray<number>,
  ) => {
    const [pLength, qLength] = [pd[pd.length - 1] as number, qd[qd.length - 1] as number]
    for (let k = 1; k + 1 < q.length; k++) {
      const corner = q[k] as XY
      for (let i = 1; i < p.length; i++) {
        const [a, b] = [p[i - 1] as XY, p[i] as XY]
        if (
          sideOf(a, b, corner) === 0 &&
          between(a, b, corner) &&
          sideOf(a, b, q[k - 1] as XY) * sideOf(a, b, q[k + 1] as XY) < 0
        ) {
          const onP = (pd[i - 1] as number) + Math.hypot(corner[0] - a[0], corner[1] - a[1])
          fans.push(fanFade(onP, pLength) + fanFade(qd[k] as number, qLength))
        }
      }
    }
  }
  corners(p, q, pd, qd)
  corners(q, p, qd, pd)
  return fans
}

// How far a route runs in one bundle with its partners: the length of its
// segments that runs of the partners lie beside, on its axis and no
// further from its line than their `need` apart, each reaching that far
// again past its ends, where a partner nested inside or outside a corner
// turns, or parts. Slants run beside nothing.
function sharedAlong(
  line: ReadonlyArray<XY>,
  partners: ReadonlyArray<{ readonly runs: ReadonlyArray<Run>; readonly need: number }>,
): number {
  let shared = 0
  for (const own of runsOf(line)) {
    // The stretches of the run that partners lie beside.
    const stretches: Array<readonly [number, number]> = []
    for (const { runs, need } of partners) {
      for (const run of runs) {
        if (run.axis === own.axis && atMost(Math.abs(run.at - own.at), need)) {
          const [low, high] = [
            Math.max(own.low, run.low - need),
            Math.min(own.high, run.high + need),
          ]
          if (before(low, high)) {
            stretches.push([low, high])
          }
        }
      }
    }
    stretches.sort(([s], [t]) => s - t)
    const [first] = stretches
    if (first === undefined) {
      continue
    }
    let [from, to] = first
    for (const [low, high] of stretches) {
      if (before(to, low)) {
        shared += to - from
        ;[from, to] = [low, high]
      } else {
        to = Math.max(to, high)
      }
    }
    shared += to - from
  }
  return shared
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
    fan: [],
    squeeze: [],
    unshared: [],
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

  const distances = lines.map((line) => (line === undefined ? [] : distancesOf(line)))
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [p, q] = [lines[i], lines[j]]
      if (p === undefined || q === undefined) {
        continue
      }
      const fans = crossingsAt(p, q, distances[i] as Array<number>, distances[j] as Array<number>)
      if (fans.length > 0) {
        charge('crossings', fans.length * crossingCost, [i, j])
      }
      // Partners crossing in their own bundle out of a port cross no
      // other network's fan.
      if (fans.length > 0 && !partners(problem, layout, i, j)) {
        for (const fan of fans) {
          if (fan > 0) {
            charge('fan', fan * (FAN_SHARE - 1) * crossingCost, [i, j])
          }
        }
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

  for (const [i, ends] of sharingOf(problem, layout).entries()) {
    for (const sharing of ends) {
      if (sharing !== undefined && before(sharing.shared, sharing.budget)) {
        charge('unshared', UNSHARED_SHARE * (sharing.budget - sharing.shared), [i])
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

/** What a route could share with its partners out of one end, and what it does. */
export interface Sharing {
  /**
   * The most it could share with any partner there, by the way their far
   * ends lie (see `shareBudget`).
   */
  readonly budget: number
  /** How far it runs in one bundle with its partners, as drawn. */
  readonly shared: number
}

/**
 * What each route of a layout could share with its merge partners out of
 * each end, and how far it runs with them as drawn: in one bundle with a
 * partner, its line no further from theirs than the merge gap and their
 * strokes. The length counts wherever it lies along the route, not only
 * out from the port: a given position can hold two partners' ports apart
 * by more than that, and the routes then bundle from just past them.
 *
 * @param problem - The problem the layout solves.
 * @param layout - The layout.
 * @returns The sharing at the source and target of each edge, or
 * `undefined` for an end with no partner with a route, or with nothing to
 * share with one.
 */
export function sharingOf(
  problem: Problem,
  layout: ConnectorLayout,
): Array<[Sharing | undefined, Sharing | undefined]> {
  const { edges } = problem
  const lines = layout.edges.map((route) => route?.points.map(({ x, y }): XY => [x, y]))
  const runs = lines.map((line) => (line === undefined ? [] : runsOf(line)))
  return edges.map((edge, i) => {
    const line = lines[i]
    return [0, 1].map((end) => {
      if (line === undefined) {
        return undefined
      }
      const mates = partnersAt(problem, i, end).filter(({ edge: j }) => lines[j] !== undefined)
      const own: EdgeEnd = { edge: i, end }
      let budget = 0
      for (const mate of mates) {
        budget = Math.max(budget, shareBudget(problem, own, mate))
      }
      if (!(budget > 0)) {
        return undefined
      }
      const beside = mates.map(({ edge: j }) => ({
        runs: runs[j] as Array<Run>,
        need: problem.mergeGap + (stroke(edge) + stroke(edges[j] as ProblemEdge)) / 2,
      }))
      return { budget, shared: sharedAlong(line, beside) }
    }) as [Sharing | undefined, Sharing | undefined]
  })
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
