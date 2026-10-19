import { clamp, coincident } from 'curvy/number'
import type { ConnectorApplyOptions, ConnectorEdgeOptions } from '../../connector.ts'
import type { Edge } from '../../edge.ts'
import type * as Point from '../../point.ts'
import * as Polygon from '../../polygon.ts'
import type * as Rect from '../../rect.ts'
import { atMost, before, inside, overlaps } from '../../utils/tolerance.ts'
import { type Axis, type SolveAdornment, resolveAdornment } from '../adornments.ts'
import type { Obstacle } from '../graph/graph.ts'
import { ALL_DIRECTIONS, type Pin } from '../graph/visibility.ts'
import {
  type XY,
  hi,
  lo,
  normalAxis,
  other,
  outward,
  outwardSign,
  pointOn,
  positiveLength,
  sideAxis,
} from '../orient.ts'
import {
  type XY as OutlinePoint,
  fitLoops,
  portDepth,
  resolveFractions,
  resolveRadius,
} from '../polygon.ts'
import { packLength } from './adornments.ts'

// The normalized form of a routing problem: the rects by index, grown into
// obstacles, the edges with their ends, costs, constraints, and resolved
// adornments, the shapes their ports sit on, and the pins every visibility
// graph of the problem needs. Every phase of the pipeline reads from it and
// none writes to it.

/** The settings of a spec, as `Connector` holds them. */
export interface Settings {
  readonly clearance: number
  readonly gap: number
  /** The cost of each corner, or `NaN` for auto. */
  readonly bendCost: number
  readonly alignAdornments: number
  readonly justifyAdornments: number
  readonly justifyAdornmentsSpace: number
  readonly justifyAdornmentsSpaceOuter: number
  readonly adornmentGap: number
  readonly jogAt: number
  readonly jogSlant: number
  readonly merge: number
  readonly mergeGap: number
}

// The costs that derive from the cost of a corner: a crossing costs this
// share of it, a corner against the preferred turn costs as much again, a
// stretch along a merge partner costs this share of its length less, and
// an end with no room in front of its port for its adornments and corner
// costs up to this share of it.
const CROSSING_SHARE = 0.4
const TURN_SHARE = 1
const MERGE_PULL = 0.75
const TIGHT_SHARE = 2

/**
 * How much more a unit of length costs, per route a channel is over
 * capacity by, in the first round of a search among routes (see
 * `searchAll`). Each round after it presses twice as hard: 0.5, 1, 2, and
 * 4. At the last, a route too many over a channel 50 px long costs about
 * 200, some four corners at the auto bend cost of 48, which is
 * `2 * (clearance + gap)` at a clearance of 16 and a gap of 8, so a route
 * with a way around of up to a few corners leaves the channel, and one
 * without stays and is squeezed.
 */
export const PRESSURE = 0.5

/** How many rounds of a search among routes follow the first. */
export const PRESSURE_ROUNDS = 3

/**
 * How much more a unit of length costs, per route a channel is over
 * capacity by, in a round of a search among routes.
 *
 * @param round - The round, `0` the first.
 * @returns The pressure.
 */
export const pressureAt = (round: number): number => PRESSURE * 2 ** round

/** The turn encodings of `placement/connector`. */
export const CLOCKWISE = 1
export const COUNTERCLOCKWISE = 2

/** The merge encodings of `placement/connector`. */
export const MERGE_NONE = 0
export const MERGE_NEAR = 2

/** A port: a point on a side of a rect that a route leaves or enters. */
export interface Port {
  readonly side: number
  readonly x: number
  readonly y: number
}

/** One end of an edge: `0` its source, `1` its target. */
export interface EdgeEnd {
  readonly edge: number
  readonly end: number
}

/**
 * The id of an end of an edge, which keys the maps over ends.
 *
 * @param edge - The edge index.
 * @param end - The end, `0` or `1`.
 * @returns The id.
 */
export const endId = (edge: number, end: number): number => 2 * edge + end

/** One end of an edge in a problem. */
export interface End {
  /** The index of the rect the end sits on. */
  readonly rect: number
  /** The given side, or `undefined` for auto. */
  readonly side: number | undefined
  /** The given position along the side, or `undefined` for auto. */
  readonly at: number | undefined
  /**
   * The adornments at the end, as a key that ends which may merge share,
   * or `undefined` for an end that never merges.
   */
  readonly key: string | undefined
}

/** The search costs of an edge's corners. */
export interface Costs {
  readonly bendCost: number
  readonly clockwiseCost: number
  readonly counterclockwiseCost: number
}

/** An edge in a problem. */
export interface ProblemEdge {
  /** The index of the rect the edge leaves. */
  readonly source: number
  /** The index of the rect the edge enters. */
  readonly target: number
  /** Whether the edge leaves and enters one rect. */
  readonly loop: boolean
  readonly ends: readonly [End, End]
  /** How thick the edge draws, with unusable values as `0`. */
  readonly thickness: number
  /** How far its corners reach at most, with unusable values as `0`. */
  readonly radius: number
  /** Its adornments, resolved. */
  readonly adornments: ReadonlyArray<SolveAdornment>
  /** The points its route passes through, in order. */
  readonly via: ReadonlyArray<XY>
  /** The pin of each of its waypoints, among the problem's extra pins. */
  readonly viaPins: ReadonlyArray<number>
  /** The way the route arrives at each waypoint, or `undefined` for any. */
  readonly viaArrivals: ReadonlyArray<Point.PointLike | undefined>
  /** The way the route leaves each waypoint, or `undefined` for any. */
  readonly viaLeavings: ReadonlyArray<Point.PointLike | undefined>
  /** The rects its route stays out of. */
  readonly avoid: ReadonlyArray<Obstacle>
  readonly costs: Costs
  /** Where its jogs sit along the runs they shift. */
  readonly jogAt: number
}

/** A rect's shape, placed in it: the outlines its ports sit on, and the radius of their corners. */
export interface Shape {
  readonly outlines: ReadonlyArray<ReadonlyArray<OutlinePoint>>
  readonly radius: number
}

/** A routing problem, normalized. */
export interface Problem {
  readonly settings: Settings
  /** The id of each rect, by index. */
  readonly ids: ReadonlyArray<string>
  /** The shape of each rect, by index, or `undefined` for the rect itself. */
  readonly shapes: ReadonlyArray<Shape | undefined>
  /** The space between the strokes of merged ends: `mergeGap`, or `gap` when unset. */
  readonly mergeGap: number
  /** The cost of each corner, resolved. */
  readonly bendCost: number
  /** The cost of each crossing. */
  readonly crossingCost: number
  /**
   * The most an end costs for the room it lacks in front of its port (see
   * `tightCostAt`).
   */
  readonly tightCost: number
  /** The partner discount while sides are chosen, `0` with merging off. */
  readonly pull: number
  /** The rects, by index. */
  readonly boxes: ReadonlyArray<Rect.Rect>
  /** The rects grown by the clearance, by index. */
  readonly obstacles: ReadonlyArray<Obstacle>
  readonly edges: ReadonlyArray<ProblemEdge>
  /**
   * The pins every visibility graph of the problem needs: the waypoints,
   * and the corners of the avoided rects.
   */
  readonly extraPins: ReadonlyArray<Pin>
}

/**
 * Normalizes the inputs of `Connector.apply` into a problem.
 *
 * @param rects - The placed rects, keyed by id.
 * @param edges - The edges, referencing rects by id.
 * @param settings - The routing spec.
 * @param options - The route constraints of each edge.
 * @returns The problem.
 * @throws `RangeError` when an edge references an id that no rect has.
 */
export function normalize(
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge<string>>,
  settings: Settings,
  options: ConnectorApplyOptions = {},
): Problem {
  const ids = Object.keys(rects)
  const index = new Map<string, number>(ids.map((id, i) => [id, i]))
  const boxes = ids.map((id) => rects[id] as Rect.Rect)
  for (const edge of edges) {
    for (const id of [edge.source, edge.target]) {
      if (!index.has(id)) {
        throw new RangeError(`An edge references the id "${id}", which no rect has`)
      }
    }
  }
  const obstacles = grow(boxes, settings.clearance)
  const given = options.shapes ?? {}
  const shapes = ids.map((id, i) =>
    shapeOf(Object.hasOwn(given, id) ? given[id] : undefined, boxes[i] as Rect.Rect),
  )
  const edgeOptions = edges.map((_, i) => options.edges?.[i])

  // The extra pins that every graph needs: waypoints, with lines every
  // way (the search holds a route to the ways a waypoint holds), and the
  // corners of avoided rects, so that lines run around them.
  const extraPins: Array<Pin> = []
  for (const option of edgeOptions) {
    for (const point of option?.via ?? []) {
      extraPins.push({ x: point.x, y: point.y, directions: ALL_DIRECTIONS })
    }
    for (const r of option?.avoid ?? []) {
      for (const [x, y] of [
        [r.left, r.top],
        [r.right, r.top],
        [r.left, r.bottom],
        [r.right, r.bottom],
      ] as const) {
        extraPins.push({ x, y, directions: ALL_DIRECTIONS })
      }
    }
  }

  const merging = settings.merge !== MERGE_NONE
  // The costs, from the one scale: twice the clearance and gap together
  // when auto.
  const bendCost = Number.isFinite(settings.bendCost)
    ? settings.bendCost
    : 2 * (settings.clearance + settings.gap)
  const turnCost = TURN_SHARE * bendCost
  const problemEdges = edges.map((edge, i): ProblemEdge => {
    const option = edgeOptions[i]
    const loop = edge.source === edge.target
    const [sourceSide, targetSide] = selfLoopSides(edge)
    const endOf = (end: number, rect: string, side: number | undefined, at: number): End => ({
      rect: index.get(rect) as number,
      side,
      at: Number.isFinite(at) ? at : undefined,
      // A loop never merges with itself.
      key: merging && !loop ? endKey(edge, end) : undefined,
    })
    const waypoints = option?.via ?? []
    const via = waypoints.map((p): XY => [p.x, p.y])
    return {
      source: index.get(edge.source) as number,
      target: index.get(edge.target) as number,
      loop,
      ends: [
        endOf(0, edge.source, sourceSide, edge.sourceAt),
        endOf(1, edge.target, targetSide, edge.targetAt),
      ],
      thickness: positiveLength(edge.thickness),
      radius: positiveLength(edge.radius),
      adornments: edge.adornments.map((adornment) =>
        resolveAdornment(adornment, true, false, settings.alignAdornments),
      ),
      via,
      viaPins: waypoints.map((p) => extraPins.findIndex((pin) => pin.x === p.x && pin.y === p.y)),
      viaArrivals: waypoints.map((p) => wayOf(p.arriving)),
      viaLeavings: waypoints.map((p) => wayOf(p.leaving)),
      avoid: option?.avoid ?? [],
      costs: {
        bendCost,
        clockwiseCost: option?.turn === COUNTERCLOCKWISE ? turnCost : 0,
        counterclockwiseCost: option?.turn === CLOCKWISE ? turnCost : 0,
      },
      jogAt:
        option?.jogAt !== undefined && Number.isFinite(option.jogAt)
          ? option.jogAt
          : settings.jogAt,
    }
  })

  return {
    settings,
    ids,
    shapes,
    mergeGap: Number.isFinite(settings.mergeGap) ? settings.mergeGap : settings.gap,
    bendCost,
    crossingCost: CROSSING_SHARE * bendCost,
    tightCost: TIGHT_SHARE * bendCost,
    pull: merging ? MERGE_PULL : 0,
    boxes,
    obstacles,
    edges: problemEdges,
    extraPins,
  }
}

/**
 * The rect at an end of an edge.
 *
 * @param edge - The edge.
 * @param end - The end, `0` or `1`.
 * @returns The rect index.
 */
export const rectAt = (edge: ProblemEdge, end: number): number =>
  end === 0 ? edge.source : edge.target

/**
 * The merges at the ends of the edges `which`, for the channels their
 * routes fill (see `fillPath`). With `merged`, the groups placed; without,
 * the ends that could merge: two or more at one rect with one merge key.
 *
 * @param problem - The problem.
 * @param which - The edges, by index.
 * @param merged - The ends of each group, if placed.
 * @returns The ids of the merges at the source and target of each of
 * `which`, by its place there, from `0` to one less than twice the count,
 * or `-1` for an end that does not merge.
 */
export function mergeIds(
  problem: Problem,
  which: ReadonlyArray<number>,
  merged?: ReadonlyArray<ReadonlyArray<EdgeEnd>>,
): Array<[number, number]> {
  const ids = which.map((): [number, number] => [-1, -1])
  const place = new Map(which.map((edge, k) => [edge, k]))
  // The ends of each merge, as places and ends.
  const merges: Array<Array<readonly [number, number]>> = []
  const add = (ends: ReadonlyArray<EdgeEnd>) => {
    const kept = ends.flatMap(({ edge, end }) => {
      const k = place.get(edge)
      return k === undefined ? [] : [[k, end] as const]
    })
    if (kept.length > 1) {
      merges.push(kept)
    }
  }
  if (merged !== undefined) {
    for (const ends of merged) {
      add(ends)
    }
  } else {
    const byKey = new Map<string, Array<EdgeEnd>>()
    for (const i of which) {
      const edge = problem.edges[i] as ProblemEdge
      for (const [end, { key }] of edge.ends.entries()) {
        if (key !== undefined) {
          const id = `${rectAt(edge, end)} ${key}`
          const list = byKey.get(id) ?? []
          list.push({ edge: i, end })
          byKey.set(id, list)
        }
      }
    }
    for (const ends of byKey.values()) {
      add(ends)
    }
  }
  for (const [id, ends] of merges.entries()) {
    for (const [k, end] of ends) {
      ;(ids[k] as [number, number])[end] = id
    }
  }
  return ids
}

/**
 * The length the adornments at an end of an edge pack into at a port on
 * `side`.
 *
 * @param problem - The problem.
 * @param edge - The edge index.
 * @param end - The end, `0` or `1`.
 * @param side - The side the port sits on.
 * @returns The length of the pack.
 */
export function packAt(problem: Problem, edge: number, end: number, side: number): number {
  const heading = outwardSign(side) * (end === 0 ? 1 : -1)
  return packLength(
    (problem.edges[edge] as ProblemEdge).adornments,
    end,
    normalAxis(side),
    heading > 0 ? 1 : -1,
    problem.settings.adornmentGap,
  )
}

/**
 * The room in front of a port: how far a route can run straight out from a
 * port on `side` of a rect, `on` along it, before the nearest obstacle or
 * avoided rect across its line. `0` where one covers the port, and
 * `Infinity` with nothing in front.
 *
 * @param problem - The problem.
 * @param rect - The rect index.
 * @param side - The side the port sits on.
 * @param on - The port's coordinate along the side.
 * @param avoid - The rects the route stays out of, besides the obstacles.
 * @returns The room.
 */
export function roomAt(
  problem: Problem,
  rect: number,
  side: number,
  on: number,
  avoid: ReadonlyArray<Obstacle> = [],
): number {
  const nAxis = normalAxis(side)
  const sAxis = sideAxis(side)
  const sign = outwardSign(side)
  const depth = depthOf(problem, rect, side, on)
  let room = Number.POSITIVE_INFINITY
  const consider = (o: Obstacle) => {
    // Only a rect whose interior the line out of the port runs through
    // blocks it, and only one that reaches past the port.
    if (!inside(on, lo(o, sAxis), hi(o, sAxis))) {
      return
    }
    const [near, far] = sign > 0 ? [lo(o, nAxis), hi(o, nAxis)] : [hi(o, nAxis), lo(o, nAxis)]
    if (before(0, sign * (far - depth))) {
      room = Math.min(room, Math.max(sign * (near - depth), 0))
    }
  }
  for (const [j, o] of problem.obstacles.entries()) {
    if (j !== rect) {
      consider(o)
    }
  }
  for (const o of avoid) {
    consider(o)
  }
  return room
}

/**
 * What an end of an edge costs for the room it lacks in front of a port on
 * `side`, `at` along it: a tight end. The end needs its adornments, packed
 * at the port, and the edge's `radius` past them for the corner, in a
 * straight run; with less room, the corner shrinks and the adornments
 * spill around it. The cost grows with the shortfall, to the problem's
 * `tightCost` once it is as long as the radius or the pack, whichever is
 * longer.
 *
 * @param problem - The problem.
 * @param edge - The edge index.
 * @param end - The end, `0` or `1`.
 * @param side - The side the port sits on.
 * @param at - The position along the side, from `0` to `1`.
 * @returns The cost, `0` for an end with room.
 */
export function tightCostAt(
  problem: Problem,
  edge: number,
  end: number,
  side: number,
  at: number,
): number {
  const { radius, avoid } = problem.edges[edge] as ProblemEdge
  const rect = rectAt(problem.edges[edge] as ProblemEdge, end)
  const pack = packAt(problem, edge, end, side)
  const need = pack + radius
  if (need === 0) {
    return 0
  }
  const on = alongSide(problem.boxes[rect] as Rect.Rect, side, at)
  const shortfall = need - roomAt(problem, rect, side, on, avoid)
  if (!(shortfall > 0)) {
    return 0
  }
  return problem.tightCost * Math.min(1, shortfall / Math.max(radius, pack))
}

/**
 * The heading out of a side, or into it with `scale` `-1`, as a search
 * endpoint takes it.
 *
 * @param side - The side.
 * @param scale - `1` for out of the side, `-1` for into it.
 * @returns The heading.
 */
export const headingOf = (side: number, scale: number): Point.PointLike => {
  const [x, y] = outward(side)
  return { x: scale * x, y: scale * y }
}

/**
 * A port on a side of a rect, `at` of the way from its top or left end, on
 * the rect's shape where it has one: where the line out of the port, across
 * the side, meets the shape first, coming in from the side.
 *
 * @param problem - The problem.
 * @param rect - The rect index.
 * @param side - The side.
 * @param at - The position along the side, from `0` to `1`.
 * @returns The port.
 */
export const portOf = (problem: Problem, rect: number, side: number, at: number): Port =>
  portAlong(problem, rect, side, alongSide(problem.boxes[rect] as Rect.Rect, side, at))

/**
 * A port on a side of a rect, at `on` along it, on the rect's shape where
 * it has one (see `portOf`).
 *
 * @param problem - The problem.
 * @param rect - The rect index.
 * @param side - The side.
 * @param on - The port's coordinate along the side: x on the top and
 * bottom, y on the left and right.
 * @returns The port.
 */
export function portAlong(problem: Problem, rect: number, side: number, on: number): Port {
  const [x, y] = pointOn(sideAxis(side), on, depthOf(problem, rect, side, on))
  return { side, x, y }
}

/**
 * The coordinate along a side of a rect `at` of the way from its top or
 * left end.
 *
 * @param box - The rect.
 * @param side - The side.
 * @param at - The position along the side, from `0` to `1`.
 * @returns The coordinate along the side: x on the top and bottom, y on
 * the left and right.
 */
export function alongSide(box: Rect.Rect, side: number, at: number): number {
  const sAxis = sideAxis(side)
  return lo(box, sAxis) + (sAxis === 0 ? box.width : box.height) * at
}

/**
 * The coordinate across a side of a rect where a port at `on` along it
 * sits: on the side, or on the rect's shape where it has one.
 *
 * @param problem - The problem.
 * @param rect - The rect index.
 * @param side - The side.
 * @param on - The port's coordinate along the side.
 * @returns The port's coordinate across the side.
 */
export function depthOf(problem: Problem, rect: number, side: number, on: number): number {
  const box = problem.boxes[rect] as Rect.Rect
  const nAxis = normalAxis(side)
  const edge = outwardSign(side) > 0 ? hi(box, nAxis) : lo(box, nAxis)
  const shape = problem.shapes[rect]
  return shape === undefined ? edge : portDepth(shape.outlines, shape.radius, side, on, edge)
}

// A polygon placed in its rect, for ports to sit on. A polygon that is the
// sharp rect is no shape at all.
function shapeOf(polygon: Polygon.Polygon | undefined, box: Rect.Rect): Shape | undefined {
  if (!Polygon.isPolygon(polygon)) {
    return undefined
  }
  const fractions = resolveFractions(polygon)
  const radius = resolveRadius(polygon.radius)
  const isRect =
    fractions.length === 1 &&
    fractions[0]?.length === 4 &&
    fractions[0].every(([x, y], i) => x === RECT_X[i] && y === RECT_Y[i])
  if (isRect && radius === 0) {
    return undefined
  }
  const fitted = fitLoops(fractions, box.x, box.y, box.width, box.height, radius)
  return { outlines: fitted.loops, radius: fitted.radius }
}

// The corners of the rect polygon, in fractions, from its top left.
const RECT_X = [0, 1, 1, 0]
const RECT_Y = [0, 0, 1, 1]

// The way a waypoint holds, with a vector of no length or no direction as
// none.
const wayOf = (heading: Point.PointLike | undefined): Point.PointLike | undefined =>
  heading !== undefined &&
  Number.isFinite(heading.x) &&
  Number.isFinite(heading.y) &&
  (heading.x !== 0 || heading.y !== 0)
    ? { x: heading.x, y: heading.y }
    : undefined

/**
 * The pin of a port, which leaves its side outward and passes through the
 * obstacle its rect is.
 *
 * @param port - The port.
 * @param owner - The obstacle the port's rect is.
 * @returns The pin.
 */
export const pinOf = (port: Port, owner: number): Pin => ({
  x: port.x,
  y: port.y,
  directions: 1 << port.side,
  owner,
})

/**
 * The sides of two rects that face each other, along the axis on which
 * their centers are farther apart, for an edge without a route.
 *
 * @param a - The source rect.
 * @param b - The target rect.
 * @returns The side of `a` toward `b`, and the side of `b` toward `a`.
 */
export function facingSides(a: Rect.Rect, b: Rect.Rect): [number, number] {
  const dx = b.centerX - a.centerX
  const dy = b.centerY - a.centerY
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [1, 3] : [3, 1]
  }
  return dy >= 0 ? [2, 0] : [0, 2]
}

/**
 * How wide the passage is that a horizontal or vertical stretch from
 * (x1, y1) to (x2, y2) runs along: the distance between the nearest
 * obstacles on either side of it, among those beside it, or `Infinity`
 * without one on each side.
 *
 * @param obstacles - The obstacles.
 * @param x1 - The x of one end of the stretch.
 * @param y1 - The y of that end.
 * @param x2 - The x of the other end.
 * @param y2 - The y of that end.
 * @returns The width of the passage.
 */
export function passage(
  obstacles: ReadonlyArray<Obstacle>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  // The axis across the stretch, which its line sits on, and the one along
  // it.
  const across: Axis = x1 === x2 ? 0 : 1
  const run = other(across)
  const at = across === 0 ? x1 : y1
  const [from, to] =
    across === 0 ? [Math.min(y1, y2), Math.max(y1, y2)] : [Math.min(x1, x2), Math.max(x1, x2)]
  let low = Number.NEGATIVE_INFINITY
  let high = Number.POSITIVE_INFINITY
  for (const o of obstacles) {
    if (!overlaps(lo(o, run), hi(o, run), from, to)) {
      continue
    }
    const [near, far] = [lo(o, across), hi(o, across)]
    if (atMost(far, at)) {
      low = Math.max(low, far)
    } else if (atMost(at, near)) {
      high = Math.min(high, near)
    }
  }
  return high - low
}

// The rects grown by the clearance on each side, except toward a nearby
// rect, where each side grows by at most half the distance between them,
// so the grown rects never close a passage the rects leave open. Rects that
// touch or overlap leave no passage, so they grow into each other, and no
// route slips through the seam between them.
function grow(boxes: ReadonlyArray<Rect.Rect>, clearance: number): Array<Obstacle> {
  const reach = 2 * clearance
  const near = (a0: number, a1: number, b0: number, b1: number) =>
    overlaps(a0 - reach, a1 + reach, b0, b1)
  const before = (a: number, b: number) => a < b && !coincident(a, b)
  return boxes.map((a, i) => {
    let left = clearance
    let top = clearance
    let right = clearance
    let bottom = clearance
    for (const [j, b] of boxes.entries()) {
      if (i === j) {
        continue
      }
      const acrossY = near(a.top, a.bottom, b.top, b.bottom)
      const acrossX = near(a.left, a.right, b.left, b.right)
      if (acrossY && before(a.right, b.left)) {
        right = Math.min(right, (b.left - a.right) / 2)
      }
      if (acrossY && before(b.right, a.left)) {
        left = Math.min(left, (a.left - b.right) / 2)
      }
      if (acrossX && before(a.bottom, b.top)) {
        bottom = Math.min(bottom, (b.top - a.bottom) / 2)
      }
      if (acrossX && before(b.bottom, a.top)) {
        top = Math.min(top, (a.top - b.bottom) / 2)
      }
    }
    return {
      left: a.left - left,
      top: a.top - top,
      right: a.right + right,
      bottom: a.bottom + bottom,
    }
  })
}

// The given sides of an edge's ports, with a loop from a rect to itself
// leaving on the right and entering on the top unless told otherwise.
function selfLoopSides(edge: Edge<string>): [number | undefined, number | undefined] {
  const source = sideOf(edge.sourceSide)
  const target = sideOf(edge.targetSide)
  if (edge.source !== edge.target) {
    return [source, target]
  }
  if (source === undefined && target === undefined) {
    return [1, 0]
  }
  return [source ?? ((target as number) + 1) % 4, target ?? ((source as number) + 3) % 4]
}

const sideOf = (side: number) =>
  Number.isFinite(side) && side >= 0 && side <= 3 ? Math.trunc(side) : undefined

// The adornments at one end of an edge, as a key that ends with the same
// adornments share.
function endKey(edge: Edge<string>, end: number): string {
  return JSON.stringify(
    edge.adornments.filter((adornment) =>
      coincident(Number.isFinite(adornment.at) ? clamp(adornment.at, 0, 1) : 0.5, end),
    ),
  )
}

/**
 * The option fields of `apply` that a problem edge keeps, for callers
 * that build problems by hand.
 */
export type { ConnectorEdgeOptions }
