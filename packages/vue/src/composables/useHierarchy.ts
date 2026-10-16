import * as Edge from 'placement/edge'
import type { Frame } from 'placement/frame'
import * as Hierarchy from 'placement/hierarchy'
import * as Point from 'placement/point'
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
  ssrContextKey,
  toValue,
  watchEffect,
} from 'vue'
import { preferCachedPoint } from '../data/point.ts'
import { type Child, useChild, useChildren } from './useChildren.ts'
import { useParentHeight, useParentWidth } from './useSizingContext.ts'

// See `useChildren.ts`: bundlers replace `process.env.NODE_ENV`, so
// production output drops the guarded warnings.
declare const process: { env: { NODE_ENV?: string } }

const NODE_CHANNEL = 'placement/hierarchy/node'
const EDGE_CHANNEL = 'placement/hierarchy/edge'
const LABEL_CHANNEL = 'placement/hierarchy/label'

const ORIGIN: InjectionKey<ComputedRef<Point.Point>> = Symbol.for('placement/hierarchy/origin')
const BASIS: InjectionKey<HierarchyPercentBasis> = Symbol.for('placement/hierarchy/basis')

/** The percent bases of node and label sizes: the dimensions of the layout's parent. */
export interface HierarchyPercentBasis {
  readonly width: ComputedRef<number>
  readonly height: ComputedRef<number>
}

const zero = Rect.make()

/** The geometry of one edge: its polyline and one rect per label, in label order. */
export interface HierarchyEdgeRoute {
  readonly points: ReadonlyArray<Point.Point>
  readonly labels: ReadonlyArray<Rect.Rect>
}

const emptyRoute: HierarchyEdgeRoute = { points: [], labels: [] }

/** The edge fields a `useHierarchyEdge` caller supplies. Labels come from label children. */
export type HierarchyEdgeInput = Omit<Edge.EdgeInput<string>, 'labels'>

type NodeChild = Child<Frame, Rect.Rect>
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
  const frames: Array<Frame<string>> = []
  const placed: Array<NodeChild> = []
  const ids = new Set<string>()

  for (const child of nodes) {
    const frame = child.input.value
    if (frame.id === undefined) {
      problems.push('a node has no id')
    } else if (ids.has(frame.id)) {
      problems.push(`nodes share the id "${frame.id}"`)
    } else {
      ids.add(frame.id)
      frames.push(frame as Frame<string>)
      placed.push(child)
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

  const layout = Hierarchy.apply(frames, specs, spec)

  return {
    bounds: layout.bounds,
    nodes: new Map(placed.map((child, index) => [child, layout.nodes[frames[index]!.id]!])),
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
    labels: route.labels.map((label) => Rect.translate(label, x, y)),
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

  useChildren<Frame, Rect.Rect>(NODE_CHANNEL, (children) => {
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

// `renderToString` provides the SSR context app-wide.
function isSSR(): boolean {
  return inject(ssrContextKey, null) !== null
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
 * @param frame - The node's frame. Its `id` is what edges reference.
 * @returns The node's solved rect, or an empty rect while it is left out of
 * the layout.
 */
export function useHierarchyNode(frame: MaybeRefOrGetter<Frame>): ComputedRef<Rect.Rect> {
  const local = useChild(NODE_CHANNEL, frame, zero)
  const origin = useOrigin()
  return computed(() => Rect.translate(local.value, origin.value.x, origin.value.y))
}

/**
 * Registers an edge with the nearest `useHierarchyLayout`, and provides a
 * label context to `useHierarchyLabel` descendants. The labels join the edge
 * in their resolved order.
 *
 * @param edge - The edge's ends, ports, weight, and length.
 * @returns The edge's solved route, which is empty while the edge is left out of the layout.
 */
export function useHierarchyEdge(
  edge: MaybeRefOrGetter<HierarchyEdgeInput>,
): ComputedRef<HierarchyEdgeRoute> {
  const labels = shallowRef<ReadonlyArray<Child<Edge.EdgeLabel, Rect.Rect>>>([])

  const input = computed(() =>
    Edge.make({ ...toValue(edge), labels: labels.value.map((child) => child.input.value) }),
  )

  const local = useChild(EDGE_CHANNEL, input, emptyRoute)
  const origin = useOrigin()
  const route = computed(() => translateRoute(local.value, origin.value))

  // As in the layout, the mapper records the list and an effect writes the
  // outputs.
  const assign = () => {
    const rects = route.value.labels
    for (const [index, child] of labels.value.entries()) {
      child.output.value = rects[index] ?? zero
    }
  }

  const ssr = isSSR()

  useChildren<Edge.EdgeLabel, Rect.Rect>(LABEL_CHANNEL, (children) => {
    labels.value = children
    if (ssr) {
      assign()
    }
  })

  watchEffect(assign, { flush: 'pre' })

  return route
}

/**
 * Registers a label with the nearest `useHierarchyEdge`.
 *
 * @param label - The label's frame and position along the edge.
 * @returns The label's solved rect.
 */
export function useHierarchyLabel(
  label: MaybeRefOrGetter<Edge.EdgeLabel>,
): Readonly<Ref<Rect.Rect>> {
  return useChild(LABEL_CHANNEL, label, zero)
}
