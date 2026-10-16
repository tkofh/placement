import { clamp, coincident } from 'curvy/number'
import {
  type Axis,
  type PlacedAdornment,
  type RunItem,
  type Sign,
  type SolveAdornment,
  measure,
  outerLength,
  packRun,
  placeAbsolute,
  pointOnDrawn,
  runLength,
} from '../adornments.ts'
import type { XY } from './nudge.ts'

// The adornments of a routed edge. A connector routes around rects that are
// already placed, so unlike the hierarchy it sizes no runs. The flow
// adornments at `at` `0` pack against the source port and those at `1`
// against the target port. Each of the others goes to the straight run
// nearest where its `at` falls that has room for it, and a run's adornments
// center on where they fall, between those packs. The space flow adornments take, gaps included, walls
// off corners. Absolute adornments land on the route as drawn, once the
// corners have their sizes, so they come second.

/** The flow adornments of a route, placed, and the stretches they wall off. */
export interface PlacedFlow {
  /** Each adornment's placement, `undefined` for the absolute ones. */
  readonly placed: ReadonlyArray<PlacedAdornment | undefined>
  /** The stretches the flow adornments take, as lengths along the route. */
  readonly walls: ReadonlyArray<readonly [number, number]>
}

/**
 * Places the flow adornments of a route.
 *
 * @param points - The route, as points with no repeats and no points in the
 * middle of a straight run.
 * @param cumulative - The length along the route at each point.
 * @param adornments - The edge's adornments.
 * @returns Where each flow adornment landed, and the walls they make.
 */
export function placeFlow(
  points: ReadonlyArray<XY>,
  cumulative: ReadonlyArray<number>,
  adornments: ReadonlyArray<SolveAdornment>,
): PlacedFlow {
  const placed: Array<PlacedAdornment | undefined> = adornments.map(() => undefined)
  const walls: Array<readonly [number, number]> = []
  const count = points.length
  if (count < 2) {
    return { placed, walls }
  }
  const total = cumulative[count - 1] as number

  // Each segment's geometry, and what of a flow adornment it takes along
  // itself, margins included.
  const segments = Array.from({ length: count - 1 }, (_, segment) => {
    const a = points[segment] as XY
    const b = points[segment + 1] as XY
    const axis: Axis = coincident(a[0], b[0]) ? 1 : 0
    const sign: Sign = b[axis] >= a[axis] ? 1 : -1
    return {
      a,
      b,
      axis,
      sign,
      start: cumulative[segment] as number,
      end: cumulative[segment + 1] as number,
      starts: [] as Array<RunItem>,
      ends: [] as Array<RunItem>,
      middle: [] as Array<RunItem>,
      used: 0,
    }
  })
  type Segment = (typeof segments)[number]
  const itemOn = (segment: Segment, index: number): RunItem => {
    const adornment = adornments[index] as SolveAdornment
    return {
      index,
      at: adornment.at,
      layer: adornment.layer,
      measured: measure(adornment, segment.axis, segment.sign, false),
    }
  }

  // The packs at the ports come first, on the first and last segments.
  const middle: Array<number> = []
  for (const [index, adornment] of adornments.entries()) {
    if (!adornment.flow) {
      continue
    }
    const first = segments[0] as Segment
    const last = segments[count - 2] as Segment
    if (coincident(adornment.at, 0)) {
      first.starts.push(itemOn(first, index))
    } else if (coincident(adornment.at, 1)) {
      last.ends.push(itemOn(last, index))
    } else {
      middle.push(index)
    }
  }
  for (const segment of segments) {
    segment.used = runLength(segment.starts) + runLength(segment.ends)
  }

  // Each other one goes to the segment nearest where it falls that has room
  // for it, or to the roomiest one when none has. Ties go to the earlier
  // segment.
  middle.sort(
    (i, j) => (adornments[i] as SolveAdornment).at - (adornments[j] as SolveAdornment).at || i - j,
  )
  for (const index of middle) {
    const position = (adornments[index] as SolveAdornment).at * total
    const away = (segment: Segment) => Math.max(segment.start - position, position - segment.end, 0)
    const ranked = segments.toSorted((p, q) => away(p) - away(q))
    const fits = ranked.find((segment) => {
      const length = outerLength(itemOn(segment, index).measured)
      return length < room(segment) || coincident(length, room(segment))
    })
    const chosen =
      fits ?? ranked.reduce((best, segment) => (room(segment) > room(best) ? segment : best))
    const item = itemOn(chosen, index)
    chosen.middle.push(item)
    chosen.used += outerLength(item.measured)
  }

  for (const segment of segments) {
    const { a, b, axis, sign, start: offset, starts, ends } = segment
    const line = a[1 - axis] as number

    const place = (group: ReadonlyArray<RunItem>, origin: (length: number) => number): void => {
      for (const [item, center] of packRun(group, sign, origin)) {
        const { size, start, end, lo, hi, direction } = item.measured
        const distance = offset + sign * (center - (a[axis] as number))
        const across = line + (lo + hi) / 2
        placed[item.index] = {
          center: axis === 0 ? [center, across] : [across, center],
          direction,
          along: [distance - size / 2, distance + size / 2],
        }
        const [before, after] = sign > 0 ? [start, end] : [end, start]
        walls.push([distance - size / 2 - before, distance + size / 2 + after])
      }
    }

    // The packs at the ports, each starting at its end of the segment.
    place(starts, (length) => (sign > 0 ? a[axis] : a[axis] - length))
    place(ends, (length) => (sign > 0 ? b[axis] - length : b[axis]))

    // The others center on the mean of their positions, inside the room the
    // packs leave where they fit. One that falls elsewhere counts as the
    // middle of the segment.
    if (segment.middle.length > 0) {
      let mean = 0
      for (const item of segment.middle) {
        const along = clampAlong(item.at * total, segment)
        mean += (a[axis] as number) + sign * (along - offset)
      }
      mean /= segment.middle.length
      const [low, high] =
        sign > 0 ? [runLength(starts), runLength(ends)] : [runLength(ends), runLength(starts)]
      const from = Math.min(a[axis] as number, b[axis] as number) + low
      const to = Math.max(a[axis] as number, b[axis] as number) - high
      place(segment.middle, (length) => clamp(mean - length / 2, from, Math.max(from, to - length)))
    }
  }
  return { placed, walls }
}

// The length a segment has left for flow adornments.
function room(segment: { start: number; end: number; used: number }): number {
  return segment.end - segment.start - segment.used
}

// A position along the route, or the middle of the segment when it falls
// outside it.
function clampAlong(position: number, segment: { start: number; end: number }): number {
  const inside =
    (segment.start < position || coincident(segment.start, position)) &&
    (position < segment.end || coincident(position, segment.end))
  return inside ? position : (segment.start + segment.end) / 2
}

/**
 * Places the absolute adornments of a route on the route as drawn.
 *
 * @param points - The route.
 * @param cumulative - The length along the route at each point.
 * @param radii - The size of the corner at each point.
 * @param adornments - The edge's adornments.
 * @param flow - Where the flow adornments landed (see `placeFlow`).
 * @returns Where every adornment landed.
 */
export function placeAdornments(
  points: ReadonlyArray<XY>,
  cumulative: ReadonlyArray<number>,
  radii: ReadonlyArray<number>,
  adornments: ReadonlyArray<SolveAdornment>,
  flow: ReadonlyArray<PlacedAdornment | undefined>,
): Array<PlacedAdornment> {
  return adornments.map(
    (adornment, index) =>
      flow[index] ??
      placeAbsolute(adornment, pointOnDrawn(points, cumulative, radii, adornment.at), false),
  )
}
