import { clamp, coincident } from 'curvy/number'
import type { ConnectorApplyOptions, ConnectorEdgeOptions } from '../../connector.ts'
import type { Edge } from '../../edge.ts'
import type * as Point from '../../point.ts'
import type * as Rect from '../../rect.ts'
import { atMost, overlaps } from '../../utils/tolerance.ts'
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
import { packLength } from './adornments.ts'

// The normalized form of a routing problem: the rects by index, grown into
// obstacles, the edges with their ends, costs, constraints, and resolved
// adornments, and the pins every visibility graph of the problem needs.
// Every phase of the pipeline reads from it and none writes to it.

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
// share of it, a corner against the preferred turn costs as much again,
// and a stretch along a merge partner costs this share of its length less.
const CROSSING_SHARE = 0.4
const TURN_SHARE = 1
const MERGE_PULL = 0.1

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
  // The obstacle the port's pin belongs to, when it is not the rect's.
  readonly owner?: number
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
  /** The rects its route stays out of. */
  readonly avoid: ReadonlyArray<Obstacle>
  readonly costs: Costs
  /** Where its jogs sit along the runs they shift. */
  readonly jogAt: number
}

/** A routing problem, normalized. */
export interface Problem {
  readonly settings: Settings
  /** The id of each rect, by index. */
  readonly ids: ReadonlyArray<string>
  /** The space between merged lanes: `mergeGap`, or `gap` when unset. */
  readonly mergeGap: number
  /** The cost of each corner, resolved. */
  readonly bendCost: number
  /** The cost of each crossing. */
  readonly crossingCost: number
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
  const edgeOptions = edges.map((_, i) => options.edges?.[i])

  // The extra pins that every graph needs: waypoints, and the corners of
  // avoided rects, so that lines run around them.
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
    const via = (option?.via ?? []).map((p): XY => [p.x, p.y])
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
      viaPins: via.map(([x, y]) => extraPins.findIndex((p) => p.x === x && p.y === y)),
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
    mergeGap: Number.isFinite(settings.mergeGap) ? settings.mergeGap : settings.gap,
    bendCost,
    crossingCost: CROSSING_SHARE * bendCost,
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
 * A port on a side of a rect, `at` of the way from its top or left end.
 *
 * @param rect - The rect.
 * @param side - The side.
 * @param at - The position along the side, from `0` to `1`.
 * @returns The port.
 */
export function portOf(rect: Rect.Rect, side: number, at: number): Port {
  const sAxis = sideAxis(side)
  const nAxis = normalAxis(side)
  const on = lo(rect, sAxis) + (sAxis === 0 ? rect.width : rect.height) * at
  const [x, y] = pointOn(sAxis, on, outwardSign(side) > 0 ? hi(rect, nAxis) : lo(rect, nAxis))
  return { side, x, y }
}

/**
 * The pin of a port, which leaves its side outward and passes through its
 * owner.
 *
 * @param port - The port.
 * @param owner - The obstacle the port's rect is, unless the port names
 * another.
 * @returns The pin.
 */
export const pinOf = (port: Port, owner: number): Pin => ({
  x: port.x,
  y: port.y,
  directions: 1 << port.side,
  owner: port.owner ?? owner,
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
