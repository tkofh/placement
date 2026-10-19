import { coincident } from 'curvy/number'
import { lengths } from '../adornments.ts'
import type { Obstacle } from '../graph/graph.ts'
import { type XY, headingOf, segmentBox } from '../orient.ts'

// A route as the passes after nudging read it: a polyline, and the facts
// about it that more than one pass needs, each worked out once, on first
// use. A route never changes. A pass that moves points makes a new route,
// so what a route remembers is always true of its points, and a pass that
// only reads one shares its work with the passes before and after it.
//
// The passes decide what a segment is by different rules, each for its own
// reason: nudging compares coordinates exactly, since it set them itself;
// adornment placement compares them within rounding, since it reads routes
// that other passes computed; and slanting reads headings as signs. A
// route holds the primitives those rules read and leaves each rule where
// it is, so that no pass changes its mind.

/** A polyline route, from its source port to its target port. */
class Route {
  /** The points, with no repeats and no points in the middle of a straight run. */
  readonly points: ReadonlyArray<XY>
  #cumulative: ReadonlyArray<number> | undefined
  #headings: ReadonlyArray<XY> | undefined
  #boxes: Map<number, ReadonlyArray<Obstacle>> | undefined

  constructor(points: ReadonlyArray<XY>) {
    this.points = points
  }

  /** The length along the route at each point, `0` at the first. */
  get cumulative(): ReadonlyArray<number> {
    this.#cumulative ??= lengths(this.points)
    return this.#cumulative
  }

  /** The heading of each segment, as the sign of its step along each axis. */
  get headings(): ReadonlyArray<XY> {
    this.#headings ??= this.points.slice(1).map((b, i) => headingOf(this.points[i] as XY, b))
    return this.#headings
  }

  /**
   * The box around each segment, grown by `half` on every side: the stroke
   * of the route for half its thickness, or the bare segments for `0`.
   *
   * @param half - How far each box reaches past its segment.
   * @returns One box per segment.
   */
  boxes(half = 0): ReadonlyArray<Obstacle> {
    this.#boxes ??= new Map()
    let found = this.#boxes.get(half)
    if (found === undefined) {
      found = this.points.slice(1).map((b, i) => segmentBox(this.points[i] as XY, b, half))
      this.#boxes.set(half, found)
    }
    return found
  }

  /**
   * Whether a segment runs along neither axis, within rounding: a slanted
   * jog.
   *
   * @param segment - The index of the segment's first point.
   * @returns Whether the segment slants.
   */
  isSlanted(segment: number): boolean {
    const a = this.points[segment] as XY
    const b = this.points[segment + 1] as XY
    return !coincident(a[0], b[0]) && !coincident(a[1], b[1])
  }
}

export type { Route }

/**
 * A route over the given points.
 *
 * @param points - The points, from the source port to the target port.
 * @returns The route.
 */
export const routeOf = (points: ReadonlyArray<XY>): Route => new Route(points)
