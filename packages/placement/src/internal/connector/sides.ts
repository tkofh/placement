import { coincident } from 'curvy/number'
import type * as Rect from '../../rect.ts'
import { within } from '../../utils/tolerance.ts'
import { channelsOf, congestionFor, fillPath, groupsOf } from '../graph/channels.ts'
import { markCrossedRuns } from '../graph/crossings.ts'
import {
  type Endpoint,
  type Path,
  type SearchContext,
  markAlong,
  markThrough,
  searchAll,
  shortestPath,
} from '../graph/search.ts'
import { type Pin, visibilityGraph } from '../graph/visibility.ts'
import { type XY, outward } from '../orient.ts'
import {
  PRESSURE_ROUNDS,
  type Problem,
  type ProblemEdge,
  facingSides,
  headingOf,
  mergeIds,
  passage,
  pinOf,
  portOf,
  pressureAt,
  rectAt,
  tightCostAt,
} from './problem.ts'

// The side selection phase. An auto side is the side of the cheapest route
// over all four candidates, searched on one graph with a port at the middle
// of every candidate side (or at the given position). A candidate with less
// room in front of its port than the end needs for its adornments and
// corner costs more (see `tightCostAt`), so an end comes in on a side with
// room where that costs less than the way around, and so, a little, does
// one that faces away from where the end's network comes from (see
// `facingCosts`), which settles near-ties so that the routes of a network
// come in, or leave, on the side that faces it. With merging on, the
// routes whose ends at one rect could merge pull each other along: a
// stretch along a partner's route costs a share of its length, so that
// routes group up where a long run together pays for the bend and length
// it takes them to meet, and the routes of a merge come in on one side.
// The pull reaches only within the span of a route's own two rects, so no
// route goes out of its way to join another. The first round of the search
// finds every route on its own, without the pull, so that the pull then
// draws each route toward where its partners would go by themselves: were
// the first route pulled by nothing and the next pulled by it alone, the
// first route's choice would settle a tie for the next, and the two would
// then hold each other there against the rest. Two rounds with the pull
// let the group settle. The trial routes also fill the channels between
// the rects, as the routes do in the search phase (see `routeAll`): an
// approach through a channel too narrow for the routes in it costs more
// by how far over it is, at a pressure that grows over the rounds, so an
// end comes in on a side with room where that costs less in all. The pull
// and that price are costs of one search, so they weigh against each
// other. As in `routeAll`, a route that crosses one found before it on a
// run they share, coming onto the run on one side of it and leaving on
// the other, a crossing the search counts nowhere, is found again with
// the nodes of that run costing the crossing, so that no end takes a side
// for a route that rides over another on a shared line, unseen. The
// search also yields a trial route, from the middle of each
// side, for every edge with an auto position, which orders the ports that
// share a side.

// How many rounds of the search pull the routes along their partners, after
// the first, which pulls none.
const PULL_ROUNDS = 2

/** The sides every end takes, and the trial routes found choosing them. */
export interface Sides {
  /** The side of each edge's source and target ports. */
  readonly sides: ReadonlyArray<readonly [number, number]>
  /** The trial route of each edge, from the middle of its sides, if found. */
  readonly trial: Array<Array<XY> | undefined>
  /** The edges whose trial routes were searched for, found or not. */
  readonly tried: ReadonlySet<number>
}

// An edge whose route another pulls along, the way it runs or back.
interface Partner {
  readonly edge: number
  readonly back: boolean
}

interface Candidate {
  readonly side: number
  readonly pin: number
  readonly outward: number
  // What the end costs on this side for the room it lacks there.
  readonly cost: number
}

/**
 * Chooses the sides of the auto ends of a problem's edges.
 *
 * @param problem - The problem.
 * @returns The sides, and the trial routes found along the way.
 */
export function chooseSides(problem: Problem): Sides {
  const { edges, boxes, obstacles, extraPins, settings, crossingCost, pull } = problem
  const sides = edges.map((edge): [number | undefined, number | undefined] => [
    edge.ends[0].side,
    edge.ends[1].side,
  ])
  const searched = sides.flatMap(([source, target], i) =>
    source === undefined || target === undefined ? [i] : [],
  )
  const trial: Array<Array<XY> | undefined> = edges.map(() => undefined)
  const tried = new Set<number>()
  if (searched.length === 0) {
    return { sides: sides as Array<[number, number]>, trial, tried }
  }
  const auto = new Set(searched)
  const routed = edges.flatMap((edge, i) =>
    auto.has(i) || edge.ends[0].at === undefined || edge.ends[1].at === undefined ? [i] : [],
  )
  const pins: Array<Pin> = [...extraPins]
  const facing = facingCosts(problem)
  const candidates = routed.map((i) => {
    const edge = edges[i] as ProblemEdge
    const [source, target] = sides[i] as [number | undefined, number | undefined]
    const ends = [
      [edge.ends[0].rect, source, edge.ends[0].at, 1],
      [edge.ends[1].rect, target, edge.ends[1].at, -1],
    ] as const
    return ends.map(([owner, side, at, outward], end) =>
      (side === undefined ? [0, 1, 2, 3] : [side]).map((s): Candidate => {
        const port = portOf(problem, owner, s, at ?? 0.5)
        pins.push(pinOf(port, owner))
        // A given side has no rival, so its room and the way it faces
        // weigh nothing.
        const cost =
          side === undefined
            ? tightCostAt(problem, i, end, s, at ?? 0.5) +
              ((facing[i] as Facing)[end] as ReadonlyArray<number>)[s]!
            : 0
        return { side: s, pin: pins.length - 1, outward, cost }
      }),
    )
  })
  const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
  const endpoint = ({ side, pin, outward: scale, cost }: Candidate): Endpoint => ({
    node: nodes[pin] as number,
    headings: [headingOf(side, scale)],
    cost,
  })
  // The routes whose ends at one rect could merge pull each other along,
  // so that they come in on one side.
  const keyAt = (i: number, end: number) => (edges[i] as ProblemEdge).ends[end]?.key
  const partners = routed.map((i) =>
    routed.flatMap((j) =>
      [0, 1].flatMap((end) =>
        [0, 1].flatMap((far): Array<Partner> => {
          const key = keyAt(i, end)
          const meets =
            j !== i &&
            key !== undefined &&
            rectAt(edges[i] as ProblemEdge, end) === rectAt(edges[j] as ProblemEdge, far)
          return meets && key === keyAt(j, far) ? [{ edge: j, back: end !== far }] : []
        }),
      ),
    ),
  )
  // The place of each routed edge among the searched routes.
  const placeOf = new Map(routed.map((i, k) => [i, k]))
  // The search options that pull route `k` along its partners' latest
  // paths, each the way it runs or back, within the span of the route's
  // own two rects, so that it never goes out of its way to join one. A
  // passage narrower than the gap holds one route, so it pulls none.
  const pullAlong = (k: number, paths: ReadonlyArray<Path | undefined>) => {
    const list = partners[k] as Array<Partner>
    if (pull === 0 || list.length === 0) {
      return {}
    }
    const { xs, ys, sources, targets } = graph
    const own = edges[routed[k] as number] as ProblemEdge
    const [from, to] = [boxes[own.source] as Rect.Rect, boxes[own.target] as Rect.Rect]
    const span = {
      left: Math.min(from.left, to.left),
      right: Math.max(from.right, to.right),
      top: Math.min(from.top, to.top),
      bottom: Math.max(from.bottom, to.bottom),
    }
    const spanned = (x: number, y: number) =>
      within(x, span.left, span.right) && within(y, span.top, span.bottom)
    const roomy = (e: number) => {
      const [a, b] = [sources[e] as number, targets[e] as number]
      const [x1, y1, x2, y2] = [xs[a], ys[a], xs[b], ys[b]] as [number, number, number, number]
      return (
        spanned(x1, y1) && spanned(x2, y2) && passage(obstacles, x1, y1, x2, y2) >= settings.gap
      )
    }
    const marks = new Uint8Array(targets.length)
    for (const { edge, back } of list) {
      markAlong(graph, marks, paths[placeOf.get(edge) as number], back, roomy)
    }
    return { partnerDiscount: pull, partners: marks }
  }
  // The routes that could merge fill the channels as one bundle out of
  // their shared port.
  const merges = mergeIds(problem, routed)
  const find = (
    k: number,
    { through, congestion, paths: latest, along }: SearchContext,
    round: number,
  ) => {
    const i = routed[k] as number
    const edge = edges[i] as ProblemEdge
    const [starts, ends] = candidates[k] as [Array<Candidate>, Array<Candidate>]
    return shortestPath(graph, starts.map(endpoint), ends.map(endpoint), {
      ...edge.costs,
      radius: edge.radius,
      avoid: edge.avoid,
      via: edge.viaPins.map((pin) => nodes[pin] as number),
      viaArrivals: edge.viaArrivals,
      viaLeavings: edge.viaLeavings,
      crossingCost: crossingCost,
      ...(through === undefined ? {} : { through }),
      ...(congestion === undefined ? {} : { congestion }),
      ...(along === undefined ? {} : { along }),
      ...(round === 0 ? {} : pullAlong(k, latest)),
    })
  }
  const channels = channelsOf(graph, obstacles)
  const strokeOf = (k: number) => (edges[routed[k] as number] as ProblemEdge).thickness
  const { paths, through, fill } = searchAll(
    graph,
    routed.length,
    crossingCost,
    find,
    (k) => pull > 0 && (partners[k] as Array<Partner>).length > 0,
    PULL_ROUNDS,
    {
      ...channels,
      stroke: strokeOf,
      merges: (k) => merges[k] as [number, number],
      gap: settings.gap,
      mergeGap: problem.mergeGap,
      pressure: pressureAt,
      rounds: PRESSURE_ROUNDS,
    },
  )
  // A route that crosses one found before it on a run they share, which
  // the search counted no crossing for, is found again with the nodes of
  // that run counting the crossing between them, as `routeAll` does. Not
  // so for two that leave or arrive at one port: the runs out of it are
  // their bundle.
  if (through !== undefined && fill !== undefined) {
    for (const [k, path] of paths.entries()) {
      if (path === undefined) {
        continue
      }
      const extra = new Float64Array(through.length)
      let crossed = false
      for (let j = 0; j < k; j++) {
        const other = paths[j]
        if (other !== undefined && !sharePort(path, other)) {
          crossed = markCrossedRuns(graph, path.nodes, other.nodes, extra) || crossed
        }
      }
      if (!crossed) {
        continue
      }
      const groups = groupsOf(routed.length, k, merges[k] as [number, number])
      markThrough(graph, through, path, -1)
      fillPath(graph, channels.slotOf, fill, path, groups, strokeOf(k), -1)
      for (const [slot, count] of through.entries()) {
        const marked = extra[slot] as number
        extra[slot] = marked + count
      }
      const congestion = congestionFor(
        channels,
        fill,
        groups,
        strokeOf(k),
        pressureAt(PRESSURE_ROUNDS),
      )
      paths[k] = find(k, { through: extra, congestion, paths }, PULL_ROUNDS)
      markThrough(graph, through, paths[k], 1)
      fillPath(graph, channels.slotOf, fill, paths[k], groups, strokeOf(k), 1)
    }
  }
  for (const [k, i] of routed.entries()) {
    const [starts, ends] = candidates[k] as [Array<Candidate>, Array<Candidate>]
    const path = paths[k]
    tried.add(i)
    if (path !== undefined) {
      trial[i] = [...path.nodes].map(
        (node): XY => [graph.xs[node] as number, graph.ys[node] as number],
      )
    }
    if (!auto.has(i)) {
      continue
    }
    const edge = edges[i] as ProblemEdge
    const fallback = facingSides(boxes[edge.source] as Rect.Rect, boxes[edge.target] as Rect.Rect)
    sides[i] = [
      path === undefined ? fallback[0] : (starts[path.start] as Candidate).side,
      path === undefined ? fallback[1] : (ends[path.end] as Candidate).side,
    ]
  }
  return { sides: sides as Array<[number, number]>, trial, tried }
}

// Whether two paths leave from or arrive at one node.
const sharePort = (p: Path, q: Path): boolean =>
  [p.nodes[0], p.nodes.at(-1)].some((node) => node === q.nodes[0] || node === q.nodes.at(-1))

/** What an end costs on each side, by side encoding, for the way it faces. */
export type Facing = readonly [source: ReadonlyArray<number>, target: ReadonlyArray<number>]

const FACES_ANY: ReadonlyArray<number> = [0, 0, 0, 0]

/**
 * What each auto end costs on each side for facing away from its network.
 * The network of an end is the edges with an end at its rect the same way:
 * the rect's ingress at a target end, its egress at a source end, loops
 * aside. It comes from the network's center of mass, the mean of the
 * centers of its far-end rects, one per edge. A side costs the problem's
 * `facingCost` times `(1 - n.d) / 2`, where `n` is the side's outward
 * normal and `d` the unit vector from the rect's center to the center of
 * mass: nothing for a side that points straight at it, half for a side at
 * right angles, all of it for the side opposite. A center of mass on the
 * rect's center, and a given side, cost nothing.
 *
 * @param problem - The problem.
 * @returns The cost of each side at the source and target of each edge.
 */
export function facingCosts(problem: Problem): ReadonlyArray<Facing> {
  const { edges, boxes, facingCost } = problem
  // The sums of the far-end centers, and their count, at each rect, for
  // its egress and its ingress.
  const sums = boxes.map(() => [
    [0, 0, 0],
    [0, 0, 0],
  ])
  for (const edge of edges) {
    if (edge.loop) {
      continue
    }
    for (const end of [0, 1]) {
      const far = boxes[rectAt(edge, 1 - end)] as Rect.Rect
      const sum = (sums[rectAt(edge, end)] as Array<Array<number>>)[end] as Array<number>
      const [x, y, count] = sum as [number, number, number]
      sum[0] = x + far.centerX
      sum[1] = y + far.centerY
      sum[2] = count + 1
    }
  }
  return edges.map((edge) => {
    const [source, target] = [0, 1].map((end) => {
      if (edge.loop || edge.ends[end]?.side !== undefined) {
        return FACES_ANY
      }
      const rect = rectAt(edge, end)
      const box = boxes[rect] as Rect.Rect
      const [x, y, count] = (sums[rect] as Array<Array<number>>)[end] as [number, number, number]
      const [cx, cy] = [x / count, y / count]
      if (coincident(cx, box.centerX) && coincident(cy, box.centerY)) {
        return FACES_ANY
      }
      const [dx, dy] = [cx - box.centerX, cy - box.centerY]
      const length = Math.hypot(dx, dy)
      return [0, 1, 2, 3].map((side) => {
        const [nx, ny] = outward(side)
        return (facingCost * (1 - (nx * dx + ny * dy) / length)) / 2
      })
    }) as [ReadonlyArray<number>, ReadonlyArray<number>]
    return [source, target]
  })
}
