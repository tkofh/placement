import { coincident } from 'curvy/number'
import { atMost, before, overlaps, within } from '../../utils/tolerance.ts'
import { crossingsBetween } from '../graph/crossings.ts'
import type { Graph, Obstacle } from '../graph/graph.ts'
import { type Path, markThrough, searchAll, shortestPath } from '../graph/search.ts'
import { type Pin, visibilityGraph } from '../graph/visibility.ts'
import { type Axis, type XY, hi, lo, other } from '../orient.ts'
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
// crossings, so it goes around instead. Nor can nudging move a route off a
// held run when a wall pens it in: a route that runs alongside a held run
// in the strip between it and an obstacle too narrow for the gap and the
// two strokes could only be moved into the obstacle or across the held
// run, and so could one on the held run's line that nudging would move
// into that strip, the side its neighbors come from. The nodes there cost
// such a route crossings too, so it crosses or goes around instead of
// lying on the other route.

// How many crossings each node of a run that nudging cannot move, or of a
// strip beside one, counts as for a route that could not be nudged off it:
// enough that two more corners cost less than one node shared, since a
// route that comes onto the run straight shares at least the node it
// comes on at.
const HELD_RUN = 6

// A run that nudging cannot move, with the room beside it: the nearest
// obstacle on either side of it, among those beside it, and the nodes in
// the strip between the run's line and each, and on the line itself, within
// the run's extent.
interface Held {
  readonly vertical: boolean
  // The line's coordinate across it, and the run's extent along it.
  readonly at: number
  readonly a0: number
  readonly a1: number
  // The nearest obstacle's edge below and above the line, or infinite.
  readonly low: number
  readonly high: number
  readonly lowStrip: ReadonlyArray<number>
  readonly highStrip: ReadonlyArray<number>
  readonly line: ReadonlyArray<number>
}

// A straight run of a path, as a range of indices into its nodes.
type Run = readonly [number, number]

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
    // The held runs of each path, with the room beside them, found when
    // first needed and again after the path is found again.
    const held: Array<Array<Held> | undefined> = []
    const heldOf = (j: number) => {
      let list = held[j]
      if (list === undefined) {
        const path = paths[j]
        list =
          path === undefined
            ? []
            : heldRuns(graph, path, waypoints[j] as Set<number>, true).map((run) =>
                heldBeside(graph, path, run, blocks),
              )
        held[j] = list
      }
      return list
    }
    // A path whose waypoints hold a run along a held run of another's, or
    // that runs along or beside a held run of another's where nudging
    // could not move it off, goes around instead.
    for (const i of which) {
      const path = paths[i]
      if (path === undefined) {
        continue
      }
      const thickness = (edges[i] as ProblemEdge).thickness
      const extra = new Int32Array(through.length)
      const mark = (nodes: ReadonlyArray<number>, vertical: boolean) => {
        for (const node of nodes) {
          const slot = 2 * node + (vertical ? 0 : 1)
          const count = extra[slot] as number
          extra[slot] = count + HELD_RUN
        }
      }
      let along = false
      const runs = runsOf(graph, path)
      const ownHeld = heldRuns(graph, path, waypoints[i] as Set<number>, true)
      for (const [j, other] of paths.entries()) {
        if (j === i || other === undefined) {
          continue
        }
        const need = problem.settings.gap + (thickness + (edges[j] as ProblemEdge).thickness) / 2
        for (const run of heldOf(j)) {
          if (before(run.at - run.low, need)) {
            mark(run.lowStrip, run.vertical)
          }
          if (before(run.high - run.at, need)) {
            mark(run.highStrip, run.vertical)
          }
          if (
            runs.some((own, r) =>
              stuckAlong(graph, path, runs, r, ownHeld.includes(own), run, need),
            )
          ) {
            along = true
            mark(run.line, run.vertical)
          }
        }
        if ((waypoints[i] as Set<number>).size === 0) {
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
            mark([...other.nodes.subarray(from, to + 1)], vertical)
          }
        }
      }
      if (along || runsThrough(graph, path, extra)) {
        shared.set(i, extra)
        markThrough(graph, through, path, -1)
        paths[i] = search(i, through)
        markThrough(graph, through, paths[i], 1)
        held[i] = undefined
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

// The straight runs of a path, as ranges of indices into its nodes.
function runsOf(graph: Graph, path: Path): Array<Run> {
  const { nodes } = path
  const { xs, ys } = graph
  const count = nodes.length
  const runs: Array<Run> = []
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
  return runs
}

// The straight runs of a path that nudging cannot move: those through its
// waypoints, and with `ports`, its first and last, out of its ports.
function heldRuns(
  graph: Graph,
  path: Path,
  waypoints: ReadonlySet<number>,
  ports: boolean,
): Array<Run> {
  const runs = runsOf(graph, path)
  return runs.filter(
    ([from, to], r) =>
      (ports && (r === 0 || r === runs.length - 1)) ||
      path.nodes.subarray(from, to + 1).some((node) => waypoints.has(node)),
  )
}

// The room beside the run `[from, to]` of a path that nudging cannot move:
// the nearest obstacle on either side of its line, among the obstacles
// beside the run, and the nodes in the strip between the line and each,
// and on the line, within the run's extent. An obstacle the line runs
// through, such as the one the run's own port sits on, is on neither side.
function heldBeside(
  graph: Graph,
  path: Path,
  [from, to]: Run,
  obstacles: ReadonlyArray<Obstacle>,
): Held {
  const { xs, ys } = graph
  const [a, b] = [path.nodes[from] as number, path.nodes[to] as number]
  const vertical = coincident(xs[a] as number, xs[b] as number)
  const across: Axis = vertical ? 0 : 1
  const along = other(across)
  const at = vertical ? (xs[a] as number) : (ys[a] as number)
  const [a0, a1] = vertical
    ? [Math.min(ys[a] as number, ys[b] as number), Math.max(ys[a] as number, ys[b] as number)]
    : [Math.min(xs[a] as number, xs[b] as number), Math.max(xs[a] as number, xs[b] as number)]
  let low = Number.NEGATIVE_INFINITY
  let high = Number.POSITIVE_INFINITY
  for (const o of obstacles) {
    if (!overlaps(lo(o, along), hi(o, along), a0, a1)) {
      continue
    }
    if (atMost(hi(o, across), at)) {
      low = Math.max(low, hi(o, across))
    } else if (atMost(at, lo(o, across))) {
      high = Math.min(high, lo(o, across))
    }
  }
  const lowStrip: Array<number> = []
  const highStrip: Array<number> = []
  const line: Array<number> = []
  for (let node = 0; node < xs.length; node++) {
    const c = vertical ? (xs[node] as number) : (ys[node] as number)
    const l = vertical ? (ys[node] as number) : (xs[node] as number)
    if (!within(l, a0, a1)) {
      continue
    }
    if (coincident(c, at)) {
      line.push(node)
    } else if (within(c, low, at)) {
      lowStrip.push(node)
    } else if (within(c, at, high)) {
      highStrip.push(node)
    }
  }
  return { vertical, at, a0, a1, low, high, lowStrip, highStrip, line }
}

// Whether run `r` of a path lies along a held run of another path where
// nudging could not move it off: on the held run's line, over part of its
// extent, and either held itself, or bound for a side of the line without
// room for it. A free run goes to the side its neighbors come from, which
// crosses the held run nowhere: where its neighbors meet it within the held
// run's extent, they come from that side, and where they meet it outside,
// they leave the side open. Neighbors from both sides leave the run a
// crossing either way, and it must then fit on whichever side it takes.
function stuckAlong(
  graph: Graph,
  path: Path,
  runs: ReadonlyArray<Run>,
  r: number,
  heldToo: boolean,
  held: Held,
  need: number,
): boolean {
  const { xs, ys } = graph
  const [from, to] = runs[r] as Run
  const [a, b] = [path.nodes[from] as number, path.nodes[to] as number]
  const vertical = coincident(xs[a] as number, xs[b] as number)
  const acrossOf = (node: number) => (held.vertical ? xs[node] : ys[node]) as number
  const alongOf = (node: number) => (held.vertical ? ys[node] : xs[node]) as number
  if (
    vertical !== held.vertical ||
    coincident(alongOf(a), alongOf(b)) ||
    !coincident(acrossOf(a), held.at)
  ) {
    return false
  }
  const [r0, r1] = [Math.min(alongOf(a), alongOf(b)), Math.max(alongOf(a), alongOf(b))]
  if (!overlaps(r0, r1, held.a0, held.a1)) {
    return false
  }
  if (heldToo) {
    return true
  }
  const roomy = (side: number) => !before(side < 0 ? held.at - held.low : held.high - held.at, need)
  // The sides the run's neighbors come from, where they meet it within the
  // held run's extent.
  const sides = new Set<number>()
  for (const [neighbor, junction] of [
    [runs[r - 1], a],
    [runs[r + 1], b],
  ] as const) {
    if (neighbor === undefined || !within(alongOf(junction), held.a0, held.a1)) {
      continue
    }
    const [n0, n1] = neighbor
    const far = path.nodes[path.nodes[n0] === junction ? n1 : n0] as number
    const side = Math.sign(acrossOf(far) - held.at)
    if (side !== 0) {
      sides.add(side)
    }
  }
  if (sides.size === 0) {
    return !roomy(-1) && !roomy(1)
  }
  return [...sides].some((side) => !roomy(side))
}

// Whether a path runs straight on through a node that `counts` marks on
// its own axis, the way the search reads them (see `SearchOptions.through`).
function runsThrough(graph: Graph, path: Path, counts: Int32Array): boolean {
  const { xs, ys } = graph
  const { nodes } = path
  for (let k = 1; k + 1 < nodes.length; k++) {
    const [a, b, c] = [nodes[k - 1] as number, nodes[k] as number, nodes[k + 1] as number]
    const horizontal =
      (ys[a] as number) === (ys[b] as number) &&
      (ys[b] as number) === (ys[c] as number) &&
      ((xs[b] as number) - (xs[a] as number)) * ((xs[c] as number) - (xs[b] as number)) > 0
    const vertical =
      (xs[a] as number) === (xs[b] as number) &&
      (xs[b] as number) === (xs[c] as number) &&
      ((ys[b] as number) - (ys[a] as number)) * ((ys[c] as number) - (ys[b] as number)) > 0
    if (
      (horizontal && (counts[2 * b + 1] as number) > 0) ||
      (vertical && (counts[2 * b] as number) > 0)
    ) {
      return true
    }
  }
  return false
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
