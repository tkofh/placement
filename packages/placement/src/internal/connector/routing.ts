import { coincident } from 'curvy/number'
import { crossingsBetween } from '../graph/crossings.ts'
import type { Graph, Obstacle } from '../graph/graph.ts'
import { type Path, markThrough, searchAll, shortestPath } from '../graph/search.ts'
import { type Pin, visibilityGraph } from '../graph/visibility.ts'
import type { XY } from '../orient.ts'
import {
  type EdgeEnd,
  type Port,
  type Problem,
  type ProblemEdge,
  headingOf,
  pinOf,
} from './problem.ts'

// The search phase: the routes of edges between given ports, on the
// visibility graph of the obstacles and those ports, found one among the
// others so that they cross as little as they can afford, with ends next
// to each other traded when that crosses less.
//
// Routes may share runs, since nudging moves them apart, but not the runs
// it cannot move: a route's first and last segments, out of its ports, and
// the segments through its waypoints. A route whose waypoints hold a run
// on such a run of another is found again with that run's nodes costing
// crossings, so it goes around instead.

// How many crossings each node of a run that nudging cannot move counts as
// for a route that would run along it on a held run of its own: enough
// that two more corners cost less than one node shared, since a route
// that comes onto the run straight shares at least the node it comes on
// at.
const HELD_RUN = 6

/** The routes a search found, and the trades it made. */
export interface Routed {
  /** Each edge's route, or `undefined` for one with no path. */
  readonly routes: Array<Array<XY> | undefined>
  /** The pairs of ends that traded ports. */
  readonly traded: Array<readonly [EdgeEnd, EdgeEnd]>
}

/**
 * Routes the edges `which`, on a graph with the given ports, among the given
 * obstacles. Where the routes from two ends in `trades`, next to each other
 * on one side, cross each other, the ends trade ports when that leaves
 * fewer crossings among all the routes, and the traded pairs come back
 * with the routes.
 *
 * @param problem - The problem.
 * @param ports - The ports of every edge.
 * @param which - The edges to route.
 * @param blocks - The obstacles, the problem's by default.
 * @param trades - The pairs of ends that may trade ports.
 * @returns The routes, by edge, and the trades made.
 */
export function routeAll(
  problem: Problem,
  ports: ReadonlyArray<readonly [Port, Port]>,
  which: ReadonlyArray<number>,
  blocks: ReadonlyArray<Obstacle> = problem.obstacles,
  trades: ReadonlyArray<readonly [EdgeEnd, EdgeEnd]> = [],
): Routed {
  const { edges, extraPins, crossingCost } = problem
  const pins: Array<Pin> = [...extraPins]
  for (const [i, edge] of edges.entries()) {
    const [source, target] = ports[i] as readonly [Port, Port]
    pins.push(pinOf(source, edge.source))
    pins.push(pinOf(target, edge.target))
  }
  const { graph, pins: nodes } = visibilityGraph(blocks, pins)
  // The pin each end leaves from or arrives at, which trades swap.
  const pinOfEnd = edges.map((_, i) => [extraPins.length + 2 * i, extraPins.length + 2 * i + 1])
  const paths: Array<Path | undefined> = edges.map(() => undefined)
  // The nodes of each edge's waypoints, and the held runs of others that
  // an edge's own held runs were found along, as crossing counts.
  const waypoints = edges.map((edge) => new Set(edge.viaPins.map((pin) => nodes[pin] as number)))
  const shared = new Map<number, Int32Array>()
  const search = (i: number, counted: ArrayLike<number> | undefined) => {
    const edge = edges[i] as ProblemEdge
    const [source, target] = ports[i] as readonly [Port, Port]
    const [start, end] = pinOfEnd[i] as [number, number]
    const extra = shared.get(i)
    let through = counted
    if (extra !== undefined && counted !== undefined) {
      const sum = new Int32Array(extra.length)
      for (let k = 0; k < sum.length; k++) {
        sum[k] = (counted[k] as number) + (extra[k] as number)
      }
      through = sum
    }
    // Ports that touch, where two rects meet, make a route of no length.
    if (nodes[start] === nodes[end] && edge.viaPins.length === 0) {
      return { nodes: Int32Array.of(nodes[start] as number), cost: 0, start: 0, end: 0 }
    }
    return shortestPath(
      graph,
      [{ node: nodes[start] as number, headings: [headingOf(source.side, 1)] }],
      [{ node: nodes[end] as number, headings: [headingOf(target.side, -1)] }],
      {
        ...edge.costs,
        avoid: edge.avoid,
        via: edge.viaPins.map((pin) => nodes[pin] as number),
        viaArrivals: edge.viaArrivals,
        viaLeavings: edge.viaLeavings,
        crossingCost: crossingCost,
        ...(through === undefined ? {} : { through }),
      },
    )
  }
  const found = searchAll(graph, which.length, crossingCost, (k, through) =>
    search(which[k] as number, through),
  )
  for (const [k, i] of which.entries()) {
    paths[i] = found.paths[k]
  }
  const through = found.through
  if (through !== undefined) {
    // A path whose waypoints hold a run along a held run of another's goes
    // around it instead.
    for (const i of which) {
      const path = paths[i]
      if (path === undefined || (waypoints[i] as Set<number>).size === 0) {
        continue
      }
      const extra = new Int32Array(through.length)
      let along = false
      for (const [j, other] of paths.entries()) {
        if (j === i || other === undefined) {
          continue
        }
        for (const run of heldRuns(graph, other, waypoints[j] as Set<number>, true)) {
          if (
            runsAlong(path, heldRuns(graph, path, waypoints[i] as Set<number>, false), other, run)
          ) {
            along = true
            const [from, to] = run
            const vertical = coincident(
              graph.xs[other.nodes[from] as number] as number,
              graph.xs[other.nodes[to] as number] as number,
            )
            for (let m = from; m <= to; m++) {
              const slot = 2 * (other.nodes[m] as number) + (vertical ? 0 : 1)
              const count = extra[slot] as number
              extra[slot] = count + HELD_RUN
            }
          }
        }
      }
      if (along) {
        shared.set(i, extra)
        markThrough(graph, through, path, -1)
        paths[i] = search(i, through)
        markThrough(graph, through, paths[i], 1)
      }
    }
  }
  const pointsOf = (path: Path | undefined) =>
    path === undefined
      ? undefined
      : [...path.nodes].map((node): XY => [graph.xs[node] as number, graph.ys[node] as number])
  const routes = paths.map(pointsOf)
  const traded: Array<readonly [EdgeEnd, EdgeEnd]> = []
  if (through === undefined) {
    return { routes, traded }
  }
  // How many times the routes of edges `a` and `b` cross any route.
  const crossingsOf = (a: number, b: number) => {
    const cross = (i: number, k: number) => {
      const p = paths[i]?.nodes
      const q = paths[k]?.nodes
      return p === undefined || q === undefined ? 0 : crossingsBetween(graph, p, q)
    }
    let count = cross(a, b)
    for (const k of paths.keys()) {
      if (k !== a && k !== b) {
        count += cross(a, k) + cross(b, k)
      }
    }
    return count
  }
  for (const pair of trades) {
    const [a, b] = pair
    const pa = paths[a.edge]?.nodes
    const pb = paths[b.edge]?.nodes
    if (
      a.edge === b.edge ||
      pa === undefined ||
      pb === undefined ||
      crossingsBetween(graph, pa, pb) === 0
    ) {
      continue
    }
    const held = [paths[a.edge], paths[b.edge]] as const
    const before = crossingsOf(a.edge, b.edge)
    const swap = () => {
      const ends = [pinOfEnd[a.edge] as Array<number>, pinOfEnd[b.edge] as Array<number>]
      const pin = ends[0]?.[a.end] as number
      ;(ends[0] as Array<number>)[a.end] = ends[1]?.[b.end] as number
      ;(ends[1] as Array<number>)[b.end] = pin
    }
    swap()
    markThrough(graph, through, held[0], -1)
    markThrough(graph, through, held[1], -1)
    for (const i of [a.edge, b.edge]) {
      paths[i] = search(i, through)
      markThrough(graph, through, paths[i], 1)
      routes[i] = pointsOf(paths[i])
    }
    if (
      paths[a.edge] !== undefined &&
      paths[b.edge] !== undefined &&
      crossingsOf(a.edge, b.edge) < before
    ) {
      traded.push(pair)
      continue
    }
    swap()
    for (const [k, i] of [a.edge, b.edge].entries()) {
      markThrough(graph, through, paths[i], -1)
      paths[i] = held[k]
      markThrough(graph, through, paths[i], 1)
      routes[i] = pointsOf(paths[i])
    }
  }
  return { routes, traded }
}

// The straight runs of a path that nudging cannot move, as ranges of
// indices into its nodes: those through its waypoints, and with `ports`,
// its first and last, out of its ports.
function heldRuns(
  graph: Graph,
  path: Path,
  waypoints: ReadonlySet<number>,
  ports: boolean,
): Array<readonly [number, number]> {
  const { nodes } = path
  const { xs, ys } = graph
  const count = nodes.length
  const runs: Array<readonly [number, number]> = []
  let start = 0
  for (let k = 1; k < count; k++) {
    const last = k + 1 === count
    if (!last) {
      const [a, b, c] = [nodes[k - 1] as number, nodes[k] as number, nodes[k + 1] as number]
      const straight =
        (coincident(xs[a] as number, xs[b] as number) &&
          coincident(xs[b] as number, xs[c] as number)) ||
        (coincident(ys[a] as number, ys[b] as number) &&
          coincident(ys[b] as number, ys[c] as number))
      if (straight) {
        continue
      }
    }
    runs.push([start, k])
    start = k
  }
  return runs.filter(
    ([from, to], r) =>
      (ports && (r === 0 || r === runs.length - 1)) ||
      nodes.subarray(from, to + 1).some((node) => waypoints.has(node)),
  )
}

// Whether any of the given runs of a path shares an edge with the run
// `[from, to]` of another path.
function runsAlong(
  path: Path,
  runs: ReadonlyArray<readonly [number, number]>,
  other: Path,
  [from, to]: readonly [number, number],
): boolean {
  const at = new Map<number, number>()
  for (let m = from; m <= to; m++) {
    at.set(other.nodes[m] as number, m)
  }
  return runs.some(([start, end]) => {
    for (let m = start; m < end; m++) {
      const p = at.get(path.nodes[m] as number)
      const q = at.get(path.nodes[m + 1] as number)
      if (p !== undefined && q !== undefined && Math.abs(p - q) === 1) {
        return true
      }
    }
    return false
  })
}
