import { describe, expect, test } from 'vitest'
import { findReversed } from '../src/internal/graph/acyclic.ts'
import type { LayeredGraph, Segment } from '../src/internal/hierarchy/graph.ts'
import { countCrossings, order } from '../src/internal/hierarchy/order.ts'
import { rank } from '../src/internal/hierarchy/rank.ts'

const e = (tail: number, head: number, weight = 1, minLength = 1) => ({
  tail,
  head,
  weight,
  minLength,
})

describe('findReversed', () => {
  test.each([
    [
      'a chain has no back edges',
      3,
      [
        [0, 1],
        [1, 2],
      ],
      [false, false],
    ],
    [
      'a two-cycle reverses its second edge',
      2,
      [
        [0, 1],
        [1, 0],
      ],
      [false, true],
    ],
    [
      'a three-cycle reverses the closing edge',
      3,
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
      [false, false, true],
    ],
    [
      'node order decides which edge is back',
      3,
      [
        [2, 0],
        [0, 1],
        [1, 2],
      ],
      [true, false, false],
    ],
    [
      'a forward shortcut is kept',
      3,
      [
        [0, 1],
        [1, 2],
        [0, 2],
      ],
      [false, false, false],
    ],
  ] as const)('%s', (_, count, pairs, expected) => {
    const edges = pairs.map(([source, target]) => ({ source, target }))
    expect(findReversed(count, edges)).toEqual(expected)
  })
})

describe('rank', () => {
  test('a chain ranks consecutively', () => {
    expect(rank(3, [e(0, 1), e(1, 2)])).toEqual([0, 1, 2])
  })

  test('minimum lengths hold', () => {
    expect(rank(3, [e(0, 1, 1, 2), e(1, 2, 1, 3)])).toEqual([0, 2, 5])
  })

  test('network simplex tightens edges that longest-path leaves slack', () => {
    // 0 -> 1 is a short branch beside the chain 0 -> 2 -> 3 -> 4. Longest
    // path puts 1 on the sink rank. The optimum pulls it up next to 0.
    expect(rank(5, [e(0, 1), e(0, 2), e(2, 3), e(3, 4)])).toEqual([0, 1, 1, 2, 3])
  })

  test('weights decide which edge stays short', () => {
    // The chain 0 -> 3 -> 4 -> 2 spans three ranks, so 1 can sit next to
    // either 0 or 2. It sits next to the end of its heavier edge.
    const chain = [e(0, 3), e(3, 4), e(4, 2)]
    expect(rank(5, [...chain, e(0, 1, 1), e(1, 2, 10)])).toEqual([0, 2, 3, 1, 2])
    expect(rank(5, [...chain, e(0, 1, 10), e(1, 2, 1)])).toEqual([0, 1, 3, 1, 2])
  })

  test('parallel edges merge', () => {
    expect(rank(2, [e(0, 1, 1, 1), e(0, 1, 1, 3)])).toEqual([0, 3])
  })

  test('each component normalizes to rank 0', () => {
    expect(rank(4, [e(0, 1), e(2, 3, 1, 2)])).toEqual([0, 1, 0, 2])
  })

  test('isolated nodes rank 0', () => {
    expect(rank(2, [])).toEqual([0, 0])
  })

  test('non-dyadic weights terminate at the optimum', () => {
    const ranks = rank(5, [e(0, 1, 0.1), e(0, 2, 0.1), e(2, 3, 0.1), e(3, 4, 0.1)])
    expect(ranks).toEqual([0, 1, 1, 2, 3])
  })
})

function layered(ranks: Array<number>, pairs: Array<[number, number]>): LayeredGraph {
  const up: Array<Array<number>> = ranks.map(() => [])
  const down: Array<Array<number>> = ranks.map(() => [])
  const segments: Array<Segment> = pairs.map(([upper, lower], index) => {
    down[upper]?.push(index)
    up[lower]?.push(index)
    return { upper, lower, weight: 1, upperShift: 0, lowerShift: 0, alignable: true }
  })
  return {
    rankCount: Math.max(...ranks) + 1,
    ranks,
    dummy: ranks.map(() => false),
    segments,
    up,
    down,
  }
}

describe('order', () => {
  test('countCrossings counts each crossing pair once', () => {
    // 0 -> 3 and 1 -> 2 cross. 0 -> 2 shares an endpoint with both.
    const graph = layered(
      [0, 0, 1, 1],
      [
        [0, 3],
        [1, 2],
        [0, 2],
      ],
    )
    const position = new Int32Array([0, 1, 0, 1])
    expect(
      countCrossings(
        graph,
        [
          [0, 1],
          [2, 3],
        ],
        position,
      ),
    ).toBe(1)
  })

  test('crossing reduction removes avoidable crossings', () => {
    // The initial order puts 2 under 1 and 3 under 0.
    const graph = layered(
      [0, 0, 1, 1],
      [
        [1, 2],
        [0, 3],
      ],
    )
    const layers = order(graph)
    const position = new Int32Array(4)
    for (const layer of layers) {
      for (const [i, element] of layer.entries()) {
        position[element] = i
      }
    }
    expect(countCrossings(graph, layers, position)).toBe(0)
  })

  test('order keeps every element exactly once', () => {
    const graph = layered(
      [0, 0, 0, 1, 1, 1, 2],
      [
        [0, 4],
        [1, 3],
        [2, 5],
        [0, 5],
        [3, 6],
        [5, 6],
      ],
    )
    const layers = order(graph)
    expect(layers.map((layer) => [...layer].toSorted())).toEqual([[0, 1, 2], [3, 4, 5], [6]])
  })
})
