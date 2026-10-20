import type * as Adornment from 'placement/adornment'
import * as Edge from 'placement/edge'
import type { Frame } from 'placement/frame'
import * as Hierarchy from 'placement/hierarchy'
import * as Point from 'placement/point'
import type * as Polygon from 'placement/polygon'
import * as Rect from 'placement/rect'
import {
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  computed,
  inject,
  provide,
  shallowRef,
  toValue,
  watchEffect,
} from 'vue'
import { preferCachedPoint } from '../data/point.ts'
import {
  type EdgeAdornmentInput,
  type EdgeRoute,
  type EdgeSolution,
  emptyRoute,
  isSSR,
  useEdgeAdornment,
  useEdgeAdornments,
} from '../internal/edge.ts'
import { type Child, useChild, useChildren } from './useChildren.ts'
import { useParentHeight, useParentWidth } from './useSizingContext.ts'

// See `useChildren.ts`: bundlers replace `process.env.NODE_ENV`, so
// production output drops the guarded warnings.
declare const process: { env: { NODE_ENV?: string } }

const NODE_CHANNEL = 'placement/hierarchy/node'
const EDGE_CHANNEL = 'placement/hierarchy/edge'
const ADORNMENT_CHANNEL = 'placement/hierarchy/adornment'

const ORIGIN: InjectionKey<ComputedRef<Point.Point>> = Symbol.for('placement/hierarchy/origin')
const BASIS: InjectionKey<HierarchyPercentBasis> = Symbol.for('placement/hierarchy/basis')

/** The percent bases of node and label sizes: the dimensions of the layout's parent. */
export interface HierarchyPercentBasis {
  readonly width: ComputedRef<number>
  readonly height: ComputedRef<number>
}

const zero = Rect.make()

/**
 * A node: its id, which edges reference, its frame, and its shape, the
 * polygon its ports sit on (see `shapes` in `placement/hierarchy`), or
 * undefined for its rect with sharp corners. A node without an id is left
 * out of the layout.
 */
export interface HierarchyNodeInput {
  readonly id: string | undefined
  readonly frame: Frame
  readonly shape?: Polygon.Polygon | undefined
}

/** The geometry of one edge: its polyline, its corner sizes, and its adornments. */
export type HierarchyEdgeRoute = EdgeRoute

/** The edge fields a `useHierarchyEdge` caller supplies. Adornments come from adornment children. */
export type HierarchyEdgeInput = Omit<Edge.EdgeInput<string>, 'adornments' | 'radius'>

/**
 * An adornment on an edge: the core adornment (see `placement/adornment`),
 * and whether the edge's drawn line stops where it begins. A trimming
 * adornment at `at` `0` trims the start of the line, and one at `at` `1`
 * the end.
 */
export type HierarchyAdornmentInput = EdgeAdornmentInput

/** Where an adornment landed (see `AdornmentPlacement` in `placement/adornment`). */
export type HierarchyAdornmentPlacement = Adornment.AdornmentPlacement

/**
 * How an edge draws its corners, which sizes them in the layout. A smoothed
 * corner reaches `1 + smoothing` times its radius along each leg.
 */
export interface HierarchyEdgeDrawing {
  /** The corner radius, `0` for sharp corners, which the layout keeps room for. */
  readonly radius: number
  /** The corner smoothing. */
  readonly smoothing: number
}

/**
 * A solved edge: its route, how far each end of the drawn line stops short
 * of the route's ends to make room for trimming adornments, and the line it
 * draws.
 */
export type HierarchyEdgeSolution = EdgeSolution

type NodeChild = Child<HierarchyNodeInput, Rect.Rect>
type EdgeChild = Child<Edge.Edge<string>, HierarchyEdgeRoute>

interface Solution {
  readonly bounds: Rect.Rect
  readonly nodes: ReadonlyMap<NodeChild, Rect.Rect>
  readonly edges: ReadonlyMap<EdgeChild, HierarchyEdgeRoute>
  // The reasons that children were left out of the solve, for dev warnings.
  readonly problems: ReadonlyArray<string>
}

// Children mount, unmount, and change ids one at a time, so the registered
// graph is often briefly incomplete. The solve never throws on it: it skips
// nodes without an id or with a taken id, and edges whose ends name no
// registered node. Skipped children resolve to an empty rect or route.
function solve(
  nodes: ReadonlyArray<NodeChild>,
  edges: ReadonlyArray<EdgeChild>,
  spec: Hierarchy.Hierarchy,
): Solution {
  const problems: Array<string> = []
  const frames: Record<string, Frame> = Object.create(null)
  const placed: Array<[NodeChild, string]> = []
  const ids = new Set<string>()
  const shapes: Record<string, Polygon.Polygon> = Object.create(null)

  for (const child of nodes) {
    const { id, frame, shape } = child.input.value
    if (id === undefined) {
      problems.push('a node has no id')
    } else if (ids.has(id)) {
      problems.push(`nodes share the id "${id}"`)
    } else {
      ids.add(id)
      frames[id] = frame
      placed.push([child, id])
      if (shape !== undefined) {
        shapes[id] = shape
      }
    }
  }

  const specs: Array<Edge.Edge<string>> = []
  const routed: Array<EdgeChild> = []

  for (const child of edges) {
    const edge = child.input.value
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      problems.push(`the edge "${edge.source}" -> "${edge.target}" names an id that no node has`)
    } else {
      specs.push(edge)
      routed.push(child)
    }
  }

  const layout = Hierarchy.apply(frames, specs, spec, { shapes })

  return {
    bounds: layout.bounds,
    nodes: new Map(placed.map(([child, id]) => [child, layout.nodes[id]!])),
    edges: new Map(routed.map((child, index) => [child, layout.edges[index]!])),
    problems,
  }
}

function translateRoute(route: HierarchyEdgeRoute, origin: Point.Point): HierarchyEdgeRoute {
  if (route.points.length === 0) {
    return route
  }
  const { x, y } = origin
  return {
    points: route.points.map((point) => Point.translate(point, x, y)),
    radii: route.radii,
    ...(route.outsets === undefined ? {} : { outsets: route.outsets }),
    adornments: route.adornments.map((placed) => ({
      ...placed,
      rect: Rect.translate(placed.rect, x, y),
    })),
  }
}

/**
 * Provides a layered graph layout to `useHierarchyNode` and
 * `useHierarchyEdge` descendants, and solves it whenever the spec, a node
 * frame, or an edge changes.
 *
 * The solve is local: its bounds start at `(0, 0)`. Descendants receive
 * their geometry translated by `origin`.
 *
 * @param spec - The layout specification.
 * @param origin - Where the top left corner of the bounds lands. It is read
 * lazily, so it may depend on the returned bounds.
 * @returns The local bounds of the drawing.
 */
export function useHierarchyLayout(
  spec: MaybeRefOrGetter<Hierarchy.Hierarchy>,
  origin: MaybeRefOrGetter<Point.Point>,
): ComputedRef<Rect.Rect> {
  const nodes = shallowRef<ReadonlyArray<NodeChild>>([])
  const edges = shallowRef<ReadonlyArray<EdgeChild>>([])

  // This tracks the spec, both child lists, and every child input, so a
  // change to any of them re-solves.
  const solution = computed(() => solve(nodes.value, edges.value, toValue(spec)))

  // The mappers only record the lists, and one effect writes every output,
  // so a change assigns once rather than once per channel.
  const assign = () => {
    const { nodes: placed, edges: routed } = solution.value
    for (const child of nodes.value) {
      child.output.value = placed.get(child) ?? zero
    }
    for (const child of edges.value) {
      child.output.value = routed.get(child) ?? emptyRoute
    }
  }

  // During SSR, effects never re-run, and `useChildren` maps synchronously
  // instead (see `useChildren.ts`), so the mappers assign directly.
  const ssr = isSSR()

  useChildren<HierarchyNodeInput, Rect.Rect>(NODE_CHANNEL, (children) => {
    nodes.value = children
    if (ssr) {
      assign()
    }
  })

  useChildren<Edge.Edge<string>, HierarchyEdgeRoute>(EDGE_CHANNEL, (children) => {
    edges.value = children
    if (ssr) {
      assign()
    }
  })

  watchEffect(assign, { flush: 'pre' })

  // The two lists resolve in separate pre-flush jobs, so a mapper can see a
  // new node list with a stale edge list. The warning waits for the post
  // flush, when both lists agree.
  if (process.env.NODE_ENV !== 'production') {
    let warned = ''
    watchEffect(
      () => {
        const key = solution.value.problems.join('\n')
        if (key !== '' && key !== warned) {
          console.warn(
            `[HierarchyLayout] Skipped part of the graph: ${key.replaceAll('\n', '; ')}.`,
          )
        }
        warned = key
      },
      { flush: 'post' },
    )
  }

  // The layout's own size is the solved bounds, so node sizes that resolved
  // percentages against it would feed back into the solve. They resolve
  // against the layout's parent instead.
  provide(BASIS, { width: useParentWidth(), height: useParentHeight() })

  provide(
    ORIGIN,
    computed((previous: Point.Point | undefined) => preferCachedPoint(toValue(origin), previous)),
  )

  return computed(() => solution.value.bounds)
}

/**
 * The percent bases for node and label sizes, which are the dimensions of
 * the nearest `useHierarchyLayout`'s parent.
 *
 * @returns The basis width and height.
 */
export function useHierarchyPercentBasis(): HierarchyPercentBasis {
  const basis = inject(BASIS, null)
  if (basis === null) {
    throw new Error('Hierarchy nodes and edges must be descendants of a hierarchy layout')
  }
  return basis
}

function useOrigin(): ComputedRef<Point.Point> {
  const origin = inject(ORIGIN, null)
  if (origin === null) {
    throw new Error('Hierarchy nodes and edges must be descendants of a hierarchy layout')
  }
  return origin
}

/**
 * Registers a node with the nearest `useHierarchyLayout`.
 *
 * @param node - The node's id, which edges reference, its frame, and
 * its outline, which its ports sit on.
 * @returns The node's solved rect, or an empty rect while it is left out of
 * the layout.
 */
export function useHierarchyNode(
  node: MaybeRefOrGetter<HierarchyNodeInput>,
): ComputedRef<Rect.Rect> {
  const local = useChild(NODE_CHANNEL, node, zero)
  const origin = useOrigin()
  return computed(() => Rect.translate(local.value, origin.value.x, origin.value.y))
}

/**
 * Registers an edge with the nearest `useHierarchyLayout`, and provides an
 * adornment context to `useHierarchyAdornment` descendants, which join the
 * edge in their resolved order. The edge's corners take the drawing's
 * radius, which the layout sizes in its reach: `1 + smoothing` radii along
 * each leg.
 *
 * @param edge - The edge's ends, ports, weight, and length.
 * @param drawing - How the edge draws its corners.
 * @returns The edge's solved route, which is empty while the edge is left
 * out of the layout, the insets its trimming adornments need, and the line
 * it draws.
 */
export function useHierarchyEdge(
  edge: MaybeRefOrGetter<HierarchyEdgeInput>,
  drawing: MaybeRefOrGetter<HierarchyEdgeDrawing> = { radius: 0, smoothing: 0 },
): ComputedRef<HierarchyEdgeSolution> {
  const { adornments, solve: solveEdge } = useEdgeAdornments(ADORNMENT_CHANNEL)

  const input = computed(() => {
    const { radius, smoothing } = toValue(drawing)
    const reach = 1 + Math.min(Math.max(smoothing, 0), 1)
    return Edge.make({
      ...toValue(edge),
      radius: reach * Math.max(radius, 0),
      adornments: adornments.value,
    })
  })

  const local = useChild(EDGE_CHANNEL, input, emptyRoute)
  const origin = useOrigin()
  return solveEdge(computed(() => translateRoute(local.value, origin.value)))
}

/**
 * Registers an adornment with the nearest `useHierarchyEdge`.
 *
 * @param adornment - The adornment's frame and where it sits.
 * @returns Where the adornment landed.
 */
export function useHierarchyAdornment(
  adornment: MaybeRefOrGetter<HierarchyAdornmentInput>,
): Readonly<Ref<HierarchyAdornmentPlacement>> {
  return useEdgeAdornment(ADORNMENT_CHANNEL, adornment)
}
