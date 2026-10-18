import { coincident } from 'curvy/number'
import type { AdornmentPlacement } from '../../adornment.ts'
import type { ConnectorLayout, ConnectorNote, ConnectorRoute } from '../../connector.ts'
import * as Interval from '../../interval.ts'
import * as Point from '../../point.ts'
import * as Rect from '../../rect.ts'
import { type PlacedAdornment, type SolveAdornment, lengths } from '../adornments.ts'
import { type XY, segmentBox } from '../orient.ts'
import { placeAdornments, placeFlow } from './adornments.ts'
import { cornerInsets, cornerRadii } from './corners.ts'
import { type Locks, emptyLocks, shiftLocks } from './locks.ts'
import { addWhisk, planMerges, stepped } from './merge.ts'
import { type RouteConstraints, coupledSegments, nudgeRoutes, partingCorners } from './nudge.ts'
import { type SlidingEnd, straightenPorts } from './ports.ts'
import {
  type EdgeEnd,
  type Port,
  type Problem,
  type ProblemEdge,
  endId,
  packAt,
} from './problem.ts'
import { routeAll } from './routing.ts'
import { chooseSides } from './sides.ts'
import { slantJogs } from './slants.ts'
import { type SharedEnd, placePorts } from './spread.ts'

// The routing pipeline: the phases of `Connector.apply`, each a function
// of the problem and the phases before it.
//
// 1. `chooseSides` picks the side of every auto end, and finds trial routes.
// 2. `placePorts` spreads the auto ports along their sides and groups the
//    ends that merge.
// 3. `planMerges` lays out the lanes and whisks of each merge, and walls
//    off the whisks.
// 4. `routeAll` finds the routes on the final ports, trading ends next to
//    each other when that crosses less.
// 5. `nudge` moves routes that run alongside each other apart.
// 6. `straightenPorts` slides auto ports to take out short jogs.
// 7. The whisks lead merged ends onto their shared ports, and the jogs and
//    corners that later passes leave alone are noted.
// 8. `placeFlow` lays out the flow adornments, whose stretches wall off
//    corners.
// 9. `cornerRadii` sizes the corners, `slantJogs` slants the short jogs,
//    and `cornerRadii` settles the corners again on the routes as drawn.
// 10. `placeAdornments` lands the absolute adornments on the drawn routes.

/**
 * Solves a routing problem.
 *
 * @param problem - The problem, from `normalize`.
 * @returns One route per edge.
 */
export function solve(problem: Problem): ConnectorLayout {
  const { ids, edges, boxes, obstacles, settings, mergeGap } = problem
  const chosen = chooseSides(problem)
  const placed = placePorts(problem, chosen)
  const plan = planMerges(problem, placed.ports, placed.merges)
  const { ports, whisks, merged, blocks, cramped } = plan

  // The routes, on a graph with the final ports. Ends next to each other on
  // a side, alone or as lanes of one merge, may trade ports to cross less.
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
  for (const members of merged) {
    for (let k = 1; k < members.length; k++) {
      const [a, b] = [members[k - 1] as EdgeEnd, members[k] as EdgeEnd]
      // Lanes of different strokes sit different distances apart.
      if ((edges[a.edge] as ProblemEdge).thickness === (edges[b.edge] as ProblemEdge).thickness) {
        trades.push([a, b])
      }
    }
  }
  const { routes, traded } = routeAll(
    problem,
    ports,
    edges.map((_, i) => i),
    blocks,
    trades,
  )
  for (const [a, b] of traded) {
    const [p, q] = [ports[a.edge] as [Port, Port], ports[b.edge] as [Port, Port]]
    ;[p[a.end], q[b.end]] = [q[b.end] as Port, p[a.end] as Port]
    const [ka, kb] = [endId(a.edge, a.end), endId(b.edge, b.end)]
    const [wa, wb] = [whisks.get(ka), whisks.get(kb)]
    if (wa !== undefined && wb !== undefined) {
      whisks.set(ka, wb)
      whisks.set(kb, wa)
    }
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
  // the merge gap apart while they run together from it.
  const mergeOf = new Map<number, number>()
  for (const [id, members] of merged.entries()) {
    for (const { edge, end } of members) {
      mergeOf.set(endId(edge, end), id)
    }
  }
  const found = routes.flatMap((route, i) => (route === undefined ? [] : [i]))
  const edgeOf = (k: number) => edges[found[k] as number] as ProblemEdge
  const { routes: nudgedRoutes, crowded } = nudgeRoutes(
    found.map((i) => routes[i] as Array<XY>),
    blocks,
    settings.gap,
    found.map((i): RouteConstraints => {
      const edge = edges[i] as ProblemEdge
      return {
        anchors: edge.via,
        avoid: edge.avoid,
        jogAt: edge.jogAt,
        merges: [mergeOf.get(endId(i, 0)) ?? -1, mergeOf.get(endId(i, 1)) ?? -1],
        thickness: edge.thickness,
        corner: edge.radius,
        slant: settings.jogSlant,
        packs: [0, 1].map((end) =>
          packAt(problem, i, end, ((ports[i] as [Port, Port])[end] as Port).side),
        ) as [number, number],
      }
    }),
    mergeGap,
  )
  // Auto ports that do not merge slide along their sides to take out the
  // short jogs right past them.
  const straight = straightenPorts(
    nudgedRoutes,
    found.map((i) => {
      const edge = edges[i] as ProblemEdge
      return [0, 1].map((end) => {
        const { rect, at } = edge.ends[end] as ProblemEdge['ends'][number]
        if (at !== undefined || mergeOf.has(endId(i, end)) || edge.loop) {
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
    },
  )

  // Merged ends lead from their lanes to the shared port. Their steps keep
  // the corners they were given, so nothing slants them further. Where a
  // route leaves a group that goes on without it, it turns as tight as the
  // merge allows, and the jog that leaves it stays upright. A jog in a
  // bundle turns with it, so it stays upright too. The locks carry these
  // decisions to the passes that size corners and slant jogs.
  const mergesOf = found.map(
    (i) => [mergeOf.get(endId(i, 0)) ?? -1, mergeOf.get(endId(i, 1)) ?? -1] as const,
  )
  const parting = partingCorners(straight, mergesOf)
  const coupled = coupledSegments(straight, mergesOf)
  const dressed = straight.map((route, k) => {
    const i = found[k] as number
    let locks = emptyLocks()
    for (const corner of parting[k] ?? []) {
      locks.parting.add(corner)
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
  const nudged = dressed.map(({ points }) => points)
  const locks = dressed.map(({ locks: held }) => held)

  // Flow adornments wall off corners, and absolute ones land on the route
  // as drawn, with its corners sized.
  const adornments = found.map((i) => (edges[i] as ProblemEdge).adornments)
  const cumulative = nudged.map((route) => lengths(route))
  // The segments of every route, as boxes, that the flow adornments between
  // the ports of other routes look for clear stretches among.
  // Each takes the width of its stroke.
  const segments = nudged.map((route, k) => {
    const half = edgeOf(k).thickness / 2
    return route.slice(1).map((b, i) => segmentBox(route[i] as XY, b, half))
  })
  const flows = nudged.map((route, k) => {
    const between = (adornments[k] as ReadonlyArray<SolveAdornment>).some(
      (adornment) => adornment.flow && !coincident(adornment.at, 0) && !coincident(adornment.at, 1),
    )
    return placeFlow(
      route,
      cumulative[k] as Array<number>,
      adornments[k] as ReadonlyArray<SolveAdornment>,
      {
        radius: edgeOf(k).radius,
        gap: settings.adornmentGap,
        justify: settings.justifyAdornments,
        space: settings.justifyAdornmentsSpace,
        spaceOuter: settings.justifyAdornmentsSpaceOuter,
        clear: settings.gap,
      },
      between ? segments.flatMap((list, other) => (other === k ? [] : list)) : [],
    )
  })
  // The steps keep the corners they were given, and nest with nothing.
  const radii = found.map((i) => (edges[i] as ProblemEdge).radius)
  const walls = flows.map((flow) => flow.walls)
  const thickness = found.map((i) => (edges[i] as ProblemEdge).thickness)
  // The tightest a merged route turns: the merge gap inside its stroke.
  const turning = thickness.map((width) => mergeGap + width / 2)
  const tight = { thickness, exits: locks.map((held) => held.parting), turning }
  const sizes = cornerRadii(nudged, radii, walls, {
    fixed: locks.map((held) => held.cornerSize),
    ...tight,
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
  // with its arc.
  const shaped = slanted.map(({ points }) => points)
  const settled = cornerRadii(nudged, radii, walls, {
    fixed: slanted.map(({ points, radii: slantedSizes }, k) => {
      const kept = new Map((locks[k] as Locks).cornerSize)
      const orthogonal = nudged[k] as ReadonlyArray<XY>
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
    ...tight,
  })
  const insets = cornerInsets(nudged, settled, shaped)

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
    const { points: route, remap } = slanted[k] as (typeof slanted)[number]
    const routeRadii = settled[k] as Array<number>
    const flow = (flows[k] as { placed: ReadonlyArray<PlacedAdornment | undefined> }).placed
    const list = adornments[k] as ReadonlyArray<SolveAdornment>
    const landed = placeAdornments(
      route,
      lengths(route),
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
    result[i] = {
      points: route.map(([x, y]) => Point.make(x, y)),
      radii: routeRadii,
      insets: insets[k] as Array<number>,
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
