import type * as Rect from '../../rect.ts'
import { atMost, before, overlaps } from '../../utils/tolerance.ts'
import type { Obstacle } from '../graph/graph.ts'
import {
  type XY,
  along,
  boxOn,
  hi,
  lo,
  normalAxis,
  outward,
  outwardSign,
  sideAxis,
} from '../orient.ts'
import {
  type EdgeEnd,
  type Port,
  type Problem,
  type ProblemEdge,
  endId,
  packAt,
  portOf,
} from './problem.ts'
import type { Merge, SharedEnd } from './spread.ts'

// Merged ends. Edges that end on one side of a rect with the same
// adornments there can share one port and one copy of the adornments. Each
// route comes in on its own lane, a merge gap from the next, and the lanes
// run straight to a whisk length from the side. There each one steps onto
// the line out of the port with two arcs of one radius, the merge gap: the
// first leaves the lane, and the second meets the line right behind the
// adornments. A lane less than two radii off the line crosses on an S, the
// arcs turning just as far as it needs; one farther off turns full corners
// with a straight between. Every lane on one side of the line meets it on
// the same circle, so the lanes peel off one another along it, the nearest
// first, and never cross. The lane on the line runs straight in.

/** Where the two corners of a lane's step onto the port's line sit. */
export interface Step {
  /** How far the corner on the port's line sits past the merge point. */
  readonly trunk: number
  /** How far the corner on the lane sits past the merge point. */
  readonly lane: number
  /** How far each corner reaches along its legs. */
  readonly reach: number
}

/**
 * The corners of a lane's step onto the port's line, for arcs of one
 * radius: an S of two arcs that turn just enough for a lane less than two
 * radii off, or two full corners with a straight between for one farther.
 *
 * @param offset - How far the lane runs off the line, at least `0`.
 * @param radius - The radius of the arcs. `0` steps square, at the merge
 * point.
 * @returns Where the corners sit past the merge point, and their reach.
 */
export function step(offset: number, radius: number): Step {
  if (!(radius > 0) || !(offset > 0)) {
    return { trunk: 0, lane: 0, reach: 0 }
  }
  if (offset >= 2 * radius) {
    return { trunk: radius, lane: radius, reach: radius }
  }
  // Each arc turns `theta`, and together they cross 2 * radius * (1 - cos).
  const cos = 1 - offset / (2 * radius)
  const theta = Math.acos(cos)
  const reach = radius * Math.tan(theta / 2)
  return { trunk: reach, lane: reach + 2 * reach * cos, reach }
}

/** Where a merged route leaves its lane for the shared port. */
export interface Whisk {
  /** The shared port. */
  readonly port: XY
  /** The direction out of the port, as a unit vector. */
  readonly outward: XY
  /** The offset from the line out of the port to the lane. */
  readonly lateral: XY
  /** How far from the port the corner on the port's line sits. */
  readonly trunk: number
  /** How far from the port the corner on the lane sits. */
  readonly lane: number
  /** How far each of the two corners reaches. */
  readonly reach: number
}

/**
 * Leads a route from its lane end to the shared port.
 *
 * @param points - The route, which arrives at its lane end heading straight
 * for the port's side, or leaves it straight away from it at the start.
 * @param whisk - Where the lane steps onto the port's line.
 * @param start - Whether the whisk is at the route's start.
 * @returns The route, with its lane end replaced by the step's corners,
 * unless the lane is the line itself, and the port.
 */
export function addWhisk(points: ReadonlyArray<XY>, whisk: Whisk, start: boolean): Array<XY> {
  const route = start ? [...points].toReversed() : [...points]
  route.pop()
  const { port, outward, lateral, trunk, lane } = whisk
  if (lateral[0] !== 0 || lateral[1] !== 0) {
    route.push(
      [port[0] + outward[0] * lane + lateral[0], port[1] + outward[1] * lane + lateral[1]],
      [port[0] + outward[0] * trunk, port[1] + outward[1] * trunk],
    )
  }
  route.push(port)
  return start ? route.toReversed() : route
}

/** A merge with no room for its lanes, whose ends share the port as they are. */
export interface Cramped {
  /** The ends of the merge. */
  readonly ends: ReadonlyArray<EdgeEnd>
  readonly rect: number
  readonly side: number
  /**
   * How much farther from the side what sits in front of it would have to
   * be for the lanes to fit: the lanes take half the room there.
   */
  readonly need: number
}

/** The lanes and whisks of every merge, and what they add to the problem. */
export interface MergePlan {
  /** The ports, with merged ends moved out to the ends of their lanes. */
  readonly ports: Array<[Port, Port]>
  /** The merges with no room for their lanes. */
  readonly cramped: ReadonlyArray<Cramped>
  /** Where each merged end's lane steps onto the shared line, by end id. */
  readonly whisks: Map<number, Whisk>
  /** The ends of each merge, in lane order. */
  readonly merged: ReadonlyArray<ReadonlyArray<EdgeEnd>>
  /** The obstacles with the whisk zones added, which routes keep out of. */
  readonly blocks: ReadonlyArray<Obstacle>
}

/**
 * Plans the lanes and whisks of the merges. Each merge's lanes sit their
 * strokes `mergeGap` apart. They end a whisk length out from the side, as
 * far as the outermost lane's step onto the line out of the port needs past
 * the adornments, or halfway to the rects in front, so routes still reach
 * the lanes between; with less room, the steps' arcs shrink to fit. Beyond
 * the clearance, a zone keeps other routes out of the whisk. With no room
 * past the adornments, the ends share the port as they are.
 *
 * @param problem - The problem.
 * @param given - The ports of every edge, with merged ends at their shared
 * port.
 * @param merges - The merges, with their ends in lane order.
 * @returns The ports moved to their lanes, the whisks, and the zones.
 */
export function planMerges(
  problem: Problem,
  given: ReadonlyArray<readonly [Port, Port]>,
  merges: ReadonlyArray<Merge>,
): MergePlan {
  const { edges, boxes, obstacles, settings, mergeGap } = problem
  const ports = given.map(([source, target]): [Port, Port] => [source, target])
  const zones: Array<Obstacle> = []
  const whisks = new Map<number, Whisk>()
  const merged: Array<Array<EdgeEnd>> = []
  const cramped: Array<Cramped> = []
  for (const { ends, at } of merges) {
    const { rect, side } = ends[0] as SharedEnd
    const port = portOf(boxes[rect] as Rect.Rect, side, at)
    const [ox, oy] = outward(side)
    const [ax, ay] = along(side)
    // The axis along the side, and the one out of it.
    const sAxis = sideAxis(side)
    const nAxis = normalAxis(side)
    const widths = ends.map((end) => (edges[end.edge] as ProblemEdge).thickness)
    const offsets = [0]
    for (let k = 1; k < ends.length; k++) {
      const previous = offsets[k - 1] as number
      offsets.push(previous + mergeGap + ((widths[k - 1] as number) + (widths[k] as number)) / 2)
    }
    const middle = (offsets.at(-1) as number) / 2
    const lanes = offsets.map((offset) => offset - middle)
    const pack = packAt(problem, (ends[0] as SharedEnd).edge, (ends[0] as SharedEnd).end, side)
    // The arcs of a lane's step leave the merge gap inside them: their
    // radius is the gap plus half the thickest lane, on edges with rounded
    // corners.
    const turning = mergeGap + Math.max(...widths) / 2
    const radii = ends.map((end) => ((edges[end.edge] as ProblemEdge).radius > 0 ? turning : 0))
    const steps = (shrink: number) =>
      ends.map((_, k) => step(Math.abs(lanes[k] as number), Math.min(radii[k] as number, shrink)))
    // Distances out from the side and positions along it.
    const base = sAxis === 0 ? port.x : port.y
    const line = nAxis === 0 ? port.x : port.y
    const sign = outwardSign(side)
    const low = base + (lanes[0] as number)
    const high = base + (lanes.at(-1) as number)
    let free = Infinity
    for (const [j, box] of obstacles.entries()) {
      if (j === rect || !overlaps(lo(box, sAxis), hi(box, sAxis), low, high)) {
        continue
      }
      const [near, far] = [lo(box, nAxis), hi(box, nAxis)]
      const [ahead, behind] = sign > 0 ? [near - line, far - line] : [line - far, line - near]
      if (before(0, behind)) {
        free = Math.min(free, Math.max(ahead, 0))
      }
    }
    // A route whose other end faces this side from in front comes in
    // toward it, so the lanes stop short of half the way there, the gap
    // clear of the other end's half, and no route has to turn back.
    for (const { edge, end } of ends) {
      const other = (ports[edge] as [Port, Port])[1 - end] as Port
      const [fx, fy] = outward(other.side)
      if (fx === -ox && fy === -oy) {
        const ahead = sign * ((nAxis === 0 ? other.x : other.y) - line)
        if (ahead > 0) {
          free = Math.min(free, Math.max(ahead - settings.gap, 0))
        }
      }
    }
    const full = steps(Infinity)
    const wanted = pack + Math.max(...full.map(({ lane }) => lane))
    const reach = Math.min(wanted, free / 2)
    const fitted = full.every(({ lane }) => atMost(pack + lane, reach))
      ? full
      : steps(Math.max((reach - pack) / 2, 0))
    const own = obstacles[rect] as Obstacle
    const grown = sign > 0 ? hi(own, nAxis) : lo(own, nAxis)
    const depth = sign * (grown - line)
    const roomy = before(0, reach) && atMost(pack, reach)
    // A merge with nothing to fit, neither adornments nor steps, shares the
    // port by design.
    if (!roomy && before(0, wanted)) {
      cramped.push({ ends, rect, side, need: 2 * wanted - free })
    }
    let owner: number | undefined
    if (roomy && before(depth, reach) && high > low) {
      const outer = line + sign * reach
      zones.push(boxOn(sAxis, [low, high], [Math.min(line, outer), Math.max(line, outer)]))
      owner = obstacles.length + zones.length - 1
    }
    for (const [k, end] of ends.entries()) {
      const key = endId(end.edge, end.end)
      const pair = ports[end.edge] as [Port, Port]
      const lane = lanes[k] as number
      if (!roomy) {
        pair[end.end] = port
        continue
      }
      pair[end.end] = {
        side,
        x: port.x + ox * reach + ax * lane,
        y: port.y + oy * reach + ay * lane,
        ...(owner === undefined ? {} : { owner }),
      }
      const { trunk, lane: onLane, reach: corner } = fitted[k] as Step
      whisks.set(key, {
        port: [port.x, port.y],
        outward: [ox, oy],
        lateral: [ax * lane, ay * lane],
        trunk: pack + trunk,
        lane: pack + onLane,
        reach: corner,
      })
    }
    merged.push(ends.map(({ edge, end }) => ({ edge, end })))
  }
  return {
    ports,
    cramped,
    whisks,
    merged,
    blocks: zones.length === 0 ? obstacles : [...obstacles, ...zones],
  }
}

/**
 * Whether a merged lane steps onto the shared line, rather than running
 * along it.
 *
 * @param whisk - The whisk.
 * @returns `true` when the lane sits off the line.
 */
export const stepped = (whisk: Whisk): boolean => whisk.lateral[0] !== 0 || whisk.lateral[1] !== 0
