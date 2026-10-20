import type { ConnectorApplyOptions, ConnectorLayout } from '../../connector.ts'
import type { Edge } from '../../edge.ts'
import type * as Rect from '../../rect.ts'
import { before } from '../../utils/tolerance.ts'
import type { XY } from '../orient.ts'
import { canonicalOrder, restore, routeInOrder } from './canonical.ts'
import type { Trace } from './pipeline.ts'
import { type End, type Problem, type Settings, rectAt } from './problem.ts'
import { type Score, scoreLayout } from './score.ts'
import { type Facing, facingCosts } from './sides.ts'

// The ways a problem routes. Every phase settles its ties by the order of
// the edges, and the routes found first shape the ones after them, so one
// order can draw a layout much worse than another. The side search, too,
// picks the side of each auto end one route at a time: where the routes
// out of a node draw best leaving it together by a side none of them takes
// alone, no one route gains by moving there, and the search keeps them
// where they are. `routeBest` routes the problem several ways and keeps
// the layout that `scoreLayout` likes best:
//
// 1. the canonical order, first, so that a tie keeps its layout;
// 2. the canonical order reversed, a second start that routes the edges
//    at the rim of the graph first;
// 3. promotions: the edge with the largest share of the best layout's
//    score so far moves to the front of that layout's order, so that it
//    routes before the edges that crowded it. Each edge moves up once in
//    a pass, the worst first, and a new pass starts when a pass improved
//    the best layout;
// 4. network moves: a network, the auto ends at one rect of the edges
//    that leave it (its egress) or of those that enter it (its ingress),
//    is held to one side, and the problem routes again in the best
//    layout's order, every other end as auto as before. The network with
//    the largest share of the best layout's score moves first, to each
//    side but the one all its ends already take, in the order its center
//    of mass faces them (see `facingCosts`). A move kept holds its
//    network in the tries after it, so moves add up, and a later move of
//    the network replaces it. Each network moves once in a pass, the
//    worst first, and a new pass starts when a pass improved the best
//    layout. A lone end is a network of one.
//
// A move is scored against the problem as given, its ends auto, so that
// it competes with the orders on one scale. The orders go first, at most
// `SOLVES` solves, and the moves after them, at most `MOVES`: a move is
// judged in the order that routes the rest best, and a move judged in a
// poor order can lose to the crowding a promotion would have cleared.
// Routed the other way round, moves first, the random diagrams of the
// property tests score worse for the same solves.
//
// A layout replaces the best only when it scores less beyond the tolerance
// band, and a try already routed is not routed again. Each kind stops
// early when a pass improves nothing. Every order derives from the
// canonical one, and every network from the rects' ids, so the layout
// still depends only on the graph, and never on the order the edges came
// in.

/**
 * How many times a problem is solved, at most, in as many orders: the
 * canonical order, its reverse, and six promotions. Each solve costs about
 * what the first did. Over the auth sweep of the playground's diagram,
 * eight solves take the mean score about 85% of the way to what sixteen
 * reach, and over the random diagrams of the property tests about 95%;
 * the reverse alone takes it about half of the way.
 */
export const SOLVES = 8

/**
 * How many times a problem is solved, at most, with a network moved, after
 * the orders. Over the auth sweep of the playground's diagram, eight moves
 * take the mean score about 90% of the way to what moves without limit
 * reach, and over the random diagrams of the property tests about half of
 * the way; sixteen take it about 65% of the way there. Four orders and
 * twelve moves score about as well as eight of each, but a layout that
 * only a fifth promotion finds would be lost to them, and eight orders
 * first keep every layout the orders alone would keep.
 */
export const MOVES = 8

/** The kind of a try: the order it routed in, or a network it moved. */
export type Kind = 'canonical' | 'reversed' | 'promotion' | 'network'

/**
 * A network held to one side: the auto ends of the edges that leave a
 * rect, its egress, or of those that enter it, its ingress.
 */
export interface Move {
  /** The id of the rect. */
  readonly rect: string
  /** `0` for the rect's egress, the source ends there, `1` for its ingress. */
  readonly end: number
  /** The side the ends are held to, `0` to `3` from the top, clockwise. */
  readonly side: number
}

/** A layout routed one way, and what it scores. */
export interface Try {
  /** How the try came about. */
  readonly kind: Kind
  /** The input index of the edge at each position of the order. */
  readonly order: ReadonlyArray<number>
  /** The networks held to a side, in the order of their rects' ids. */
  readonly moves: ReadonlyArray<Move>
  /** The network this try moved, for a `network` try. */
  readonly move: Move | undefined
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

// The auto ends at one rect of one direction, `end` `0` for its egress and
// `1` for its ingress, as `facingCosts` gathers them: loops aside.
interface Network {
  readonly rect: number
  readonly end: number
  /** Its edges, by input index. */
  readonly edges: Array<number>
  /** What its ends cost on each side for the way it faces. */
  readonly facing: ReadonlyArray<number>
}

// The networks of a problem whose edges are in `order`, by rect and then
// end.
function networksOf(problem: Problem, order: ReadonlyArray<number>): Array<Network> {
  const facing = facingCosts(problem)
  const found = new Map<number, Network>()
  for (const [k, edge] of problem.edges.entries()) {
    if (edge.loop) {
      continue
    }
    for (const end of [0, 1]) {
      if ((edge.ends[end] as End).side !== undefined) {
        continue
      }
      const rect = rectAt(edge, end)
      const key = 2 * rect + end
      let network = found.get(key)
      if (network === undefined) {
        const faces = (facing[k] as Facing)[end] as ReadonlyArray<number>
        network = { rect, end, edges: [], facing: faces }
        found.set(key, network)
      }
      network.edges.push(order[k] as number)
    }
  }
  return [...found.entries()].toSorted(([a], [b]) => a - b).map(([, network]) => network)
}

// The side of a rect a port sits on: the side it is nearest.
function sideOf(box: Rect.Rect, x: number, y: number): number {
  const away = [
    Math.abs(y - box.top),
    Math.abs(x - box.right),
    Math.abs(y - box.bottom),
    Math.abs(x - box.left),
  ]
  return away.indexOf(Math.min(...away))
}

// The problem with the auto ends of the networks `moves` names held to
// their sides.
const holding =
  (moves: ReadonlyArray<Move>) =>
  (problem: Problem): Problem =>
    moves.length === 0
      ? problem
      : {
          ...problem,
          edges: problem.edges.map((edge) =>
            edge.loop
              ? edge
              : {
                  ...edge,
                  ends: edge.ends.map((at, end) => {
                    const move = moves.find((m) => m.end === end && m.rect === problem.ids[at.rect])
                    return move === undefined || at.side !== undefined
                      ? at
                      : { ...at, side: move.side }
                  }) as [End, End],
                },
          ),
        }

/**
 * The tries of a problem, in the order they route (see the module
 * comment), at most `SOLVES` orders and then at most `MOVES` network
 * moves. Each is solved when the one before it has been taken, so a
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
  let first: Problem | undefined
  const attempt = (
    kind: Kind,
    order: ReadonlyArray<number>,
    moves: ReadonlyArray<Move> = [],
    move: Move | undefined = undefined,
  ): Try | undefined => {
    const key = `${order.join(',')}|${moves.map(({ rect, end, side }) => `${rect} ${end} ${side}`).join(',')}`
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
      holding(moves),
    )
    first ??= problem
    const score = byInput(scoreLayout(problem, layout), order)
    return { kind, order, moves, move, layout, score, phases }
  }

  let best = attempt('canonical', canonical) as Try
  yield best
  const problem = first as Problem
  const networks = networksOf(problem, canonical)

  // The orders after the canonical one: its reverse, then promotions.
  function* orders(limit: number): Generator<Try, void, undefined> {
    let solves = 0
    if (solves >= limit) {
      return
    }
    const reversed = attempt('reversed', canonical.toReversed())
    if (reversed !== undefined) {
      yield reversed
      solves += 1
      if (before(reversed.score.total, best.score.total)) {
        best = reversed
      }
    }
    let promoted = new Set<number>()
    let improved = false
    while (solves < limit) {
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
        solves += 1
        if (before(next.score.total, best.score.total)) {
          best = next
          improved = true
        }
      }
    }
  }

  // The network moves, each in the order of the best layout so far.
  function* moves(limit: number): Generator<Try, void, undefined> {
    let moved = 0
    let tried = new Set<number>()
    let improved = false
    for (;;) {
      // The network with the largest share that has not moved in this pass,
      // its shares summed, compared exactly as the edges' are.
      let pick = -1
      let top = 0
      for (const [n, network] of networks.entries()) {
        if (tried.has(n)) {
          continue
        }
        let share = 0
        for (const i of network.edges) {
          share += best.score.byEdge[i] as number
        }
        if (pick < 0 || share > top) {
          pick = n
          top = share
        }
      }
      if (pick < 0) {
        if (!improved) {
          return
        }
        tried = new Set()
        improved = false
        continue
      }
      tried.add(pick)
      const network = networks[pick] as Network
      const id = problem.ids[network.rect] as string
      const box = problem.boxes[network.rect] as Rect.Rect
      // The sides its ends take in the best layout so far.
      const at = new Int32Array(edges.length)
      for (const [k, i] of best.order.entries()) {
        at[i] = k
      }
      const used = new Set<number>()
      for (const i of network.edges) {
        const points = best.layout.edges[at[i] as number]?.points
        const port = network.end === 0 ? points?.[0] : points?.at(-1)
        if (port !== undefined) {
          used.add(sideOf(box, port.x, port.y))
        }
      }
      const sides = [0, 1, 2, 3]
        .filter((side) => used.size !== 1 || !used.has(side))
        .toSorted((a, b) => (network.facing[a] as number) - (network.facing[b] as number) || a - b)
      const from = best
      for (const side of sides) {
        if (moved >= limit) {
          return
        }
        const move: Move = { rect: id, end: network.end, side }
        const held = [
          ...from.moves.filter((m) => m.rect !== id || m.end !== network.end),
          move,
        ].toSorted(
          (a, b) => problem.ids.indexOf(a.rect) - problem.ids.indexOf(b.rect) || a.end - b.end,
        )
        const next = attempt('network', from.order, held, move)
        if (next === undefined) {
          continue
        }
        yield next
        moved += 1
        if (before(next.score.total, best.score.total)) {
          best = next
          improved = true
        }
      }
    }
  }

  yield* orders(SOLVES - 1)
  yield* moves(MOVES)
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
 * Routes edges in several orders, and with networks moved, and keeps the
 * layout that scores best (see the module comment).
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
  }
  const best = tries[kept] as Try
  if (trace !== undefined) {
    for (const [phase, routes] of best.phases) {
      trace(phase, routes)
    }
  }
  return { layout: restore(best.layout, best.order), tries, kept }
}
