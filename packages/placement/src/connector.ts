import { coincident } from 'curvy/number'
import { Pipeable, dual } from 'curvy/utils'
import type { Edge } from './edge.ts'
import { type RouteConstraints, type XY, nudge } from './internal/connector/nudge.ts'
import type { Obstacle } from './internal/graph/graph.ts'
import { type Endpoint, shortestPath } from './internal/graph/search.ts'
import { ALL_DIRECTIONS, type Pin, visibilityGraph } from './internal/graph/visibility.ts'
import * as Point from './point.ts'
import type * as Rect from './rect.ts'

const TypeBrand: unique symbol = Symbol('placement/connector')
type TypeBrand = typeof TypeBrand

/**
 * The turn a connector prefers, encoded as numbers: `none` is `0`,
 * `clockwise` is `1`, `counterclockwise` is `2`. Turns are as seen on screen,
 * where the Y axis points down: a route that turns clockwise at every corner
 * winds around an obstacle the way the hands of a clock do.
 */
export const turn = {
  none: 0,
  clockwise: 1,
  counterclockwise: 2,
} as const

/** A turn preference, one of the `turn` encodings. */
export type ConnectorTurn = (typeof turn)[keyof typeof turn]

/**
 * The construction input for `make`. Every field is optional, and passing
 * `undefined` for one is the same as omitting it. Negative and non-finite
 * values act as `0`.
 */
export interface ConnectorInput {
  /**
   * The space routes keep from the rects they pass, except where they leave
   * or enter one. Where two rects are closer than twice this, the space
   * between them shrinks to half the distance on each side, so a route can
   * still pass between them. Defaults to `0`.
   */
  readonly clearance?: number | undefined
  /**
   * The distance between routes that run alongside each other. Where a
   * passage is too narrow for every route at this distance, the routes in it
   * move closer together, down to touching. Defaults to `0`, which lets
   * routes overlap.
   */
  readonly gap?: number | undefined
  /**
   * The cost of each corner, in units of length: a route takes a detour up
   * to this long to save a corner. Among routes of equal cost, the one with
   * fewer corners wins anyway. Defaults to `0`.
   */
  readonly bendCost?: number | undefined
  /**
   * The extra cost of each corner that turns against a connector's
   * preferred `turn`, in units of length. Defaults to `0`.
   */
  readonly turnCost?: number | undefined
}

/**
 * A connector routing spec: the clearance, spacing, and costs that `apply`
 * routes with.
 *
 * Values are immutable. Every setter returns a new spec. Create one with
 * `make`.
 */
class Connector extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  /** The space routes keep from the rects they pass. */
  readonly clearance: number
  /** The distance between routes that run alongside each other. */
  readonly gap: number
  /** The cost of each corner, in units of length. */
  readonly bendCost: number
  /** The extra cost of a corner against the preferred turn. */
  readonly turnCost: number

  constructor(input: ConnectorInput) {
    super()

    this.clearance = length(input.clearance)
    this.gap = length(input.gap)
    this.bendCost = length(input.bendCost)
    this.turnCost = length(input.turnCost)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Connector [clearance ${this.clearance} gap ${this.gap} bend ${this.bendCost} turn ${this.turnCost}]`
  }

  /**
   * Returns the spec as a plain record of the shape `make` accepts.
   *
   * @returns The input record.
   */
  toJSON() {
    return {
      clearance: this.clearance,
      gap: this.gap,
      bendCost: this.bendCost,
      turnCost: this.turnCost,
    }
  }
}

const length = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : 0

export type { Connector }

/**
 * Creates a `Connector`.
 *
 * @param input - The spec's fields. See `ConnectorInput` for the default of each field.
 * @returns An immutable `Connector`.
 * @example
 * ```ts
 * const connector = Connector.make({ clearance: 8, gap: 4 })
 * connector.bendCost // 0
 * ```
 */
export const make = (input: ConnectorInput = {}): Connector => new Connector(input)

/**
 * Checks if a value is a `Connector`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a `Connector`, `false` otherwise.
 */
export const isConnector = (value: unknown): value is Connector => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from toJSON. Each takes a number, never a connector, as
// its first data-last argument.

/**
 * Sets the clearance. The data-last form omits `self` and returns a function
 * of it.
 *
 * @param self - The spec to update.
 * @param clearance - The new clearance.
 * @returns A new spec with the clearance replaced.
 */
export const setClearance: {
  (self: Connector, clearance: number): Connector
  (clearance: number): (self: Connector) => Connector
} = dual(2, (self: Connector, clearance: number) => new Connector({ ...self.toJSON(), clearance }))

/**
 * Sets the gap between routes. The data-last form omits `self` and returns
 * a function of it.
 *
 * @param self - The spec to update.
 * @param gap - The new gap.
 * @returns A new spec with the gap replaced.
 */
export const setGap: {
  (self: Connector, gap: number): Connector
  (gap: number): (self: Connector) => Connector
} = dual(2, (self: Connector, gap: number) => new Connector({ ...self.toJSON(), gap }))

/**
 * Sets the cost of each corner. The data-last form omits `self` and returns
 * a function of it.
 *
 * @param self - The spec to update.
 * @param bendCost - The new cost of each corner.
 * @returns A new spec with the corner cost replaced.
 */
export const setBendCost: {
  (self: Connector, bendCost: number): Connector
  (bendCost: number): (self: Connector) => Connector
} = dual(2, (self: Connector, bendCost: number) => new Connector({ ...self.toJSON(), bendCost }))

/**
 * Sets the extra cost of a corner against the preferred turn. The data-last
 * form omits `self` and returns a function of it.
 *
 * @param self - The spec to update.
 * @param turnCost - The new extra cost.
 * @returns A new spec with the turn cost replaced.
 */
export const setTurnCost: {
  (self: Connector, turnCost: number): Connector
  (turnCost: number): (self: Connector) => Connector
} = dual(2, (self: Connector, turnCost: number) => new Connector({ ...self.toJSON(), turnCost }))

/**
 * The route constraints of one edge, in the `edges` option of `apply`.
 */
export interface ConnectorEdgeOptions {
  /**
   * Points the route passes through, in order. A point inside a rect, or
   * inside its clearance off the lines out of its ports, cannot be reached,
   * and leaves the edge without a route.
   */
  readonly via?: ReadonlyArray<Point.PointLike> | undefined
  /**
   * Rects whose interior the route stays out of. Other edges may still
   * cross them. The route may run along their sides.
   */
  readonly avoid?: ReadonlyArray<Rect.Rect> | undefined
  /** The turn the route prefers, one of the `turn` encodings. */
  readonly turn?: number | undefined
}

/**
 * The options of `apply`.
 */
export interface ConnectorApplyOptions {
  /** The route constraints of each edge, in the order of the edges. */
  readonly edges?: ReadonlyArray<ConnectorEdgeOptions | undefined> | undefined
}

/**
 * The solved geometry of one edge.
 *
 * - `points`: the polyline from the source port to the target port, with
 *   at least two points. Every segment runs along an axis, and every inner
 *   point is a right-angled corner.
 * - `radii`: how far the corner at each point reaches along its two legs,
 *   one per point, `0` at both ends. Each is at most the edge's `radius`,
 *   and the corners on a segment never reach past each other. A renderer
 *   that rounds corners draws circular corners of these radii, or any
 *   corner that reaches no farther.
 */
export interface ConnectorRoute {
  /** The polyline from the source port to the target port. */
  readonly points: ReadonlyArray<Point.Point>
  /** The size of the corner at each point, `0` at both ends. */
  readonly radii: ReadonlyArray<number>
}

/**
 * The result of `apply`.
 *
 * - `edges`: one route per edge, in input order, or `undefined` for an edge
 *   that no route connects: one whose rect is enclosed by others, or whose
 *   waypoints cannot be reached.
 */
export interface ConnectorLayout {
  /** One route per edge, in input order. */
  readonly edges: ReadonlyArray<ConnectorRoute | undefined>
}

// The outward heading of each side, in the order of the `side` encodings
// of `placement/edge`: top, right, bottom, left.
const OUTWARD = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const

interface Port {
  readonly side: number
  readonly x: number
  readonly y: number
}

/**
 * Routes edges between rects that are already placed, around the other
 * rects, and returns one orthogonal route per edge.
 *
 * Rects come keyed by id, the shape of the `nodes` that `Hierarchy.apply`
 * returns (see `placement/hierarchy`), and edges reference them by id, as
 * `Edge`s (see `placement/edge`). Every rect is an obstacle that routes keep
 * `clearance` away from, except where they leave or enter it.
 *
 * The solver follows orthogonal connector routing (Wybrow, Marriott, and
 * Stuckey, 2009):
 *
 * 1. It builds the orthogonal visibility graph: lines through every corner
 *    of every rect, grown by the clearance, and through every port, up to
 *    the nearest rect.
 * 2. It finds each edge's cheapest route on the graph, by A*: the sum of
 *    its length and `bendCost` per corner, plus `turnCost` per corner
 *    against the edge's preferred turn. Routes pass through their `via`
 *    points and stay out of their `avoid` rects.
 * 3. It nudges routes that run alongside each other apart, `gap` apart,
 *    ordered so that routes that share a path cross only where they must.
 *
 * Ports come from each edge's sides and positions. A port sits on its side
 * of its rect, at its `sourceAt` or `targetAt` along the side, and the route
 * leaves it straight out from the side. An auto side (an omitted or
 * non-finite one) is the side of the cheapest route among all four. An
 * auto position is the middle of the side, and the auto ports that share a
 * side spread out evenly, ordered by where their other ends are. An edge
 * from a rect to itself leaves on the right and enters on the top, by
 * default.
 *
 * Each route's corners report their `radii`, from the edge's `radius`. The
 * edge's `weight`, `minLength`, `minRadius`, and `adornments` have no effect.
 *
 * Every input is deterministic: the same rects and edges always produce the
 * same routes. Ties fall back to the order of the rects' keys, then of the
 * edges.
 *
 * The geometry comes from exact IEEE 754 arithmetic and is never rounded
 * (see PRECISION.md). Ports and the corners of routes that need no nudging
 * sit exactly on the coordinates of the rects.
 *
 * @param rects - The placed rects, keyed by id.
 * @param edges - The edges, referencing rects by id.
 * @param connector - The routing spec.
 * @param options - The route constraints of each edge.
 * @returns One route per edge.
 * @throws `RangeError` when an edge references an id that no rect has.
 * @example
 * ```ts
 * const rects = { a: Rect.make(0, 0, 40, 20), b: Rect.make(100, 40, 40, 20) }
 * const edges = [Edge.make({ source: 'a', target: 'b' })]
 * const layout = Connector.apply(rects, edges, Connector.make({ clearance: 10 }))
 * layout.edges[0]?.points // [Point (40, 10), Point (70, 10), Point (70, 50), Point (100, 50)]
 * ```
 */
export function apply<const K extends string>(
  rects: Readonly<Record<K, Rect.Rect>>,
  edges: ReadonlyArray<Edge<NoInfer<K>>>,
  connector: Connector,
  options: ConnectorApplyOptions = {},
): ConnectorLayout {
  const ids = Object.keys(rects) as Array<K>
  const index = new Map<string, number>(ids.map((id, i) => [id, i]))
  const boxes = ids.map((id) => rects[id])
  for (const edge of edges) {
    for (const id of [edge.source, edge.target]) {
      if (!index.has(id)) {
        throw new RangeError(`An edge references the id "${id}", which no rect has`)
      }
    }
  }
  const obstacles = grow(boxes, connector.clearance)
  const edgeOptions = edges.map((_, i) => options.edges?.[i])

  // The extra pins that every graph needs: waypoints, and the corners of
  // avoided rects, so that lines run around them.
  const extraPins: Array<Pin> = []
  for (const option of edgeOptions) {
    for (const point of option?.via ?? []) {
      extraPins.push({ x: point.x, y: point.y, directions: ALL_DIRECTIONS })
    }
    for (const r of option?.avoid ?? []) {
      for (const [x, y] of [
        [r.left, r.top],
        [r.right, r.top],
        [r.left, r.bottom],
        [r.right, r.bottom],
      ] as const) {
        extraPins.push({ x, y, directions: ALL_DIRECTIONS })
      }
    }
  }
  const costs = (option: ConnectorEdgeOptions | undefined) => ({
    bendCost: connector.bendCost,
    clockwiseCost: option?.turn === turn.counterclockwise ? connector.turnCost : 0,
    counterclockwiseCost: option?.turn === turn.clockwise ? connector.turnCost : 0,
    avoid: option?.avoid ?? [],
  })

  // The sides of each edge's two ports. Auto sides take the side of the
  // cheapest route over all four, on a graph with a port at the middle of
  // every candidate side.
  const sides = edges.map((edge) => selfLoopSides(edge))
  const searched = sides.flatMap(([source, target], i) =>
    source === undefined || target === undefined ? [i] : [],
  )
  if (searched.length > 0) {
    const pins: Array<Pin> = [...extraPins]
    const candidates = searched.map((i) => {
      const edge = edges[i] as Edge<K>
      const [source, target] = sides[i] as [number | undefined, number | undefined]
      const ends = [
        [edge.source, source, edge.sourceAt, 1],
        [edge.target, target, edge.targetAt, -1],
      ] as const
      return ends.map(([id, side, at, outward]) => {
        const owner = index.get(id) as number
        return (side === undefined ? [0, 1, 2, 3] : [side]).map((s) => {
          const port = portOf(boxes[owner] as Rect.Rect, s, Number.isFinite(at) ? at : 0.5)
          pins.push(pinOf(port, owner))
          return { side: s, pin: pins.length - 1, outward }
        })
      })
    })
    const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
    for (const [k, i] of searched.entries()) {
      const [starts, ends] = candidates[k] as [
        Array<{ side: number; pin: number; outward: number }>,
        Array<{ side: number; pin: number; outward: number }>,
      ]
      const endpoint = ({
        side,
        pin,
        outward,
      }: {
        side: number
        pin: number
        outward: number
      }): Endpoint => {
        const heading = OUTWARD[side] as Point.PointLike
        return {
          node: nodes[pin] as number,
          headings: [{ x: outward * heading.x, y: outward * heading.y }],
        }
      }
      const path = shortestPath(graph, starts.map(endpoint), ends.map(endpoint), {
        ...costs(edgeOptions[i]),
        via: viaNodes(edgeOptions[i], nodes, extraPins),
      })
      const edge = edges[i] as Edge<K>
      const facing = facingSides(
        boxes[index.get(edge.source) as number] as Rect.Rect,
        boxes[index.get(edge.target) as number] as Rect.Rect,
      )
      sides[i] = [
        path === undefined ? facing[0] : (starts[path.start] as { side: number }).side,
        path === undefined ? facing[1] : (ends[path.end] as { side: number }).side,
      ]
    }
  }

  // The ports, with auto positions spread along shared sides.
  const ports = spreadPorts(edges, sides as Array<[number, number]>, boxes, index)

  // The routes, on a graph with the final ports.
  const pins: Array<Pin> = [...extraPins]
  for (const [i, edge] of edges.entries()) {
    const [source, target] = ports[i] as [Port, Port]
    pins.push(pinOf(source, index.get(edge.source) as number))
    pins.push(pinOf(target, index.get(edge.target) as number))
  }
  const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
  const routes: Array<Array<XY> | undefined> = edges.map((_, i) => {
    const [source, target] = ports[i] as [Port, Port]
    const out = OUTWARD[source.side] as Point.PointLike
    const into = OUTWARD[target.side] as Point.PointLike
    const path = shortestPath(
      graph,
      [{ node: nodes[extraPins.length + 2 * i] as number, headings: [out] }],
      [
        {
          node: nodes[extraPins.length + 2 * i + 1] as number,
          headings: [{ x: -into.x, y: -into.y }],
        },
      ],
      { ...costs(edgeOptions[i]), via: viaNodes(edgeOptions[i], nodes, extraPins) },
    )
    return path === undefined
      ? undefined
      : [...path.nodes].map((node): XY => [graph.xs[node] as number, graph.ys[node] as number])
  })

  // Nudge the routes that were found, together.
  const found = routes.flatMap((route, i) => (route === undefined ? [] : [i]))
  const nudged = nudge(
    found.map((i) => routes[i] as Array<XY>),
    obstacles,
    connector.gap,
    found.map((i): RouteConstraints => {
      const option = edgeOptions[i]
      return {
        anchors: (option?.via ?? []).map((p): XY => [p.x, p.y]),
        avoid: option?.avoid ?? [],
      }
    }),
  )
  const result: Array<ConnectorRoute | undefined> = edges.map(() => undefined)
  for (const [k, i] of found.entries()) {
    const points = nudged[k] as Array<XY>
    result[i] = {
      points: points.map(([x, y]) => Point.make(x, y)),
      radii: radiiOf(points, (edges[i] as Edge<K>).radius),
    }
  }
  return { edges: result }
}

// The rects grown by the clearance on each side, except toward a nearby
// rect, where each side grows by at most half the distance between them,
// so the grown rects never close a passage the rects leave open.
function grow(boxes: ReadonlyArray<Rect.Rect>, clearance: number): Array<Obstacle> {
  const reach = 2 * clearance
  const near = (a0: number, a1: number, b0: number, b1: number) =>
    b0 < a1 + reach && !coincident(b0, a1 + reach) && b1 > a0 - reach && !coincident(b1, a0 - reach)
  return boxes.map((a, i) => {
    let left = clearance
    let top = clearance
    let right = clearance
    let bottom = clearance
    for (const [j, b] of boxes.entries()) {
      if (i === j) {
        continue
      }
      const acrossY = near(a.top, a.bottom, b.top, b.bottom)
      const acrossX = near(a.left, a.right, b.left, b.right)
      if (acrossY && (b.left >= a.right || coincident(b.left, a.right))) {
        right = Math.min(right, Math.max(0, (b.left - a.right) / 2))
      }
      if (acrossY && (b.right <= a.left || coincident(b.right, a.left))) {
        left = Math.min(left, Math.max(0, (a.left - b.right) / 2))
      }
      if (acrossX && (b.top >= a.bottom || coincident(b.top, a.bottom))) {
        bottom = Math.min(bottom, Math.max(0, (b.top - a.bottom) / 2))
      }
      if (acrossX && (b.bottom <= a.top || coincident(b.bottom, a.top))) {
        top = Math.min(top, Math.max(0, (a.top - b.bottom) / 2))
      }
    }
    return {
      left: a.left - left,
      top: a.top - top,
      right: a.right + right,
      bottom: a.bottom + bottom,
    }
  })
}

// The given sides of an edge's ports, with a loop from a rect to itself
// leaving on the right and entering on the top unless told otherwise.
function selfLoopSides(edge: Edge<string>): [number | undefined, number | undefined] {
  const source = sideOf(edge.sourceSide)
  const target = sideOf(edge.targetSide)
  if (edge.source !== edge.target) {
    return [source, target]
  }
  if (source === undefined && target === undefined) {
    return [1, 0]
  }
  return [source ?? ((target as number) + 1) % 4, target ?? ((source as number) + 3) % 4]
}

const sideOf = (side: number) =>
  Number.isFinite(side) && side >= 0 && side <= 3 ? Math.trunc(side) : undefined

// The sides of two rects that face each other, along the axis on which
// their centers are farther apart, for an edge without a route.
function facingSides(a: Rect.Rect, b: Rect.Rect): [number, number] {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2)
  const dy = b.y + b.height / 2 - (a.y + a.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [1, 3] : [3, 1]
  }
  return dy >= 0 ? [2, 0] : [0, 2]
}

// A port on a side of a rect, `at` of the way from its top or left end.
function portOf(rect: Rect.Rect, side: number, at: number): Port {
  switch (side) {
    case 0:
      return { side, x: rect.left + rect.width * at, y: rect.top }
    case 1:
      return { side, x: rect.right, y: rect.top + rect.height * at }
    case 2:
      return { side, x: rect.left + rect.width * at, y: rect.bottom }
    default:
      return { side, x: rect.left, y: rect.top + rect.height * at }
  }
}

const pinOf = (port: Port, owner: number): Pin => ({
  x: port.x,
  y: port.y,
  directions: 1 << port.side,
  owner,
})

// The ports of every edge. Ports with an auto position that share a side
// spread out evenly along it, ordered by where the rects at their other
// ends sit along the side, then by edge order.
function spreadPorts(
  edges: ReadonlyArray<Edge<string>>,
  sides: ReadonlyArray<[number, number]>,
  boxes: ReadonlyArray<Rect.Rect>,
  index: ReadonlyMap<string, number>,
): Array<[Port, Port]> {
  const shared = new Map<string, Array<{ edge: number; end: number; key: number }>>()
  for (const [i, edge] of edges.entries()) {
    const ends = [
      [edge.source, edge.target, edge.sourceAt],
      [edge.target, edge.source, edge.targetAt],
    ] as const
    for (const [end, [id, other, at]] of ends.entries()) {
      if (Number.isFinite(at)) {
        continue
      }
      const side = (sides[i] as [number, number])[end] as number
      const far = boxes[index.get(other) as number] as Rect.Rect
      const key = side % 2 === 0 ? far.x + far.width / 2 : far.y + far.height / 2
      const group = `${index.get(id)}:${side}`
      const list = shared.get(group) ?? []
      list.push({ edge: i, end, key })
      shared.set(group, list)
    }
  }
  const positions = new Map<string, number>()
  for (const list of shared.values()) {
    list.sort((a, b) => a.key - b.key || a.edge - b.edge || a.end - b.end)
    for (const [k, { edge, end }] of list.entries()) {
      positions.set(`${edge}:${end}`, (k + 1) / (list.length + 1))
    }
  }
  return edges.map((edge, i) => {
    const [source, target] = sides[i] as [number, number]
    const at = (end: number, given: number) =>
      Number.isFinite(given) ? given : (positions.get(`${i}:${end}`) as number)
    return [
      portOf(boxes[index.get(edge.source) as number] as Rect.Rect, source, at(0, edge.sourceAt)),
      portOf(boxes[index.get(edge.target) as number] as Rect.Rect, target, at(1, edge.targetAt)),
    ]
  })
}

// The graph nodes of an edge's waypoints, which come first among the extra
// pins, in edge order.
function viaNodes(
  option: ConnectorEdgeOptions | undefined,
  nodes: Int32Array,
  extraPins: ReadonlyArray<Pin>,
): Array<number> {
  const via = option?.via ?? []
  return via.map((point) => {
    const pin = extraPins.findIndex((p) => p.x === point.x && p.y === point.y)
    return nodes[pin] as number
  })
}

// The size of each corner: at most the radius, and no more of a leg than
// its share. A leg between two corners splits evenly between them, and a
// leg from a port belongs to its one corner.
function radiiOf(points: ReadonlyArray<XY>, radius: number): Array<number> {
  const r = Number.isFinite(radius) && radius > 0 ? radius : 0
  const legs = points.slice(1).map((point, i) => {
    const previous = points[i] as XY
    return Math.abs(point[0] - previous[0]) + Math.abs(point[1] - previous[1])
  })
  const last = points.length - 1
  return points.map((_, i) => {
    if (i === 0 || i === last) {
      return 0
    }
    const before = (legs[i - 1] as number) / (i - 1 === 0 ? 1 : 2)
    const after = (legs[i] as number) / (i === last - 1 ? 1 : 2)
    return Math.min(r, before, after)
  })
}
