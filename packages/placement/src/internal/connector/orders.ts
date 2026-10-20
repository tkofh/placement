import type { ConnectorApplyOptions, ConnectorLayout } from '../../connector.ts'
import type { Edge } from '../../edge.ts'
import type * as Rect from '../../rect.ts'
import { before } from '../../utils/tolerance.ts'
import type { XY } from '../orient.ts'
import { canonicalOrder, restore, routeInOrder } from './canonical.ts'
import type { Trace } from './pipeline.ts'
import type { Settings } from './problem.ts'
import { type Score, scoreLayout } from './score.ts'

// The orders a problem routes in. Every phase settles its ties by the order
// of the edges, and the routes found first shape the ones after them, so
// one order can draw a layout much worse than another. `routeBest` routes
// the problem in several orders and keeps the layout that `scoreLayout`
// likes best:
//
// 1. the canonical order, first, so that a tie keeps its layout;
// 2. the canonical order reversed, a second start that routes the edges
//    at the rim of the graph first;
// 3. promotions: the edge with the largest share of the best layout's
//    score so far moves to the front of that layout's order, so that it
//    routes before the edges that crowded it. Each edge moves up once in
//    a pass, the worst first, and a new pass starts when a pass improved
//    the best layout.
//
// A layout replaces the best only when it scores less beyond the tolerance
// band, and an order already routed is not routed again. The routing stops
// after `SOLVES` solves, or when a pass of promotions improves nothing.
// Every order derives from the canonical one, so the layout still depends
// only on the graph, and never on the order the edges came in.

/**
 * How many times a problem is solved, at most, in as many orders: the
 * canonical order, its reverse, and six promotions. Each solve costs about
 * what the first did. Over the auth sweep of the playground's diagram,
 * eight solves take the mean score about 85% of the way to what sixteen
 * reach, and over the random diagrams of the property tests about 95%;
 * the reverse alone takes it about half of the way.
 */
export const SOLVES = 8

/** The kind of order a try routed in. */
export type Kind = 'canonical' | 'reversed' | 'promotion'

/** A layout routed in one order, and what it scores. */
export interface Try {
  /** How the order came about. */
  readonly kind: Kind
  /** The input index of the edge at each position of the order. */
  readonly order: ReadonlyArray<number>
  /** The layout, in the order of the try (see `restore`). */
  readonly layout: ConnectorLayout
  /** Its score, with each edge's share by input index. */
  readonly score: Score
  /** The routes after each phase, by input index, when traced. */
  readonly phases: ReadonlyArray<
    readonly [phase: string, routes: ReadonlyArray<ReadonlyArray<XY> | undefined>]
  >
}

// The edges' shares of a score, from the order of a try to the input
// order.
const byInput = (score: Score, order: ReadonlyArray<number>): Score => {
  const byEdge = new Float64Array(order.length)
  for (const [k, i] of order.entries()) {
    byEdge[i] = score.byEdge[k] as number
  }
  return { ...score, byEdge }
}

/**
 * The tries of a problem, in the order they route (see the module
 * comment). Each is solved when the one before it has been taken, so a
 * caller stops the routing by taking no more.
 *
 * @param rects - The placed rects, keyed by id.
 * @param edges - The edges, referencing rects by id.
 * @param settings - The routing spec.
 * @param options - The route constraints of each edge, and the shapes.
 * @param traced - Whether each try keeps its routes after each phase.
 * @returns The tries.
 */
export function* triesOf(
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge<string>>,
  settings: Settings,
  options: ConnectorApplyOptions,
  traced: boolean,
): Generator<Try, void, undefined> {
  const canonical = canonicalOrder(rects, edges, options)
  // The canonical position of each edge, to settle ties between shares.
  const rank = new Int32Array(edges.length)
  for (const [k, i] of canonical.entries()) {
    rank[i] = k
  }
  const routed = new Set<string>()
  const attempt = (kind: Kind, order: ReadonlyArray<number>): Try | undefined => {
    const key = order.join(',')
    if (routed.has(key)) {
      return undefined
    }
    routed.add(key)
    const phases: Array<Try['phases'][number]> = []
    const { problem, layout } = routeInOrder(
      rects,
      edges,
      settings,
      options,
      order,
      traced ? (phase, routes) => phases.push([phase, routes]) : undefined,
    )
    return { kind, order, layout, score: byInput(scoreLayout(problem, layout), order), phases }
  }

  let best = attempt('canonical', canonical) as Try
  yield best
  const reversed = attempt('reversed', canonical.toReversed())
  if (reversed !== undefined) {
    yield reversed
    if (before(reversed.score.total, best.score.total)) {
      best = reversed
    }
  }

  let promoted = new Set<number>()
  let improved = false
  for (;;) {
    // The edge with the largest share that has not moved up in this pass.
    // Shares compare exactly: this picks among edges, and decides nothing
    // about the geometry.
    let edge = -1
    for (const [i, share] of best.score.byEdge.entries()) {
      if (promoted.has(i)) {
        continue
      }
      const top = edge < 0 ? 0 : (best.score.byEdge[edge] as number)
      if (
        edge < 0 ||
        share > top ||
        (share === top && (rank[i] as number) < (rank[edge] as number))
      ) {
        edge = i
      }
    }
    if (edge < 0) {
      if (!improved) {
        return
      }
      promoted = new Set()
      improved = false
      continue
    }
    promoted.add(edge)
    const next = attempt('promotion', [edge, ...best.order.filter((i) => i !== edge)])
    if (next !== undefined) {
      yield next
      if (before(next.score.total, best.score.total)) {
        best = next
        improved = true
      }
    }
  }
}

/** A layout routed in several orders, and how it came about. */
export interface Routed {
  /** The layout kept, in input order. */
  readonly layout: ConnectorLayout
  /** The tries, in the order they routed. */
  readonly tries: ReadonlyArray<Try>
  /** The index of the try kept. */
  readonly kept: number
}

/**
 * Routes edges in several orders and keeps the layout that scores best
 * (see the module comment).
 *
 * @param rects - The placed rects, keyed by id.
 * @param edges - The edges, referencing rects by id.
 * @param settings - The routing spec.
 * @param options - The route constraints of each edge, and the shapes.
 * @param trace - Hears the routes after each phase of the kept try, by
 *   input index.
 * @returns The layout kept, in input order, and the tries.
 */
export function routeBest(
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge<string>>,
  settings: Settings,
  options: ConnectorApplyOptions = {},
  trace?: Trace,
): Routed {
  const tries: Array<Try> = []
  let kept = 0
  for (const next of triesOf(rects, edges, settings, options, trace !== undefined)) {
    tries.push(next)
    if (before(next.score.total, (tries[kept] as Try).score.total)) {
      kept = tries.length - 1
    }
    if (tries.length >= SOLVES) {
      break
    }
  }
  const best = tries[kept] as Try
  if (trace !== undefined) {
    for (const [phase, routes] of best.phases) {
      trace(phase, routes)
    }
  }
  return { layout: restore(best.layout, best.order), tries, kept }
}
