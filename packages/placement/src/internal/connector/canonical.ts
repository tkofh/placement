import type { Adornment } from '../../adornment.ts'
import type {
  ConnectorApplyOptions,
  ConnectorEdgeOptions,
  ConnectorLayout,
  ConnectorNote,
  ConnectorRoute,
  ConnectorWaypoint,
} from '../../connector.ts'
import type { Edge } from '../../edge.ts'
import type * as Point from '../../point.ts'
import type * as Rect from '../../rect.ts'
import { type Trace, solve } from './pipeline.ts'
import { type Problem, type Settings, compareIds, normalize } from './problem.ts'

// The canonical order of a routing problem. Every phase breaks its ties by
// the index of a rect or an edge. `normalize` indexes the rects in the
// order of their ids, and `route` hands it the edges in an order of their
// own, then maps what the pipeline returns back to the order they came in.
// The routes then depend on the graph and never on how it was listed: an
// edge removed and added back at the end routes as before. The edges go
// center first, by the eccentricity of their rects, which reads only the
// connections, so moving a rect never reorders them; then by their ids,
// and then by the rest of their specs and options, so that parallel edges
// keep their own routes. Edges equal in all of that route alike, and keep
// the order they came in.
//
// The orders here are orders of inputs, not geometric decisions, so they
// compare exactly: two numbers are equal when they are the same number.

// A total order on numbers: by value, `-0` before `0`, and `NaN` last.
const compareNumbers = (a: number, b: number): number => {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return Number(Number.isNaN(a)) - Number(Number.isNaN(b))
  }
  return Object.is(a, b) ? 0 : Object.is(a, -0) ? -1 : 1
}

// An order on optional values, unset first.
const optional =
  <T>(compare: (a: T, b: T) => number) =>
  (a: T | undefined, b: T | undefined): number =>
    a === undefined ? (b === undefined ? 0 : -1) : b === undefined ? 1 : compare(a, b)

// An order on lists, element by element, a list before the longer lists it
// starts.
const lists =
  <T>(compare: (a: T, b: T) => number) =>
  (a: ReadonlyArray<T>, b: ReadonlyArray<T>): number => {
    for (let k = 0; k < a.length && k < b.length; k++) {
      const order = compare(a[k] as T, b[k] as T)
      if (order !== 0) {
        return order
      }
    }
    return a.length - b.length
  }

// The first nonzero of a list of comparisons, evaluated in turn.
const by = (...orders: ReadonlyArray<() => number>): number => {
  for (const order of orders) {
    const result = order()
    if (result !== 0) {
      return result
    }
  }
  return 0
}

const maybeNumbers = optional(compareNumbers)
const maybeIds = optional(compareIds)

// The fields of an adornment's frame that routing reads.
const FRAME_FIELDS = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'offsetTop',
  'offsetRight',
  'offsetBottom',
  'offsetLeft',
  'align',
] as const

const compareAdornments = lists((a: Adornment, b: Adornment): number => {
  const order = by(
    () => compareNumbers(a.at, b.at),
    () => compareNumbers(a.position, b.position),
    () => compareNumbers(a.layer, b.layer),
    () => compareNumbers(a.orient, b.orient),
    () => maybeIds(a.frame.id, b.frame.id),
  )
  if (order !== 0) {
    return order
  }
  for (const field of FRAME_FIELDS) {
    const next = compareNumbers(a.frame[field], b.frame[field])
    if (next !== 0) {
      return next
    }
  }
  return 0
})

const comparePoints = optional((a: Point.PointLike, b: Point.PointLike): number =>
  by(
    () => compareNumbers(a.x, b.x),
    () => compareNumbers(a.y, b.y),
  ),
)

const compareWaypoints = lists((a: ConnectorWaypoint, b: ConnectorWaypoint): number =>
  by(
    () => compareNumbers(a.x, b.x),
    () => compareNumbers(a.y, b.y),
    () => comparePoints(a.arriving, b.arriving),
    () => comparePoints(a.leaving, b.leaving),
  ),
)

const compareRects = lists((a: Rect.Rect, b: Rect.Rect): number =>
  by(
    () => compareNumbers(a.x, b.x),
    () => compareNumbers(a.y, b.y),
    () => compareNumbers(a.width, b.width),
    () => compareNumbers(a.height, b.height),
  ),
)

// The order of two edges past their ids: the rest of the spec, then the
// options.
function compareSpecs(
  a: Edge<string>,
  b: Edge<string>,
  p: ConnectorEdgeOptions | undefined,
  q: ConnectorEdgeOptions | undefined,
): number {
  return by(
    () => compareNumbers(a.weight, b.weight),
    () => compareNumbers(a.minLength, b.minLength),
    () => compareNumbers(a.sourceSide, b.sourceSide),
    () => compareNumbers(a.targetSide, b.targetSide),
    () => compareNumbers(a.sourceAt, b.sourceAt),
    () => compareNumbers(a.targetAt, b.targetAt),
    () => compareNumbers(a.radius, b.radius),
    () => compareNumbers(a.thickness, b.thickness),
    () => compareAdornments(a.adornments, b.adornments),
    () => maybeNumbers(p?.turn, q?.turn),
    () => maybeNumbers(p?.jogAt, q?.jogAt),
    () => compareWaypoints(p?.via ?? [], q?.via ?? []),
    () => compareRects(p?.avoid ?? [], q?.avoid ?? []),
  )
}

/**
 * The eccentricity of each rect: the most hops from it to any rect it
 * reaches, in the undirected graph of the rects and the edges between them.
 * A rect without edges, or with only loops, has `0`.
 *
 * @param ids - The ids of the rects.
 * @param edges - The edges, by the ids of their ends.
 * @returns The eccentricity of each id in `ids`, and of each id an edge
 *   names.
 */
export function eccentricities(
  ids: Iterable<string>,
  edges: ReadonlyArray<{ readonly source: string; readonly target: string }>,
): Map<string, number> {
  const index = new Map<string, number>()
  const indexOf = (id: string): number => {
    let found = index.get(id)
    if (found === undefined) {
      found = index.size
      index.set(id, found)
    }
    return found
  }
  for (const id of ids) {
    indexOf(id)
  }
  const pairs = edges.map(({ source, target }) => [indexOf(source), indexOf(target)] as const)
  const neighbors: Array<Array<number>> = Array.from({ length: index.size }, () => [])
  for (const [s, t] of pairs) {
    if (s !== t) {
      ;(neighbors[s] as Array<number>).push(t)
      ;(neighbors[t] as Array<number>).push(s)
    }
  }
  // A breadth-first search from each rect, its last ring the farthest.
  const hops = new Int32Array(index.size)
  const queue = new Int32Array(index.size)
  const result = new Map<string, number>()
  for (const [id, start] of index) {
    hops.fill(-1)
    hops[start] = 0
    queue[0] = start
    let farthest = 0
    for (let head = 0, tail = 1; head < tail; head++) {
      const at = queue[head] as number
      farthest = hops[at] as number
      for (const next of neighbors[at] as Array<number>) {
        if (hops[next] === -1) {
          hops[next] = farthest + 1
          queue[tail++] = next
        }
      }
    }
    result.set(id, farthest)
  }
  return result
}

/**
 * The canonical order of the edges: by the smaller eccentricity of their
 * two rects, then the larger, then by source id, target id, the rest of
 * the spec and the options, and last by input index.
 *
 * @param rects - The rects, keyed by id.
 * @param edges - The edges.
 * @param options - The options, whose `edges` go with the edges.
 * @returns The input index of the edge at each canonical position.
 */
export function canonicalOrder(
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge<string>>,
  options: ConnectorApplyOptions = {},
): Array<number> {
  const eccentricity = eccentricities(Object.keys(rects), edges)
  const reach = edges.map(({ source, target }) => {
    const [a, b] = [eccentricity.get(source) ?? 0, eccentricity.get(target) ?? 0]
    return [Math.min(a, b), Math.max(a, b)] as const
  })
  return edges
    .map((_, i) => i)
    .toSorted((i, j) => {
      const [a, b] = [edges[i] as Edge<string>, edges[j] as Edge<string>]
      const [p, q] = [reach[i] as readonly [number, number], reach[j] as readonly [number, number]]
      return by(
        () => p[0] - q[0],
        () => p[1] - q[1],
        () => compareIds(a.source, b.source),
        () => compareIds(a.target, b.target),
        () => compareSpecs(a, b, options.edges?.[i], options.edges?.[j]),
        () => i - j,
      )
    })
}

// The order of notes: by kind, then by their edges, then by the rest of
// their fields.
const compareEdgeLists = lists(compareNumbers)
const compareIdLists = lists(compareIds)
const compareNotes = (a: ConnectorNote, b: ConnectorNote): number => {
  if (a.kind !== b.kind) {
    return a.kind - b.kind
  }
  if (a.kind === 0 && b.kind === 0) {
    return a.edge - b.edge
  }
  if (a.kind === 1 && b.kind === 1) {
    return by(
      () => compareEdgeLists(a.edges, b.edges),
      () => a.axis - b.axis,
      () => compareIdLists(a.rects, b.rects),
      () => compareNumbers(a.need, b.need),
    )
  }
  if (a.kind === 2 && b.kind === 2) {
    return by(
      () => compareEdgeLists(a.edges, b.edges),
      () => compareIds(a.rect, b.rect),
      () => compareNumbers(a.side, b.side),
      () => compareNumbers(a.need, b.need),
    )
  }
  if (a.kind === 3 && b.kind === 3) {
    return by(
      () => a.edge - b.edge,
      () => a.adornment - b.adornment,
      () => compareNumbers(a.need, b.need),
    )
  }
  return 0
}

/**
 * Maps a layout solved in canonical order back to the input order: the
 * routes, the edges each note names, sorted, and the notes, by kind and
 * then by their edges.
 *
 * @param layout - The layout, in canonical order.
 * @param order - The input index of the edge at each canonical position.
 * @returns The layout in input order.
 */
export function restore(layout: ConnectorLayout, order: ReadonlyArray<number>): ConnectorLayout {
  const input = (k: number) => order[k] as number
  const sorted = (edges: ReadonlyArray<number>) => edges.map(input).toSorted((a, b) => a - b)
  const edges: Array<ConnectorRoute | undefined> = order.map(() => undefined)
  for (const [k, route] of layout.edges.entries()) {
    edges[input(k)] =
      route === undefined
        ? undefined
        : {
            ...route,
            merged: [
              route.merged[0] < 0 ? route.merged[0] : input(route.merged[0]),
              route.merged[1] < 0 ? route.merged[1] : input(route.merged[1]),
            ],
          }
  }
  const notes = layout.notes.map((note): ConnectorNote => {
    switch (note.kind) {
      case 0:
      case 3:
        return { ...note, edge: input(note.edge) }
      case 1:
      case 2:
        return { ...note, edges: sorted(note.edges) }
    }
  })
  return { edges, notes: notes.toSorted(compareNotes) }
}

/**
 * Routes edges in a given order: solves the problem of the rects and the
 * edges listed in that order, and maps the routes `trace` hears back to
 * the input order.
 *
 * @param rects - The placed rects, keyed by id.
 * @param edges - The edges, referencing rects by id.
 * @param settings - The routing spec.
 * @param options - The route constraints of each edge, and the shapes.
 * @param order - The input index of the edge to route at each position.
 * @param trace - Hears the routes after each phase, by input index.
 * @returns The problem, its edges in `order`, and the layout that solves
 *   it, in the same order (see `restore`).
 */
export function routeInOrder(
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge<string>>,
  settings: Settings,
  options: ConnectorApplyOptions,
  order: ReadonlyArray<number>,
  trace?: Trace,
): { readonly problem: Problem; readonly layout: ConnectorLayout } {
  const given = options.edges
  const listed: ConnectorApplyOptions = {
    ...options,
    edges: given === undefined ? undefined : order.map((i) => given[i]),
  }
  const problem = normalize(
    rects,
    order.map((i) => edges[i] as Edge<string>),
    settings,
    listed,
  )
  const heard: Trace | undefined =
    trace === undefined
      ? undefined
      : (phase, routes) => {
          const byInput: Array<(typeof routes)[number]> = order.map(() => undefined)
          for (const [k, points] of routes.entries()) {
            byInput[order[k] as number] = points
          }
          trace(phase, byInput)
        }
  return { problem, layout: solve(problem, heard) }
}

/**
 * Routes edges in canonical order: sorts the rects and edges, solves once,
 * and maps the layout, and the routes `trace` hears, back to the input
 * order.
 *
 * @param rects - The placed rects, keyed by id.
 * @param edges - The edges, referencing rects by id.
 * @param settings - The routing spec.
 * @param options - The route constraints of each edge, and the shapes.
 * @param trace - Hears the routes after each phase, by input index.
 * @returns One route per edge, in input order.
 */
export function route(
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge<string>>,
  settings: Settings,
  options: ConnectorApplyOptions = {},
  trace?: Trace,
): ConnectorLayout {
  const order = canonicalOrder(rects, edges, options)
  return restore(routeInOrder(rects, edges, settings, options, order, trace).layout, order)
}
