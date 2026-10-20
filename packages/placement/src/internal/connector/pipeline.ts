import { coincident } from 'curvy/number'
import type { AdornmentPlacement } from '../../adornment.ts'
import type { ConnectorLayout, ConnectorNote, ConnectorRoute } from '../../connector.ts'
import * as Interval from '../../interval.ts'
import * as Point from '../../point.ts'
import * as Rect from '../../rect.ts'
import type { PlacedAdornment, SolveAdornment } from '../adornments.ts'
import type { XY } from '../orient.ts'
import { betweenLength, placeAdornments, placeFlow } from './adornments.ts'
import { cornerOutsets, cornerRadii } from './corners.ts'
import { emptyLocks } from './locks.ts'
import { type RouteConstraints, bundled, nudgeRoutes } from './nudge.ts'
import { type SlidingEnd, type SlidingGroup, slideGroups, straightenPorts } from './ports.ts'
import {
  type EdgeEnd,
  type Port,
  type Problem,
  type ProblemEdge,
  endId,
  packAt,
} from './problem.ts'
import { type Route, routeOf } from './route.ts'
import { routeAll } from './routing.ts'
import { chooseSides } from './sides.ts'
import { slantJogs } from './slants.ts'
import { type SharedEnd, placePorts } from './spread.ts'

// The routing pipeline: the phases of `Connector.apply`, each a function
// of the problem and the phases before it.
//
// 1. `chooseSides` picks the side of every auto end, and finds trial routes.
// 2. `placePorts` spreads the auto ports along their sides, with the ends
//    that merge grouped on ports next to each other.
// 3. `routeAll` finds the routes on the final ports, trading ends next to
//    each other when that crosses less.
// 4. `nudge` moves routes that run alongside each other apart.
// 5. `straightenPorts` slides lone auto ports to take out short jogs, and
//    `slideGroups` slides groups of auto ports as one.
// 6. The jogs and corner sizes that later passes leave alone are noted.
// 7. `placeFlow` lays out the flow adornments, whose stretches wall off
//    corners.
// 8. `cornerRadii` sizes the corners, `slantJogs` slants the short jogs,
//    and `cornerRadii` settles the corners again on the routes as drawn.
// 9. `placeAdornments` lands the absolute adornments on the drawn routes.

/**
 * Hears the routes after each phase of `solve`, for diagnostics: the phase
 * (`'search'`, `'nudge'`, `'ports'`, `'slants'`) and one polyline per
 * edge, `undefined` for an edge without a route.
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
  const { ports, cramped } = placed
  const merged = placed.groups.map(({ ends }) => ends.map(({ edge, end }) => ({ edge, end })))

  // The routes, on a graph with the final ports. Ends next to each other on
  // a side, alone or in one group, may trade ports to cross less.
  const lone = (end: EdgeEnd) =>
    !merged.some((members) => members.some((m) => m.edge === end.edge && m.end === end.end))
  const trades: Array<readonly [EdgeEnd, EdgeEnd]> = []
  for (const group of placed.shared.values()) {
    const sorted = group
      .filter(lone)
      .toSorted(
        (a, b) =>
          (placed.positions.get(endId(a.edge, a.end)) ?? 0) -
          (placed.positions.get(endId(b.edge, b.end)) ?? 0),
      )
    for (let k = 1; k < sorted.length; k++) {
      trades.push([sorted[k - 1] as SharedEnd, sorted[k] as SharedEnd])
    }
  }
  for (const members of merged) {
    for (let k = 1; k < members.length; k++) {
      const [a, b] = [members[k - 1] as EdgeEnd, members[k] as EdgeEnd]
      // Ends of different strokes sit different distances apart.
      if ((edges[a.edge] as ProblemEdge).thickness === (edges[b.edge] as ProblemEdge).thickness) {
        trades.push([a, b])
      }
    }
  }
  const { routes, traded } = routeAll(
    problem,
    ports,
    edges.map((_, i) => i),
    obstacles,
    trades,
    merged,
  )
  for (const [a, b] of traded) {
    const [p, q] = [ports[a.edge] as [Port, Port], ports[b.edge] as [Port, Port]]
    ;[p[a.end], q[b.end]] = [q[b.end] as Port, p[a.end] as Port]
  }

  // Nudge the routes that were found, together. The routes of a group stay
  // the merge gap apart while they run together from it.
  const mergeOf = new Map<number, number>()
  for (const [id, members] of merged.entries()) {
    for (const { edge, end } of members) {
      mergeOf.set(endId(edge, end), id)
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
  // neither groups nor belongs to a loop.
  const slides = (i: number, end: number) => {
    const edge = edges[i] as ProblemEdge
    const { at } = edge.ends[end] as ProblemEdge['ends'][number]
    return at === undefined && !mergeOf.has(endId(i, end)) && !edge.loop
  }
  const { routes: nudgedRoutes, crowded } = nudgeRoutes(
    found.map((i) => routes[i] as Array<XY>),
    obstacles,
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
      }
    }),
    mergeGap,
  )
  report('nudge', nudgedRoutes)
  const mergesOf = found.map(
    (i) => [mergeOf.get(endId(i, 0)) ?? -1, mergeOf.get(endId(i, 1)) ?? -1] as const,
  )
  // Auto ports that do not group slide along their sides to take out the
  // short jogs right past them, and then whole groups of auto ports do.
  const strokes = {
    gap: settings.gap,
    reach: found.map((i) => (edges[i] as ProblemEdge).radius),
    thickness: found.map((i) => (edges[i] as ProblemEdge).thickness),
    anchors: found.map((i) => (edges[i] as ProblemEdge).via),
    packs,
    merges: mergesOf,
    mergeGap,
  }
  const alone = straightenPorts(
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
    obstacles,
    strokes,
  )
  const routeOfEdge = new Map(found.map((i, k) => [i, k]))
  // A group of auto ports slides as one, once every member has a route.
  const sliding = merged.flatMap((members): Array<SlidingGroup> => {
    const routed = members.map(({ edge, end }) => ({ route: routeOfEdge.get(edge), end }))
    const first = members[0] as EdgeEnd
    const { rect } = (edges[first.edge] as ProblemEdge).ends[
      first.end
    ] as ProblemEdge['ends'][number]
    if (
      routed.some(({ route }) => route === undefined) ||
      members.some(({ edge, end }) => (edges[edge] as ProblemEdge).ends[end]?.at !== undefined)
    ) {
      return []
    }
    return [
      {
        rect: boxes[rect] as Rect.Rect,
        own: rect,
        side: ((ports[first.edge] as [Port, Port])[first.end] as Port).side,
        members: routed as Array<{ route: number; end: number }>,
      },
    ]
  })
  const straight = slideGroups(alone, sliding, obstacles, strokes)

  report('ports', straight)

  // Where a route leaves a group that goes on without it, the jog that
  // leaves it stays upright. A jog in a bundle turns with it, so it stays
  // upright too. The locks carry these decisions to the passes that size
  // corners and slant jogs.
  const { coupled, parting } = bundled(straight, mergesOf, settings.gap)
  const locks = straight.map((_, k) => {
    const held = emptyLocks()
    for (const corner of parting[k] ?? []) {
      held.upright.add(corner - 1).add(corner)
    }
    for (const segment of coupled[k] ?? []) {
      held.upright.add(segment)
    }
    return held
  })
  // The routes as nudged, which the passes from here on read and never
  // change: each pass that moves points makes new routes.
  const nudged = straight.map((points) => routeOf(points))

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
  const radii = found.map((i) => (edges[i] as ProblemEdge).radius)
  const walls = flows.map((flow) => flow.walls)
  const thickness = found.map((i) => (edges[i] as ProblemEdge).thickness)
  const sizes = cornerRadii(nudged, radii, walls)
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
  // toward its arc, where it is within reach.
  const shaped = slanted.map(({ route }) => route)
  report(
    'slants',
    shaped.map((route) => route.points),
  )
  const settled = cornerRadii(nudged, radii, walls, {
    fixed: slanted.map(({ route: { points }, radii: slantedSizes }, k) => {
      const kept = new Map<number, number>()
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
      rects: channel.obstacles.map((o) => ids[o] as string),
      need: channel.need,
    })
  }
  for (const { ends, rect, side, need } of cramped) {
    notes.push({
      kind: 2,
      edges: [...new Set(ends.map(({ edge }) => edge))].toSorted((a, b) => a - b),
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
      // Grouped ends share no adornments: each route draws its own.
      merged: [-1, -1],
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
