import type { XY } from './nudge.ts'

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
