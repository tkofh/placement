import { coincident } from 'curvy/number'
import * as Connector from 'placement/connector'
import * as Edge from 'placement/edge'
import type * as Rect from 'placement/rect'
import {
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  computed,
  shallowRef,
  toValue,
  watchEffect,
} from 'vue'
import {
  type EdgeAdornmentInput,
  type EdgeAdornmentPlacement,
  type EdgeRoute,
  type EdgeSolution,
  emptyRoute,
  isSSR,
  useEdgeAdornment,
  useEdgeAdornments,
} from '../internal/edge.ts'
import { type Child, useChild, useChildren } from './useChildren.ts'

// See `useChildren.ts`: bundlers replace `process.env.NODE_ENV`, so
// production output drops the guarded warnings.
declare const process: { env: { NODE_ENV?: string } }

const NODE_CHANNEL = 'placement/connector/node'
const EDGE_CHANNEL = 'placement/connector/edge'
const ADORNMENT_CHANNEL = 'placement/connector/adornment'

/**
 * A rect that routes connect and go around: its `id`, which edges
 * reference, and where it is. A node without an id is only an obstacle.
 */
export interface ConnectorNodeInput {
  readonly id?: string | undefined
  readonly rect: Rect.Rect
}

/**
 * The edge fields a `useConnectorEdge` caller supplies: its ends and ports
 * (see `placement/edge`), and its route constraints (see
 * `ConnectorEdgeOptions` in `placement/connector`). Adornments come from
 * adornment children.
 */
export type ConnectorEdgeInput = Pick<
  Edge.EdgeInput<string>,
  'source' | 'target' | 'sourceSide' | 'sourceAt' | 'targetSide' | 'targetAt'
> &
  Connector.ConnectorEdgeOptions

/**
 * How an edge draws its corners, which sizes them in the layout. A smoothed
 * corner reaches `1 + smoothing` times its radius along each leg.
 */
export interface ConnectorEdgeDrawing {
  /** The corner radius, `0` for sharp corners. */
  readonly radius: number
  /** The corner smoothing. */
  readonly smoothing: number
  /** The stroke width, which the layout keeps its gaps between. Defaults to `0`. */
  readonly thickness?: number
}

interface EdgeEntry {
  readonly edge: Edge.Edge<string>
  readonly options: Connector.ConnectorEdgeOptions
}

type NodeChild = Child<ConnectorNodeInput>
type EdgeChild = Child<EdgeEntry, EdgeRoute>

interface Solution {
  readonly edges: ReadonlyMap<EdgeChild, EdgeRoute>
  // The reasons that children were left out of the solve, for dev warnings.
  readonly problems: ReadonlyArray<string>
}

// Children mount, unmount, and change ids one at a time, so the registered
// graph is often briefly incomplete. `Connector.applyTolerant` never throws
// on it: a node whose id another node took is only an obstacle, and edges
// whose ends name no registered node resolve to an empty route, as do edges
// that no route connects.
function solve(
  nodes: ReadonlyArray<NodeChild>,
  edges: ReadonlyArray<EdgeChild>,
  spec: Connector.Connector,
): Solution {
  const entries = edges.map((child) => child.input.value)
  const layout = Connector.applyTolerant(
    nodes.map((child) => child.input.value),
    entries,
    spec,
  )
  const named = (index: number) => {
    const { source, target } = entries[index]!.edge
    return `the edge "${source}" -> "${target}"`
  }
  const problems = layout.problems.map((problem) =>
    problem.kind === Connector.problem.duplicate
      ? `nodes share the id "${problem.id}"`
      : `${named(problem.edge)} names an id that no node has`,
  )
  for (const note of layout.notes) {
    if (note.kind === Connector.note.unrouted) {
      problems.push(`no route connects ${named(note.edge)}`)
    }
  }

  const routes = new Map<EdgeChild, EdgeRoute>()
  for (const [index, child] of edges.entries()) {
    const route = layout.edges[index]
    if (route === undefined) {
      continue
    }
    // At an end merged with others, one of their edges draws the adornments
    // they share there.
    const shared = route.merged.map((leader) => leader >= 0 && leader !== index)
    const drawn = entries[index]!.edge.adornments.map((adornment) => {
      const at = Number.isFinite(adornment.at) ? Math.min(Math.max(adornment.at, 0), 1) : 0.5
      return !((coincident(at, 0) && shared[0]) || (coincident(at, 1) && shared[1]))
    })
    routes.set(child, drawn.includes(false) ? { ...route, drawn } : route)
  }
  return { edges: routes, problems }
}

/**
 * Provides orthogonal routing to `useConnectorNode` and `useConnectorEdge`
 * descendants, and routes the edges whenever the spec, a node, or an edge
 * changes.
 *
 * Nodes and routes share one coordinate space, the one that rects resolve
 * in, so a node can be any placed rect: a flex item, a hierarchy node, or a
 * group positioned on its own.
 *
 * @param spec - The routing specification.
 */
export function useConnectorLayout(spec: MaybeRefOrGetter<Connector.Connector>): void {
  const nodes = shallowRef<ReadonlyArray<NodeChild>>([])
  const edges = shallowRef<ReadonlyArray<EdgeChild>>([])

  // This tracks the spec, both child lists, and every child input, so a
  // change to any of them routes again.
  const solution = computed(() => solve(nodes.value, edges.value, toValue(spec)))

  // The mappers only record the lists, and one effect writes every output,
  // so a change assigns once rather than once per channel.
  const assign = () => {
    const { edges: routed } = solution.value
    for (const child of edges.value) {
      child.output.value = routed.get(child) ?? emptyRoute
    }
  }

  // During SSR, effects never re-run, and `useChildren` maps synchronously
  // instead (see `useChildren.ts`), so the mappers assign directly.
  const ssr = isSSR()

  useChildren<ConnectorNodeInput>(NODE_CHANNEL, (children) => {
    nodes.value = children
    if (ssr) {
      assign()
    }
  })

  useChildren<EdgeEntry, EdgeRoute>(EDGE_CHANNEL, (children) => {
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
          console.warn(`[ConnectorLayout] Left edges unrouted: ${key.replaceAll('\n', '; ')}.`)
        }
        warned = key
      },
      { flush: 'post' },
    )
  }
}

/**
 * Registers a node with the nearest `useConnectorLayout`. Every node is an
 * obstacle that routes go around.
 *
 * @param node - The node's id, which edges reference, and its rect.
 */
export function useConnectorNode(node: MaybeRefOrGetter<ConnectorNodeInput>): void {
  useChild(NODE_CHANNEL, node)
}

/**
 * Registers an edge with the nearest `useConnectorLayout`, and provides an
 * adornment context to `useConnectorAdornment` descendants, which join the
 * edge in their resolved order. The edge's corners take the drawing's
 * radius, which the layout sizes in its reach: `1 + smoothing` radii along
 * each leg.
 *
 * @param edge - The edge's ends, ports, and route constraints.
 * @param drawing - How the edge draws its corners.
 * @returns The edge's solved route, which is empty while the edge has no
 * route, the insets its trimming adornments need, and the line it draws.
 */
export function useConnectorEdge(
  edge: MaybeRefOrGetter<ConnectorEdgeInput>,
  drawing: MaybeRefOrGetter<ConnectorEdgeDrawing> = { radius: 0, smoothing: 0 },
): ComputedRef<EdgeSolution> {
  const { adornments, solve: solveEdge } = useEdgeAdornments(ADORNMENT_CHANNEL)

  const input = computed((): EdgeEntry => {
    const { via, avoid, turn, jogAt, ...ends } = toValue(edge)
    const { radius, smoothing, thickness = 0 } = toValue(drawing)
    const reach = 1 + Math.min(Math.max(smoothing, 0), 1)
    return {
      edge: Edge.make({
        ...ends,
        radius: reach * Math.max(radius, 0),
        thickness,
        adornments: adornments.value,
      }),
      options: { via, avoid, turn, jogAt },
    }
  })

  return solveEdge(useChild(EDGE_CHANNEL, input, emptyRoute))
}

/**
 * Registers an adornment with the nearest `useConnectorEdge`.
 *
 * @param adornment - The adornment's frame and where it sits.
 * @returns Where the adornment landed.
 */
export function useConnectorAdornment(
  adornment: MaybeRefOrGetter<EdgeAdornmentInput>,
): Readonly<Ref<EdgeAdornmentPlacement>> {
  return useEdgeAdornment(ADORNMENT_CHANNEL, adornment)
}
