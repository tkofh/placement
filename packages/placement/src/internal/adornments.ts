import { coincident } from 'curvy/number'
import type { Adornment } from '../adornment.ts'
import { auto } from '../utils/arguments.ts'
import { atMost, before, overlaps } from '../utils/tolerance.ts'

// The geometry of edge adornments in logical space: how much of a straight
// run each one takes, how flow adornments line up on a run, how big each
// corner of a route can be, and where a point at some length along the
// drawn route lands. Both routers use it: the hierarchy in its logical
// space, and the connector in physical space, which is the hierarchy's
// logical space when edges flow down.
//
// Axis 0 is the order axis and axis 1 the rank axis, the indices of a
// `LogicalPoint`. A run's `sign` is 1 when the route, from source to target,
// heads toward increasing coordinates along it.

export type LogicalPoint = readonly [o: number, r: number]

// Where an adornment landed: its center, the logical direction of its local
// x axis when it turns, and the stretch of the route it covers, as lengths
// along the route's polyline.
export interface PlacedAdornment {
  readonly center: LogicalPoint
  readonly direction: LogicalPoint | undefined
  readonly along: readonly [start: number, end: number]
}

export const UPRIGHT = 0
export const FORWARD = 1
export const BACKWARD = 2

export type Axis = 0 | 1
export type Sign = 1 | -1

// One axis of an adornment's frame: its size, its margins before and after
// it in increasing coordinates, and its alignment across a line that runs
// along the other axis.
export interface AxisFrame {
  readonly size: number
  readonly start: number
  readonly end: number
  readonly align: number
}

export interface SolveAdornment {
  // The position along the edge from source (0) to target (1), in [0, 1].
  readonly at: number
  readonly flow: boolean
  readonly layer: number
  readonly orient: number
  // The frame on the logical axes, for an upright adornment.
  readonly o: AxisFrame
  readonly r: AxisFrame
  // The frame in its own axes, for a turned one: x along the line (start
  // trails, end leads) and y across it (start above its x axis).
  readonly x: AxisFrame
  readonly y: AxisFrame
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

// A frame's size along one axis, clamped to its finite limits. Unset sizes
// are `0`.
export function frameSize(size: number, min: number, max: number): number {
  let result = finite(Math.max(size, 0))
  if (Number.isFinite(max)) {
    result = Math.min(result, max)
  }
  if (Number.isFinite(min)) {
    result = Math.max(result, min)
  }
  return result
}

// Resolves an adornment into logical terms. Upright frames map their
// physical axes to the logical ones: x to the order axis when `vertical`,
// and the rank axis mirrored when `reverse`. Turned frames keep their own
// axes. A non-finite `align` on the frame takes `align`.
export function resolveAdornment(
  adornment: Adornment,
  vertical: boolean,
  reverse: boolean,
  align: number,
): SolveAdornment {
  const { frame } = adornment
  const width = frameSize(frame.width, frame.minWidth, frame.maxWidth)
  const height = frameSize(frame.height, frame.minHeight, frame.maxHeight)
  const top = finite(frame.offsetTop)
  const right = finite(frame.offsetRight)
  const bottom = finite(frame.offsetBottom)
  const left = finite(frame.offsetLeft)
  const side = auto(frame.align, align)
  const [leading, trailing] = vertical ? [top, bottom] : [left, right]
  const o: AxisFrame = vertical
    ? { size: width, start: left, end: right, align: side }
    : { size: height, start: top, end: bottom, align: side }
  const r: AxisFrame = {
    size: vertical ? height : width,
    start: reverse ? trailing : leading,
    end: reverse ? leading : trailing,
    align: reverse ? 1 - side : side,
  }
  const at = Number.isFinite(adornment.at) ? Math.min(Math.max(adornment.at, 0), 1) : 0.5
  return {
    at,
    flow: adornment.position !== 1,
    layer: Number.isFinite(adornment.layer) ? Math.trunc(adornment.layer) : 0,
    orient: adornment.orient === 1 || adornment.orient === 2 ? adornment.orient : 0,
    o,
    r,
    x: { size: width, start: left, end: right, align: 0.5 },
    y: { size: height, start: top, end: bottom, align: side },
  }
}

// An adornment measured on a line along some axis: its size along the line,
// its margins in increasing coordinates, its box and its outer box (margins
// included) across the line relative to it, and the logical direction of its
// local x axis when it turns.
export interface Measured {
  readonly size: number
  readonly start: number
  readonly end: number
  readonly lo: number
  readonly hi: number
  readonly outerLo: number
  readonly outerHi: number
  readonly direction: LogicalPoint | undefined
}

// `mirror` is whether logical space maps to physical space by a reflection,
// which flips which side of the line a turned frame's y axis points to.
export function measure(
  adornment: SolveAdornment,
  axis: Axis,
  sign: Sign,
  mirror: boolean,
): Measured {
  const { orient } = adornment
  if (orient !== FORWARD && orient !== BACKWARD) {
    const along = axis === 0 ? adornment.o : adornment.r
    const across = axis === 0 ? adornment.r : adornment.o
    return {
      size: along.size,
      start: along.start,
      end: along.end,
      ...acrossLine(across, 1),
      direction: undefined,
    }
  }
  const facing: Sign = orient === FORWARD ? sign : (-sign as Sign)
  const { x, y } = adornment
  // A frame turned to `(do, dr)` has its y axis along `(-dr, do)`, or
  // `(dr, -do)` under a reflection.
  const across: Sign =
    axis === 1 ? (mirror ? facing : (-facing as Sign)) : mirror ? (-facing as Sign) : facing
  return {
    size: x.size,
    start: facing > 0 ? x.start : x.end,
    end: facing > 0 ? x.end : x.start,
    ...acrossLine(y, across),
    direction: axis === 0 ? [facing, 0] : [0, facing],
  }
}

function acrossLine(frame: AxisFrame, sign: Sign) {
  const outer = frame.start + frame.size + frame.end
  const outerLo = -(1 - frame.align) * outer
  const outerHi = outerLo + outer
  const lo = outerLo + frame.start
  const hi = lo + frame.size
  return sign > 0
    ? { lo, hi, outerLo, outerHi }
    : { lo: -hi, hi: -lo, outerLo: -outerHi, outerHi: -outerLo }
}

export function outerLength(measured: Measured): number {
  return measured.start + measured.size + measured.end
}

export interface RunItem {
  // The adornment's index on its edge, which breaks ties in `at`.
  readonly index: number
  readonly at: number
  readonly layer: number
  readonly measured: Measured
}

// The length a run needs: the longest of its layers, each the sum of its
// adornments' outer lengths.
export function runLength(items: ReadonlyArray<RunItem>): number {
  let longest = 0
  for (const layer of byLayer(items).values()) {
    let total = 0
    for (const item of layer) {
      total += outerLength(item.measured)
    }
    longest = Math.max(longest, total)
  }
  return longest
}

// The adornments of a run by layer, each layer in the order given.
export function byLayer(items: ReadonlyArray<RunItem>): Map<number, Array<RunItem>> {
  const layers = new Map<number, Array<RunItem>>()
  for (const item of items) {
    let layer = layers.get(item.layer)
    if (layer === undefined) {
      layer = []
      layers.set(item.layer, layer)
    }
    layer.push(item)
  }
  return layers
}

// Orders the adornments of a run by `at`, and those at one position, within
// tolerance, by index.
export const byAt = (a: RunItem, b: RunItem): number =>
  coincident(a.at, b.at) ? a.index - b.index : a.at - b.at

// Lines up the adornments of a run, layer by layer: each layer's adornments
// follow one another in route order (`sign` turns that into increasing
// coordinates), starting at the coordinate `place` returns for the layer's
// total length. Returns the center coordinate of each adornment.
export function packRun(
  items: ReadonlyArray<RunItem>,
  sign: Sign,
  place: (total: number) => number,
): Map<RunItem, number> {
  const centers = new Map<RunItem, number>()
  for (const layer of byLayer(items).values()) {
    const ordered = layer.toSorted(byAt)
    if (sign < 0) {
      ordered.reverse()
    }
    let total = 0
    for (const item of ordered) {
      total += outerLength(item.measured)
    }
    let cursor = place(total)
    for (const item of ordered) {
      const { start, size } = item.measured
      centers.set(item, cursor + start + size / 2)
      cursor += outerLength(item.measured)
    }
  }
  return centers
}

// The cumulative length of a polyline at each of its points.
export function lengths(points: ReadonlyArray<LogicalPoint>): Array<number> {
  const result = [0]
  for (let i = 1; i < points.length; i++) {
    const [ao, ar] = points[i - 1] as LogicalPoint
    const [bo, br] = points[i] as LogicalPoint
    result.push((result[i - 1] as number) + Math.hypot(bo - ao, br - ar))
  }
  return result
}

// The length along a polyline of the point on it nearest `point`. Ties go to
// the earlier segment.
export function distanceAlong(
  points: ReadonlyArray<LogicalPoint>,
  cumulative: ReadonlyArray<number>,
  point: LogicalPoint,
): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i + 1 < points.length; i++) {
    const [ao, ar] = points[i] as LogicalPoint
    const [bo, br] = points[i + 1] as LogicalPoint
    const length = (cumulative[i + 1] as number) - (cumulative[i] as number)
    const t =
      length > 0
        ? Math.min(
            Math.max(((point[0] - ao) * (bo - ao) + (point[1] - ar) * (br - ar)) / length, 0),
            length,
          )
        : 0
    const fraction = length > 0 ? t / length : 0
    const distance = Math.hypot(
      ao + (bo - ao) * fraction - point[0],
      ar + (br - ar) * fraction - point[1],
    )
    if (i === 0 || before(distance, bestDistance)) {
      bestDistance = distance
      best = (cumulative[i] as number) + t
    }
  }
  return best
}

/** What settles first where a leg is too short for both its corners. */
export interface RadiiPriority {
  /**
   * The size each corner turns at the least, one per point. A corner
   * wanted further past its floor than the one at the other end of a leg
   * too short for both, as a corner grown for a nest is, takes from it.
   */
  readonly floors: ReadonlyArray<number>
  /** The corners, by point index, that give way to no other. */
  readonly held?: ((index: number) => boolean) | undefined
}

// The size of each corner of an orthogonal route: how far it reaches along
// each of its legs, `0` at the two ends. Each corner takes up to `radius`
// (one for every corner, or one per point), but never past a wall (a
// stretch of the route that flow adornments occupy, as lengths along it)
// or the route's ends, and two corners on one leg share its length. Shared
// legs settle shortest first: a corner limited elsewhere keeps its size and
// the other takes the rest, otherwise both take half, unless one of the
// two is wanted further past its floor than the other, as a corner grown
// for a nest is (`priority`): then it takes from the other, by no more than
// the leg has spare past its floor and the other's want, so that a nest
// holds together where its leg falls a little short and lets go slowly
// where it falls far short, down to the two at their floors on a leg that
// holds no more than those. A held corner gives way to no other. A last
// pass gives each corner whatever its legs still have room for.
export function resolveRadii(
  points: ReadonlyArray<LogicalPoint>,
  cumulative: ReadonlyArray<number>,
  radius: number | ReadonlyArray<number>,
  walls: ReadonlyArray<readonly [number, number]>,
  priority?: RadiiPriority,
): Array<number> {
  const count = points.length
  const radii: Array<number> = points.map(() => 0)
  const wanted = (i: number): number => {
    const value = typeof radius === 'number' ? radius : radius[i]
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0
  }
  if (count < 3 || !points.some((_, i) => wanted(i) > 0)) {
    return radii
  }
  const at = (i: number) => cumulative[i] as number
  const floor = (i: number) => priority?.floors[i] ?? wanted(i)
  const held = (i: number) => priority?.held?.(i) ?? false

  // For each leg between points i and i + 1: the room its first and last
  // point may take from it, and whether its two corners share it.
  interface Leg {
    readonly length: number
    readonly shared: boolean
    readonly fromStart: number
    readonly fromEnd: number
  }
  const legs: Array<Leg> = []
  for (let i = 0; i + 1 < count; i++) {
    const start = at(i)
    const end = at(i + 1)
    let first = end
    let last = start
    for (const [a, b] of walls) {
      if (overlaps(a, b, start, end)) {
        first = Math.min(first, a)
        last = Math.max(last, b)
      }
    }
    const walled = last > start
    legs.push({
      length: end - start,
      shared: !walled && i > 0 && i + 2 < count,
      fromStart: walled ? Math.max(first - start, 0) : end - start,
      fromEnd: walled ? Math.max(end - last, 0) : end - start,
    })
  }

  for (let i = 1; i + 1 < count; i++) {
    const before = legs[i - 1] as Leg
    const after = legs[i] as Leg
    radii[i] = Math.min(wanted(i), before.fromEnd, after.fromStart)
  }

  const shared = legs
    .flatMap((leg, i) => (leg.shared ? [i] : []))
    .toSorted((a, b) => (legs[a] as Leg).length - (legs[b] as Leg).length || a - b)
  for (const i of shared) {
    const { length } = legs[i] as Leg
    if (atMost((radii[i] as number) + (radii[i + 1] as number), length)) {
      continue
    }
    // The corner wanted further past its floor takes from the other, by
    // no more than the leg has spare past its floor and the other's want.
    const growth = (k: number) => (radii[k] as number) - floor(k)
    const [grown, other] = before(growth(i), growth(i + 1)) ? [i + 1, i] : [i, i + 1]
    if (!held(other) && before(growth(other), growth(grown))) {
      const spare = length - floor(grown) - (radii[other] as number)
      const shortfall = (radii[grown] as number) + (radii[other] as number) - length
      if (spare > 0) {
        radii[other] = Math.max((radii[other] as number) - Math.min(shortfall, spare), 0)
      }
    }
    const a = radii[i] as number
    const b = radii[i + 1] as number
    if (atMost(a + b, length)) {
      continue
    }
    if (Math.min(a, b) <= length / 2) {
      if (a < b) {
        radii[i + 1] = length - a
      } else {
        radii[i] = length - b
      }
    } else {
      radii[i] = length / 2
      radii[i + 1] = length / 2
    }
  }

  for (let i = 1; i + 1 < count; i++) {
    const before = legs[i - 1] as Leg
    const after = legs[i] as Leg
    const roomBefore = before.shared ? before.length - (radii[i - 1] as number) : before.fromEnd
    const roomAfter = after.shared ? after.length - (radii[i + 1] as number) : after.fromStart
    radii[i] = Math.max(Math.min(wanted(i), roomBefore, roomAfter), 0)
  }
  return radii
}

// A point on the drawn route: where it is, the unit tangent there, and its
// length along the polyline (a rounded corner maps its arc evenly onto the
// two stretches of polyline it replaces).
export interface DrawnPoint {
  readonly point: LogicalPoint
  readonly tangent: LogicalPoint
  readonly distance: number
}

// The circle of the corner at point `i`, which reaches `reach` along its
// legs: the turning angle, the radius, and the unit normal from the
// incoming leg toward the circle's center. A right-angled corner is a
// quarter circle of radius `reach`, exactly.
function cornerCircle(
  u: LogicalPoint,
  v: LogicalPoint,
  reach: number,
): { readonly theta: number; readonly radius: number; readonly normal: LogicalPoint } {
  const cos = u[0] * v[0] + u[1] * v[1]
  if (coincident(cos, 0)) {
    return { theta: Math.PI / 2, radius: reach, normal: v }
  }
  const theta = Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), cos)
  const n: LogicalPoint = [v[0] - cos * u[0], v[1] - cos * u[1]]
  const size = Math.hypot(n[0], n[1])
  return {
    theta,
    radius: reach / Math.tan(theta / 2),
    normal: size > 0 ? [n[0] / size, n[1] / size] : [0, 0],
  }
}

// The point at `fraction` of the length of the route drawn with circular
// corners that reach `radii` along their legs: quarter circles where the
// route turns a right angle.
export function pointOnDrawn(
  points: ReadonlyArray<LogicalPoint>,
  cumulative: ReadonlyArray<number>,
  radii: ReadonlyArray<number>,
  fraction: number,
): DrawnPoint {
  const count = points.length
  const unitAt = (i: number): LogicalPoint => {
    const [ao, ar] = points[i] as LogicalPoint
    const [bo, br] = points[i + 1] as LogicalPoint
    const length = (cumulative[i + 1] as number) - (cumulative[i] as number)
    return length > 0 ? [(bo - ao) / length, (br - ar) / length] : [0, 0]
  }
  // The circle of the corner at the end of segment i.
  const circleAt = (i: number) => cornerCircle(unitAt(i), unitAt(i + 1), radii[i + 1] as number)

  let total = 0
  for (let i = 0; i + 1 < count; i++) {
    const length = (cumulative[i + 1] as number) - (cumulative[i] as number)
    total += length - (radii[i] as number) - (radii[i + 1] as number)
    if (i + 2 < count && (radii[i + 1] as number) > 0) {
      const { theta, radius } = circleAt(i)
      total += theta * radius
    }
  }
  let remaining = Math.min(Math.max(fraction, 0), 1) * total

  let tangent: LogicalPoint = [0, 0]
  for (let i = 0; i + 1 < count; i++) {
    const u = unitAt(i)
    if (u[0] !== 0 || u[1] !== 0) {
      tangent = u
    }
    const [ao, ar] = points[i] as LogicalPoint
    const startRadius = radii[i] as number
    const endRadius = radii[i + 1] as number
    const straight =
      (cumulative[i + 1] as number) - (cumulative[i] as number) - startRadius - endRadius
    if (remaining <= straight || i + 2 === count) {
      const t = startRadius + Math.min(remaining, straight)
      return {
        point: [ao + u[0] * t, ar + u[1] * t],
        tangent,
        distance: (cumulative[i] as number) + t,
      }
    }
    remaining -= straight
    if (endRadius <= 0) {
      continue
    }
    const { theta, radius, normal: n } = circleAt(i)
    const arc = theta * radius
    if (remaining <= arc) {
      const phi = remaining / radius
      const sin = Math.sin(phi)
      const cos = Math.cos(phi)
      const [co, cr] = points[i + 1] as LogicalPoint
      return {
        point: [
          co - u[0] * endRadius + u[0] * radius * sin + n[0] * radius * (1 - cos),
          cr - u[1] * endRadius + u[1] * radius * sin + n[1] * radius * (1 - cos),
        ],
        tangent: [u[0] * cos + n[0] * sin, u[1] * cos + n[1] * sin],
        distance: (cumulative[i + 1] as number) - endRadius + (2 * endRadius * phi) / theta,
      }
    }
    remaining -= arc
  }
  const last = points[count - 1] as LogicalPoint
  return { point: last, tangent, distance: cumulative[count - 1] as number }
}

// Places an absolute adornment at a point on the drawn route. A turned
// adornment faces along the tangent there, and an upright one takes the
// side of the line from the axis the tangent runs closest to.
export function placeAbsolute(
  adornment: SolveAdornment,
  drawn: DrawnPoint,
  mirror: boolean,
): PlacedAdornment {
  const { point, tangent, distance } = drawn
  const turned = adornment.orient === FORWARD || adornment.orient === BACKWARD
  if (turned && (tangent[0] !== 0 || tangent[1] !== 0)) {
    const facing = adornment.orient === FORWARD ? 1 : -1
    const direction: LogicalPoint = [tangent[0] * facing, tangent[1] * facing]
    const across: LogicalPoint = mirror
      ? [direction[1], -direction[0]]
      : [-direction[1], direction[0]]
    const { lo, hi } = acrossLine(adornment.y, 1)
    const offset = (lo + hi) / 2
    const half = adornment.x.size / 2
    return {
      center: [point[0] + across[0] * offset, point[1] + across[1] * offset],
      direction,
      along: [distance - half, distance + half],
    }
  }
  const axis: Axis = Math.abs(tangent[0]) >= Math.abs(tangent[1]) ? 0 : 1
  const along = axis === 0 ? adornment.o : adornment.r
  const { lo, hi } = acrossLine(axis === 0 ? adornment.r : adornment.o, 1)
  const offset = (lo + hi) / 2
  return {
    center: axis === 0 ? [point[0], point[1] + offset] : [point[0] + offset, point[1]],
    direction: undefined,
    along: [distance - along.size / 2, distance + along.size / 2],
  }
}
