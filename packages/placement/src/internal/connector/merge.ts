import { coincident } from 'curvy/number'
import { atMost, before, inside, overlaps } from '../../utils/tolerance.ts'
import type { Obstacle } from '../graph/graph.ts'
import {
  type Axis,
  type XY,
  along,
  boxOn,
  hi,
  lo,
  normalAxis,
  other,
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
  rectAt,
} from './problem.ts'
import type { Merge, SharedEnd } from './spread.ts'

// Merged ends. Edges that end on one side of a rect with the same
// adornments there can share one port and one copy of the adornments. The
// routes of a merge come in to the branch, a whisk length from the side:
// where it sits past the clearance, on any line that meets the face there
// no farther off the port's line than an S at the merge's radius steps,
// so a route held off the port's line comes in straight, and otherwise at
// the branch pin on the port's line. The nudge then spreads them apart
// onto lanes, each a merge gap from the next, in the order the routes part
// in: where nothing
// is in the way, the lanes sit centered on the line, and they shift as a
// group where something is. At the branch each lane steps onto the line out
// of the port with two arcs of one radius, the merge gap: the first leaves
// the lane, and the second meets the line right behind the adornments. A
// lane less than two radii off the line crosses on an S, the arcs turning
// just as far as it needs; one farther off turns full corners with a
// straight between. Every lane on one side of the line meets it on the same
// circle, so the lanes peel off one another along it, the nearest first,
// and never cross. The lane on the line runs straight in.
//
// The steps lie between the side and the branch, where no other route may
// run. Where the branch sits past the clearance, the rect's clearance on
// that side deepens to it, so the steps lie inside the rect's own obstacle
// whatever lanes the nudge picks, and a route along the side meets one
// face. Only where the deeper clearance would reach into another obstacle,
// cover a pin, or close a passage that had room for a route does a zone
// over the planned lanes, a gap wider on each side, wall off the steps
// instead.

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
  const end = route.pop() as XY
  const { port, outward, trunk, lane } = whisk
  if (stepped(whisk)) {
    // The corner on the lane keeps the lane's line, where the route ends.
    route.push(
      [
        outward[0] === 0 ? end[0] : port[0] + outward[0] * lane,
        outward[1] === 0 ? end[1] : port[1] + outward[1] * lane,
      ],
      [port[0] + outward[0] * trunk, port[1] + outward[1] * trunk],
    )
  }
  route.push(port)
  return start ? route.toReversed() : route
}

// The most of its leg the corner on the lane of an S reaches past the merge
// point, as a multiple of the arcs' radius: at a turn of `theta` it is
// `tan(theta / 2) * (1 + 2 * cos(theta))`, at its greatest where
// `tan(theta / 2)^2 = 2 * sqrt(3) - 3`.
const S_REACH = Math.sqrt(6 * Math.sqrt(3) - 9)

// How far off the line a lane may sit for its step to keep arcs of
// `radius` in `depth` past the adornments: an S, which turns less than a
// right angle, up to two radii off, where the depth holds every S, or as
// far as the S whose corner on the lane meets the depth; two full corners
// with a straight between, at any offset, where the depth holds both
// arcs, one past the other. Without arcs, any offset steps square.
function capOf(radius: number, depth: number): number {
  if (!(radius > 0) || atMost(2 * radius, depth)) {
    return Number.POSITIVE_INFINITY
  }
  if (atMost(S_REACH * radius, depth)) {
    return 2 * radius
  }
  // The corner on the lane climbs with the turn up to its greatest reach,
  // so the turn whose corner meets the depth is found by halving.
  const peak = 2 * Math.atan(Math.sqrt(2 * Math.sqrt(3) - 3))
  let [low, high] = [0, peak]
  for (let k = 0; k < 60; k++) {
    const theta = (low + high) / 2
    const lane = radius * Math.tan(theta / 2) * (1 + 2 * Math.cos(theta))
    if (lane <= depth) {
      low = theta
    } else {
      high = theta
    }
  }
  return 2 * radius * (1 - Math.cos(low))
}

/**
 * Whether a merged lane steps onto the shared line, rather than running
 * along it.
 *
 * @param whisk - The whisk.
 * @returns `true` when the lane sits off the line.
 */
export const stepped = (whisk: Whisk): boolean => whisk.lateral[0] !== 0 || whisk.lateral[1] !== 0

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

/**
 * A merge with room for its lanes: where its routes branch off the line out
 * of the shared port, and how far its lanes may move.
 */
export interface Branch {
  /** The ends of the merge. */
  readonly ends: ReadonlyArray<EdgeEnd>
  /** The side the shared port sits on. */
  readonly side: number
  /** The shared port. */
  readonly port: XY
  /** How far out from the port the branch sits. */
  readonly reach: number
  /** The length of the adornments packed at the port. */
  readonly pack: number
  /**
   * The radius of each end's step, by its place in `ends`: `0` for an edge
   * without rounded corners.
   */
  readonly radii: ReadonlyArray<number>
  /** The least and most a lane may move to along the side. */
  readonly lanes: readonly [number, number]
  /** How far apart the outermost lanes sit, packed the merge gap apart. */
  readonly width: number
  /**
   * The least and most a route may come in at along the side, where it
   * has a face to come in on: where its step stays within an S of the
   * whisk's radius and the others still fit beside it.
   */
  readonly landing: readonly [number, number]
  /**
   * The coordinate across the side of the face the whisks start at, the
   * deeper clearance or the zone's, where routes may come in on any line
   * within the lanes' reach, or `undefined` where the branch sits within
   * the clearance and they come in at the branch.
   */
  readonly face: number | undefined
}

/** The branches of every merge, and what they add to the problem. */
export interface MergePlan {
  /** The ports, with the ends of each merge with room moved out to its branch. */
  readonly ports: Array<[Port, Port]>
  /** The merges with no room for their lanes. */
  readonly cramped: ReadonlyArray<Cramped>
  /** The merges with room for their lanes. */
  readonly branches: ReadonlyArray<Branch>
  /** The ends of each merge. */
  readonly merged: ReadonlyArray<ReadonlyArray<EdgeEnd>>
  /**
   * The obstacles, with the clearance deepened on merged sides and the whisk
   * zones added, which routes keep out of.
   */
  readonly blocks: ReadonlyArray<Obstacle>
}

// A merge with room for its lanes, as planned: its branch, and the band its
// lanes would take centered on the port's line.
interface Planned extends Omit<Branch, 'lanes' | 'face' | 'width' | 'landing'> {
  readonly rect: number
  readonly band: readonly [number, number]
  // Whether the branch sits past the rect's clearance.
  readonly deep: boolean
}

/**
 * Plans the branches of the merges. Each merge's lanes would sit their
 * strokes `mergeGap` apart, centered on the port's line. The branch sits a
 * whisk length out from the side, as far as the outermost of those lanes'
 * steps onto the line out of the port needs past the adornments, or halfway
 * to the rects in front, so routes still reach the lanes between. Every end
 * of the merge routes to the branch, on any line that meets its face where
 * it has one within reach of an S of the whisk's radius, and its lane may
 * move along the side as far as the rect's clearance reaches, or the
 * planned lanes do. The branch sits far enough out for every such S. Where the branch
 * sits past the clearance, the rect's obstacle deepens on that side to the
 * farthest branch there, corners included, unless that would overlap
 * another obstacle, cover the pin of another rect's end or a waypoint, or
 * narrow a passage below the gap and the thickest stroke that had that
 * room: there, a zone over the planned lanes, the gap wider on each side,
 * keeps other routes out of the whisks, and the lanes stay within it. With
 * no room past the adornments, the ends share the port as they are.
 *
 * @param problem - The problem.
 * @param given - The ports of every edge, with merged ends at their shared
 * port.
 * @param merges - The merges, with their ends in the order spread gave them.
 * @returns The ports moved to their branches, the branches, and the
 * obstacles deepened and walled.
 */
export function planMerges(
  problem: Problem,
  given: ReadonlyArray<readonly [Port, Port]>,
  merges: ReadonlyArray<Merge>,
): MergePlan {
  const { edges, boxes, obstacles, settings, mergeGap } = problem
  const ports = given.map(([source, target]): [Port, Port] => [source, target])
  const merged: Array<Array<EdgeEnd>> = []
  const cramped: Array<Cramped> = []
  const planned: Array<Planned> = []
  // Where each merge's port sits along its side.
  const spots: Array<{ readonly rect: number; readonly side: number; readonly on: number }> = []
  for (const { ends, at } of merges) {
    const { rect, side } = ends[0] as SharedEnd
    const port = portOf(problem, rect, side, at)
    const [ox, oy] = outward(side)
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
    // Distances out from the side and positions along it.
    const base = sAxis === 0 ? port.x : port.y
    const line = nAxis === 0 ? port.x : port.y
    const sign = outwardSign(side)
    const low = base + (lanes[0] as number)
    const high = base + (lanes.at(-1) as number)
    spots.push({ rect, side, on: base })
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
    const wanted =
      pack + Math.max(...lanes.map((lane, k) => step(Math.abs(lane), radii[k] as number).lane))
    // The whisks reach as far as an S at the merge's radius may need, so a
    // lane the nudge moves off the line still steps on its full arcs.
    const reach = Math.min(Math.max(wanted, pack + S_REACH * Math.max(...radii)), free / 2)
    const own = obstacles[rect] as Obstacle
    const grown = sign > 0 ? hi(own, nAxis) : lo(own, nAxis)
    const depth = sign * (grown - line)
    const roomy = before(0, reach) && atMost(pack, reach)
    merged.push(ends.map(({ edge, end }) => ({ edge, end })))
    if (!roomy) {
      // A merge with nothing to fit, neither adornments nor steps, shares
      // the port by design.
      if (before(0, wanted)) {
        cramped.push({ ends, rect, side, need: 2 * wanted - free })
      }
      for (const { edge, end } of ends) {
        ;(ports[edge] as [Port, Port])[end] = port
      }
      continue
    }
    planned.push({
      ends,
      rect,
      side,
      port: [port.x, port.y],
      reach,
      pack,
      radii,
      band: [low, high],
      deep: before(depth, reach),
    })
  }

  // The pins a deeper clearance may not cover: the ends on other rects, at
  // their branches where they merge with room, and the waypoints.
  const pins: Array<{ readonly rect: number; readonly at: XY }> = []
  const atBranch = new Map<number, XY>()
  for (const branch of planned) {
    for (const { edge, end } of branch.ends) {
      atBranch.set(endId(edge, end), branchOf(branch))
    }
  }
  for (const [i, edge] of edges.entries()) {
    for (const end of [0, 1]) {
      const port = (ports[i] as [Port, Port])[end] as Port
      pins.push({ rect: rectAt(edge, end), at: atBranch.get(endId(i, end)) ?? [port.x, port.y] })
    }
    for (const point of edge.via) {
      pins.push({ rect: -1, at: point })
    }
  }
  // A route's room: the gap and the thickest stroke.
  const room = settings.gap + Math.max(0, ...edges.map(({ thickness }) => thickness))

  // Each merged side deepens once, to its farthest branch, or else walls
  // off the whisks of its merges that reach past the clearance.
  const blocks: Array<Obstacle> = [...obstacles]
  const zones: Array<Obstacle> = []
  const owners = new Map<Planned, number>()
  const faces = new Map<Planned, number>()
  const sides = new Map<number, Array<Planned>>()
  for (const branch of planned) {
    if (branch.deep) {
      const key = 4 * branch.rect + branch.side
      sides.set(key, [...(sides.get(key) ?? []), branch])
    }
  }
  for (const list of sides.values()) {
    const { rect, side } = list[0] as Planned
    const sAxis = sideAxis(side)
    const nAxis = normalAxis(side)
    const sign = outwardSign(side)
    const box = blocks[rect] as Obstacle
    const face = sign > 0 ? hi(box, nAxis) : lo(box, nAxis)
    const outer = list.map((branch) => (branchOf(branch)[nAxis] as number) - face)
    const farthest = face + (sign > 0 ? Math.max(...outer) : Math.min(...outer))
    const span = [lo(box, sAxis), hi(box, sAxis)] as const
    const slab = boxOn(sAxis, span, sign > 0 ? [face, farthest] : [farthest, face])
    const deeper = boxOn(
      sAxis,
      span,
      sign > 0 ? [lo(box, nAxis), farthest] : [farthest, hi(box, nAxis)],
    )
    const others = [...blocks.filter((_, j) => j !== rect), ...zones]
    const clear =
      others.every((o) => !overlapsBox(slab, o) && !narrows(box, deeper, o, room)) &&
      pins.every(
        (pin) =>
          pin.rect === rect ||
          !inside(pin.at[0], slab.left, slab.right) ||
          !inside(pin.at[1], slab.top, slab.bottom),
      )
    if (clear) {
      blocks[rect] = deeper
      for (const branch of list) {
        faces.set(branch, farthest)
      }
      continue
    }
    for (const branch of list) {
      const [low, high] = branch.band
      const line = branch.port[nAxis] as number
      const outer = branchOf(branch)[nAxis] as number
      zones.push(
        boxOn(
          sAxis,
          [low - settings.gap, high + settings.gap],
          [Math.min(line, outer), Math.max(line, outer)],
        ),
      )
      owners.set(branch, obstacles.length + zones.length - 1)
      faces.set(branch, outer)
    }
  }

  // Every end of a merge with room routes to its branch, and its lane may
  // move along the side as far as the rect's clearance reaches, so its
  // step stays inside it, or as the lanes were
  // planned to, short of halfway to the next merge's port on the side, and
  // within its zone where it has one.
  const branches: Array<Branch> = []
  for (const branch of planned) {
    const { ends, rect, side, band } = branch
    const sAxis = sideAxis(side)
    const owner = owners.get(branch)
    const [x, y] = branchOf(branch)
    for (const { edge, end } of ends) {
      ;(ports[edge] as [Port, Port])[end] = {
        side,
        x,
        y,
        ...(owner === undefined ? {} : { owner }),
      }
    }
    const box = blocks[rect] as Obstacle
    let lanes: readonly [number, number] = [
      Math.min(lo(box, sAxis), band[0]),
      Math.max(hi(box, sAxis), band[1]),
    ]
    const on = branch.port[sAxis] as number
    for (const spot of spots) {
      if (spot.rect === rect && spot.side === side && !coincident(spot.on, on)) {
        const half = (spot.on + on) / 2
        lanes =
          spot.on > on
            ? [lanes[0], Math.min(lanes[1], Math.max(half, band[1]))]
            : [Math.max(lanes[0], Math.min(half, band[0])), lanes[1]]
      }
    }
    if (owner !== undefined) {
      lanes = [
        Math.max(lanes[0], band[0] - settings.gap),
        Math.min(lanes[1], band[1] + settings.gap),
      ]
    }
    // No farther off the line than a step the whisk takes at its own
    // radius between the adornments and the branch: an S, which turns
    // less than a right angle, or, where the depth holds both its arcs,
    // two full corners with a straight between, at any offset. Past that
    // the step would stand up across the trunk, and a jog in the route's
    // own run, with its own corners, does better. The lanes packed always
    // fit beside one on the line, so the routes come in within that band
    // short of its ends by their width (see `solve`), and the nudge never
    // has to squeeze them.
    const cap = Math.max(
      capOf(Math.max(...branch.radii), branch.reach - branch.pack),
      band[1] - band[0],
    )
    const width = band[1] - band[0]
    const landing: readonly [number, number] = [
      Math.max(lanes[0], on - cap) + width,
      Math.min(lanes[1], on + cap) - width,
    ]
    branches.push({
      ends: ends.map(({ edge, end }) => ({ edge, end })),
      side,
      port: branch.port,
      reach: branch.reach,
      pack: branch.pack,
      radii: branch.radii,
      lanes,
      landing,
      width,
      face: faces.get(branch),
    })
  }
  return {
    ports,
    cramped,
    branches,
    merged,
    blocks: zones.length === 0 ? blocks : [...blocks, ...zones],
  }
}

/**
 * The whisks of a merge's ends, from where the nudge left their lanes. The
 * steps of one merge share one radius, so the lanes on one side of the line
 * meet it on one circle; where the farthest lane's step does not fit
 * between the adornments and the branch, the radius shrinks for all of them.
 *
 * @param branch - The merge.
 * @param offsets - How far each end's lane sits off the port's line along
 * the side, by its place in the merge's ends, or `undefined` for an end
 * without a route.
 * @returns The whisk of each end, or `undefined` for one without a route.
 */
export function whisksOf(
  branch: Branch,
  offsets: ReadonlyArray<number | undefined>,
): Array<Whisk | undefined> {
  const { side, port, reach, pack, radii } = branch
  const steps = (shrink: number) =>
    offsets.map((offset, k) =>
      offset === undefined
        ? undefined
        : step(Math.abs(offset), Math.min(radii[k] as number, shrink)),
    )
  const full = steps(Infinity)
  const fitted = full.every((found) => found === undefined || atMost(pack + found.lane, reach))
    ? full
    : steps(Math.max((reach - pack) / 2, 0))
  const [ax, ay] = along(side)
  return offsets.map((offset, k) => {
    const found = fitted[k]
    if (offset === undefined || found === undefined) {
      return undefined
    }
    return {
      port,
      outward: outward(side),
      lateral: [ax * offset, ay * offset],
      trunk: pack + found.trunk,
      lane: pack + found.lane,
      reach: found.reach,
    }
  })
}

// Where a merge's routes come in: its reach out from the port.
function branchOf({ port, side, reach }: Pick<Branch, 'port' | 'side' | 'reach'>): XY {
  const [ox, oy] = outward(side)
  return [port[0] + ox * reach, port[1] + oy * reach]
}

// Whether two boxes have area in common.
const overlapsBox = (a: Obstacle, b: Obstacle): boolean =>
  overlaps(a.left, a.right, b.left, b.right) && overlaps(a.top, a.bottom, b.top, b.bottom)

// How far apart two boxes are along an axis, where they face each other
// across it, or `Infinity` where they do not.
function apart(a: Obstacle, b: Obstacle, axis: Axis): number {
  const across = other(axis)
  if (!overlaps(lo(a, across), hi(a, across), lo(b, across), hi(b, across))) {
    return Number.POSITIVE_INFINITY
  }
  return Math.max(lo(b, axis) - hi(a, axis), lo(a, axis) - hi(b, axis))
}

// Whether growing `box` into `deeper` leaves less than `room` between it
// and `other` along either axis, where there was that much before.
const narrows = (box: Obstacle, deeper: Obstacle, other: Obstacle, room: number): boolean =>
  ([0, 1] as const).some(
    (axis) => atMost(room, apart(box, other, axis)) && before(apart(deeper, other, axis), room),
  )
