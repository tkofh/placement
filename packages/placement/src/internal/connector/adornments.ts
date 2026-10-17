import { coincident } from 'curvy/number'
import * as Track from '../../track.ts'
import {
  type Axis,
  type Measured,
  type PlacedAdornment,
  type RunItem,
  type Sign,
  type SolveAdornment,
  measure,
  outerLength,
  placeAbsolute,
  pointOnDrawn,
} from '../adornments.ts'
import type { XY } from './nudge.ts'

// The adornments of a routed edge. A connector routes around rects that are
// already placed, so unlike the hierarchy it sizes no runs. Each straight
// run of the route is a flex container with no thickness, its main axis
// pointing toward the target. The flow adornments at `at` `0` pack against
// the source port and those at `1` against the target port. Each of the
// others goes to the run nearest where its `at` falls that has room for it
// and for the run's corners, and the run lays them out between its packs
// and its corners, justified like flex items. The space flow adornments
// take, gaps included, walls off corners. Absolute adornments land on the
// route as drawn, once the corners have their sizes, so they come second.

/** How the runs of a route lay out their flow adornments. */
export interface RunLayout {
  /** The room a run keeps at each of its corners for the corner to round. */
  readonly radius: number
  /** The distance between adornments next to each other in a layer. */
  readonly gap: number
  /** Where leftover length puts a run's middle, from `0` toward the source. */
  readonly justify: number
  /** The share of leftover length that goes between adornments. */
  readonly space: number
  /** The share of that spacing that also goes before the first and after the last. */
  readonly spaceOuter: number
}

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
 * @param layout - How runs lay out their adornments.
 * @returns Where each flow adornment landed, and the walls they make.
 */
export function placeFlow(
  points: ReadonlyArray<XY>,
  cumulative: ReadonlyArray<number>,
  adornments: ReadonlyArray<SolveAdornment>,
  layout: RunLayout,
): PlacedFlow {
  const placed: Array<PlacedAdornment | undefined> = adornments.map(() => undefined)
  const walls: Array<readonly [number, number]> = []
  const count = points.length
  if (count < 2) {
    return { placed, walls }
  }
  const total = cumulative[count - 1] as number
  const { gap } = layout

  // Each run's geometry, the room it keeps for the corners at its ends (none
  // at a port), and its adornments: the packs at either end, and the ones
  // between them.
  const runs = Array.from({ length: count - 1 }, (_, index) => {
    const a = points[index] as XY
    const b = points[index + 1] as XY
    const axis: Axis = coincident(a[0], b[0]) ? 1 : 0
    const sign: Sign = b[axis] >= a[axis] ? 1 : -1
    return {
      a,
      axis,
      sign,
      start: cumulative[index] as number,
      end: cumulative[index + 1] as number,
      padStart: index > 0 ? layout.radius : 0,
      padEnd: index < count - 2 ? layout.radius : 0,
      starts: [] as Array<RunItem>,
      ends: [] as Array<RunItem>,
      middle: [] as Array<RunItem>,
    }
  })
  type Run = (typeof runs)[number]
  const itemOn = (run: Run, index: number): RunItem => {
    const adornment = adornments[index] as SolveAdornment
    return {
      index,
      at: adornment.at,
      layer: adornment.layer,
      measured: measure(adornment, run.axis, run.sign, false),
    }
  }

  // The length a run needs for its adornments, with `extra` among them: its
  // fullest layer, gaps included, and the room for its corners when
  // `corners` is set.
  const demand = (run: Run, extra: RunItem, corners: boolean): number => {
    const items = [...run.starts, ...run.middle, ...run.ends, extra]
    let longest = 0
    for (const layer of byLayer(items).values()) {
      longest = Math.max(longest, extent(layer, gap))
    }
    return corners ? longest + run.padStart + run.padEnd : longest
  }

  // The packs at the ports come first, on the first and last runs.
  const middle: Array<number> = []
  for (const [index, adornment] of adornments.entries()) {
    if (!adornment.flow) {
      continue
    }
    const first = runs[0] as Run
    const last = runs[count - 2] as Run
    if (coincident(adornment.at, 0)) {
      first.starts.push(itemOn(first, index))
    } else if (coincident(adornment.at, 1)) {
      last.ends.push(itemOn(last, index))
    } else {
      middle.push(index)
    }
  }

  // Each other one goes to the run nearest where it falls that has room for
  // it and its corners, or else for it alone, or else to the roomiest run.
  // Runs equally near, within rounding, keep route order, so that the
  // earlier one wins ties however the route's lengths round.
  middle.sort(
    (i, j) => (adornments[i] as SolveAdornment).at - (adornments[j] as SolveAdornment).at || i - j,
  )
  for (const index of middle) {
    const position = (adornments[index] as SolveAdornment).at * total
    const away = (run: Run) => Math.max(run.start - position, position - run.end, 0)
    const ranked = runs.toSorted((p, q) => {
      const [x, y] = [away(p), away(q)]
      return coincident(x, y) ? 0 : x - y
    })
    const slack = (run: Run, corners: boolean) =>
      run.end - run.start - demand(run, itemOn(run, index), corners)
    const fits = (corners: boolean) => (run: Run) =>
      slack(run, corners) > 0 || coincident(slack(run, corners), 0)
    const chosen =
      ranked.find(fits(true)) ??
      ranked.find(fits(false)) ??
      runs.reduce((best, run) => (slack(run, false) > slack(best, false) ? run : best))
    chosen.middle.push(itemOn(chosen, index))
  }

  for (const run of runs) {
    const { a, axis, sign, start: offset } = run
    const length = run.end - run.start
    const line = a[1 - axis] as number

    // Places a group of a layer, ordered along the route, where its frames
    // start, as distances from the run's start.
    const place = (group: ReadonlyArray<RunItem>, starts: ReadonlyArray<number>): void => {
      for (const [k, item] of group.entries()) {
        const { size, lo, hi, direction } = item.measured
        const [before, after] = margins(item.measured, sign)
        const center = (starts[k] as number) + size / 2
        const distance = offset + center
        const along = (a[axis] as number) + sign * center
        const across = line + (lo + hi) / 2
        placed[item.index] = {
          center: axis === 0 ? [along, across] : [across, along],
          direction,
          along: [distance - size / 2, distance + size / 2],
        }
        walls.push([distance - size / 2 - before, distance + size / 2 + after])
      }
    }

    const layers = byLayer([...run.starts, ...run.middle, ...run.ends])
    for (const layer of layers.values()) {
      const inLayer = (group: ReadonlyArray<RunItem>) =>
        group.filter((item) => layer.includes(item)).toSorted(inOrder)
      const starts = inLayer(run.starts)
      const ends = inLayer(run.ends)
      const between = inLayer(run.middle)

      // The packs at the ports, each against its end of the run.
      const packed = (group: ReadonlyArray<RunItem>, place: number) =>
        group.length === 0 ? [] : Track.sequence(trackItems(group, sign), { gap, place }).intervals
      place(
        starts,
        packed(starts, 0).map((interval) => interval.start),
      )
      place(
        ends,
        packed(ends, 1).map((interval) => length + interval.start),
      )
      if (between.length === 0) {
        continue
      }

      // The others, justified between the packs, a gap from each, and the
      // corners. The corners give up their room when the adornments need it,
      // and adornments that overflow even then start after the start pack.
      const from = starts.length > 0 ? extent(starts, gap) + gap : 0
      const to = length - (ends.length > 0 ? extent(ends, gap) + gap : 0)
      const content = extent(between, gap)
      const room = to - from - run.padStart - run.padEnd
      const items = trackItems(between, sign)
      let origin = from
      let track: Track.Track
      if (room > 0 && (content < room || coincident(content, room))) {
        origin = from + run.padStart
        track = Track.sequence(items, {
          size: room,
          gap,
          place: layout.justify,
          space: layout.space,
          spaceOuter: layout.spaceOuter,
        })
      } else {
        // Each corner keeps the same share of its room, what the
        // adornments leave.
        const left = to - from - content
        if (left > 0) {
          origin = from + (run.padStart * left) / (run.padStart + run.padEnd)
        }
        track = Track.sequence(items, { gap })
      }
      place(
        between,
        track.intervals.map((interval) => origin + interval.start),
      )
    }
  }
  return { placed, walls }
}

const inOrder = (a: RunItem, b: RunItem) =>
  coincident(a.at, b.at) ? a.index - b.index : a.at - b.at

function byLayer(items: ReadonlyArray<RunItem>): Map<number, Array<RunItem>> {
  const layers = new Map<number, Array<RunItem>>()
  for (const item of items) {
    const layer = layers.get(item.layer)
    if (layer === undefined) {
      layers.set(item.layer, [item])
    } else {
      layer.push(item)
    }
  }
  return layers
}

// The length a group takes on a run, margins and the gaps between included.
function extent(group: ReadonlyArray<RunItem>, gap: number): number {
  let total = 0
  for (const item of group) {
    total += outerLength(item.measured)
  }
  return total + gap * Math.max(group.length - 1, 0)
}

// An adornment's margins before and after it along the route.
function margins(measured: Measured, sign: Sign): [before: number, after: number] {
  return sign > 0 ? [measured.start, measured.end] : [measured.end, measured.start]
}

// A group as flex items along the route, in route order.
function trackItems(group: ReadonlyArray<RunItem>, sign: Sign): Array<Track.SequenceItem> {
  return group.map((item) => {
    const [before, after] = margins(item.measured, sign)
    return { basis: item.measured.size, start: before, end: after }
  })
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
