import { describe, expect, test } from 'vitest'
import { type XY, nudge } from '../src/internal/connector/nudge.ts'
import type { Obstacle } from '../src/internal/graph/graph.ts'
import { shortestPath } from '../src/internal/graph/search.ts'
import { type Pin, visibilityGraph } from '../src/internal/graph/visibility.ts'
import { type Separation, type Variable, placeSeparated } from '../src/internal/separation.ts'

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
    // q turns off first on the outside of the bend, so it stays outside.
    expect(nudge([p, q], [], 8)).toEqual([
      route([0, 0], [0, 14], [26, 14], [26, 50], [60, 50]),
      route([10, -20], [10, 6], [34, 6], [34, 40], [60, 40]),
    ])
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

  test('a narrow channel shrinks the gaps until the routes fit', () => {
    const walls: Array<Obstacle> = [
      { left: -20, top: 0, right: 0, bottom: 40 },
      { left: 6, top: 0, right: 26, bottom: 40 },
    ]
    const routes = [0, 1, 2].map((k) =>
      route([-30, -10 - k], [3, -10 - k], [3, 50 + k], [40, 50 + k]),
    )
    const nudged = nudge(routes, walls, 8)
    const xs = nudged.map((r) => r[1]?.[0] as number)
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(6)
    }
    // Three distinct lanes, in some order, at least one unit apart.
    const sorted = xs.toSorted((a, b) => a - b)
    expect(sorted[1]! - sorted[0]!).toBeGreaterThanOrEqual(1)
    expect(sorted[2]! - sorted[1]!).toBeGreaterThanOrEqual(1)
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
    // r pushes the horizontal of p down, which stretches the vertical of p
    // into the start of q on x = 10. p turns east there, so its vertical
    // moves east of q.
    const p = route([0, 0], [10, 0], [10, 10], [40, 10], [40, 30])
    const r = route([20, -10], [20, 10], [50, 10], [50, 30])
    const q = route([10, 11], [10, 30], [0, 30])
    expect(nudge([p, r, q], [], 3)).toEqual([
      route([0, 0], [13, 0], [13, 11.5], [40, 11.5], [40, 30]),
      route([20, -10], [20, 8.5], [50, 8.5], [50, 30]),
      q,
    ])
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
    const path = shortestPath(graph, nodes[a] as number, nodes[b] as number, {
      bendCost: 20,
      depart: [HEADINGS[from.side] as { x: number; y: number }],
      arrive: [{ x: -into.x, y: -into.y }],
    })
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
