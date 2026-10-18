import { coincident } from 'curvy/number'
import * as Track from '../../track.ts'
import { atMost, before, overlaps } from '../../utils/tolerance.ts'
import {
  type Axis,
  type Measured,
  type PlacedAdornment,
  type RunItem,
  type Sign,
  type SolveAdornment,
  byAt,
  byLayer,
  measure,
  outerLength,
  placeAbsolute,
  pointOnDrawn,
} from '../adornments.ts'
import type { Obstacle } from '../graph/graph.ts'
import { type XY, hi, lo, other, pointOn } from '../orient.ts'

// The adornments of a routed edge. A connector routes around rects that are
// already placed, so unlike the hierarchy it sizes no runs. Each straight
// run of the route is a flex container with no thickness, its main axis
// pointing toward the target. The flow adornments at `at` `0` pack against
// the source port and those at `1` against the target port. Each of the
// others goes to the run nearest where its `at` falls that has room for it
// and for the run's corners, and the run lays them out between its packs
// and its corners, justified like flex items. A stretch of a run where no
// other route comes near the adornment comes first: the adornment goes to
// the nearest such stretch with room, and its run justifies it there. The space flow adornments
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
  /**
   * How far other routes keep from an adornment, across the line and along
   * it, for the stretch it sits on to count as clear of them.
   */
  readonly clear: number
}

/** The flow adornments of a route, placed, and the stretches they wall off. */
export interface PlacedFlow {
  /** Each adornment's placement, `undefined` for the absolute ones. */
  readonly placed: ReadonlyArray<PlacedAdornment | undefined>
  /** The stretches the flow adornments take, as lengths along the route. */
  readonly walls: ReadonlyArray<readonly [number, number]>
  /**
   * The flow adornments that no run had room for, by index, and how much
   * length each one's run is short by.
   */
  readonly overflow: ReadonlyArray<readonly [index: number, need: number]>
}

/**
 * Places the flow adornments of a route.
 *
 * @param points - The route, as points with no repeats and no points in the
 * middle of a straight run.
 * @param cumulative - The length along the route at each point.
 * @param adornments - The edge's adornments.
 * @param layout - How runs lay out their adornments.
 * @param others - The segments of the other routes, as boxes.
 * @returns Where each flow adornment landed, and the walls they make.
 */
export function placeFlow(
  points: ReadonlyArray<XY>,
  cumulative: ReadonlyArray<number>,
  adornments: ReadonlyArray<SolveAdornment>,
  layout: RunLayout,
  others: ReadonlyArray<Obstacle> = [],
): PlacedFlow {
  const placed: Array<PlacedAdornment | undefined> = adornments.map(() => undefined)
  const walls: Array<readonly [number, number]> = []
  const overflow: Array<readonly [number, number]> = []
  const count = points.length
  if (count < 2) {
    return { placed, walls, overflow }
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
      // A slanted run, the step of a merged lane, takes no adornments.
      slanted: !coincident(a[0], b[0]) && !coincident(a[1], b[1]),
      start: cumulative[index] as number,
      end: cumulative[index + 1] as number,
      padStart: index > 0 ? layout.radius : 0,
      padEnd: index < count - 2 ? layout.radius : 0,
      starts: [] as Array<RunItem>,
      ends: [] as Array<RunItem>,
      middle: [] as Array<RunItem>,
      // The clear stretch its middle adornments keep to, as distances from
      // its start, when they went there for being clear.
      window: undefined as readonly [number, number] | undefined,
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

  // The segments of this route, as boxes, for the runs that are not next to
  // them.
  const own = runs.map(({ a }, index): Obstacle => {
    const b = points[index + 1] as XY
    return {
      left: Math.min(a[0], b[0]),
      right: Math.max(a[0], b[0]),
      top: Math.min(a[1], b[1]),
      bottom: Math.max(a[1], b[1]),
    }
  })

  // Where a run's middle adornments may go, as distances from its start:
  // past its packs, the gap from them, and the room for its corners, in the
  // fullest layer of each pack.
  const content = (run: Run): [number, number] => {
    let from = 0
    let to = 0
    for (const layer of byLayer(run.starts).values()) {
      from = Math.max(from, extent(layer, gap) + gap)
    }
    for (const layer of byLayer(run.ends).values()) {
      to = Math.max(to, extent(layer, gap) + gap)
    }
    return [from + run.padStart, run.end - run.start - to - run.padEnd]
  }

  // The stretches of a run, as distances from its start within `[min, max]`,
  // where no other route, nor any part of this one not next to the run,
  // comes within `clear` of the adornment `item`, across the line or along
  // it.
  const clearOn = (run: Run, item: RunItem, min: number, max: number): Array<[number, number]> => {
    const { a, axis, sign } = run
    const line = a[1 - axis] as number
    const reach = layout.clear
    const low = line + item.measured.outerLo - reach
    const high = line + item.measured.outerHi + reach
    const index = runs.indexOf(run)
    const blocked: Array<[number, number]> = []
    const block = (box: Obstacle) => {
      // A segment that runs alongside has no thickness, so it counts when it
      // reaches into the band, short of its edges.
      const [near, far] = [lo(box, other(axis)), hi(box, other(axis))]
      if (!overlaps(near, far, low, high)) {
        return
      }
      const [start, end] = [lo(box, axis), hi(box, axis)]
      const origin = a[axis] as number
      const [p, q] = [sign * (start - origin), sign * (end - origin)]
      blocked.push([Math.min(p, q) - reach, Math.max(p, q) + reach])
    }
    for (const box of others) {
      block(box)
    }
    for (const [k, box] of own.entries()) {
      if (Math.abs(k - index) > 1) {
        block(box)
      }
    }
    blocked.sort((x, y) => x[0] - y[0])
    const free: Array<[number, number]> = []
    let at = min
    for (const [from, to] of blocked) {
      if (before(at, from)) {
        free.push([at, Math.min(from, max)])
      }
      at = Math.max(at, to)
      if (at > max || coincident(at, max)) {
        break
      }
    }
    if (before(at, max)) {
      free.push([at, max])
    }
    return free
  }

  // The length the middle adornments of a run take, with `extra` among
  // them: their fullest layer, gaps included.
  const middleLength = (run: Run, extra: RunItem): number => {
    let longest = 0
    for (const layer of byLayer([...run.middle, extra]).values()) {
      longest = Math.max(longest, extent(layer, gap))
    }
    return longest
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

    // The nearest clear stretch with room for it, within the stretch the
    // run's middle adornments already keep to.
    let clear: { run: Run; window: readonly [number, number]; away: number } | undefined
    const straight = runs.filter((run) => !run.slanted)
    for (const run of straight) {
      const item = itemOn(run, index)
      const [min, max] = run.window ?? content(run)
      const need = middleLength(run, item)
      for (const [from, to] of clearOn(run, item, min, max)) {
        if (before(to - from, need)) {
          continue
        }
        const distance = Math.max(run.start + from - position, position - run.start - to, 0)
        if (clear === undefined || before(distance, clear.away)) {
          clear = { run, window: [from, to], away: distance }
        }
      }
    }
    if (clear !== undefined) {
      clear.run.window = clear.window
      clear.run.middle.push(itemOn(clear.run, index))
      continue
    }

    const ranked = straight.toSorted((p, q) => {
      const [x, y] = [away(p), away(q)]
      return coincident(x, y) ? 0 : x - y
    })
    const slack = (run: Run, corners: boolean) =>
      run.end - run.start - demand(run, itemOn(run, index), corners)
    const fits = (corners: boolean) => (run: Run) => atMost(0, slack(run, corners))
    const roomy = ranked.find(fits(true)) ?? ranked.find(fits(false))
    const chosen =
      roomy ?? straight.reduce((best, run) => (slack(run, false) > slack(best, false) ? run : best))
    if (roomy === undefined) {
      overflow.push([index, -slack(chosen, false)])
    }
    // Crowded now, the run's adornments no longer keep to a clear stretch.
    chosen.window = undefined
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
          center: pointOn(axis, along, across),
          direction,
          along: [distance - size / 2, distance + size / 2],
        }
        walls.push([distance - size / 2 - before, distance + size / 2 + after])
      }
    }

    const layers = byLayer([...run.starts, ...run.middle, ...run.ends])
    for (const layer of layers.values()) {
      const inLayer = (group: ReadonlyArray<RunItem>) =>
        group.filter((item) => layer.includes(item)).toSorted(byAt)
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
      if (run.window !== undefined) {
        // Clear of the other routes, they keep to their stretch.
        const [start, end] = run.window
        origin = start
        track = Track.sequence(items, {
          size: end - start,
          gap,
          place: layout.justify,
          space: layout.space,
          spaceOuter: layout.spaceOuter,
        })
      } else if (room > 0 && (content < room || coincident(content, room))) {
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
  return { placed, walls, overflow }
}

/**
 * The length the flow adornments at one end of a route pack into against
 * its port, gaps and margins included, on a run along `axis` heading
 * `sign`.
 *
 * @param adornments - The edge's adornments.
 * @param end - The end, `0` for the source and `1` for the target.
 * @param axis - The axis the run at that end runs along.
 * @param sign - The run's heading along it.
 * @param gap - The distance between adornments next to each other.
 * @returns The length of the fullest layer of the pack, `0` for none.
 */
export function packLength(
  adornments: ReadonlyArray<SolveAdornment>,
  end: number,
  axis: Axis,
  sign: Sign,
  gap: number,
): number {
  const items = adornments.flatMap(
    (adornment, index): Array<RunItem> =>
      adornment.flow && coincident(adornment.at, end)
        ? [
            {
              index,
              at: adornment.at,
              layer: adornment.layer,
              measured: measure(adornment, axis, sign, false),
            },
          ]
        : [],
  )
  let longest = 0
  for (const layer of byLayer(items).values()) {
    longest = Math.max(longest, extent(layer, gap))
  }
  return longest
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
