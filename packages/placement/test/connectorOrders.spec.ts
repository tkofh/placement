import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import { canonicalOrder, restore, route } from '../src/internal/connector/canonical.ts'
import { MOVES, SOLVES, type Try, routeBest } from '../src/internal/connector/orders.ts'
import * as Rect from '../src/rect.ts'
import { type SceneName, sceneOf } from './fixtures/judgements.ts'

// Routing in several orders: `Connector.apply` keeps the layout that
// scores best of the orders it tries, all of them from the canonical one.

const box = (x: number, y: number) => Rect.make(x, y, 40, 20)
const spec = Connector.make({ clearance: 8, gap: 4 })

// Five edges among nine rects. In canonical order g->c leaves g's left
// side beside g->d, so g->d jogs into d. With i->e moved to the front, it
// takes the column at 172 rather than 156, g->c leaves g's bottom instead
// and passes above e, and g->d runs straight: two corners fewer.
const jog = {
  rects: {
    a: box(12, 12),
    b: box(12, 80),
    c: box(4, 176),
    d: box(112, 12),
    e: box(104, 80),
    f: box(100, 164),
    g: box(208, 12),
    h: box(204, 96),
    i: box(200, 160),
  },
  edges: [
    Edge.make({ source: 'g', target: 'd' }),
    Edge.make({ source: 'c', target: 'i' }),
    Edge.make({ source: 'a', target: 'e' }),
    Edge.make({ source: 'g', target: 'c' }),
    Edge.make({ source: 'i', target: 'e' }),
  ],
}

// A hub sends to two workers below it, one on each side of a rect under
// the hub, as the playground's events sends to indexer and exporter past
// db. Routed one at a time, the route to indexer leaves the hub's left,
// straight down, and the route to exporter its right, hooking into
// exporter's right side; neither gains by moving alone. Moved together to
// the hub's right, they leave as one bundle and come into both workers
// from the top.
const egress = {
  rects: {
    events: Rect.make(784, 176, 136, 40),
    db: Rect.make(784, 360, 120, 40),
    indexer: Rect.make(692, 540, 112, 36),
    exporter: Rect.make(827, 540, 112, 36),
  },
  edges: (['indexer', 'exporter'] as const).map((target) =>
    Edge.make({
      source: 'events',
      target,
      radius: 16,
      thickness: 1.75,
      adornments: [
        Adornment.make({
          frame: Frame.make({ width: 9, height: 8, offsetLeft: 4 }),
          at: 1,
          orient: Adornment.orient.forward,
        }),
      ],
    }),
  ),
  spec: Connector.make({
    clearance: 16,
    gap: 8,
    jogSlant: 2,
    merge: Connector.merge.side,
    mergeGap: 4,
  }),
}

// A try by its order and the networks it holds.
const keyOf = ({ order, moves }: Try) => `${order.join()} ${JSON.stringify(moves)}`

const pointsOf = (layout: Connector.ConnectorLayout) =>
  layout.edges.map((route) => route?.points.map(({ x, y }) => [x, y]))

// A permutation of `0..n-1` from a seed.
const permutation = (n: number, seed: number): Array<number> => {
  let state = seed
  const list = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) % 2147483648
    const j = Math.floor((state / 2147483648) * (i + 1))
    ;[list[i], list[j]] = [list[j] as number, list[i] as number]
  }
  return list
}

describe('routing in several orders', () => {
  test('keeps a promotion that turns less than the canonical order', () => {
    const { rects, edges } = jog
    const routed = routeBest(rects, edges, spec)
    const kept = routed.tries[routed.kept] as Try
    const canonical = routed.tries[0] as Try
    expect(canonical.kind).toBe('canonical')
    expect(kept.kind).toBe('promotion')
    expect(kept.order[0]).toBe(4)
    expect(canonical.score.terms.turning - kept.score.terms.turning).toBe(2 * 24)
    expect(kept.score.total).toBeLessThan(canonical.score.total)
    expect(pointsOf(route(rects, edges, spec))[0]).toHaveLength(4)
    const layout = Connector.apply(rects, edges, spec)
    expect(layout).toEqual(restore(kept.layout, kept.order))
    expect(pointsOf(layout)[0]).toEqual([
      [208, 22],
      [152, 22],
    ])
  })

  test('keeps the canonical layout where no order beats it', () => {
    // Two routes that never meet route alike in every order.
    const rects = { a: box(0, 0), b: box(100, 0), c: box(0, 100), d: box(100, 100) }
    const edges = [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'c', target: 'd' })]
    const routed = routeBest(rects, edges, spec)
    expect(routed.kept).toBe(0)
    expect(Connector.apply(rects, edges, spec)).toEqual(route(rects, edges, spec))
  })

  test('tries the canonical order, its reverse, promotions, then network moves, each once', () => {
    const { rects, edges, spec: settings } = sceneOf('case1')
    const { tries } = routeBest(rects, edges, settings)
    const canonical = canonicalOrder(rects, edges)
    expect(tries.length).toBe(SOLVES + MOVES)
    expect(tries.map(({ kind }) => kind)).toEqual([
      'canonical',
      'reversed',
      ...Array.from({ length: SOLVES - 2 }, () => 'promotion'),
      ...Array.from({ length: MOVES }, () => 'network'),
    ])
    expect(tries.slice(0, SOLVES).every(({ moves }) => moves.length === 0)).toBe(true)
    expect(tries[0]?.order).toEqual(canonical)
    expect(tries[1]?.order).toEqual(canonical.toReversed())
    expect(new Set(tries.map(keyOf)).size).toBe(tries.length)
  })

  test('routes a single edge once in order, and moves its two ends', () => {
    // The ends of a lone edge are networks of one each, and each moves to
    // the three sides it does not take, once, unless a move improves.
    const rects = { a: box(0, 0), b: box(100, 40) }
    const routed = routeBest(rects, [Edge.make({ source: 'a', target: 'b' })], spec)
    expect(routed.tries.filter(({ kind }) => kind !== 'network')).toHaveLength(1)
    expect(routed.tries.filter(({ kind }) => kind === 'network')).toHaveLength(6)
    expect(routed.kept).toBe(0)
  })

  test('keeps a network move that takes routes to a side none takes alone', () => {
    const { rects, edges, spec: settings } = egress
    const routed = routeBest(rects, edges, settings)
    const kept = routed.tries[routed.kept] as Try
    expect(kept.kind).toBe('network')
    expect(kept.moves).toEqual([{ rect: 'events', end: 0, side: Edge.side.right }])
    // Routed in order alone, one leaves the hub's left and one its right.
    const orders = routed.tries.filter(({ kind }) => kind !== 'network')
    for (const { layout } of orders) {
      expect(layout.edges.map((route) => route?.points[0]?.x).toSorted()).toEqual([784, 920])
    }
    // The move saves the hook into exporter's right side, and the length
    // the two routes run apart: about 200.
    expect(Math.min(...orders.map(({ score }) => score.total))).toBeGreaterThan(
      kept.score.total + 200,
    )
    const layout = Connector.apply(rects, edges, settings)
    expect(layout.edges.map((route) => route?.points[0]?.x)).toEqual([920, 920])
    expect(layout.edges.map((route) => route?.points.at(-1)?.y)).toEqual([540, 540])
    expect(layout).toEqual(restore(kept.layout, kept.order))
  })

  test('keeps the layout of the orders where no network move beats it', () => {
    // In the fan, a bus sends to six rects to its right and below it. A
    // promotion draws the layout kept, and moving any network of it, the
    // bus's egress or a lone end, scores worse.
    const { rects, edges, spec: settings } = sceneOf('fan')
    const routed = routeBest(rects, edges, settings)
    const kept = routed.tries[routed.kept] as Try
    expect(kept.kind).not.toBe('network')
    expect(routed.tries.some(({ kind }) => kind === 'network')).toBe(true)
    for (const { kind, score } of routed.tries) {
      if (kind === 'network') {
        expect(score.total).toBeGreaterThan(kept.score.total)
      }
    }
    expect(Connector.apply(rects, edges, settings)).toEqual(restore(kept.layout, kept.order))
  })

  test('traces the phases of the try it keeps', () => {
    const { rects, edges } = jog
    const heard: Array<unknown> = []
    const routed = routeBest(rects, edges, spec, {}, (phase, routes) => heard.push([phase, routes]))
    expect(routed.kept).not.toBe(0)
    expect(heard).toEqual((routed.tries[routed.kept] as Try).phases)
    expect(heard.length).toBeGreaterThan(0)
  })

  // Scenes where an order other than the canonical one wins, and where a
  // network move wins.
  test.each<SceneName>(['case5', 'case6', 'case4', 'diabolical'])(
    '%s does not depend on the order of the edges or the keys',
    (name) => {
      const { rects, edges, spec: settings } = sceneOf(name)
      const routed = routeBest(rects, edges, settings)
      expect(routed.kept).not.toBe(0)
      const ids = Object.keys(rects)
      for (const seed of [1, 2, 3]) {
        const order = permutation(edges.length, seed)
        const keys = permutation(ids.length, seed).map((k) => ids[k] as string)
        const shuffled: Record<string, Rect.Rect> = {}
        for (const key of keys) {
          shuffled[key] = rects[key] as Rect.Rect
        }
        const layout = Connector.apply(
          shuffled,
          order.map((i) => edges[i] as Edge.Edge<string>),
          settings,
        )
        expect(restore(layout, order)).toEqual(routed.layout)
      }
    },
  )
})
