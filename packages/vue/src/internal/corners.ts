import { CubicCurve2d } from 'curvy/curve'
import { coincident } from 'curvy/number'
import { CubicPath2d } from 'curvy/path'
import { Vector2 } from 'curvy/vector'

// Smooth corners for polylines and rects.
//
// A plain rounded corner is a circular arc. It meets the straight legs with
// matching tangents, but its curvature jumps from 0 to 1/r there, and the eye
// reads that jump as a kink. A smoothed corner (Apple's continuous corners,
// Figma's corner smoothing, squircles) eases the curvature in. Here each
// corner is three pieces:
//
// 1. A transition cubic that leaves the incoming leg. Its first three
//    control points lie on the leg, so its curvature starts at 0. Its last
//    handle is sized so that its curvature ends at exactly 1/r.
// 2. The middle of the circular fillet of radius r, as cubic arcs of at most
//    90 degrees each. Their handles are sized for curvature exactly 1/r at
//    their ends rather than for the least radial error, which keeps every
//    join curvature-continuous for a radial error under 0.2% of r.
// 3. The mirror image of the first cubic, onto the outgoing leg.
//
// `smoothing` in [0, 1] sets how much of the turn the transition cubics take.
// At 0 the corner is the plain circular fillet. At 1 the arc vanishes and the
// two cubics meet on the corner's bisector, which is the squircle-like
// extreme. A smoothed corner reaches further along its legs: (1 + smoothing)
// times the fillet's tangent length.

type XY = readonly [number, number]
type Bezier = readonly [XY, XY, XY, XY]

const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]]
const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]]
const mul = (a: XY, k: number): XY => [a[0] * k, a[1] * k]
const dot = (a: XY, b: XY): number => a[0] * b[0] + a[1] * b[1]
const cross = (a: XY, b: XY): number => a[0] * b[1] - a[1] * b[0]

function unit(a: XY): XY {
  const length = Math.hypot(a[0], a[1])
  return [a[0] / length, a[1] / length]
}

function line(a: XY, b: XY): Bezier {
  const step = mul(sub(b, a), 1 / 3)
  return [a, add(a, step), add(a, mul(step, 2)), b]
}

// A cubic approximation of a circular arc of `angle` radians and radius `r`,
// from `start` (heading `startTangent`) to `end` (heading `endTangent`). The
// symmetric handle length k solves k^2 + (4/3) r sin(a) cos(a) k -
// (4/3) r^2 sin(a)^2 = 0 with a = angle / 2, which sets the curvature at both
// ends to exactly 1/r.
function arc(start: XY, startTangent: XY, end: XY, endTangent: XY, angle: number, r: number) {
  const sin = Math.sin(angle / 2)
  const linear = (4 / 3) * r * sin * Math.cos(angle / 2)
  const constant = (4 / 3) * r * r * sin * sin
  const handle = (Math.sqrt(linear * linear + 4 * constant) - linear) / 2
  return [
    start,
    add(start, mul(startTangent, handle)),
    sub(end, mul(endTangent, handle)),
    end,
  ] as const
}

/** The resolved geometry of one corner, before clamping decides its size. */
interface Turn {
  // The unit directions of the incoming and outgoing legs.
  readonly u: XY
  readonly v: XY
  // tan(theta / 2), where theta is the turning angle. 0 means no turn.
  readonly halfTan: number
  readonly theta: number
}

function turnOf(u: XY, v: XY): Turn | undefined {
  const cos = dot(u, v)
  const sin = Math.abs(cross(u, v))
  // A straight continuation needs no corner, and a full reversal has no
  // fillet that fits, so both stay sharp.
  if (coincident(sin, 0)) {
    return undefined
  }
  const theta = Math.atan2(sin, cos)
  return { u, v, halfTan: Math.tan(theta / 2), theta }
}

/**
 * The cubics of one smoothed corner at `vertex`. The result starts on the
 * incoming leg, `(1 + smoothing) * r * tan(theta / 2)` before the vertex, and
 * ends the same distance along the outgoing leg.
 */
function corner(vertex: XY, turn: Turn, r: number, smoothing: number): Array<Bezier> {
  const { u, v, theta, halfTan } = turn

  // The unit normals toward the fillet's center: n at the incoming tangent
  // point, n2 at the outgoing one.
  const perpU: XY = [-u[1], u[0]]
  const n = dot(perpU, v) > 0 ? perpU : mul(perpU, -1)
  const perpV: XY = [-v[1], v[0]]
  const n2 = dot(perpV, u) < 0 ? perpV : mul(perpV, -1)

  const tangentLength = r * halfTan
  const extent = (1 + smoothing) * tangentLength
  const phi = (smoothing * theta) / 2
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  // `reach` is how far the transition's last handle reaches back from the
  // arc. `handle` sizes the handle before it so the transition's curvature
  // meets the arc's 1/r: k(1) = (2/3) * handle * sin(phi) / reach^2.
  const reach = (r * sinPhi) / (1 + cosPhi)
  const handle = (3 * r * sinPhi) / (2 * (1 + cosPhi) ** 2)

  const tangentIn = sub(vertex, mul(u, tangentLength))
  const tangentOut = add(vertex, mul(v, tangentLength))
  const arcStart = add(add(tangentIn, mul(u, r * sinPhi)), mul(n, r * (1 - cosPhi)))
  // At smoothing 1, the two transitions meet at one point. Sharing it keeps
  // the corner closed exactly.
  const arcEnd =
    smoothing === 1 ? arcStart : add(sub(tangentOut, mul(v, r * sinPhi)), mul(n2, r * (1 - cosPhi)))

  const result: Array<Bezier> = []

  if (smoothing > 0) {
    const inner = sub(vertex, mul(u, tangentLength - reach))
    result.push([sub(vertex, mul(u, extent)), sub(inner, mul(u, handle)), inner, arcStart])
  }

  const sweep = theta * (1 - smoothing)
  if (smoothing < 1) {
    const startTangent = add(mul(u, cosPhi), mul(n, sinPhi))
    const endTangent = sub(mul(v, cosPhi), mul(n2, sinPhi))
    if (sweep > Math.PI / 2) {
      // Split at the fillet's midpoint, which lies on the bisector.
      const center = add(tangentIn, mul(n, r))
      const middle = add(center, mul(unit(sub(vertex, center)), r))
      const middleTangent = unit(add(u, v))
      result.push(arc(arcStart, startTangent, middle, middleTangent, sweep / 2, r))
      result.push(arc(middle, middleTangent, arcEnd, endTangent, sweep / 2, r))
    } else {
      result.push(arc(arcStart, startTangent, arcEnd, endTangent, sweep, r))
    }
  }

  if (smoothing > 0) {
    const inner = add(vertex, mul(v, tangentLength - reach))
    result.push([arcEnd, inner, add(inner, mul(v, handle)), add(vertex, mul(v, extent))])
  }

  return result
}

function toPath(beziers: ReadonlyArray<Bezier>): CubicPath2d.CubicPath2d {
  return CubicPath2d.fromArray(
    beziers.map(([p0, p1, p2, p3]) =>
      CubicCurve2d.fromBezierPoints(
        Vector2.make(p0[0], p0[1]),
        Vector2.make(p1[0], p1[1]),
        Vector2.make(p2[0], p2[1]),
        Vector2.make(p3[0], p3[1]),
      ),
    ),
  )
}

/**
 * The size one corner can actually take: the radius and smoothing after
 * clamping to the room on its legs. Smoothing gives way first, and the radius
 * shrinks only once smoothing is gone, as in CSS and Figma.
 */
function fit(turn: Turn, r: number, smoothing: number, room: number) {
  const tangentLength = r * turn.halfTan
  if ((1 + smoothing) * tangentLength <= room) {
    return { r, smoothing }
  }
  if (tangentLength <= room) {
    return { r, smoothing: room / tangentLength - 1 }
  }
  return { r: room / turn.halfTan, smoothing: 0 }
}

// The radius a corner of radius `r` takes to reach `reach` along its legs:
// `r`, or more where the reach is past what `r` reaches with its smoothing,
// as the gentle turns of a connector's slanted jog and the outer corners
// of its nests have.
function grownRadius(turn: Turn, r: number, smoothing: number, reach: number): number {
  const full = (1 + smoothing) * r * turn.halfTan
  return reach > full && !coincident(reach, full) ? reach / ((1 + smoothing) * turn.halfTan) : r
}

// A corner of a nest, `outset` larger than its innermost corner: that
// corner, fitted to the room less the outset, moved out by the outset. Its
// radius grows by the outset, so the nest keeps one center (or comes as
// near to it as a corner its leg holds short can), and its smoothing
// shrinks to keep its reach within the room.
function nested(turn: Turn, r: number, smoothing: number, room: number, outset: number) {
  const reach = Math.max(room - outset, 0)
  const inner = fit(turn, grownRadius(turn, r, smoothing, reach), smoothing, reach)
  const radius = inner.r + outset
  const filled = room / (radius * turn.halfTan) - 1
  return { r: radius, smoothing: coincident(filled, 0) ? 0 : Math.min(Math.max(filled, 0), 1) }
}

/**
 * Rounds the corners of a polyline with smoothed fillets of radius `r`.
 *
 * Each corner takes at most its share of each leg: all of an end leg, or a
 * share of an inner leg proportional to what the two corners on it want.
 * Corners that do not fit lose smoothing first, then radius. Repeated points
 * are dropped. Straight and reversing vertices, and every vertex when `r` is
 * `0`, stay sharp.
 *
 * A closed polyline rounds every vertex, the first one included. Its path
 * starts and ends at the middle of the first leg, which splits that leg
 * evenly between its two corners.
 *
 * `rooms`, one per point of an open polyline, sets how far each corner
 * reaches along its legs, as the corner sizes that `placement/hierarchy`
 * and `placement/connector` solve do. A corner with less room gives way as
 * a crowded one does. A corner with more room than `r` reaches, as the
 * gentle turns of a connector's slanted jog and the outer corners of its
 * nests have, grows to fill it.
 *
 * `nests`, one per point, sets how much larger than the innermost corner
 * of its nest each corner is, for the corners of routes that turn
 * together: how far outside it the corner sits, where the nest keeps one
 * center. Such a corner is drawn as that innermost corner, fitted to its
 * room less the outset, moved out by the outset: its radius grows by the
 * outset, so the nest keeps one center, and its smoothing shrinks to keep
 * its reach within its room.
 *
 * @param points - The polyline.
 * @param r - The corner radius. `0` keeps every corner sharp.
 * @param smoothing - From `0` (circular fillets) to `1` (fully smoothed).
 * @param closed - Whether the last point joins back to the first.
 * @param rooms - How far each corner reaches along its legs, per point.
 * @param nests - How much larger than the innermost corner of its nest
 * each corner is, per point.
 * @returns The rounded path, or `undefined` for fewer than two distinct points.
 */
export function roundPolyline(
  points: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  r: number,
  smoothing: number,
  closed = false,
  rooms?: ReadonlyArray<number>,
  nests?: ReadonlyArray<number>,
): CubicPath2d.CubicPath2d | undefined {
  const fitted = fitCorners(points, r, smoothing, closed, rooms, nests)
  if (fitted === undefined) {
    return undefined
  }
  const { distinct, sizes } = fitted

  const beziers: Array<Bezier> = []
  let cursor = distinct[0]!

  for (let i = 1; i < distinct.length - 1; i++) {
    const size = sizes[i]
    if (size === undefined) {
      beziers.push(line(cursor, distinct[i]!))
      cursor = distinct[i]!
      continue
    }
    const pieces = corner(distinct[i]!, size.turn, size.r, size.smoothing)
    const start = pieces[0]![0]
    if (!coincident(cursor[0], start[0]) || !coincident(cursor[1], start[1])) {
      beziers.push(line(cursor, start))
    }
    beziers.push(...pieces)
    cursor = pieces.at(-1)![3]
  }

  const end = distinct.at(-1)!
  if (beziers.length === 0 || !coincident(cursor[0], end[0]) || !coincident(cursor[1], end[1])) {
    beziers.push(line(cursor, end))
  }

  return toPath(beziers)
}

// The distinct points of a polyline, and the fitted size of the corner at
// each of them (`undefined` where the polyline does not turn or `r` is 0).
function fitCorners(
  points: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  r: number,
  smoothing: number,
  closed: boolean,
  rooms?: ReadonlyArray<number>,
  nests?: ReadonlyArray<number>,
):
  | {
      readonly distinct: ReadonlyArray<XY>
      readonly sizes: ReadonlyArray<
        { readonly turn: Turn; readonly r: number; readonly smoothing: number } | undefined
      >
    }
  | undefined {
  let distinct: Array<XY> = []
  // The cap on each distinct point's corner: the least of its repeats'. And
  // its outset in a nest: the most of theirs.
  const caps: Array<number> = []
  const outsets: Array<number> = []
  for (const [i, { x, y }] of points.entries()) {
    const cap = rooms?.[i] ?? Number.POSITIVE_INFINITY
    const outset = nests?.[i] ?? 0
    const last = distinct.at(-1)
    if (last === undefined || !coincident(last[0], x) || !coincident(last[1], y)) {
      distinct.push([x, y])
      caps.push(cap)
      outsets.push(outset)
    } else {
      caps[caps.length - 1] = Math.min(caps.at(-1)!, cap)
      outsets[outsets.length - 1] = Math.max(outsets.at(-1)!, outset)
    }
  }
  if (closed) {
    const first = distinct[0]
    const last = distinct.at(-1)
    if (
      distinct.length > 1 &&
      first !== undefined &&
      last !== undefined &&
      coincident(first[0], last[0]) &&
      coincident(first[1], last[1])
    ) {
      distinct.pop()
    }
    if (distinct.length > 2) {
      const middle = mul(add(distinct[0]!, distinct[1]!), 0.5)
      distinct = [middle, ...distinct.slice(1), distinct[0]!, middle]
    }
  }
  if (distinct.length < 2) {
    return undefined
  }

  const lengths: Array<number> = []
  for (let i = 1; i < distinct.length; i++) {
    const delta = sub(distinct[i]!, distinct[i - 1]!)
    lengths.push(Math.hypot(delta[0], delta[1]))
  }

  const turns: Array<Turn | undefined> = [undefined]
  for (let i = 1; i < distinct.length - 1; i++) {
    const u = unit(sub(distinct[i]!, distinct[i - 1]!))
    const v = unit(sub(distinct[i + 1]!, distinct[i]!))
    turns.push(r > 0 ? turnOf(u, v) : undefined)
  }
  turns.push(undefined)

  const s = Math.min(Math.max(smoothing, 0), 1)
  // Each corner's radius: `r`, or larger where its room asks for more.
  const radii = turns.map((turn, i) => {
    const cap = caps[i]!
    return closed || turn === undefined || !Number.isFinite(cap) ? r : grownRadius(turn, r, s, cap)
  })
  const wanted = turns.map((turn, i) =>
    turn === undefined ? 0 : (1 + s) * radii[i]! * turn.halfTan,
  )

  // The room of vertex i on the leg toward vertex j.
  const share = (i: number, j: number, length: number) => {
    const mine = wanted[i]!
    const total = mine + wanted[j]!
    return total <= length ? mine : (length * mine) / total
  }

  const sizes = turns.map((turn, i) => {
    if (turn === undefined) {
      return undefined
    }
    const room = Math.min(
      share(i, i - 1, lengths[i - 1]!),
      share(i, i + 1, lengths[i]!),
      closed ? Number.POSITIVE_INFINITY : Math.max(caps[i]!, 0),
    )
    const outset = closed ? 0 : outsets[i]!
    const size =
      outset > 0 && Number.isFinite(outset)
        ? nested(turn, r, s, room, outset)
        : fit(turn, radii[i]!, s, room)
    return { turn, r: size.r, smoothing: size.smoothing }
  })

  return { distinct, sizes }
}

/**
 * A rect with smoothed corners of radii `rx` by `ry`, as a closed path that
 * runs clockwise from the top edge.
 *
 * The corners are the unit corner of `roundPolyline` scaled to `rx` by `ry`.
 * Like SVG's `rx`/`ry`, a corner never reaches past the middle of a side:
 * smoothing gives way first, then the radius.
 *
 * @param x - The rect's left.
 * @param y - The rect's top.
 * @param width - The rect's width.
 * @param height - The rect's height.
 * @param rx - The horizontal corner radius.
 * @param ry - The vertical corner radius.
 * @param smoothing - From `0` (elliptical corners) to `1` (fully smoothed).
 * @returns The closed path.
 */
export function roundRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
  smoothing: number,
): CubicPath2d.CubicPath2d {
  const s = Math.min(Math.max(smoothing, 0), 1)
  // Per axis, the corner reaches (1 + s) times its radius along the side.
  const roomX = width / 2
  const roomY = height / 2
  const fitted = Math.max(0, Math.min(s, roomX / rx - 1, roomY / ry - 1))
  const cx = Math.min(rx, roomX)
  const cy = Math.min(ry, roomY)

  const right: XY = [1, 0]
  const down: XY = [0, 1]
  const left: XY = [-1, 0]
  const up: XY = [0, -1]
  const corners: ReadonlyArray<readonly [XY, XY, XY]> = [
    [[x + width, y], right, down],
    [[x + width, y + height], down, left],
    [[x, y + height], left, up],
    [[x, y], up, right],
  ]

  const beziers: Array<Bezier> = []
  let cursor: XY | undefined
  for (const [vertex, u, v] of corners) {
    const turn: Turn = { u, v, halfTan: 1, theta: Math.PI / 2 }
    const place = ([px, py]: XY): XY => [vertex[0] + px * cx, vertex[1] + py * cy]
    const pieces = corner([0, 0], turn, 1, fitted).map(
      ([p0, p1, p2, p3]): Bezier => [place(p0), place(p1), place(p2), place(p3)],
    )
    const start = pieces[0]![0]
    if (
      cursor !== undefined &&
      (!coincident(cursor[0], start[0]) || !coincident(cursor[1], start[1]))
    ) {
      beziers.push(line(cursor, start))
    }
    beziers.push(...pieces)
    cursor = pieces.at(-1)![3]
  }
  const first = beziers[0]![0]
  if (!coincident(cursor![0], first[0]) || !coincident(cursor![1], first[1])) {
    beziers.push(line(cursor!, first))
  }

  return toPath(beziers)
}
