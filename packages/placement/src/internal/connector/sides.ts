import type * as Rect from '../../rect.ts'
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
} from './problem.ts'

// The side selection phase. An auto side is the side of the cheapest route
// over all four candidates, searched on one graph with a port at the middle
// of every candidate side (or at the given position). With merging on, the
// routes whose ends at one rect could merge pull each other along, so that
// they come in on one side. The search also yields a trial route, from the
// middle of each side, for every edge with an auto position, which orders
// the ports that share a side.

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
    return ends.map(([owner, side, at, outward]) =>
      (side === undefined ? [0, 1, 2, 3] : [side]).map((s): Candidate => {
        const port = portOf(problem, owner, s, at ?? 0.5)
        pins.push(pinOf(port, owner))
        return { side: s, pin: pins.length - 1, outward }
      }),
    )
  })
  const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
  const endpoint = ({ side, pin, outward: scale }: Candidate): Endpoint => ({
    node: nodes[pin] as number,
    headings: [headingOf(side, scale)],
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
  // paths, each the way it runs or back. A passage narrower than the gap
  // holds one route, so it pulls none.
  const pullAlong = (k: number) => {
    const list = partners[k] as Array<Partner>
    if (pull === 0 || list.length === 0) {
      return {}
    }
    const { xs, ys, sources, targets } = graph
    const roomy = (e: number) => {
      const [a, b] = [sources[e] as number, targets[e] as number]
      const [x1, y1, x2, y2] = [xs[a], ys[a], xs[b], ys[b]] as [number, number, number, number]
      return passage(obstacles, x1, y1, x2, y2) >= settings.gap
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
    (k, through) => {
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
        ...pullAlong(k),
      })
      pathOf[i] = path
      return path
    },
    (k) => pull > 0 && (partners[k] as Array<Partner>).length > 0,
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
