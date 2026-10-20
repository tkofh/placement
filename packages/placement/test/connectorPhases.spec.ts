import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import { lengths, pointOnDrawn } from '../src/internal/adornments.ts'
import {
  canonicalOrder,
  eccentricities,
  restore,
  route as routeCanonical,
  routeInOrder,
} from '../src/internal/connector/canonical.ts'
import { cornerOutsets, cornerRadii } from '../src/internal/connector/corners.ts'
import {
  type XY,
  bundled,
  firstTurn,
  nudge,
  partingCorners,
  partingSide,
  nudgeRoutes,
} from '../src/internal/connector/nudge.ts'
import { straightenPorts } from '../src/internal/connector/ports.ts'
import { normalize, roomAt, tightCostAt } from '../src/internal/connector/problem.ts'
import { type Route, routeOf } from '../src/internal/connector/route.ts'
import { routeAll } from '../src/internal/connector/routing.ts'
import { scoreLayout } from '../src/internal/connector/score.ts'
import { chooseSides } from '../src/internal/connector/sides.ts'
import { type SlantedRoute, slantJogs } from '../src/internal/connector/slants.ts'
import { placePorts } from '../src/internal/connector/spread.ts'
import type { Obstacle } from '../src/internal/graph/graph.ts'
import { shortestPath } from '../src/internal/graph/search.ts'
import { type Pin, visibilityGraph } from '../src/internal/graph/visibility.ts'
import { type Separation, type Variable, placeSeparated } from '../src/internal/separation.ts'
import * as Point from '../src/point.ts'
import * as Rect from '../src/rect.ts'
import { sceneOf } from './fixtures/judgements.ts'

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

  test('a jog that straightens onto the line of the segment past it leaves it be', () => {
    // The anchor on the first segment, which the route runs straight
    // through, keeps the jog a gap past it: exactly on the line of the
    // segment two on, which holds an anchor of its own. The jog moves
    // there, the segment between them is left with no length, and the
    // run on through both anchors stays as one.
    const path = route([0, 0], [14, 0], [14, 40], [18, 40], [18, 60], [13, 60], [13, 80])
    const anchors: Array<XY> = [
      [10, 0],
      [18, 50],
    ]
    expect(nudgeRoutes([path], [], 8, [{ anchors, straight: anchors }]).routes).toEqual([
      route([0, 0], [18, 0], [18, 60], [13, 60], [13, 80]),
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

  test('a jog that parts from its bundle leaves the flow adornments between the ports a stretch', () => {
    // With 30 of adornments to place between the ports, p's jog parts 30
    // earlier, so they sit past it, between its corner and the pack, clear
    // of q. With 40, the stretch would reach past the middle of the run,
    // so the jog goes as late as it would with none.
    const p = route([0, 0], [0, 20], [60, 20], [60, 100])
    const q = route([4, 0], [4, 100])
    const merges = [0, -1] as const
    const parted = (flows: number) =>
      nudge(
        [p, q],
        [],
        8,
        [{ merges, corner: 10, packs: [0, 8], flows }, { merges }],
        2,
      )[0]?.[1]?.[1]
    expect(parted(30)).toBe(52)
    expect(parted(40)).toBe(82)
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
    // A rect up to x 1 beside the jog leaves it no room past p, so it goes
    // past q instead, rather than into the rect.
    const wall = [{ left: -20, right: 1, top: 45, bottom: 55 }]
    expect(nudge([p, q, r], wall, 8, constraints, 2)[2]).toEqual(
      route([-50, 40], [10, 40], [10, 60], [50, 60]),
    )
  })

  test('an end between the lanes of a merge steps out past them', () => {
    // r leaves its port between p's and q's lanes, which hold still as it
    // does. It runs straight out of its port until a gap short of p, then
    // steps a gap past p, and that step stays put.
    const p = route([100, 0], [0, 0], [0, 50])
    const q = route([100, 2], [30, 2], [30, 50])
    const r = route([-40, 1], [60, 1], [60, 80])
    const port = [{ left: -60, top: -20, right: -30, bottom: 20 }]
    const merges = [0, -1] as const
    const constraints = [{ merges }, { merges }, {}]
    expect(nudge([p, q, r], port, 8, constraints, 2)[2]).toEqual(
      route([-40, 1], [-8, 1], [-8, -8], [60, -8], [60, 80]),
    )
    // With corners, it stops their reach shorter, or the reach of the S
    // that a step too short for them slants into.
    const cornered = [{ merges }, { merges }, { corner: 4 }]
    expect(nudge([p, q, r], port, 8, cornered, 2)[2]).toEqual(
      route([-40, 1], [-12, 1], [-12, -8], [60, -8], [60, 80]),
    )
    const slanted = [{ merges }, { merges }, { corner: 8, slant: 2 }]
    expect(nudge([p, q, r], port, 8, slanted, 2)[2]).toEqual(
      route([-40, 1], [-19.5, 1], [-19.5, -8], [60, -8], [60, 80]),
    )
    // But never back into the obstacle around its port.
    const close = [{ merges }, { merges }, { corner: 32 }]
    expect(nudge([p, q, r], port, 8, close, 2)[2]).toEqual(
      route([-40, 1], [-30, 1], [-30, -8], [60, -8], [60, 80]),
    )
    // Lanes of different merges hold it nowhere.
    const apart = [{ merges: [0, -1] as const }, { merges: [1, -1] as const }, {}]
    expect(nudge([p, q, r], port, 8, apart, 2)[2]).toEqual(r)
    // Nor do lanes that it meets within the obstacle.
    const near = [{ left: -60, top: -20, right: 10, bottom: 20 }]
    expect(nudge([p, q, r], near, 8, constraints, 2)[2]).toEqual(r)
  })

  test('a step out from among lanes keeps out of obstacles', () => {
    // r leaves its port, inside the box from x 100 to 140, heading left
    // between the lanes of p and q, which start at x 20. A zone sits just
    // above r's leg where the leg leaves the box. The leg holds through it,
    // and the step past the lanes comes only a gap short of them.
    const p = route([-100, 0], [20, 0], [20, -60])
    const q = route([-100, 2], [10, 2], [10, -60])
    const r = route([110, 1], [-50, 1], [-50, 80])
    const port = { left: 100, top: -40, right: 140, bottom: 40 }
    const zone = { left: 95, top: -12, right: 105, bottom: -4 }
    const merges = [0, -1] as const
    const constraints = [{ merges }, { merges }, {}]
    const [, , moved] = nudge([p, q, r], [port, zone], 8, constraints, 2)
    expect(moved).toEqual(route([110, 1], [28, 1], [28, -8], [-50, -8], [-50, 80]))
    // A zone where that step would cross comes before it, and the step
    // comes back to the zone's near edge.
    const crossing = { left: 26, top: -6, right: 40, bottom: -2 }
    expect(nudge([p, q, r], [port, crossing], 8, constraints, 2)[2]).toEqual(
      route([110, 1], [40, 1], [40, -8], [-50, -8], [-50, 80]),
    )
    // A zone on the line the run past the step would take leaves the end
    // where it is.
    const onLine = { left: -20, top: -12, right: -10, bottom: -4 }
    expect(nudge([p, q, r], [port, onLine], 8, constraints, 2)[2]).toEqual(r)
    // In every case, no segment of any route ends up inside an obstacle.
    for (const zones of [
      [port, zone],
      [port, crossing],
      [port, onLine],
    ]) {
      const routes = nudge([p, q, r], zones, 8, constraints, 2)
      for (const path of routes) {
        for (let k = 0; k + 1 < path.length; k++) {
          const [[x0, y0], [x1, y1]] = [path[k] as XY, path[k + 1] as XY]
          for (const o of zones.slice(1)) {
            const across =
              Math.min(x0, x1) < o.right &&
              Math.max(x0, x1) > o.left &&
              Math.min(y0, y1) < o.bottom &&
              Math.max(y0, y1) > o.top
            expect(across).toBe(false)
          }
        }
      }
    }
  })

  test('a step out from among lanes moves back toward the port for a route beside it', () => {
    // As above, r steps a gap short of the lanes, at x 28, but a route
    // leaves its port down at x 26, past r's step: the step moves back the
    // gap from it, and r still runs straight up to there.
    const p = route([-100, 0], [20, 0], [20, -60])
    const q = route([-100, 2], [10, 2], [10, -60])
    const r = route([110, 1], [-50, 1], [-50, 80])
    const s = route([26, -50], [26, 50], [80, 50])
    const port = { left: 100, top: -40, right: 140, bottom: 40 }
    const merges = [0, -1] as const
    const constraints = [{ merges }, { merges }, {}, {}]
    expect(nudge([p, q, r, s], [port], 8, constraints, 2)[2]).toEqual(
      route([110, 1], [34, 1], [34, -8], [-50, -8], [-50, 80]),
    )
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

  test('the segment beside a kink stays put rather than balance a staircase', () => {
    // A long leg down, then a step of half a pixel before the port. With
    // corners of 16 the step is a kink, so the leg beside it is no rise of
    // a Z to center between the port legs, which would make the step a jog
    // of 22. The step itself centers along the leg.
    const path = route([0, 20], [-43.5, 20], [-43.5, 184], [-44, 184], [-44, 200])
    expect(nudgeRoutes([path], [], 8, [{ corner: 16 }]).routes).toEqual([
      route([0, 20], [-43.5, 20], [-43.5, 110], [-44, 110], [-44, 200]),
    ])
    // Without a corner, the step is a leg, and the long leg centers.
    expect(nudgeRoutes([path], [], 0, [{ corner: 0 }]).routes).toEqual([
      route([0, 20], [-22, 20], [-22, 110], [-44, 110], [-44, 200]),
    ])
  })

  test('a kink right past a port that may slide stays for the port', () => {
    const path = route([0, 20], [-43.5, 20], [-43.5, 184], [-44, 184], [-44, 200])
    const constraints = [{ corner: 16, sliding: [false, true] as [boolean, boolean] }]
    expect(nudgeRoutes([path], [], 8, constraints).routes).toEqual([path])
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
    [2, [14, 10]],
    [3, [18, 14, 10]],
  ])('a nest of %i grows its outer corners to share a center', (count, expected) => {
    const sizes = cornerRadii(
      nest(count, 4),
      Array.from({ length: count }, () => 10),
    )
    expect(sizes.map((list) => list[1])).toEqual(expected)
    // The centers sit back from each corner along the way in and over
    // along the way out, by its size: the innermost corner's, of radius 10.
    const inner = 4 * (count - 1)
    for (const [k, list] of sizes.entries()) {
      const size = list[1] as number
      expect([30 - 4 * k - size, 4 * k + size]).toEqual([30 - inner - 10, inner + 10])
    }
  })

  test('the growth tapers off past the outer radius, to none at both radii', () => {
    // 12 inside a corner of radius 10, past that radius, the outer corner
    // grows by the 8 left to both radii together; 20 inside, it keeps its
    // own.
    expect(cornerRadii(nest(2, 12), [10, 10]).map((list) => list[1])).toEqual([18, 10])
    expect(cornerRadii(nest(2, 20), [10, 10]).map((list) => list[1])).toEqual([10, 10])
  })

  test('an end leg too short for the grown size holds the outer corner, not the inner', () => {
    // The outer route's first leg is 12 long: its corner reaches 12, not
    // the 14 that shares a center, and the inner one keeps its radius.
    const outer = routed([18, 0], [30, 0], [30, 40])
    const inner = routed([0, 4], [26, 4], [26, 40])
    expect(cornerRadii([outer, inner], [10, 10])).toEqual([
      [0, 12, 0],
      [0, 10, 0],
    ])
  })

  test('the corner at the other end of a short leg gives way to a grown one', () => {
    // The outer route turns onto the leg into its nest corner `leg` before
    // it: that corner wants 10, and the nest corner 14. At 22 the leg has
    // 2 to spare past both radii, and the first corner gives up the 2 the
    // nest is short. At 21 it has 1 to spare and gives up 1, and the nest
    // drifts. At 20 both keep their radius, as with no nest, so nothing
    // jumps on the way.
    const outer = (leg: number) => routed([30 - leg, -30], [30 - leg, 0], [30, 0], [30, 40])
    const inner = routed([0, 4], [26, 4], [26, 40])
    expect(cornerRadii([outer(24), inner], [10, 10])[0]).toEqual([0, 10, 14, 0])
    expect(cornerRadii([outer(22), inner], [10, 10])[0]).toEqual([0, 8, 14, 0])
    expect(cornerRadii([outer(21), inner], [10, 10])[0]).toEqual([0, 9, 12, 0])
    expect(cornerRadii([outer(20), inner], [10, 10])[0]).toEqual([0, 10, 10, 0])
    // A fixed corner at the other end gives way to nothing.
    const fixed = [new Map([[1, 10]]), new Map<number, number>()]
    expect(cornerRadii([outer(22), inner], [10, 10], [], { fixed })[0]).toEqual([0, 10, 12, 0])
  })

  test('an inner corner that short legs hold small holds back nothing', () => {
    // The inner route's last leg is 4 long, so its corner reaches 4 at
    // most. The outer one keeps its radius rather than shrinking around
    // it, and the two drift apart through the turn.
    const outer = routed([0, 0], [30, 0], [30, 40])
    const inner = routed([0, 4], [26, 4], [26, 8])
    expect(cornerRadii([outer, inner], [16, 16])).toEqual([
      [0, 16, 0],
      [0, 4, 0],
    ])
  })

  test('uneven offsets grow the outer corner by the larger', () => {
    const outer = routed([0, 0], [30, 0], [30, 40])
    const inner = routed([0, 8], [26, 8], [26, 40])
    expect(cornerRadii([outer, inner], [10, 10])).toEqual([
      [0, 18, 0],
      [0, 10, 0],
    ])
  })

  test('corners that turn differently, or fan out, keep their size', () => {
    const right = routed([0, 0], [30, 0], [30, 40])
    const left = routed([0, 4], [26, 4], [26, -40])
    const fanned = routed([0, -4], [26, -4], [26, 40])
    expect(cornerRadii([right, left], [10, 10]).map((list) => list[1])).toEqual([10, 10])
    expect(cornerRadii([right, fanned], [10, 10]).map((list) => list[1])).toEqual([10, 10])
  })

  test('an outer corner that its legs hold short leaves the inner one its radius', () => {
    // The outer corner's jog is 6 long, so it reaches 3, less than the 4
    // the inner corner sits inside it, which keeps its 10.
    const outer = routed([0, 0], [30, 0], [30, 6], [60, 6])
    const inner = routed([0, 4], [26, 4], [26, 40])
    expect(cornerRadii([outer, inner], [10, 10]).map((list) => list[1])).toEqual([3, 10])
  })

  test('a jog too short for the grown sizes keeps both corners their radius', () => {
    // Two routes jog together, 4 apart: each is the inner one at one corner
    // and the outer one at the other, so each wants 10 and 14 of a jog. A
    // jog of 20 holds the radii only; one of 28 holds the nests too. On one
    // of 22, the inner corner of each nest gives way to nothing, though
    // the leg has 2 to spare, or the nests would chase each other: the
    // outer corners take what is left and drift.
    const jog = (d: number) => [
      routed([0, 0], [30, 0], [30, d], [60, d]),
      routed([0, 4], [26, 4], [26, d + 4], [60, d + 4]),
    ]
    expect(cornerRadii(jog(20), [10, 10])).toEqual([
      [0, 10, 10, 0],
      [0, 10, 10, 0],
    ])
    expect(cornerRadii(jog(22), [10, 10])).toEqual([
      [0, 12, 10, 0],
      [0, 10, 12, 0],
    ])
    expect(cornerRadii(jog(28), [10, 10])).toEqual([
      [0, 14, 10, 0],
      [0, 10, 14, 0],
    ])
  })

  test('fixed corners keep their size, and corners grow around them', () => {
    const routes = nest(2, 4)
    const outerFixed = [new Map([[1, 3]]), new Map<number, number>()]
    expect(cornerRadii(routes, [10, 10], [], { fixed: outerFixed }).map((list) => list[1])).toEqual(
      [3, 10],
    )
    const innerFixed = [new Map<number, number>(), new Map([[1, 8]])]
    expect(cornerRadii(routes, [10, 10], [], { fixed: innerFixed }).map((list) => list[1])).toEqual(
      [12, 8],
    )
  })

  test('an inner corner grows to the arc of an outer corner that turns less', () => {
    // The outer corner turns down and right, 45 degrees, once slanted: its
    // size of 4 draws an arc of radius 4 / tan(pi / 8), and the inner
    // corner, of radius 4, takes that less the 4 it sits inside.
    const routes = nest(2, 4)
    const shaped = [routed([0, 0], [26, 0], [40, 14]), routes[1] as Route]
    const fixed = [new Map([[1, 4]]), new Map<number, number>()]
    const sizes = cornerRadii(routes, [10, 4], [], { fixed, shaped })
    expect(sizes[1]?.[1]).toBeCloseTo(4 / Math.tan(Math.PI / 8) - 4, 9)
    // One of radius 10 keeps that, as the arc less the offset is smaller.
    expect(cornerRadii(routes, [10, 10], [], { fixed, shaped })[1]?.[1]).toBe(10)
    // Upright, the inner one keeps its radius and the outer grows around it.
    expect(cornerRadii(routes, [6, 10]).map((list) => list[1])).toEqual([14, 10])
    // A moved corner nests with nothing.
    expect(cornerOutsets(routes, [10, 4], sizes, shaped)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ])
  })

  // A route that jogs 10 down at x 100, and one that turns down into a
  // corner 6 inside the jog's lower corner, after a leg of `leg` from
  // the corner before it. The jog's corners are fixed at `size`, and it
  // slants by moving them `run` apart along their legs.
  const slanted = (size: number, run: number, leg = 64) => {
    const outer = routed([0, 60], [100, 60], [100, 70], [200, 70])
    const inner = routed([80, 64 - leg], [106, 64 - leg], [106, 64], [200, 64])
    const drawn = routed([0, 60], [100 - run, 60], [100 + run, 70], [200, 70])
    const fixed = [
      new Map([
        [1, size],
        [2, size],
      ]),
      new Map<number, number>(),
    ]
    const sizes = cornerRadii([outer, inner], [16, 16], [], { fixed, shaped: [drawn, inner] })
    // The radius of the arc the slanted corner draws, from its turn.
    const arc = size / Math.tan(Math.atan2(10, 2 * run) / 2)
    return { inner: sizes[1] as Array<number>, arc }
  }

  test('a corner inside a gentle slant keeps its radius, and so does the one before it', () => {
    // The slant turns 14 degrees: its arc, 130 wide, lies far past both
    // radii together, 32, and the corner inside keeps its radius rather
    // than sweep a right angle 124 wide, which its leg of 64 would take
    // from the corner before it.
    const { inner, arc } = slanted(16, 20)
    expect(arc).toBeGreaterThan(128)
    expect(inner).toEqual([0, 16, 16, 0])
  })

  test('a corner inside a slant within reach grows to share its center', () => {
    // A slant that turns 45 degrees with corners of 12 draws an arc 29
    // wide: the corner 6 inside it grows to 23.
    const { inner, arc } = slanted(12, 5)
    expect(arc).toBeCloseTo(12 / Math.tan(Math.PI / 8), 9)
    expect(inner[2]).toBeCloseTo(arc - 6, 9)
    expect(inner[1]).toBe(16)
  })

  test('the growth toward an arc tapers, with no jump as the slant changes', () => {
    // As the slant lengthens, its arc widens from 10 to 128: the corner
    // inside grows from its radius, by at most half both radii together,
    // and falls back to it, never moving more than the arc does.
    let last: { size: number; arc: number } | undefined
    let most = 0
    for (let run = 1; run <= 40; run += 1 / 16) {
      const { inner, arc } = slanted(8, run)
      const size = inner[2] as number
      if (last !== undefined) {
        expect(Math.abs(size - last.size)).toBeLessThanOrEqual(Math.abs(arc - last.arc) + 1e-9)
      }
      expect(size).toBeLessThanOrEqual(32 + 1e-9)
      most = Math.max(most, size)
      last = { size, arc }
    }
    expect(most).toBeGreaterThan(31)
    expect(last?.size).toBe(16)
    expect(slanted(8, 1).inner[2]).toBe(16)
  })

  test('a corner growing toward an arc leaves the one before it its radius', () => {
    // The corner inside would grow to 23 on a leg of 36, which holds the
    // corner before it at 16 and 20 of growth: it grows to 20.
    expect(slanted(12, 5, 36).inner).toEqual([0, 16, 20, 0])
    // On a leg of 32 it keeps its radius, and so does the one before it.
    expect(slanted(12, 5, 32).inner).toEqual([0, 16, 16, 0])
  })

  test('the corners a nest grows report how far outside its innermost one they sit', () => {
    const routes = nest(4, 4)
    const sizes = cornerRadii(routes, [10, 10, 10, 10])
    expect(sizes.map((list) => list[1])).toEqual([22, 18, 14, 10])
    expect(cornerOutsets(routes, [10, 10, 10, 10], sizes).map((list) => list[1])).toEqual([
      12, 8, 4, 0,
    ])
    // Grown by less than the offset, where the growth tapers, the outset
    // is the growth.
    const apart = nest(2, 12)
    expect(cornerOutsets(apart, [10, 10], cornerRadii(apart, [10, 10]))).toEqual([
      [0, 8, 0],
      [0, 0, 0],
    ])
  })

  test('a corner its leg holds short of the grown size is outset by what it grew', () => {
    // Drawn as the innermost corner moved out by that, it comes as near to
    // the nest's center as its size allows.
    const inner = routed([0, 4], [26, 4], [26, 40])
    const short = routed([18, 0], [30, 0], [30, 40])
    const exact = routed([16, 0], [30, 0], [30, 40])
    const held = cornerRadii([short, inner], [10, 10])
    expect(held.map((list) => list[1])).toEqual([12, 10])
    expect(cornerOutsets([short, inner], [10, 10], held).map((list) => list[1])).toEqual([2, 0])
    const fitted = cornerRadii([exact, inner], [10, 10])
    expect(fitted.map((list) => list[1])).toEqual([14, 10])
    expect(cornerOutsets([exact, inner], [10, 10], fitted).map((list) => list[1])).toEqual([4, 0])
    // One no larger than the innermost corner is not outset.
    const tiny = routed([25, 0], [30, 0], [30, 40])
    const small = cornerRadii([tiny, inner], [10, 10])
    expect(small.map((list) => list[1])).toEqual([5, 10])
    expect(cornerOutsets([tiny, inner], [10, 10], small).map((list) => list[1])).toEqual([0, 0])
  })

  test('only the nests that size corners are outset', () => {
    // Around a corner with no radius, or one past both radii together, a
    // corner nests with nothing, whatever its size.
    const routes = nest(2, 4)
    const sizes = cornerRadii(routes, [10, 0])
    expect(sizes.map((list) => list[1])).toEqual([10, 0])
    expect(cornerOutsets(routes, [10, 0], sizes).map((list) => list[1])).toEqual([0, 0])
    const far = nest(2, 20)
    expect(cornerOutsets(far, [10, 10], cornerRadii(far, [10, 10])).map((list) => list[1])).toEqual(
      [0, 0],
    )
  })
})

// Straightens the first route's start, a port on the right side of `box`,
// with a gap of 8 and corners that reach 8, and `pack` of the leg out of
// the port taken by adornments.
function straighten(
  routes: Array<Array<XY>>,
  box: Obstacle = { left: -40, right: 0, top: 0, bottom: 40 },
  others: Array<Array<XY>> = [],
  pack = 0,
  partners = false,
) {
  const all = [...routes, ...others]
  return straightenPorts(
    all,
    [
      [{ rect: box, own: 0, side: 1 }, undefined],
      ...others.map(() => [undefined, undefined] as const),
    ],
    [],
    {
      gap: 8,
      reach: [8],
      thickness: [],
      anchors: [],
      packs: [[pack, 0]],
      ...(partners ? { merges: all.map(() => [0, -1] as const), mergeGap: 2 } : {}),
    },
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

  test('a pack at the port leaves its corner less of the leg, so less of the jog is short', () => {
    // With 16 of the 20 out of the port packed, the corner past the leg
    // reaches 4 at most, so the two corners need 12 of the jog: one of 14
    // stays, and one of 10 slides 6 * (12 - 10) / 6 = 2 of the way.
    expect(straighten([leaving(24)], undefined, [], 16)).toEqual(leaving(24))
    expect(straighten([leaving(20)], undefined, [], 16)).toEqual(
      route([0, 12], [20, 12], [20, 20], [60, 20]),
    )
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
    // A route that shares a merge with it keeps only the merge gap, 2, so
    // the jog slides away whole.
    expect(straighten([leaving(14)], undefined, [other], 0, true)).toEqual(route([0, 14], [60, 14]))
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

describe('a port slide’s residue', () => {
  // Two routes leave one merge on lanes at y 0 and 5.75, run down together
  // a merge gap apart, and turn left: a at y 158.75 for good, b at 164.5
  // for a jog `jog` long before it runs down onto the top of a rect, where
  // its port may slide. With corners of 16, a jog up to 16 slides away
  // whole; past that the slide tapers, and leaves a residue jog that grows
  // from none. Here it is shorter than the gap, and must never draw as an
  // upright kink: it slants, though a runs right beside its leg.
  const R = 16
  const gap = 8
  const rect = { left: -60, top: 340, right: 60, bottom: 380 }
  const grown = { left: -76, top: 324, right: 76, bottom: 396 }
  const merges = [
    [0, -1],
    [0, -1],
  ] as const
  const a = route([100, 0], [0, 0], [0, 158.75], [-145, 158.75], [-145, 340])
  const b = (jog: number) =>
    route([100, 5.75], [5.75, 5.75], [5.75, 164.5], [5.75 - jog, 164.5], [5.75 - jog, 340])
  const drawn = (jog: number) => {
    const straight = straightenPorts(
      [a, b(jog)],
      [
        [undefined, undefined],
        [undefined, { rect, own: 0, side: 0 }],
      ],
      [grown],
      {
        gap,
        reach: [R, R],
        thickness: [1.75, 1.75],
        anchors: [[], []],
        packs: [
          [0, 0],
          [0, 0],
        ],
        merges,
        mergeGap: 4,
      },
    )
    // The jogs the pipeline keeps upright for the bundle.
    const { coupled, parting } = bundled(straight, merges, gap)
    const upright = straight.map((_, k) => {
      const set = new Set(coupled[k])
      for (const corner of parting[k] ?? []) {
        set.add(corner - 1).add(corner)
      }
      return set
    })
    const routes = straight.map((points) => routeOf(points))
    const sizes = cornerRadii(routes, [R, R])
    const strokes = { gap, thickness: [1.75, 1.75], merges, mergeGap: 4 }
    return {
      straight: straight[1] as Array<XY>,
      slanted: slantJogs(routes, sizes, [R, R], 2, [], [grown], upright, strokes)[1],
    }
  }

  test.each([4, 12, 16])('a jog of %d slides away whole', (jog) => {
    expect(drawn(jog).straight).toEqual(route([100, 5.75], [5.75, 5.75], [5.75, 340]))
  })

  test.each([16.01, 16.39, 17, 18, 19, 19.9])('a jog of %d leaves a residue that slants', (jog) => {
    const { straight, slanted } = drawn(jog)
    // The slide leaves a residue: 2 * jog - 32 of it.
    const [, , near, far] = straight
    expect((near as XY)[0] - (far as XY)[0]).toBeCloseTo(2 * jog - 2 * R, 9)
    // Drawn, no corner is upright with a reach shorter than the gap: the
    // jog's two corners slid apart along the legs into an S.
    const points = slanted?.route.points ?? []
    const radii = slanted?.radii ?? []
    for (let k = 1; k + 1 < points.length; k++) {
      const [p, q, r] = [points[k - 1], points[k], points[k + 1]] as [XY, XY, XY]
      const upright = (p[0] === q[0] || p[1] === q[1]) && (q[0] === r[0] || q[1] === r[1])
      if (upright) {
        expect(radii[k]).toBeGreaterThanOrEqual(gap)
      }
    }
    expect(points).toHaveLength(5)
    expect(points[2]?.[1]).toBeLessThan(164.5)
    expect(points[3]?.[1]).toBeGreaterThan(164.5)
  })

  test('a residue shorter than the gap is no turn of the bundle', () => {
    // b's residue of 6 overlaps a's run left by a quarter, so the two turn
    // together there, but a jog shorter than the gap is no visible turn.
    const straight = [
      a,
      route([100, 5.75], [5.75, 5.75], [5.75, 164.5], [-0.25, 164.5], [-0.25, 340]),
    ]
    expect(bundled(straight, merges).coupled[1]).toEqual(new Set([1, 2, 3]))
    expect(bundled(straight, merges, gap).coupled[1]).toEqual(new Set([1, 3]))
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

  test.each([
    [2, true],
    [6, true],
    [10, false],
  ])('a jog of %d beside a route the gap from its leg slants: %s', (d, slants) => {
    // A route runs alongside the first leg, the gap of 8 below it, up to
    // where its box, grown by the gap, ends at the jog. The S strays
    // toward it by half the jog, as the upright corners do. A jog shorter
    // than the gap, a residue, keeps that much less than the gap from it
    // and slants; a longer one keeps the gap and stays upright.
    const jog = route([0, 0], [30, 0], [30, d], [60, d])
    const beside = route([0, 8], [22, 8])
    const [slanted] = slantJogs(
      [jog, beside].map(routeOf),
      [
        [0, d / 2, d / 2, 0],
        [0, 0],
      ],
      [8, 0],
      1,
      [],
      [],
      [],
      { gap: 8 },
    )
    expect(slanted?.route.points.length).toBe(4)
    expect(slanted?.route.points[1]?.[0] !== 30).toBe(slants)
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

// A point as a key.
const key = ([x, y]: XY) => `${x},${y}`

describe('grouped ends', () => {
  test('the search runs no route straight across the end of another', () => {
    // Routes from a, b, and c group into the left of t, on ports next to
    // each other, and routes from a and b group at one spot on the left of
    // u below it. No route runs straight through the end of another,
    // across the way it arrives, since the port there goes on that way.
    const head = Adornment.make({ frame: Frame.make({ width: 8, height: 6 }), at: 1, orient: 1 })
    const rects = {
      a: Rect.make(0, 0, 40, 20),
      b: Rect.make(0, 60, 40, 20),
      c: Rect.make(0, 120, 40, 20),
      t: Rect.make(200, 50, 40, 40),
      u: Rect.make(200, 150, 40, 40),
    }
    const into = (source: 'a' | 'b' | 'c', target: 't' | 'u', input = {}) =>
      Edge.make({ source, target, adornments: [head], ...input })
    const problem = normalize(
      rects,
      [
        into('a', 't', { radius: 10, thickness: 2 }),
        into('b', 't', { radius: 10, thickness: 2 }),
        into('c', 't', { radius: 10, thickness: 2 }),
        into('c', 'u', { radius: 10, thickness: 2 }),
        into('a', 'u', { targetSide: 3, targetAt: 0.5 }),
        into('b', 'u', { targetSide: 3, targetAt: 0.5 }),
      ],
      Connector.make({ clearance: 8, gap: 4, bendCost: 20, merge: 1, mergeGap: 2 }),
    )
    const placed = placePorts(problem, chooseSides(problem))
    const { routes } = routeAll(
      problem,
      placed.ports,
      problem.edges.map((_, i) => i),
    )
    // The end of each route, with whether it arrives across the X axis.
    const ends = new Map<string, Array<{ edge: number; vertical: boolean }>>()
    for (const [i, route] of routes.entries()) {
      const points = route as Array<XY>
      for (const [end, next] of [
        [points[0], points[1]],
        [points.at(-1), points.at(-2)],
      ] as Array<[XY, XY]>) {
        const list = ends.get(key(end)) ?? []
        list.push({ edge: i, vertical: end[0] === next[0] })
        ends.set(key(end), list)
      }
    }
    const across: Array<[number, number]> = []
    for (const [i, route] of routes.entries()) {
      const points = route as Array<XY>
      for (let k = 1; k + 1 < points.length; k++) {
        const [a, b, c] = [points[k - 1], points[k], points[k + 1]] as [XY, XY, XY]
        const vertical = a[0] === b[0] && b[0] === c[0]
        const horizontal = a[1] === b[1] && b[1] === c[1]
        for (const end of ends.get(key(b)) ?? []) {
          if (end.edge !== i && (vertical || horizontal) && end.vertical !== vertical) {
            across.push([i, end.edge])
          }
        }
      }
    }
    expect(across).toEqual([])
  })
})

const link = (source: string, target: string) => ({ source, target })

const unitRoute = (x: number): Connector.ConnectorRoute => ({
  points: [Point.make(x, 0), Point.make(x, 10)],
  radii: [0, 0],
  outsets: [0, 0],
  adornments: [],
  merged: [-1, -1],
})

describe('canonical order', () => {
  test.each([
    [
      'a path',
      ['a', 'b', 'c', 'd'],
      [link('a', 'b'), link('c', 'b'), link('c', 'd')],
      [3, 2, 2, 3],
    ],
    [
      'a star',
      ['hub', 'n', 'e', 's', 'w'],
      ['n', 'e', 's', 'w'].map((leaf) => link('hub', leaf)),
      [1, 2, 2, 2, 2],
    ],
    [
      'two components, a lone rect, and a loop',
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      [link('a', 'b'), link('c', 'd'), link('e', 'd'), link('g', 'g')],
      [1, 1, 2, 1, 2, 0, 0],
    ],
  ])('eccentricities of %s', (_, ids, edges, expected) => {
    const found = eccentricities(ids, edges)
    expect(ids.map((id) => found.get(id))).toEqual(expected)
  })

  test('edges go centre first, then by ids, then by spec, then by index', () => {
    const box = Rect.make(0, 0, 10, 10)
    const rects = { a: box, b: box, c: box, d: box }
    const edges = [
      Edge.make({ source: 'd', target: 'c' }),
      Edge.make({ source: 'c', target: 'b', thickness: 2 }),
      Edge.make({ source: 'b', target: 'a' }),
      Edge.make({ source: 'c', target: 'b', thickness: 1 }),
      Edge.make({ source: 'b', target: 'c' }),
      Edge.make({ source: 'c', target: 'b', thickness: 1 }),
    ]
    // b and c are 2 from the far end, a and d 3.
    expect(canonicalOrder(rects, edges)).toEqual([4, 3, 5, 1, 2, 0])
    // Options tell edges apart past their specs.
    const twins = [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'b' })]
    expect(canonicalOrder(rects, twins, { edges: [{ jogAt: 0.75 }, { jogAt: 0.25 }] })).toEqual([
      1, 0,
    ])
    expect(canonicalOrder(rects, twins, { edges: [{ turn: 1 }] })).toEqual([1, 0])
  })

  test('restore maps routes and notes back to the input order', () => {
    // Canonical position k holds input edge order[k].
    const order = [2, 0, 3, 1]
    const layout: Connector.ConnectorLayout = {
      edges: [unitRoute(0), unitRoute(1), undefined, unitRoute(3)],
      notes: [
        { kind: 0, edge: 2 },
        { kind: 1, edges: [0, 3], axis: 1, rects: ['b'], need: 1 },
        { kind: 1, edges: [1, 2], axis: 0, rects: [], need: 2 },
        { kind: 3, edge: 3, adornment: 0, need: 4 },
        { kind: 3, edge: 0, adornment: 1, need: 5 },
      ],
    }
    expect(restore(layout, order)).toEqual({
      edges: [unitRoute(1), unitRoute(3), unitRoute(0), undefined],
      notes: [
        { kind: 0, edge: 3 },
        { kind: 1, edges: [0, 3], axis: 0, rects: [], need: 2 },
        { kind: 1, edges: [1, 2], axis: 1, rects: ['b'], need: 1 },
        { kind: 3, edge: 1, adornment: 0, need: 4 },
        { kind: 3, edge: 2, adornment: 1, need: 5 },
      ],
    })
  })
})

// The routes the search finds, with the ports the spread places, for the
// edges listed in canonical order, as the canonical solve lists them,
// back in the order given.
const searched = <Id extends string>(
  rects: Readonly<Record<Id, Rect.Rect>>,
  edges: ReadonlyArray<Edge.Edge<Id>>,
  spec: Connector.Connector,
) => {
  const order = canonicalOrder(rects, edges, {})
  const problem = normalize(
    rects,
    order.map((i) => edges[i] as Edge.Edge<Id>),
    spec,
  )
  const { routes } = routeAll(
    problem,
    placePorts(problem, chooseSides(problem)).ports,
    problem.edges.map((_, i) => i),
  )
  const byInput: Array<Array<XY>> = []
  for (const [k, i] of order.entries()) {
    byInput[i] = routes[k] as Array<XY>
  }
  return byInput
}

// The straight runs of a route: the line each lies on, its axis, and its
// extent along it.
const runsOfRoute = (points: ReadonlyArray<XY>) => {
  const runs: Array<{ vertical: boolean; at: number; from: number; to: number }> = []
  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1] as XY, points[k] as XY]
    const vertical = a[0] === b[0]
    const [at, p, q] = vertical ? [a[0], a[1], b[1]] : [a[1], a[0], b[0]]
    const last = runs.at(-1)
    if (last !== undefined && last.vertical === vertical && last.at === at) {
      last.from = Math.min(last.from, p, q)
      last.to = Math.max(last.to, p, q)
    } else {
      runs.push({ vertical, at, from: Math.min(p, q), to: Math.max(p, q) })
    }
  }
  return runs
}

describe('held runs the search sees', () => {
  describe('a held run that turns off a shared run', () => {
    // The auth sweep's crowded corner, cut down. The routes from orders
    // and billing come down one line beside db and turn right into it,
    // and the route from events to mailer comes down that line too, and
    // crosses them on it. The route from auth runs into db from the left,
    // above the leg into db from orders. Leaving the shared line at the
    // turn into that leg, left along its line, the route to mailer lies
    // beside the leg once nudging spreads the shared line and stretches
    // the leg under it, and between it and the route from auth, too close
    // for both.
    const head = Adornment.make({
      frame: Frame.make({ width: 9, height: 8, offsetLeft: 4 }),
      at: 1,
      orient: Adornment.orient.forward,
    })
    const label = Adornment.make({ frame: Frame.make({ width: 40, height: 16 }), at: 0.5 })
    const rects = {
      auth: Rect.make(370, 340, 112, 40),
      billing: Rect.make(512, 288, 120, 40),
      db: Rect.make(784, 360, 120, 40),
      events: Rect.make(784, 176, 136, 40),
      indexer: Rect.make(692, 540, 112, 36),
      mailer: Rect.make(557, 540, 112, 36),
      orders: Rect.make(512, 96, 120, 40),
    }
    type Id = keyof typeof rects
    const edge = (source: Id, target: Id, input: Partial<Edge.EdgeInput<Id>> = {}) =>
      Edge.make<Id>({ source, target, thickness: 1, adornments: [head], ...input })
    const edges = [
      edge('auth', 'db', { adornments: [head, label] }),
      edge('billing', 'events'),
      edge('orders', 'db', { radius: 16 }),
      edge('billing', 'db'),
      edge('events', 'mailer', { adornments: [] }),
      edge('events', 'indexer', { radius: 16, adornments: [] }),
    ]
    const spec = Connector.make({ clearance: 16, gap: 8, merge: Connector.merge.side, mergeGap: 4 })

    test('the search leaves the shared run off the line of the leg', () => {
      const routes = searched(rects, edges, spec)
      // The leg into db from orders, and the run into db from auth.
      const leg = runsOfRoute(routes[2] as Array<XY>).at(-1)
      const entry = runsOfRoute(routes[0] as Array<XY>)[0]
      expect(leg?.vertical).toBe(false)
      expect(entry?.vertical).toBe(false)
      const low = Math.min(leg?.at as number, entry?.at as number)
      const high = Math.max(leg?.at as number, entry?.at as number)
      const between = runsOfRoute(routes[4] as Array<XY>).filter(
        (run) => !run.vertical && low <= run.at && run.at <= high,
      )
      expect(between).toEqual([])
    })

    test('the canonical solve squeezes no route', () => {
      const layout = routeCanonical(rects, edges, spec)
      expect(scoreLayout(normalize(rects, edges, spec), layout).terms.squeeze).toBe(0)
      expect(layout.notes).toEqual([])
    })
  })

  test('routes that trade ports answer to the held runs of the others', () => {
    // The architecture diagram with auth moved below and right of gateway,
    // its edges routed in the order listed. The routes from orders to
    // events and to db trade their ports, and the route to db, found again
    // for the trade, turns into the strip between the leg into indexer
    // and the wall of events and db, beside the routes already in it, too
    // narrow for them all. Checked again for the held runs of the others,
    // it keeps out of the strip, and nothing is crowded.
    const { rects, edges, spec } = sceneOf('default')
    rects.auth = Rect.make(370, 350, 112, 40)
    const order = edges.map((_, i) => i)
    expect(routeInOrder(rects, edges, spec, {}, order).layout.notes).toEqual([])
  })

  describe('a strip with a route in it already', () => {
    // The route from b to c leaves the top of b up a leg past a, 5.5 from
    // the wall of a's clearance: room beside the leg for one route, the
    // gap and the strokes from it and half a stroke from the wall, but not
    // for two. The loop on a runs in that strip, and the route from e into
    // the top of a would run down it too.
    const rects = {
      a: Rect.make(0, 126, 33, 35),
      b: Rect.make(23, 212, 43, 52),
      c: Rect.make(117, 100, 48, 53),
      d: Rect.make(226, 220, 54, 48),
      e: Rect.make(326, 211, 34, 39),
    }
    type Id = keyof typeof rects
    const edges = [
      Edge.make<Id>({ source: 'b', target: 'c', thickness: 1 }),
      Edge.make<Id>({ source: 'a', target: 'a', thickness: 1 }),
      Edge.make<Id>({ source: 'e', target: 'a', targetSide: Edge.side.top, thickness: 1 }),
    ]
    const spec = Connector.make({ clearance: 6, gap: 3, adornmentGap: 2 })

    test('the search puts one route in the strip', () => {
      const routes = searched(rects, edges, spec)
      // The leg up out of b, and the wall at the right of a's clearance.
      const leg = runsOfRoute(routes[0] as Array<XY>)[0]
      expect(leg).toMatchObject({ vertical: true, at: 44.5 })
      const wall = 33 + 6
      const inStrip = routes
        .slice(1)
        .filter((points) =>
          runsOfRoute(points).some(
            (run) =>
              run.vertical &&
              wall <= run.at &&
              run.at < (leg?.at as number) &&
              run.from < (leg?.to as number) &&
              (leg?.from as number) < run.to,
          ),
        )
      expect(inStrip).toHaveLength(1)
    })

    test('the canonical solve squeezes no route', () => {
      const layout = routeCanonical(rects, edges, spec)
      expect(scoreLayout(normalize(rects, edges, spec), layout).terms.squeeze).toBe(0)
      expect(layout.notes).toEqual([])
    })
  })
})
