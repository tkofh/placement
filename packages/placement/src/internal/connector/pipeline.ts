import { coincident } from 'curvy/number'
import type { AdornmentPlacement } from '../../adornment.ts'
import type { ConnectorLayout, ConnectorNote, ConnectorRoute } from '../../connector.ts'
import * as Interval from '../../interval.ts'
import * as Point from '../../point.ts'
import * as Rect from '../../rect.ts'
import type { PlacedAdornment, SolveAdornment } from '../adornments.ts'
import { type XY, sideAxis } from '../orient.ts'
import { betweenLength, placeAdornments, placeFlow } from './adornments.ts'
import { cornerOutsets, cornerRadii } from './corners.ts'
import { type Locks, emptyLocks, shiftLocks } from './locks.ts'
import { type Whisk, addWhisk, planMerges, stepped, whisksOf } from './merge.ts'
import { type Lane, type RouteConstraints, bundled, nudgeRoutes } from './nudge.ts'
import { type SlidingEnd, straightenPorts } from './ports.ts'
import {
  type EdgeEnd,
  type Port,
  type Problem,
  type ProblemEdge,
  endId,
  packAt,
  rectAt,
} from './problem.ts'
import { type Route, routeOf } from './route.ts'
import { type Landing, routeAll } from './routing.ts'
import { chooseSides } from './sides.ts'
import { slantJogs } from './slants.ts'
import { type SharedEnd, placePorts } from './spread.ts'

// The routing pipeline: the phases of `Connector.apply`, each a function
// of the problem and the phases before it.
//
// 1. `chooseSides` picks the side of every auto end, and finds trial routes.
// 2. `placePorts` spreads the auto ports along their sides and groups the
//    ends that merge.
// 3. `planMerges` sets the branch of each merge, where its routes come in,
//    and deepens the clearance there or walls off the whisks.
// 4. `routeAll` finds the routes on the final ports, trading lone ends
//    next to each other when that crosses less.
// 5. `nudge` moves routes that run alongside each other apart, and spreads
//    the routes of each merge onto lanes, in the order they part in.
// 6. `straightenPorts` slides auto ports to take out short jogs.
// 7. The whisks lead merged ends from where their lanes landed onto their
//    shared ports, and the jogs and corner sizes that later passes leave
//    alone are noted.
// 8. `placeFlow` lays out the flow adornments, whose stretches wall off
//    corners.
// 9. `cornerRadii` sizes the corners, `slantJogs` slants the short jogs,
//    and `cornerRadii` settles the corners again on the routes as drawn.
// 10. `placeAdornments` lands the absolute adornments on the drawn routes.

/**
 * Hears the routes after each phase of `solve`, for diagnostics: the phase
 * (`'search'`, `'nudge'`, `'ports'`, `'whisks'`, `'slants'`) and one
 * polyline per edge, `undefined` for an edge without a route.
 */
export type Trace = (phase: string, routes: ReadonlyArray<ReadonlyArray<XY> | undefined>) => void

/**
 * Solves a routing problem.
 *
 * @param problem - The problem, from `normalize`.
 * @param trace - Hears the routes after each phase, for diagnostics.
 * @returns One route per edge.
 */
export function solve(problem: Problem, trace?: Trace): ConnectorLayout {
  const { ids, edges, boxes, obstacles, settings, mergeGap } = problem
  const chosen = chooseSides(problem)
  const placed = placePorts(problem, chosen)
  const plan = planMerges(problem, placed.ports, placed.merges)
  const { ports, branches, merged, blocks, cramped } = plan

  // The routes, on a graph with the final ports. Lone ends next to each
  // other on a side may trade ports to cross less. The ends of a merge
  // share their branch, and the nudge orders their lanes.
  const lone = (end: EdgeEnd) =>
    !merged.some((members) => members.some((m) => m.edge === end.edge && m.end === end.end))
  const trades: Array<readonly [EdgeEnd, EdgeEnd]> = []
  for (const group of placed.shared.values()) {
    const sorted = group
      .filter(lone)
      .toSorted(
        (a, b) =>
          (placed.positions.get(endId(a.edge, a.end)) ?? 0.5) -
          (placed.positions.get(endId(b.edge, b.end)) ?? 0.5),
      )
    for (let k = 1; k < sorted.length; k++) {
      trades.push([sorted[k - 1] as SharedEnd, sorted[k] as SharedEnd])
    }
  }
  // The ends of a merge whose whisks start past the clearance come in on
  // any line that meets its face within the band its steps can take.
  const landings = new Map<number, Landing>()
  for (const { ends, side, landing, face } of branches) {
    if (face !== undefined) {
      for (const { edge, end } of ends) {
        landings.set(endId(edge, end), { side, face, low: landing[0], high: landing[1] })
      }
    }
  }
  const { routes, traded } = routeAll(
    problem,
    ports,
    edges.map((_, i) => i),
    blocks,
    trades,
    merged,
    landings,
  )
  for (const [a, b] of traded) {
    const [p, q] = [ports[a.edge] as [Port, Port], ports[b.edge] as [Port, Port]]
    ;[p[a.end], q[b.end]] = [q[b.end] as Port, p[a.end] as Port]
  }

  // The first edge of each merge with a route draws the shared adornments.
  const leaders = new Map<number, number>()
  for (const members of merged) {
    const first = members
      .filter(({ edge }) => routes[edge] !== undefined)
      .reduce((lead, { edge }) => Math.min(lead, edge), Infinity)
    for (const { edge, end } of members) {
      leaders.set(endId(edge, end), Number.isFinite(first) ? first : -1)
    }
  }

  // Nudge the routes that were found, together. The routes of a merge stay
  // the merge gap apart while they run together from it, and the lanes of
  // a merge with room move along its side, within the reach of its whisks.
  const mergeOf = new Map<number, number>()
  for (const [id, members] of merged.entries()) {
    for (const { edge, end } of members) {
      mergeOf.set(endId(edge, end), id)
    }
  }
  const laneOf = new Map<number, Lane>()
  for (const { ends, side, port, lanes, face } of branches) {
    const line = port[sideAxis(side)] as number
    for (const { edge, end } of ends) {
      const rect = rectAt(edges[edge] as ProblemEdge, end)
      laneOf.set(endId(edge, end), {
        line,
        low: lanes[0],
        high: lanes[1],
        ...(face === undefined ? {} : { rect }),
      })
    }
  }
  const found = routes.flatMap((route, i) => (route === undefined ? [] : [i]))
  const edgeOf = (k: number) => edges[found[k] as number] as ProblemEdge
  const report = (phase: string, list: ReadonlyArray<ReadonlyArray<XY>>) => {
    if (trace !== undefined) {
      const byEdge: Array<ReadonlyArray<XY> | undefined> = edges.map(() => undefined)
      for (const [k, i] of found.entries()) {
        byEdge[i] = list[k]
      }
      trace(phase, byEdge)
    }
  }
  report(
    'search',
    routes.filter((route) => route !== undefined),
  )
  // The length the flow adornments between an edge's ports take on a run,
  // and the gap that keeps them off a pack.
  const flowsOf = (edge: ProblemEdge) => {
    const between = betweenLength(edge.adornments, settings.adornmentGap)
    return between > 0 ? between + settings.adornmentGap : 0
  }
  // The length the adornments at each end pack into at its port.
  const packs = found.map(
    (i) =>
      [0, 1].map((end) =>
        packAt(problem, i, end, ((ports[i] as [Port, Port])[end] as Port).side),
      ) as [number, number],
  )
  // Whether an end's port may slide along its side: an auto port that
  // neither merges nor belongs to a loop.
  const slides = (i: number, end: number) => {
    const edge = edges[i] as ProblemEdge
    const { at } = edge.ends[end] as ProblemEdge['ends'][number]
    return at === undefined && !mergeOf.has(endId(i, end)) && !edge.loop
  }
  const { routes: nudgedRoutes, crowded } = nudgeRoutes(
    found.map((i) => routes[i] as Array<XY>),
    blocks,
    settings.gap,
    found.map((i, k): RouteConstraints => {
      const edge = edges[i] as ProblemEdge
      return {
        anchors: edge.via,
        straight: edge.via.filter(
          (_, k) => edge.viaArrivals[k] !== undefined || edge.viaLeavings[k] !== undefined,
        ),
        avoid: edge.avoid,
        jogAt: edge.jogAt,
        merges: [mergeOf.get(endId(i, 0)) ?? -1, mergeOf.get(endId(i, 1)) ?? -1],
        thickness: edge.thickness,
        corner: edge.radius,
        slant: settings.jogSlant,
        packs: packs[k] as [number, number],
        flows: flowsOf(edge),
        sliding: [slides(i, 0), slides(i, 1)],
        lanes: [laneOf.get(endId(i, 0)), laneOf.get(endId(i, 1))],
      }
    }),
    mergeGap,
  )
  report('nudge', nudgedRoutes)
  const mergesOf = found.map(
    (i) => [mergeOf.get(endId(i, 0)) ?? -1, mergeOf.get(endId(i, 1)) ?? -1] as const,
  )
  // Auto ports that do not merge slide along their sides to take out the
  // short jogs right past them.
  const straight = straightenPorts(
    nudgedRoutes,
    found.map((i) => {
      const edge = edges[i] as ProblemEdge
      return [0, 1].map((end) => {
        const { rect } = edge.ends[end] as ProblemEdge['ends'][number]
        if (!slides(i, end)) {
          return undefined
        }
        return {
          rect: boxes[rect] as Rect.Rect,
          own: rect,
          side: ((ports[i] as [Port, Port])[end] as Port).side,
        }
      }) as [SlidingEnd | undefined, SlidingEnd | undefined]
    }),
    blocks,
    {
      gap: settings.gap,
      reach: found.map((i) => (edges[i] as ProblemEdge).radius),
      thickness: found.map((i) => (edges[i] as ProblemEdge).thickness),
      anchors: found.map((i) => (edges[i] as ProblemEdge).via),
      packs,
      merges: mergesOf,
      mergeGap,
    },
  )

  report('ports', straight)

  // The whisk of each merged end, from where its lane landed.
  const placeOf = new Map(found.map((i, k) => [i, k]))
  const whisks = new Map<number, Whisk>()
  for (const branch of branches) {
    const { ends, side, port } = branch
    const sAxis = sideAxis(side)
    const offsets = ends.map(({ edge, end }) => {
      const k = placeOf.get(edge)
      const route = k === undefined ? undefined : straight[k]
      const point = end === 0 ? route?.[0] : route?.at(-1)
      return point === undefined ? undefined : point[sAxis] - (port[sAxis] as number)
    })
    for (const [k, whisk] of whisksOf(branch, offsets).entries()) {
      const { edge, end } = ends[k] as EdgeEnd
      if (whisk !== undefined) {
        whisks.set(endId(edge, end), whisk)
      }
    }
  }

  // Merged ends lead from their lanes to the shared port. Their steps keep
  // the corners they were given, so nothing slants them further. Where a
  // route leaves a group that goes on without it, the jog that leaves it
  // stays upright. A jog in a bundle turns with it, so it stays upright
  // too. The locks carry these decisions to the passes that size corners
  // and slant jogs.
  const { coupled, parting } = bundled(straight, mergesOf, settings.gap)
  const dressed = straight.map((route, k) => {
    const i = found[k] as number
    let locks = emptyLocks()
    for (const corner of parting[k] ?? []) {
      locks.upright.add(corner - 1).add(corner)
    }
    for (const segment of coupled[k] ?? []) {
      locks.upright.add(segment)
    }
    let points: Array<XY> = route
    const target = whisks.get(endId(i, 1))
    if (target !== undefined) {
      points = addWhisk(points, target, false)
      if (stepped(target)) {
        locks.upright.add(points.length - 3)
        locks.cornerSize.set(points.length - 3, target.reach).set(points.length - 2, target.reach)
      }
    }
    const source = whisks.get(endId(i, 0))
    if (source !== undefined) {
      const before = points.length
      points = addWhisk(points, source, true)
      locks = shiftLocks(locks, points.length - before)
      if (stepped(source)) {
        locks.upright.add(1)
        locks.cornerSize.set(1, source.reach).set(2, source.reach)
      }
    }
    return { points, locks }
  })
  // The routes as nudged, which the passes from here on read and never
  // change: each pass that moves points makes new routes.
  const nudged = dressed.map(({ points }) => routeOf(points))
  const locks = dressed.map(({ locks: held }) => held)
  report(
    'whisks',
    dressed.map(({ points }) => points),
  )

  // Flow adornments wall off corners, and absolute ones land on the route
  // as drawn, with its corners sized.
  const adornments = found.map((i) => (edges[i] as ProblemEdge).adornments)
  const flows = nudged.map((route, k) => {
    const between = (adornments[k] as ReadonlyArray<SolveAdornment>).some(
      (adornment) => adornment.flow && !coincident(adornment.at, 0) && !coincident(adornment.at, 1),
    )
    return placeFlow(
      route,
      adornments[k] as ReadonlyArray<SolveAdornment>,
      {
        radius: edgeOf(k).radius,
        gap: settings.adornmentGap,
        justify: settings.justifyAdornments,
        space: settings.justifyAdornmentsSpace,
        spaceOuter: settings.justifyAdornmentsSpaceOuter,
        clear: settings.gap,
      },
      // The strokes of every other route, which the flow adornments between
      // the ports look for clear stretches among.
      between
        ? nudged.flatMap((other, j) => (j === k ? [] : other.boxes(edgeOf(j).thickness / 2)))
        : [],
    )
  })
  // The steps keep the corners they were given.
  const radii = found.map((i) => (edges[i] as ProblemEdge).radius)
  const walls = flows.map((flow) => flow.walls)
  const thickness = found.map((i) => (edges[i] as ProblemEdge).thickness)
  const sizes = cornerRadii(nudged, radii, walls, {
    fixed: locks.map((held) => held.cornerSize),
  })
  // Short jogs slant, and the flow adornments past them move up the
  // shorter route.
  const slanted = slantJogs(
    nudged,
    sizes,
    radii,
    settings.jogSlant,
    walls,
    obstacles,
    locks.map((held) => held.upright),
    { gap: settings.gap, thickness, merges: mergesOf, mergeGap },
  )
  // Then the corners settle on the routes as drawn. A slanted corner keeps
  // its size, and so do the corners at the far ends of its legs, which the
  // slant made room beside; the corners nested inside a slanted one grow
  // to its arc.
  const shaped = slanted.map(({ route }) => route)
  report(
    'slants',
    shaped.map((route) => route.points),
  )
  const settled = cornerRadii(nudged, radii, walls, {
    fixed: slanted.map(({ route: { points }, radii: slantedSizes }, k) => {
      const kept = new Map((locks[k] as Locks).cornerSize)
      const orthogonal = (nudged[k] as Route).points
      const moved = (index: number) => {
        const [x, y] = points[index] as XY
        const [x0, y0] = orthogonal[index] as XY
        return x !== x0 || y !== y0
      }
      for (let index = 1; index + 1 < points.length; index++) {
        if (moved(index) || moved(index - 1) || moved(index + 1)) {
          kept.set(index, slantedSizes[index] as number)
        }
      }
      return kept
    }),
    shaped,
  })
  const outsets = cornerOutsets(nudged, radii, settled, shaped)

  // What the routes gave up, and what would have fit them.
  const notes: Array<ConnectorNote> = []
  for (const [i, route] of routes.entries()) {
    if (route === undefined) {
      notes.push({ kind: 0, edge: i })
    }
  }
  for (const channel of crowded) {
    notes.push({
      kind: 1,
      edges: channel.routes.map((k) => found[k] as number),
      axis: channel.axis,
      // The zones past the obstacles hold routes too, but are no rect.
      rects: channel.obstacles.flatMap((o) => (o < obstacles.length ? [ids[o] as string] : [])),
      need: channel.need,
    })
  }
  for (const { ends, rect, side, need } of cramped) {
    notes.push({
      kind: 2,
      edges: [...new Set(ends.map(({ edge }) => edge))],
      rect: ids[rect] as string,
      side,
      need,
    })
  }
  for (const [k, flow] of flows.entries()) {
    for (const [adornment, need] of flow.overflow) {
      notes.push({ kind: 3, edge: found[k] as number, adornment, need })
    }
  }

  const result: Array<ConnectorRoute | undefined> = edges.map(() => undefined)
  for (const [k, i] of found.entries()) {
    const { route, remap } = slanted[k] as (typeof slanted)[number]
    const routeRadii = settled[k] as Array<number>
    const flow = (flows[k] as { placed: ReadonlyArray<PlacedAdornment | undefined> }).placed
    const list = adornments[k] as ReadonlyArray<SolveAdornment>
    const landed = placeAdornments(
      route,
      routeRadii,
      list,
      flow.map((adornment) =>
        adornment === undefined
          ? undefined
          : {
              center: adornment.center,
              direction: adornment.direction,
              along: [remap(adornment.along[0]), remap(adornment.along[1])],
            },
      ),
    )
    // A route of no length, between ports that touch, keeps both its ends.
    const points = route.points.map(([x, y]) => Point.make(x, y))
    const single = points.length === 1
    result[i] = {
      points: single ? [points[0] as Point.Point, points[0] as Point.Point] : points,
      radii: single ? [0, 0] : routeRadii,
      outsets: single ? [0, 0] : (outsets[k] as Array<number>),
      adornments: landed.map((adornment, a) => placementOf(adornment, list[a] as SolveAdornment)),
      merged: [leaders.get(endId(i, 0)) ?? -1, leaders.get(endId(i, 1)) ?? -1],
    }
  }
  return { edges: result, notes }
}

// A placed adornment as the public shape: its upright rect about its
// center, the angle its local x axis turns to, and its stretch of the route.
function placementOf(placed: PlacedAdornment, adornment: SolveAdornment): AdornmentPlacement {
  const width = adornment.x.size
  const height = adornment.y.size
  const [x, y] = placed.center
  const [start, end] = placed.along
  return {
    rect: Rect.make(x - width / 2, y - height / 2, width, height),
    angle:
      placed.direction === undefined ? 0 : Math.atan2(placed.direction[1], placed.direction[0]),
    along: Interval.make(start, end - start),
  }
}
