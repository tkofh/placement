import { describe, expect, test } from 'vitest'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import { canonicalOrder, restore, route } from '../src/internal/connector/canonical.ts'
import { SOLVES, type Try, routeBest } from '../src/internal/connector/orders.ts'
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

  test('tries the canonical order, its reverse, then promotions, each once', () => {
    const { rects, edges, spec: settings } = sceneOf('case1')
    const { tries } = routeBest(rects, edges, settings)
    const canonical = canonicalOrder(rects, edges)
    expect(tries.length).toBe(SOLVES)
    expect(tries.map(({ kind }) => kind)).toEqual([
      'canonical',
      'reversed',
      ...Array.from({ length: SOLVES - 2 }, () => 'promotion'),
    ])
    expect(tries[0]?.order).toEqual(canonical)
    expect(tries[1]?.order).toEqual(canonical.toReversed())
    expect(new Set(tries.map(({ order }) => order.join())).size).toBe(tries.length)
  })

  test('routes a single edge once', () => {
    const rects = { a: box(0, 0), b: box(100, 40) }
    const routed = routeBest(rects, [Edge.make({ source: 'a', target: 'b' })], spec)
    expect(routed.tries.length).toBe(1)
  })

  test('traces the phases of the try it keeps', () => {
    const { rects, edges } = jog
    const heard: Array<unknown> = []
    const routed = routeBest(rects, edges, spec, {}, (phase, routes) => heard.push([phase, routes]))
    expect(routed.kept).not.toBe(0)
    expect(heard).toEqual((routed.tries[routed.kept] as Try).phases)
    expect(heard.length).toBeGreaterThan(0)
  })

  // Scenes where an order other than the canonical one wins.
  test.each<SceneName>(['case5', 'case6'])(
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
