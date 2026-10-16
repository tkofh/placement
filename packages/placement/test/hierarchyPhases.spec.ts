import { describe, expect, test } from 'vitest'
import { findReversed } from '../src/internal/hierarchy/acyclic.ts'
import type { LayeredGraph, Segment } from '../src/internal/hierarchy/graph.ts'
import { FAR, type Jog, NEAR, assignLanes } from '../src/internal/hierarchy/lanes.ts'
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

const jog = (start: number, end: number): Jog => ({ start, end })
const insideJog = (x: number, j: Jog) =>
  x > Math.min(j.start, j.end) && x < Math.max(j.start, j.end)

describe('assignLanes', () => {
  // The crossings in an assignment: for each overlapping pair, the
  // connections of the nearer jog that cross the farther one, and back.
  function crossingsOf(jogs: ReadonlyArray<Jog>, lanes: ReadonlyArray<number>): number {
    let total = 0
    for (let i = 0; i < jogs.length; i++) {
      for (let k = 0; k < jogs.length; k++) {
        const a = jogs[i] as Jog
        const b = jogs[k] as Jog
        if ((lanes[i] as number) < (lanes[k] as number)) {
          total += (insideJog(a.end, b) ? 1 : 0) + (insideJog(b.start, a) ? 1 : 0)
        }
      }
    }
    return total
  }

  test.each([
    ['no jogs', [], [], 0],
    ['apart', [jog(0, 10), jog(20, 30)], [0, 0], 1],
    // A jog that leads on where another comes in runs farther, so the two
    // never meet.
    ['end to end', [jog(0, 10), jog(10, 20)], [1, 0], 2],
    ['a fan-out', [jog(10, 0), jog(10, 20)], [0, 0], 1],
    // Staggered jogs in one direction: the later one jogs nearer.
    ['staggered', [jog(0, 10), jog(5, 15)], [1, 0], 2],
    // Nested jogs toward one side: the outer one jogs nearer.
    ['nested', [jog(20, 0), jog(25, 10)], [0, 1], 2],
  ] as const)('%s', (_, jogs, lanes, count) => {
    expect(assignLanes(jogs)).toEqual({ lanes, count })
  })

  test('overlapping jogs never share a lane', () => {
    let state = 7
    const next = () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    }
    for (let round = 0; round < 50; round++) {
      const jogs = Array.from({ length: 8 }, () =>
        jog(Math.floor(next() * 20) * 5, Math.floor(next() * 20) * 5),
      )
      const { lanes, count } = assignLanes(jogs)
      expect(assignLanes(jogs)).toEqual({ lanes, count })
      for (let i = 0; i < jogs.length; i++) {
        expect(lanes[i]).toBeLessThan(count)
        for (let k = i + 1; k < jogs.length; k++) {
          const a = jogs[i] as Jog
          const b = jogs[k] as Jog
          const overlap =
            Math.min(Math.max(a.start, a.end), Math.max(b.start, b.end)) -
            Math.max(Math.min(a.start, a.end), Math.min(b.start, b.end))
          if (overlap > 0) {
            expect(lanes[i]).not.toBe(lanes[k])
          }
        }
      }
    }
  })

  test('staggered jogs in one direction avoid every crossing', () => {
    const jogs = [jog(20, 50), jog(0, 30), jog(25, 55), jog(10, 40), jog(60, 70)]
    const { lanes } = assignLanes(jogs)
    expect(crossingsOf(jogs, lanes)).toBe(0)
  })

  test('a jog inside another one in the same direction crosses it once', () => {
    const jogs = [jog(0, 60), jog(10, 40)]
    const { lanes, count } = assignLanes(jogs)
    expect(count).toBe(2)
    expect(crossingsOf(jogs, lanes)).toBe(1)
  })

  // U-turns around a node on the far side nest with the outer one nearer,
  // and around a node on the near side with the inner one nearer.
  test.each([
    ['far', FAR, [0, 1]],
    ['near', NEAR, [1, 0]],
  ] as const)('U-turns toward the %s side nest', (_, side, lanes) => {
    const turn = (start: number, end: number): Jog => ({
      start,
      end,
      startSide: side,
      endSide: side,
    })
    expect(assignLanes([turn(0, 30), turn(10, 20)])).toEqual({ lanes, count: 2 })
  })

  test('a jog runs past a U-turn on the side its connections avoid', () => {
    // The turn leads to the far side at 10 and 30, so the jog that comes in
    // at 20 from the near side runs nearer, crossing nothing.
    const turn: Jog = { start: 10, end: 30, startSide: FAR, endSide: FAR }
    expect(assignLanes([turn, jog(20, 40)])).toEqual({ lanes: [1, 0], count: 2 })
  })

  test('two jogs that swap sides cross once in either order', () => {
    const jogs = [jog(0, 10), jog(15, 5)]
    const { lanes, count } = assignLanes(jogs)
    expect(count).toBe(2)
    expect(crossingsOf(jogs, lanes)).toBe(1)
  })
})
