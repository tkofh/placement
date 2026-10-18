import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import { lengths, pointOnDrawn } from '../src/internal/adornments.ts'
import { cornerInsets, cornerRadii } from '../src/internal/connector/corners.ts'
import { addWhisk, step } from '../src/internal/connector/merge.ts'
import {
  type XY,
  firstTurn,
  nudge,
  partingCorners,
  partingSide,
} from '../src/internal/connector/nudge.ts'
import { straightenPorts } from '../src/internal/connector/ports.ts'
import { normalize, roomAt, tightCostAt } from '../src/internal/connector/problem.ts'
import { type Route, routeOf } from '../src/internal/connector/route.ts'
import { type SlantedRoute, slantJogs } from '../src/internal/connector/slants.ts'
import type { Obstacle } from '../src/internal/graph/graph.ts'
import { shortestPath } from '../src/internal/graph/search.ts'
import { type Pin, visibilityGraph } from '../src/internal/graph/visibility.ts'
import { type Separation, type Variable, placeSeparated } from '../src/internal/separation.ts'
import * as Rect from '../src/rect.ts'

const place = (variables: ReadonlyArray<Variable>, constraints: ReadonlyArray<Separation>) => {
  const { positions, conflicts } = placeSeparated(variables, constraints)
  return { positions: [...positions], conflicts }
}

const free = (desired: number): Variable => ({ desired })
const fixed = (desired: number): Variable => ({ desired, fixed: true })
const sep = (left: number, right: number, gap: number): Separation => ({ left, right, gap })

// The cheapest placement, by trying every set of constraints that could hold
// at exactly their gaps: each set is a linear system (the Lagrange
// conditions), and the cheapest solution that meets every constraint wins.
function bruteForce(
  variables: ReadonlyArray<Variable>,
  constraints: ReadonlyArray<Separation>,
): number | undefined {
  const n = variables.length
  let best: number | undefined
  for (let mask = 0; mask < 1 << constraints.length; mask++) {
    const active = constraints.filter((_, c) => (mask >> c) & 1)
    const pinned = variables.flatMap((v, i) => (v.fixed === true ? [i] : []))
    const size = n + active.length + pinned.length
    const matrix = Array.from({ length: size }, () => Array.from({ length: size + 1 }, () => 0))
    for (let i = 0; i < n; i++) {
      const v = variables[i] as Variable
      const row = matrix[i] as Array<number>
      row[i] = v.weight ?? 1
      row[size] = (v.weight ?? 1) * v.desired
    }
    for (const [k, { left, right, gap }] of active.entries()) {
      const row = matrix[n + k] as Array<number>
      row[right] = 1
      row[left] = -1
      row[size] = gap
      // The multiplier pushes right up and left down.
      ;(matrix[right] as Array<number>)[n + k] = -1
      ;(matrix[left] as Array<number>)[n + k] = 1
    }
    for (const [k, i] of pinned.entries()) {
      const row = matrix[n + active.length + k] as Array<number>
      row[i] = 1
      row[size] = (variables[i] as Variable).desired
      ;(matrix[i] as Array<number>)[n + active.length + k] = -1
    }
    const solution = solve(matrix)
    if (solution === undefined) {
      continue
    }
    const x = solution.slice(0, n)
    const feasible = constraints.every(
      ({ left, right, gap }) => (x[right] as number) - (x[left] as number) >= gap - 1e-9,
    )
    if (!feasible) {
      continue
    }
    const cost = variables.reduce(
      (sum, v, i) => sum + (v.weight ?? 1) * ((x[i] as number) - v.desired) ** 2,
      0,
    )
    if (best === undefined || cost < best) {
      best = cost
    }
  }
  return best
}

// Gaussian elimination with partial pivoting, or `undefined` when singular.
function solve(matrix: Array<Array<number>>): Array<number> | undefined {
  const size = matrix.length
  for (let col = 0; col < size; col++) {
    let pivot = col
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(matrix[row]?.[col] as number) > Math.abs(matrix[pivot]?.[col] as number)) {
        pivot = row
      }
    }
    if (Math.abs(matrix[pivot]?.[col] as number) < 1e-12) {
      return undefined
    }
    ;[matrix[col], matrix[pivot]] = [matrix[pivot] as Array<number>, matrix[col] as Array<number>]
    const top = matrix[col] as Array<number>
    for (let row = 0; row < size; row++) {
      const current = matrix[row] as Array<number>
      if (row === col) {
        continue
      }
      const factor = (current[col] as number) / (top[col] as number)
      for (let k = col; k <= size; k++) {
        const value = current[k] as number
        current[k] = value - factor * (top[k] as number)
      }
    }
  }
  return matrix.map((row, i) => (row[size] as number) / (row[i] as number))
}

const costOf = (variables: ReadonlyArray<Variable>, positions: ReadonlyArray<number>) =>
  variables.reduce(
    (sum, v, i) => sum + (v.weight ?? 1) * ((positions[i] as number) - v.desired) ** 2,
    0,
  )

describe('placeSeparated', () => {
  test('without constraints, every variable stays put', () => {
    expect(place([free(3), fixed(5), free(-2)], [])).toEqual({
      positions: [3, 5, -2],
      conflicts: [],
    })
  })

  test('two variables at one place move apart evenly', () => {
    expect(place([free(10), free(10)], [sep(0, 1, 8)]).positions).toEqual([6, 14])
  })

  test('weights decide who moves', () => {
    expect(place([{ desired: 0, weight: 3 }, free(0)], [sep(0, 1, 8)]).positions).toEqual([-2, 6])
  })

  test('a fixed variable holds its block in place', () => {
    expect(place([fixed(0), free(0), free(0)], [sep(0, 1, 4), sep(1, 2, 4)]).positions).toEqual([
      0, 4, 8,
    ])
  })

  test('a block splits where a constraint pulls its sides together', () => {
    // 1 pushes 0 down to make room, then 2 pushes 1 up past where 0 needs
    // it, so the constraint between 0 and 1 lets go.
    const variables = [free(0), free(0), free(20)]
    const constraints = [sep(0, 1, 4), sep(1, 2, 30)]
    const { positions } = place(variables, constraints)
    expect(costOf(variables, positions)).toBeCloseTo(
      bruteForce(variables, constraints) as number,
      9,
    )
    expect(positions[1]! - positions[0]!).toBeGreaterThanOrEqual(4 - 1e-9)
  })

  test('a constraint between fixed variables that cannot hold is a conflict', () => {
    const { positions, conflicts } = place(
      [fixed(0), free(2), fixed(5)],
      [sep(0, 1, 4), sep(1, 2, 4)],
    )
    expect(conflicts).toHaveLength(1)
    expect([...(conflicts[0]?.variables ?? [])].toSorted()).toEqual([0, 1, 2])
    expect(positions[0]).toBe(0)
    expect(positions[2]).toBe(5)
  })

  test.each(Array.from({ length: 60 }, (_, i) => i + 1))(
    'random problem %i is solved optimally',
    (seed) => {
      let state = seed
      const next = (n: number) => {
        state = (state * 1103515245 + 12345) % 2147483648
        return Math.floor((state / 2147483648) * n)
      }
      const count = 2 + next(4)
      const variables: Array<Variable> = Array.from({ length: count }, () => ({
        desired: next(21),
        weight: 1 + next(3),
        fixed: next(5) === 0,
      }))
      // Constraints point along a random order, so they never form a cycle.
      const order = Array.from({ length: count }, (_, i) => i).toSorted(() => next(3) - 1)
      const constraints: Array<Separation> = []
      for (let k = 0; k < 2 + next(4); k++) {
        const a = next(count)
        const b = next(count)
        if (a !== b) {
          const [left, right] = order.indexOf(a) < order.indexOf(b) ? [a, b] : [b, a]
          constraints.push(sep(left, right, next(9)))
        }
      }
      const expected = bruteForce(variables, constraints)
      const { positions, conflicts } = place(variables, constraints)
      if (expected === undefined) {
        expect(conflicts.length).toBeGreaterThan(0)
        return
      }
      expect(conflicts).toEqual([])
      for (const { left, right, gap } of constraints) {
        expect(positions[right]! - positions[left]!).toBeGreaterThanOrEqual(gap - 1e-9)
      }
      for (const [i, v] of variables.entries()) {
        if (v.fixed === true) {
          expect(positions[i]).toBe(v.desired)
        }
      }
      expect(costOf(variables, positions)).toBeCloseTo(expected, 9)
    },
  )
})

const route = (...points: Array<XY>) => points
const routed = (...points: Array<XY>) => routeOf(points)

describe('nudge', () => {
  test('routes that share nothing are unchanged', () => {
    const routes = [route([0, 0], [10, 0], [10, 20], [20, 20]), route([0, 40], [30, 40])]
    expect(nudge(routes, [], 8)).toEqual(routes)
  })

  test('collinear and repeated points are dropped', () => {
    expect(nudge([route([0, 0], [5, 0], [5, 0], [10, 0], [10, 10])], [], 8)).toEqual([
      route([0, 0], [10, 0], [10, 10]),
    ])
  })

  test('a shared segment splits, with each route on the side it leaves to', () => {
    // Both come in from the left and go back out to the left. The inner
    // route, which runs alongside the outer one for less, keeps inside.
    const outer = route([0, 0], [10, 0], [10, 30], [0, 30])
    const inner = route([0, 10], [10, 10], [10, 20], [0, 20])
    expect(nudge([outer, inner], [], 8)).toEqual([
      route([0, 0], [14, 0], [14, 30], [0, 30]),
      route([0, 10], [6, 10], [6, 20], [0, 20]),
    ])
  })

  test('routes keep their sides through a shared bend', () => {
    const p = route([0, 0], [0, 10], [30, 10], [30, 50], [60, 50])
    const q = route([10, -20], [10, 10], [30, 10], [30, 40], [60, 40])
    // q turns off first on the outside of the bend, so it stays outside:
    // above p, then right of it. Each jog centers on its run, a gap apart.
    expect(nudge([p, q], [], 8)).toEqual([
      route([0, 0], [0, 25], [28.5, 25], [28.5, 50], [60, 50]),
      route([10, -20], [10, 10], [36.5, 10], [36.5, 40], [60, 40]),
    ])
  })

  test('a jog leaps over a line that runs alongside all of it', () => {
    // The jog wants the middle of its run, past the other route's line. Its
    // legs go opposite ways, so leaping moves the crossing from one leg to
    // the other.
    const jog = route([0, 10], [80, 10], [80, 20], [100, 20])
    const line = route([70, -20], [70, 50])
    expect(nudge([jog, line], [], 8)[0]).toEqual(route([0, 10], [50, 10], [50, 20], [100, 20]))
  })

  test('a jog stays behind a line that runs alongside only part of it', () => {
    const jog = route([0, 10], [80, 10], [80, 20], [100, 20])
    const line = route([70, -20], [70, 15])
    expect(nudge([jog, line], [], 8)[0]).toEqual(route([0, 10], [78, 10], [78, 20], [100, 20]))
  })

  test.each([
    [0.25, 25],
    [0.75, 75],
  ])('a jog at %f of its run', (jogAt, x) => {
    const jog = route([0, 10], [80, 10], [80, 20], [100, 20])
    expect(nudge([jog], [], 8, [{ jogAt }])[0]?.[1]).toEqual([x, 10])
  })

  test('a segment does not move into an obstacle beside it', () => {
    const box: Obstacle = { left: 0, top: 0, right: 10, bottom: 30 }
    const a = route([20, -10], [10, -10], [10, 40], [20, 40])
    const b = route([20, -5], [10, -5], [10, 35], [20, 35])
    const [na, nb] = nudge([a, b], [box], 8)
    // Neither enters the box. The outer route stays on its edge, and the
    // inner one moves out, inside the outer one's turns.
    expect(na).toEqual(a)
    expect(nb).toEqual(route([20, -5], [18, -5], [18, 35], [20, 35]))
  })

  test('the segments at the ends of a route stay on their pins', () => {
    const a = route([10, 0], [10, 30], [30, 30])
    const b = route([10, 10], [10, 20], [30, 20])
    const [na, nb] = nudge([a, b], [], 8)
    expect(na?.[0]).toEqual([10, 0])
    expect(nb?.[0]).toEqual([10, 10])
    // Both first segments are fixed on x = 10, so neither moves.
    expect(na?.[1]?.[0]).toBe(10)
    expect(nb?.[1]?.[0]).toBe(10)
  })

  test.each([
    [3, [6, 3, 0]],
    [4, [6, 4, 2, 0]],
  ])('a narrow channel spreads %i routes evenly between its walls', (count, expected) => {
    const walls: Array<Obstacle> = [
      { left: -20, top: 0, right: 0, bottom: 40 },
      { left: 6, top: 0, right: 26, bottom: 40 },
    ]
    const routes = Array.from({ length: count }, (_, k) =>
      route([-30, -10 - k], [3, -10 - k], [3, 50 + k], [40, 50 + k]),
    )
    expect(nudge(routes, walls, 8).map((r) => r[1]?.[0])).toEqual(expected)
  })

  test('a squeeze beside a fixed segment splits the room evenly', () => {
    // The pinned route holds x = 1.75, and the wall x = 4, so the two
    // routes between share the 2.25 between them.
    const wall: Array<Obstacle> = [{ left: 4, top: -50, right: 30, bottom: 60 }]
    const pinned = route([1.75, -20], [1.75, 40])
    const a = route([-30, -10], [4, -10], [4, 50], [-30, 50])
    const b = route([-30, -5], [4, -5], [4, 45], [-30, 45])
    expect(nudge([pinned, a, b], wall, 3)).toEqual([
      pinned,
      a,
      route([-30, -5], [2.875, -5], [2.875, 45], [-30, 45]),
    ])
  })

  test('the ranges two segments may sit in order them, whatever their sides say', () => {
    // The two share y = 50 and part to different sides at the two ends, so
    // a crossing is unavoidable, and the sides alone put a above b. But a
    // runs straight through an anchor 4 below its line and keeps the gap
    // from it, so it may only move down, and b likewise only up.
    const a = route([0, 100], [0, 50], [100, 50], [100, 0])
    const b = route([20, 0], [20, 50], [120, 50], [120, 100])
    expect(nudge([a, b], [], 8)).toEqual([
      route([0, 100], [0, 46], [100, 46], [100, 0]),
      route([20, 0], [20, 54], [120, 54], [120, 100]),
    ])
    expect(
      nudge([a, b], [], 8, [
        { anchors: [[100, 46]], straight: [[100, 46]] },
        { anchors: [[120, 54]], straight: [[120, 54]] },
      ]),
    ).toEqual([
      route([0, 100], [0, 54], [100, 54], [100, 0]),
      route([20, 0], [20, 46], [120, 46], [120, 100]),
    ])
  })

  test('a jog between two segments of one route never turns back', () => {
    // b pushes the upper vertical of a right, past its lower vertical.
    const a = route([0, 0], [10, 0], [10, 20], [12, 20], [12, 40], [30, 40])
    const b = route([30, 2], [10, 2], [10, 18], [-10, 18])
    const [na] = nudge([a, b], [], 8)
    const upper = na?.[1]?.[0] as number
    const lower = na?.[3]?.[0] as number
    expect(upper).toBeLessThanOrEqual(lower)
  })

  test('segments that a move stretches into overlap move apart in another round', () => {
    // The horizontal of p centers on its run, down to y = 15, which
    // stretches the vertical before it into the start of q on x = 10. p
    // turns west there, so its vertical moves west of q.
    const p = route([0, 0], [10, 0], [10, 10], [-30, 10], [-30, 30])
    const q = route([10, 11], [10, 30], [0, 30])
    expect(nudge([p, q], [], 3)).toEqual([route([0, 0], [7, 0], [7, 15], [-30, 15], [-30, 30]), q])
  })

  test('segments that meet end to end on nearby lines move a gap apart', () => {
    // b and c share x = 12 below y = 10, where a ends on x = 10.
    const a = route([0, 0], [10, 0], [10, 10], [-10, 10])
    const b = route([30, 10], [12, 10], [12, 20], [30, 20])
    const c = route([40, 12], [12, 12], [12, 18], [40, 18])
    const [na, nb, nc] = nudge([a, b, c], [], 3)
    const xa = na?.[1]?.[0] as number
    const xb = nb?.[1]?.[0] as number
    const xc = nc?.[1]?.[0] as number
    expect(xb - xa).toBeCloseTo(3, 9)
    expect(xc - xb).toBeCloseTo(3, 9)
  })

  test('a segment through an anchor stays put', () => {
    const outer = route([0, 0], [10, 0], [10, 30], [0, 30])
    const inner = route([0, 10], [10, 10], [10, 20], [0, 20])
    expect(nudge([outer, inner], [], 8, [{ anchors: [[10, 15]] }])).toEqual([
      outer,
      route([0, 10], [2, 10], [2, 20], [0, 20]),
    ])
  })

  test('the rects a route avoids are walls for its segments only', () => {
    const outer = route([0, 0], [10, 0], [10, 30], [0, 30])
    const inner = route([0, 10], [10, 10], [10, 20], [0, 20])
    const avoid = [{ left: 0, top: 0, right: 7, bottom: 40 }]
    expect(nudge([outer, inner], [], 8, [undefined, { avoid }])).toEqual([
      route([0, 0], [15, 0], [15, 30], [0, 30]),
      route([0, 10], [7, 10], [7, 20], [0, 20]),
    ])
  })

  test('gaps are between strokes, widened by half of each thickness', () => {
    const outer = route([0, 0], [10, 0], [10, 30], [0, 30])
    const inner = route([0, 10], [10, 10], [10, 20], [0, 20])
    const thickness = [{ thickness: 2 }, { thickness: 2 }]
    expect(nudge([outer, inner], [], 8, thickness)).toEqual([
      route([0, 0], [15, 0], [15, 30], [0, 30]),
      route([0, 10], [5, 10], [5, 20], [0, 20]),
    ])
  })

  test('a stroke keeps off the walls by half its thickness', () => {
    const jog = route([0, -10], [10, -10], [10, 40], [20, 40])
    const wall = [{ left: 0, top: 5, right: 10, bottom: 25 }]
    expect(nudge([jog], wall, 8, [{ thickness: 2 }])[0]).toEqual(
      route([0, -10], [11, -10], [11, 40], [20, 40]),
    )
    expect(nudge([jog], wall, 8)[0]).toEqual(jog)
  })

  test('routes that leave one merge keep the merge gap while they run together', () => {
    // Both leave lanes 4 apart and turn east together; q ends on its run,
    // and p goes on to turn down.
    const p = route([0, 0], [0, 20], [60, 20], [60, 40])
    const q = route([4, 0], [4, 20], [40, 20])
    const merges = [0, -1] as const
    expect(nudge([p, q], [], 8, [{ merges }, { merges }], 2)[0]).toEqual(
      route([0, 0], [0, 22], [60, 22], [60, 40]),
    )
    // Apart, or in different merges, they keep the full gap.
    expect(nudge([p, q], [], 8, [], 2)[0]).toEqual(route([0, 0], [0, 28], [60, 28], [60, 40]))
    const apart = [{ merges: [0, -1] as const }, { merges: [1, -1] as const }]
    expect(nudge([p, q], [], 8, apart, 2)[0]).toEqual(route([0, 0], [0, 28], [60, 28], [60, 40]))
  })

  test('a jog that leaves a merge with another route sits beside it', () => {
    // p's jog would center on its run, at 50, but it runs on with q, so it
    // sits the merge gap from q's end.
    const p = route([0, 0], [0, 20], [60, 20], [60, 100])
    const q = route([4, 0], [4, 20], [40, 20])
    const merges = [0, -1] as const
    expect(nudge([p, q], [], 8, [{ merges }, { merges }], 2)[0]).toEqual(
      route([0, 0], [0, 22], [60, 22], [60, 100]),
    )
    const apart = [{ merges: [0, -1] as const }, { merges: [1, -1] as const }]
    expect(nudge([p, q], [], 8, apart, 2)[0]).toEqual(route([0, 0], [0, 50], [60, 50], [60, 100]))
  })

  test('the bottom of a U stays put in its bundle', () => {
    // Moving it up to q would lengthen p and drag both its legs.
    const p = route([0, 0], [0, 50], [60, 50], [60, -30])
    const q = route([4, 0], [4, 20], [40, 20])
    const merges = [0, -1] as const
    expect(nudge([p, q], [], 8, [{ merges }, { merges }], 2)[0]).toEqual(p)
  })

  test('routes that turn apart from a merge are no longer coupled', () => {
    // q turns west off its lane where p turns east, so p keeps the full gap
    // from it there. A corner too large for p's run keeps its jog, which
    // parts from q, in the middle.
    const p = route([0, 0], [0, 20], [60, 20], [60, 40])
    const q = route([4, 0], [4, 20], [-40, 20])
    const merges = [0, -1] as const
    const [np] = nudge([p, q], [], 8, [{ merges, corner: 1000 }, { merges }], 2)
    expect(Math.abs((np?.[1]?.[1] as number) - 20)).toBe(8)
  })

  test('a jog that parts from its bundle goes as late as its corners allow', () => {
    // p parts from q at its jog, which goes toward the far end of its run,
    // short of it by p's corner and the adornments at its port.
    const p = route([0, 0], [0, 20], [60, 20], [60, 100])
    const q = route([4, 0], [4, 100])
    const merges = [0, -1] as const
    const parted = (packs: readonly [number, number]) =>
      nudge([p, q], [], 8, [{ merges, corner: 10, packs }, { merges }], 2)[0]?.[1]?.[1]
    expect(parted([0, 0])).toBe(90)
    expect(parted([0, 8])).toBe(82)
    // From the target's merge, the far end is the start.
    const r = route([60, 0], [60, 80], [0, 80], [0, 100])
    const t = route([4, 0], [4, 100])
    const ends = [-1, 0] as const
    const [nr] = nudge([r, t], [], 8, [{ merges: ends, corner: 10 }, { merges: ends }], 2)
    expect(nr?.[1]?.[1]).toBe(10)
  })

  test('jogs that part from a bundle together go as late as the least of them', () => {
    // p and q part from s together, turning east with q inside, then down
    // with p inside; p's larger corner holds the pair back.
    const p = route([0, 0], [0, 20], [50, 20], [50, 100])
    const q = route([4, 0], [4, 10], [60, 10], [60, 100])
    const s = route([-4, 0], [-4, 100])
    const merges = [0, -1] as const
    const constraints = [{ merges, corner: 20 }, { merges, corner: 10 }, { merges }]
    const [np, nq] = nudge([p, q, s], [], 8, constraints, 2)
    expect(nq?.[1]?.[1]).toBe(78)
    expect(np?.[1]?.[1]).toBe(80)
  })

  test('a route keeps out from between the lanes of a merge', () => {
    // p and q leave one merge on lanes 2 apart; r's jog would sit between
    // them, squeezed, but goes past p, toward where it wants to be.
    const p = route([0, 0], [0, 100], [-30, 100])
    const q = route([2, 0], [2, 100], [30, 100])
    const r = route([-50, 40], [1, 40], [1, 60], [50, 60])
    const merges = [0, -1] as const
    const constraints = [{ merges }, { merges }, {}]
    expect(nudge([p, q, r], [], 8, constraints, 2)[2]).toEqual(
      route([-50, 40], [-8, 40], [-8, 60], [50, 60]),
    )
    // Lanes of different merges are no bundle.
    const apart = [{ merges: [0, -1] as const }, { merges: [1, -1] as const }, {}]
    expect(nudge([p, q, r], [], 8, apart, 2)[2]).toEqual(r)
  })

  test('an end between the lanes of a merge steps out past them', () => {
    // r leaves its port between p's and q's lanes, which hold still as it
    // does. It runs straight out of the obstacle around its port, then
    // steps a gap past p, and that step stays put.
    const p = route([100, 0], [0, 0], [0, 50])
    const q = route([100, 2], [30, 2], [30, 50])
    const r = route([-40, 1], [60, 1], [60, 80])
    const port = [{ left: -60, top: -20, right: -30, bottom: 20 }]
    const merges = [0, -1] as const
    const constraints = [{ merges }, { merges }, {}]
    expect(nudge([p, q, r], port, 8, constraints, 2)[2]).toEqual(
      route([-40, 1], [-30, 1], [-30, -8], [60, -8], [60, 80]),
    )
    // Lanes of different merges hold it nowhere.
    const apart = [{ merges: [0, -1] as const }, { merges: [1, -1] as const }, {}]
    expect(nudge([p, q, r], port, 8, apart, 2)[2]).toEqual(r)
    // Nor do lanes that it meets within the obstacle.
    const near = [{ left: -60, top: -20, right: 10, bottom: 20 }]
    expect(nudge([p, q, r], near, 8, constraints, 2)[2]).toEqual(r)
  })

  test('the segment past a port stays on its side of it', () => {
    // p ends 2 past its last corner. Moved apart from q, its middle
    // segment stops at the end rather than passing it and turning back.
    const p = route([0, 0], [10, 0], [10, 20], [12, 20])
    const q = route([10, -10], [10, 30])
    const [np] = nudge([p, q], [], 8)
    const [last, before] = [np?.at(-1) as XY, np?.at(-2) as XY]
    expect(before[0]).toBeLessThanOrEqual(last[0])
  })

  test('a gap of zero changes nothing but the points', () => {
    const outer = route([0, 0], [10, 0], [10, 30], [0, 30])
    const inner = route([0, 10], [10, 10], [10, 20], [0, 20])
    expect(nudge([outer, inner], [], 0)).toEqual([outer, inner])
  })
})

const HEADINGS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const

// A deterministic diagram: boxes in a loose grid, inflated by a clearance,
// with pins on their sides that leave outward, and routes between random
// pairs of pins.
function randomDiagram(seed: number) {
  let state = seed
  const next = (n: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return Math.floor((state / 2147483648) * n)
  }
  const boxes: Array<Obstacle> = []
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      if (next(4) !== 0) {
        const left = i * 100 + next(30)
        const top = j * 100 + next(30)
        boxes.push({ left, top, right: left + 30 + next(30), bottom: top + 30 + next(30) })
      }
    }
  }
  const clearance = 6
  const obstacles = boxes.map((b) => ({
    left: b.left - clearance,
    top: b.top - clearance,
    right: b.right + clearance,
    bottom: b.bottom + clearance,
  }))
  const pins: Array<Pin & { side: number }> = []
  for (const [owner, b] of boxes.entries()) {
    for (let k = 0; k < 2; k++) {
      const side = next(4)
      const along = (next(3) + 1) / 4
      const x = side % 2 === 0 ? b.left + (b.right - b.left) * along : side === 1 ? b.right : b.left
      const y = side % 2 === 1 ? b.top + (b.bottom - b.top) * along : side === 0 ? b.top : b.bottom
      pins.push({ x, y, directions: 1 << side, owner, side })
    }
  }
  const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
  const routes: Array<Array<XY>> = []
  for (let k = 0; k < 10; k++) {
    const a = next(pins.length)
    const b = next(pins.length)
    const from = pins[a]
    const to = pins[b]
    if (a === b || from === undefined || to === undefined) {
      continue
    }
    const into = HEADINGS[to.side] as { x: number; y: number }
    const path = shortestPath(
      graph,
      [{ node: nodes[a] as number, headings: [HEADINGS[from.side] as { x: number; y: number }] }],
      [{ node: nodes[b] as number, headings: [{ x: -into.x, y: -into.y }] }],
      { bendCost: 20 },
    )
    if (path !== undefined) {
      routes.push([...path.nodes].map((n) => [graph.xs[n] as number, graph.ys[n] as number]))
    }
  }
  return { boxes, obstacles, routes }
}

describe('nudging random diagrams', () => {
  test.each(Array.from({ length: 24 }, (_, i) => i + 1))('diagram %i', (seed) => {
    const { boxes, obstacles, routes } = randomDiagram(seed)
    const nudged = nudge(routes, obstacles, 3)
    const segments: Array<{ route: number; end: boolean; a: XY; b: XY }> = []
    for (const [k, path] of nudged.entries()) {
      const source = routes[k] as Array<XY>
      // The pins stay put.
      expect(path[0]).toEqual(source[0])
      expect(path.at(-1)).toEqual(source.at(-1))
      for (let j = 0; j + 1 < path.length; j++) {
        const a = path[j] as XY
        const b = path[j + 1] as XY
        // Every segment is horizontal or vertical, and stays out of the
        // boxes.
        expect(a[0] === b[0] || a[1] === b[1]).toBe(true)
        const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        for (const box of boxes) {
          expect(mx > box.left && mx < box.right && my > box.top && my < box.bottom).toBe(false)
        }
        segments.push({ route: k, end: j === 0 || j === path.length - 2, a, b })
      }
    }
    // No two routes overlap, except where both attach to one pin.
    for (const [i, s] of segments.entries()) {
      for (const t of segments.slice(i + 1)) {
        if (s.route === t.route || (s.end && t.end)) {
          continue
        }
        for (const axis of [0, 1] as const) {
          const other = 1 - axis
          if (s.a[axis] === s.b[axis] && t.a[axis] === t.b[axis] && s.a[axis] === t.a[axis]) {
            const from = Math.max(
              Math.min(s.a[other]!, s.b[other]!),
              Math.min(t.a[other]!, t.b[other]!),
            )
            const to = Math.min(
              Math.max(s.a[other]!, s.b[other]!),
              Math.max(t.a[other]!, t.b[other]!),
            )
            expect(to - from).toBeLessThanOrEqual(0)
          }
        }
      }
    }
  })
})

describe('partingSide', () => {
  // Heading down from the origin, with the Y axis down, the left of travel
  // is toward +x.
  test.each([
    [
      'a left turn against straight on',
      [
        [0, 0],
        [0, 10],
        [10, 10],
      ],
      [
        [0, 0],
        [0, 20],
      ],
      1,
    ],
    [
      'straight on against a left turn',
      [
        [0, 0],
        [0, 20],
      ],
      [
        [0, 0],
        [0, 10],
        [10, 10],
      ],
      -1,
    ],
    [
      'a right turn against a left turn',
      [
        [0, 0],
        [0, 10],
        [-10, 10],
      ],
      [
        [0, 0],
        [0, 10],
        [10, 10],
      ],
      -1,
    ],
    [
      'a shared turn, then a right turn',
      [
        [0, 0],
        [0, 10],
        [20, 10],
        [20, 30],
      ],
      [
        [0, 0],
        [0, 10],
        [40, 10],
      ],
      -1,
    ],
    [
      'a point in the middle of a run',
      [
        [0, 0],
        [0, 5],
        [0, 10],
        [10, 10],
      ],
      [
        [0, 0],
        [0, 20],
      ],
      1,
    ],
    [
      'the same route',
      [
        [0, 0],
        [0, 10],
        [10, 10],
      ],
      [
        [0, 0],
        [0, 10],
        [10, 10],
      ],
      0,
    ],
  ] as const)('%s', (_, p, q, expected) => {
    expect(partingSide(p, q)).toBe(expected)
  })
})

describe('firstTurn', () => {
  // Heading down, with the Y axis down, +x is to the left.
  test.each([
    [
      'left',
      [
        [0, 0],
        [0, 5],
        [0, 10],
        [10, 10],
      ],
      -1,
    ],
    [
      'right',
      [
        [0, 0],
        [0, 10],
        [-10, 10],
        [-10, 20],
      ],
      1,
    ],
    [
      'none',
      [
        [0, 0],
        [0, 20],
      ],
      0,
    ],
  ] as const)('%s', (_, route, expected) => {
    expect(firstTurn(route)).toBe(expected)
  })
})

describe('step', () => {
  test('a lane two radii or more off steps with two full corners', () => {
    expect(step(16, 8)).toEqual({ trunk: 8, lane: 8, reach: 8 })
    expect(step(24, 8)).toEqual({ trunk: 8, lane: 8, reach: 8 })
  })

  test('a lane nearer crosses on an S of two arcs of the radius', () => {
    // Each arc turns 60 degrees, so each corner reaches 8 * tan(30).
    const { trunk, lane, reach } = step(8, 8)
    expect(reach).toBeCloseTo(8 / Math.sqrt(3), 12)
    expect(trunk).toBeCloseTo(reach, 12)
    expect(lane).toBeCloseTo(2 * reach, 12)
  })

  test.each([0.5, 2, 7, 12, 15.5])('the arcs of a lane %d off have the radius', (offset) => {
    const { trunk, lane, reach } = step(offset, 8)
    // The slanted segment between the corners is 2 * reach long.
    const cos = (lane - trunk) / (2 * reach)
    const theta = Math.acos(cos)
    expect(2 * reach * Math.sin(theta)).toBeCloseTo(offset, 12)
    expect(reach / Math.tan(theta / 2)).toBeCloseTo(8, 12)
  })

  test.each([
    [0, 8],
    [4, 0],
  ])('a lane %d off with arcs of radius %d steps square, at the merge point', (offset, radius) => {
    expect(step(offset, radius)).toEqual({ trunk: 0, lane: 0, reach: 0 })
  })
})

describe('addWhisk', () => {
  const whisk = {
    port: [100, 20],
    outward: [-1, 0],
    lateral: [0, -2],
    trunk: 12,
    lane: 16,
    reach: 2,
  } as const

  test('a lane steps onto the line out of the port', () => {
    expect(
      addWhisk(
        [
          [0, 0],
          [60, 0],
          [60, 18],
          [76, 18],
        ],
        whisk,
        false,
      ),
    ).toEqual([
      [0, 0],
      [60, 0],
      [60, 18],
      [84, 18],
      [88, 20],
      [100, 20],
    ])
  })

  test('at the start, the route leaves the port and jogs onto its lane', () => {
    expect(
      addWhisk(
        [
          [76, 18],
          [60, 18],
          [60, 0],
        ],
        whisk,
        true,
      ),
    ).toEqual([
      [100, 20],
      [88, 20],
      [84, 18],
      [60, 18],
      [60, 0],
    ])
  })

  test('the lane on the line runs straight in', () => {
    expect(
      addWhisk(
        [
          [0, 20],
          [76, 20],
        ],
        { ...whisk, lateral: [0, 0] },
        false,
      ),
    ).toEqual([
      [0, 20],
      [100, 20],
    ])
  })
})

describe('partingCorners', () => {
  // p and q run east together and part, one turning down and the other
  // up; r turns west off the lanes.
  const p = route([0, 0], [0, 20], [60, 20], [60, 100])
  const q = route([4, 0], [4, 20], [40, 20], [40, -50])
  const r = route([8, 0], [8, 50], [-50, 50])
  const starts = [
    [0, -1],
    [0, -1],
    [0, -1],
  ] as const

  test('a route parts at the corner where it leaves a group going on', () => {
    // r leaves p and q, which go on together. When they part, no group is
    // left, so neither does.
    expect(partingCorners([p, q, r], starts)).toEqual([new Set(), new Set(), new Set([1])])
  })

  test('a pair that parts leaves no group', () => {
    expect(partingCorners([p, q], starts)).toEqual([new Set(), new Set()])
  })

  test('routes that merge at their targets are walked back from there', () => {
    const ends = [
      [-1, 0],
      [-1, 0],
      [-1, 0],
    ] as const
    const back = [p, q, r].map((points) => points.toReversed())
    expect(partingCorners(back, ends)).toEqual([new Set(), new Set(), new Set([1])])
  })
})

describe('cornerRadii', () => {
  // Routes that run right, then turn down, nested `spacing` apart, the
  // outermost first.
  const nest = (count: number, spacing: number) =>
    Array.from({ length: count }, (_, k) =>
      routed([0, k * spacing], [30 - k * spacing, k * spacing], [30 - k * spacing, 40]),
    )

  test('a corner takes its share of each leg', () => {
    expect(cornerRadii([routed([0, 0], [30, 0], [30, 40], [100, 40])], [25])).toEqual([
      [0, 20, 20, 0],
    ])
    expect(cornerRadii([routed([0, 0], [30, 0], [30, 40])], [-1])).toEqual([[0, 0, 0]])
  })

  test.each([
    [2, [10, 6]],
    [3, [10, 6, 2]],
  ])('a nest of %i shrinks its inner corners to share a center', (count, expected) => {
    const sizes = cornerRadii(
      nest(count, 4),
      Array.from({ length: count }, () => 10),
    )
    expect(sizes.map((list) => list[1])).toEqual(expected)
    // The centers sit back from each corner along the way in and over
    // along the way out, by its size.
    const centers = sizes.flatMap((list, k) =>
      (list[1] as number) > 0
        ? [[30 - 4 * k - (list[1] as number), 4 * k + (list[1] as number)]]
        : [],
    )
    for (const center of centers) {
      expect(center).toEqual([20, 10])
    }
  })

  test('a corner past the center its nest shares grows back by as much', () => {
    // The fourth corner sits 12 inside the outermost, 2 past their center:
    // it takes 2, as far as it sits past, rather than none.
    const sizes = cornerRadii(nest(4, 4), [10, 10, 10, 10])
    expect(sizes.map((list) => list[1])).toEqual([10, 6, 2, 2])
  })

  test('an inner corner that short legs hold small holds the outer one too', () => {
    // The inner route's last leg is 4 long, so its corner reaches 4 at most,
    // and the outer corner, 4 farther out, reaches 8 about the same center.
    const outer = routed([0, 0], [30, 0], [30, 40])
    const inner = routed([0, 4], [26, 4], [26, 8])
    expect(cornerRadii([outer, inner], [16, 16])).toEqual([
      [0, 8, 0],
      [0, 4, 0],
    ])
  })

  test('uneven offsets shrink the inner corner by the larger', () => {
    const outer = routed([0, 0], [30, 0], [30, 40])
    const inner = routed([0, 8], [26, 8], [26, 40])
    expect(cornerRadii([outer, inner], [10, 10])).toEqual([
      [0, 10, 0],
      [0, 2, 0],
    ])
  })

  test('an inner corner past the outer center grows back with the distance', () => {
    // 12 inside a corner of 10, the inner one takes the 2 it sits past the
    // center; 20 inside, past both radii, it keeps its own.
    expect(cornerRadii(nest(2, 12), [10, 10]).map((list) => list[1])).toEqual([10, 2])
    expect(cornerRadii(nest(2, 20), [10, 10]).map((list) => list[1])).toEqual([10, 10])
  })

  test('corners that turn differently, or fan out, keep their size', () => {
    const right = routed([0, 0], [30, 0], [30, 40])
    const left = routed([0, 4], [26, 4], [26, -40])
    const fanned = routed([0, -4], [26, -4], [26, 40])
    expect(cornerRadii([right, left], [10, 10]).map((list) => list[1])).toEqual([10, 10])
    expect(cornerRadii([right, fanned], [10, 10]).map((list) => list[1])).toEqual([10, 10])
  })
  test('an inner corner follows an outer one that its legs hold short', () => {
    // The outer corner's jog is 6 long, so it reaches 3, less than the 4 the
    // inner corner sits inside it: the inner one takes the 1 it sits past
    // the center rather than jumping back to its radius.
    const outer = routed([0, 0], [30, 0], [30, 6], [60, 6])
    const inner = routed([0, 4], [26, 4], [26, 40])
    expect(cornerRadii([outer, inner], [10, 10]).map((list) => list[1])).toEqual([3, 1])
  })

  test('a nest shrinks no corner below half its thickness', () => {
    // The outer corner of 5 would leave the inner one 1, inside a stroke 4
    // wide that needs 2.
    const routes = nest(2, 4)
    const thickness = [0, 4]
    expect(cornerRadii(routes, [5, 10], [], { thickness }).map((list) => list[1])).toEqual([5, 2])
  })

  test('corners that part from a bundle turn tight, nests growing outward', () => {
    // Both part from a bundle, the inner one at the tightest turn and the
    // outer one around it, the offset farther out.
    const routes = nest(2, 4)
    const exits = [new Set([1]), new Set([1])]
    const sizes = cornerRadii(routes, [10, 10], [], { exits, turning: [3, 3] })
    expect(sizes.map((list) => list[1])).toEqual([7, 3])
  })

  test('fixed corners keep their size and take no part in nests', () => {
    const routes = nest(2, 4)
    const fixed = [new Map([[1, 3]]), new Map<number, number>()]
    expect(cornerRadii(routes, [10, 10], [], { fixed }).map((list) => list[1])).toEqual([3, 10])
  })

  test('an inner corner grows with the arc of an outer corner that turns less', () => {
    // The outer corner turns down and right, 45 degrees, once slanted: its
    // size of 4 draws an arc of radius 4 / tan(pi / 8), and the inner corner
    // takes that less the 4 it sits inside, where upright it would take 0.
    const routes = nest(2, 4)
    const shaped = [routed([0, 0], [26, 0], [40, 14]), routes[1] as Route]
    const fixed = [new Map([[1, 4]]), new Map<number, number>()]
    const sizes = cornerRadii(routes, [10, 10], [], { fixed, shaped })
    expect(sizes[1]?.[1]).toBeCloseTo(4 / Math.tan(Math.PI / 8) - 4, 9)
    // Upright, an outer corner of 6 would leave it 2.
    expect(cornerRadii(routes, [6, 10]).map((list) => list[1])).toEqual([6, 2])
    // A moved corner nests with nothing.
    expect(cornerInsets(routes, sizes, shaped)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ])
  })

  test('the corners a nest sizes report how far inside its outermost one they sit', () => {
    const routes = nest(4, 4)
    const sizes = cornerRadii(routes, [10, 10, 10, 10])
    expect(cornerInsets(routes, sizes).map((list) => list[1])).toEqual([0, 4, 8, 0])
    // Too far apart to nest, nothing is inset.
    const apart = nest(2, 12)
    expect(cornerInsets(apart, cornerRadii(apart, [10, 10]))).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ])
  })

  test('an outer corner that shrinks around a small inner one still insets it', () => {
    // The inner corner's short leg holds it to 3, and the outer one shrinks
    // to wrap it about one center.
    const outer = routed([0, 0], [30, 0], [30, 40])
    const inner = routed([0, 4], [26, 4], [26, 7])
    const sizes = cornerRadii([outer, inner], [10, 10])
    expect(sizes.map((list) => list[1])).toEqual([7, 3])
    expect(cornerInsets([outer, inner], sizes).map((list) => list[1])).toEqual([0, 4])
  })
})

// Straightens the first route's start, a port on the right side of `box`,
// with a gap of 8 and corners that reach 8.
function straighten(
  routes: Array<Array<XY>>,
  box: Obstacle = { left: -40, right: 0, top: 0, bottom: 40 },
  others: Array<Array<XY>> = [],
) {
  return straightenPorts(
    [...routes, ...others],
    [
      [{ rect: box, own: 0, side: 1 }, undefined],
      ...others.map(() => [undefined, undefined] as const),
    ],
    [],
    { gap: 8, reach: [8], thickness: [], anchors: [] },
  )[0]
}

describe('straightenPorts', () => {
  // A route leaving the right side of a rect at y 10, jogging at x 20 to
  // `to`, with corners that reach 8: jogs under 16 are short.
  const leaving = (to: number) => route([0, 10], [20, 10], [20, to], [60, to])

  test('a jog up to half the short length slides away whole', () => {
    expect(straighten([leaving(14)])).toEqual(route([0, 14], [60, 14]))
    expect(straighten([leaving(9)])).toEqual(route([0, 9], [60, 9]))
  })

  test('a longer short jog slides less, down to none at the short length', () => {
    // 12 long: 8 * (16 - 12) / 8 = 4 of it.
    expect(straighten([leaving(22)])).toEqual(route([0, 14], [20, 14], [20, 22], [60, 22]))
    expect(straighten([leaving(26)])).toEqual(leaving(26))
  })

  test('a port stops short of its side’s end by the gap', () => {
    const short = { left: -40, right: 0, top: 0, bottom: 24 }
    expect(straighten([leaving(18)], short)).toEqual(route([0, 16], [20, 16], [20, 18], [60, 18]))
  })

  test('a port stops short of another route by the gap', () => {
    const other = route([5, 20], [15, 20])
    expect(straighten([leaving(14)], undefined, [other])).toEqual(
      route([0, 12], [20, 12], [20, 14], [60, 14]),
    )
  })

  test('a route across the leg does not hold the port back', () => {
    // It crosses the leg wherever the leg slides.
    const across = route([10, 0], [10, 40])
    expect(straighten([leaving(14)], undefined, [across])).toEqual(route([0, 14], [60, 14]))
  })

  test('a port that may not slide stays', () => {
    const routes = [leaving(14)]
    expect(
      straightenPorts(routes, [[undefined, undefined]], [], {
        gap: 8,
        reach: [8],
        thickness: [],
        anchors: [],
      }),
    ).toEqual(routes)
  })
})

// The S's span along the legs, and whether the route as drawn comes into a
// box.
function spanOf(slanted: SlantedRoute | undefined): number {
  const [, a, b] = slanted?.route.points ?? []
  return (b?.[0] as number) - (a?.[0] as number) + 2 * (slanted?.radii[1] as number)
}

function enters(slanted: SlantedRoute | undefined, box: Obstacle): boolean {
  const points = slanted?.route.points ?? []
  const cumulative = lengths(points)
  return Array.from({ length: 401 }, (_, k) => k / 400).some((t) => {
    const [x, y] = pointOnDrawn(points, cumulative, slanted?.radii ?? [], t).point
    return x > box.left && x < box.right && y > box.top && y < box.bottom
  })
}

describe('slantJogs', () => {
  // A Z with a jog 8 long, too short for two corners that reach 8.
  const zed = route([0, 0], [30, 0], [30, 8], [60, 8])
  const sizes = [0, 4, 4, 0]
  const slant = (
    options: {
      slant?: number
      walls?: Array<readonly [number, number]>
      obstacles?: Array<Obstacle>
      others?: Array<Array<XY>>
      exempt?: boolean
    } = {},
  ) =>
    slantJogs(
      [zed, ...(options.others ?? [])].map(routeOf),
      [sizes, ...(options.others ?? []).map((other) => other.map(() => 0))],
      [8, ...(options.others ?? []).map(() => 0)],
      options.slant ?? 1,
      [options.walls ?? []],
      options.obstacles ?? [],
      options.exempt === true ? [new Set([1])] : [],
    )[0]

  test('a short jog slants into two arcs that meet halfway', () => {
    // The S spans 16, what the two full corners would, and each corner
    // turns atan(4 / 3) and reaches 5.
    const slanted = slant()
    expect(slanted?.route.points).toEqual([
      [0, 0],
      [27, 0],
      [33, 8],
      [60, 8],
    ])
    expect(slanted?.radii).toEqual([0, 5, 5, 0])
    // The route is 4 shorter past the S.
    expect(slanted?.remap(10)).toBe(10)
    expect(slanted?.remap(50)).toBe(46)
  })

  test('a larger slant stretches the S', () => {
    // The span is 2 * 2 * 8 - 8.
    const [, a, b] = slant({ slant: 2 })?.route.points ?? []
    expect((b?.[0] as number) - (a?.[0] as number)).toBeCloseTo(32 / 3, 9)
  })

  test.each([
    ['no slant', { slant: 0 }],
    ['a flow adornment on the jog', { walls: [[31, 35] as const] }],
    ['a route across the band', { others: [route([33, -10], [33, 20])] }],
    [
      'a rect the first leg passes through',
      { obstacles: [{ left: 20, right: 28, top: -4, bottom: 4 }] },
    ],
  ])('%s keeps the jog upright', (_, options) => {
    expect(slant(options)?.route.points).toEqual(zed)
    expect(slant(options)?.radii).toEqual(sizes)
  })

  test('an exempt jog stays as it is', () => {
    expect(slant({ exempt: true })?.route.points).toEqual(zed)
    expect(slant({ exempt: true })?.radii).toEqual(sizes)
  })

  test('something in the band shortens the S to clear it, less the farther it is', () => {
    const beside = { left: 31, right: 40, top: 2, bottom: 6 }
    const farther = { left: 36, right: 40, top: 2, bottom: 6 }
    const [near, far] = [slant({ obstacles: [beside] }), slant({ obstacles: [farther] })]
    expect(enters(near, beside)).toBe(false)
    expect(enters(far, farther)).toBe(false)
    // Near its end the S runs close to the second leg, so it clears the
    // farther rect whole.
    expect(spanOf(near)).toBeLessThan(spanOf(far))
    expect(spanOf(far)).toBeCloseTo(16, 9)
  })

  test('a rect that slides into the band from the side shortens the S gradually', () => {
    // A rect past the jog, reaching `depth` into the band from the first
    // leg's side. The S passes above it until it nears the second leg,
    // then narrows through every span down to the upright jog's 8.
    const spans = Array.from({ length: 41 }, (_, k) => 6 + k / 20).map((depth) => {
      const rising = { left: 34, right: 38, top: -10, bottom: depth }
      const slanted = slant({ obstacles: [rising] })
      expect(enters(slanted, rising)).toBe(false)
      return spanOf(slanted)
    })
    expect(spans[0]).toBeCloseTo(16, 9)
    for (const [k, span] of spans.entries()) {
      expect(spans[k + 1] ?? 0).toBeLessThanOrEqual(span + 1e-9)
    }
    expect(spans.filter((span) => span > 8.5 && span < 15.5).length).toBeGreaterThan(5)
  })

  test('a route across a leg needs only the S to end short of its stroke', () => {
    // 10 past the jog: the S, half 8 wide, ends short of it, though not by
    // the gap.
    const slanted = slantJogs(
      [zed, route([40, -10], [40, 20])].map(routeOf),
      [sizes, [0, 0]],
      [8, 0],
      1,
      [[]],
      [],
      [],
      { gap: 8 },
    )[0]
    expect(slanted?.route.points).toEqual(route([0, 0], [27, 0], [33, 8], [60, 8]))
  })

  test('a route that shares a merge keeps only the merge gap from the S', () => {
    // A partner 5 above the first leg: the gap would keep the jog upright,
    // and the merge gap leaves the S whole.
    const partner = route([0, -5], [40, -5])
    const strokes = (merges: Array<readonly [number, number]>) =>
      slantJogs([zed, partner].map(routeOf), [sizes, [0, 0]], [8, 0], 1, [[]], [], [], {
        gap: 8,
        mergeGap: 4,
        merges,
      })[0]?.route.points
    expect(
      strokes([
        [0, -1],
        [1, -1],
      ]),
    ).toEqual(zed)
    expect(
      strokes([
        [0, -1],
        [0, -1],
      ]),
    ).toEqual(route([0, 0], [27, 0], [33, 8], [60, 8]))
  })

  test('the drawn route passes through the middle of the S', () => {
    const slanted = slant()
    const points = slanted?.route.points ?? []
    const drawn = pointOnDrawn(points, lengths(points), slanted?.radii ?? [], 0.5)
    expect(drawn.point[0]).toBeCloseTo(30, 9)
    expect(drawn.point[1]).toBeCloseTo(4, 9)
    expect(drawn.tangent[0]).toBeCloseTo(0.6, 9)
    expect(drawn.tangent[1]).toBeCloseTo(0.8, 9)
    expect(drawn.distance).toBeCloseTo(32, 9)
  })
})

describe('tight ends', () => {
  // b has a neighbor 10 apart on its right, so the obstacles grow 5 toward
  // each other there, and a across the seam above.
  const rects = {
    a: Rect.make(125, 0, 40, 20),
    b: Rect.make(100, 100, 40, 20),
    c: Rect.make(150, 100, 40, 20),
  }
  const spec = Connector.make({ clearance: 10, gap: 4, bendCost: 20 })
  const arrow = Adornment.make({
    frame: Frame.make({ width: 8, height: 6, offsetLeft: 2 }),
    at: 1,
    orient: Adornment.orient.forward,
  })
  const problemOf = (input: Partial<Edge.EdgeInput<'a' | 'b' | 'c'>> = {}) =>
    normalize(rects, [Edge.make({ source: 'a', target: 'b', ...input })], spec)

  test('the room in front of a port runs to the nearest obstacle across its line', () => {
    const problem = problemOf()
    // Up to a's obstacle, to c's, and off the bottom and left.
    expect(roomAt(problem, 1, 0, 120)).toBe(70)
    expect(roomAt(problem, 1, 1, 110)).toBe(5)
    expect(roomAt(problem, 1, 2, 120)).toBe(Number.POSITIVE_INFINITY)
    expect(roomAt(problem, 1, 3, 110)).toBe(Number.POSITIVE_INFINITY)
    // Along the top of b, past a's obstacle, nothing is in front.
    expect(roomAt(problem, 1, 0, 105)).toBe(Number.POSITIVE_INFINITY)
    // An obstacle whose edge is on the line does not block it.
    expect(roomAt(problem, 1, 0, 115)).toBe(Number.POSITIVE_INFINITY)
    // An avoided rect counts too, and one that covers the port leaves none.
    expect(roomAt(problem, 1, 2, 120, [Rect.make(0, 150, 200, 10)])).toBe(30)
    expect(roomAt(problem, 1, 2, 120, [Rect.make(0, 110, 200, 20)])).toBe(0)
  })

  test.each([
    ['nothing', {}, 0],
    ['a corner', { radius: 10 }, 20],
    ['an arrowhead', { adornments: [arrow] }, 20],
    ['both', { radius: 10, adornments: [arrow] }, 40],
    ['a corner too large to lose', { radius: 20, adornments: [arrow] }, 40],
    ['a corner with room to spare', { radius: 2 }, 0],
  ])('an end that needs %s costs by its shortfall, up to twice a corner', (_, input, cost) => {
    const problem = problemOf(input)
    // 5 in front of the right side, which the arrowhead alone, 10, falls
    // short of by half its length; the corner of 10 by half its radius.
    expect(tightCostAt(problem, 0, 1, 1, 0.5)).toBe(cost)
    expect(tightCostAt(problem, 0, 1, 0, 0.5)).toBe(0)
    expect(tightCostAt(problem, 0, 0, 2, 0.5)).toBe(0)
  })
})
