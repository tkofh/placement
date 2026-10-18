import { coincident } from 'curvy/number'
import { before, overlaps } from '../../utils/tolerance.ts'
import type { Obstacle } from '../graph/graph.ts'
import { type XY, hi, lo, other, pointOn, positiveLength, sideAxis } from '../orient.ts'
import { routeOf } from './route.ts'

// Straightened ports. Auto ports spread out along their sides before the
// routes are nudged, so a route can leave its port only to jog a hair
// across right away, a kink too short for its corners. Where the port can
// slide along its side to the line past the jog, the route runs straight
// instead: the port stays clear of the side's ends by the gap, and its leg
// keeps clear of the rects and, by the gap, of the routes alongside it. A
// route across the leg crosses it wherever it slides.

/** An end of a route whose port may slide along its side. */
export interface SlidingEnd {
  /** The rect the port sits on. */
  readonly rect: Obstacle
  /** The index of the rect's grown obstacle, which the route may cross. */
  readonly own: number
  /** The side the port sits on: `0` top, `1` right, `2` bottom, `3` left. */
  readonly side: number
}

/** How far ports slide, and what they keep clear of. */
export interface StraightenOptions {
  /** The space between the strokes of routes. */
  readonly gap: number
  /** How far each route's corners reach. A jog shorter than two of them slides away. */
  readonly reach: ReadonlyArray<number>
  /** How thick each route draws. */
  readonly thickness: ReadonlyArray<number>
  /** The points each route must pass through. */
  readonly anchors: ReadonlyArray<ReadonlyArray<XY>>
}

/**
 * Slides auto ports along their sides to take out the short jogs right past
 * them.
 *
 * @param routes - The routes, as points with no repeats and no points in the
 * middle of a straight run, from source port to target port.
 * @param ends - Each route's ends that may slide, as `[source, target]`.
 * @param obstacles - The rects grown by their clearance, which the gained
 * stretch keeps out of.
 * @param options - The gap, and each route's reach, thickness, and anchors.
 * @returns The routes, with the jogs past the slid ports taken out.
 */
export function straightenPorts(
  routes: ReadonlyArray<ReadonlyArray<XY>>,
  ends: ReadonlyArray<readonly [SlidingEnd | undefined, SlidingEnd | undefined]>,
  obstacles: ReadonlyArray<Obstacle>,
  options: StraightenOptions,
): Array<Array<XY>> {
  const result = routes.map((route) => [...route])
  // The routes as they stand, for their segment boxes: a port that slides
  // reads the routes slid before it, so a slid route is taken anew.
  const boxed = result.map((points) => routeOf(points))
  const spacing = positiveLength(options.gap)
  const width = (route: number) => positiveLength(options.thickness[route])
  for (const [route, pair] of ends.entries()) {
    for (const [end, sliding] of pair.entries()) {
      const points = result[route] as Array<XY>
      if (sliding === undefined || points.length < 4) {
        continue
      }
      // The port, the corner past its leg, the jog's far corner, and the
      // point past that, walked from this end.
      const at = (k: number) => points[end === 0 ? k : points.length - 1 - k] as XY
      const [port, near, far, next] = [at(0), at(1), at(2), at(3)]
      // Along the side, and across it.
      const along = sideAxis(sliding.side)
      const across = other(along)
      const jog = far[along] - near[along]
      const reach = options.reach[route] ?? 0
      const short = Math.max(2 * (Number.isFinite(reach) ? reach : 0), spacing)
      const z =
        near[along] === port[along] &&
        far[across] === near[across] &&
        next[along] === far[along] &&
        (near[across] - port[across]) * (next[across] - far[across]) > 0
      if (!z || jog === 0 || !before(Math.abs(jog), short)) {
        continue
      }
      if ((options.anchors[route] ?? []).some((point) => onPath(point, [port, near, far]))) {
        continue
      }
      // How far the port and its leg slide toward the jog's far line: all
      // the way for a jog up to half the short length, then less, down to
      // none at the short length, so the slide never jumps as the jog
      // grows. The rest of the jog stays for a slant.
      const length = Math.abs(jog)
      const sign = Math.sign(jog)
      const full = short / 2
      let slide = length <= full ? length : (full * (short - length)) / (short - full)
      // The leg, across the side, at its spot along it.
      const from = port[along]
      const [legLow, legHigh] = [
        Math.min(port[across], near[across]),
        Math.max(port[across], near[across]),
      ]
      // It stops short of the side's ends by the gap.
      const [low, high] = [lo(sliding.rect, along), hi(sliding.rect, along)]
      const margin = Math.min(spacing, (high - low) / 2)
      slide = Math.min(slide, Math.max(sign > 0 ? high - margin - from : from - low - margin, 0))
      // And short of whatever it would come too near: the rects, and the
      // other routes that run alongside it, by the gap. A route that
      // crosses the leg crosses it wherever it slides.
      const stop = (box: Obstacle, keep: number, crossing = false) => {
        const [a0, a1] = [lo(box, along), hi(box, along)]
        if (crossing && a1 > a0) {
          return
        }
        const [c0, c1] = [lo(box, across), hi(box, across)]
        if (!overlaps(c0 - keep, c1 + keep, legLow, legHigh)) {
          return
        }
        const [near0, far0] =
          sign > 0 ? [a0 - keep - from, a1 + keep - from] : [from - a1 - keep, from - a0 + keep]
        if (!before(0, far0)) {
          return
        }
        slide = Math.min(slide, Math.max(near0, 0))
      }
      for (const [k, box] of obstacles.entries()) {
        if (k !== sliding.own) {
          stop(box, 0)
        }
      }
      for (const [k, other] of boxed.entries()) {
        const keep = spacing + (width(route) + width(k)) / 2
        const boxes = other.boxes()
        for (const [s, box] of boxes.entries()) {
          // The route's own leg, jog, and the stretch past them slide with it.
          if (k === route && (end === 0 ? s <= 2 : s >= boxes.length - 3)) {
            continue
          }
          stop(box, keep, true)
        }
      }
      if (!(slide > 0) || coincident(slide, 0)) {
        continue
      }
      const shift = (point: XY): XY => pointOn(along, point[along] + sign * slide, point[across])
      const [first, second] = end === 0 ? [0, 1] : [points.length - 1, points.length - 2]
      if (coincident(slide, length)) {
        // The jog is gone: the port runs straight on past it.
        const moved = shift(port)
        if (end === 0) {
          points.splice(0, 3, moved)
        } else {
          points.splice(points.length - 3, 3, moved)
        }
      } else {
        points[first] = shift(port)
        points[second] = shift(near)
      }
      boxed[route] = routeOf([...points])
    }
  }
  return result
}

// Whether a point lies on the polyline through `points`.
function onPath(point: XY, points: ReadonlyArray<XY>): boolean {
  return points.slice(1).some((b, k) => {
    const a = points[k] as XY
    return (
      (point[0] - a[0]) * (b[1] - a[1]) === (point[1] - a[1]) * (b[0] - a[0]) &&
      point[0] >= Math.min(a[0], b[0]) &&
      point[0] <= Math.max(a[0], b[0]) &&
      point[1] >= Math.min(a[1], b[1]) &&
      point[1] <= Math.max(a[1], b[1])
    )
  })
}
