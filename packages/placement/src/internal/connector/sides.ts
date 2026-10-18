import type * as Rect from '../../rect.ts'
import { within } from '../../utils/tolerance.ts'
import { type Endpoint, type Path, markAlong, searchAll, shortestPath } from '../graph/search.ts'
import { type Pin, visibilityGraph } from '../graph/visibility.ts'
import type { XY } from '../orient.ts'
import {
  type Problem,
  type ProblemEdge,
  facingSides,
  headingOf,
  passage,
  pinOf,
  portOf,
  rectAt,
  tightCostAt,
} from './problem.ts'

// The side selection phase. An auto side is the side of the cheapest route
// over all four candidates, searched on one graph with a port at the middle
// of every candidate side (or at the given position). A candidate with less
// room in front of its port than the end needs for its adornments and
// corner costs more (see `tightCostAt`), so an end comes in on a side with
// room where that costs less than the way around. With merging on, the
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
// let the group settle. The search also yields a trial route, from the
// middle of each side, for every edge with an auto position, which orders
// the ports that share a side.

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
        // A given side has no rival, so its room weighs nothing.
        const cost = side === undefined ? tightCostAt(problem, i, end, s, at ?? 0.5) : 0
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
  const pathOf: Array<Path | undefined> = edges.map(() => undefined)
  // The search options that pull route `k` along its partners' latest
  // paths, each the way it runs or back, within the span of the route's
  // own two rects, so that it never goes out of its way to join one. A
  // passage narrower than the gap holds one route, so it pulls none.
  const pullAlong = (k: number) => {
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
      markAlong(graph, marks, pathOf[edge], back, roomy)
    }
    return { partnerDiscount: pull, partners: marks }
  }
  const { paths } = searchAll(
    graph,
    routed.length,
    crossingCost,
    (k, through, round) => {
      const i = routed[k] as number
      const edge = edges[i] as ProblemEdge
      const [starts, ends] = candidates[k] as [Array<Candidate>, Array<Candidate>]
      const path = shortestPath(graph, starts.map(endpoint), ends.map(endpoint), {
        ...edge.costs,
        avoid: edge.avoid,
        via: edge.viaPins.map((pin) => nodes[pin] as number),
        viaArrivals: edge.viaArrivals,
        viaLeavings: edge.viaLeavings,
        crossingCost: crossingCost,
        ...(through === undefined ? {} : { through }),
        ...(round === 0 ? {} : pullAlong(k)),
      })
      pathOf[i] = path
      return path
    },
    (k) => pull > 0 && (partners[k] as Array<Partner>).length > 0,
    PULL_ROUNDS,
  )
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
    const facing = facingSides(boxes[edge.source] as Rect.Rect, boxes[edge.target] as Rect.Rect)
    sides[i] = [
      path === undefined ? facing[0] : (starts[path.start] as Candidate).side,
      path === undefined ? facing[1] : (ends[path.end] as Candidate).side,
    ]
  }
  return { sides: sides as Array<[number, number]>, trial, tried }
}
