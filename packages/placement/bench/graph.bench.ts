import { bench, describe } from 'vitest'
import type { Obstacle } from '../src/internal/graph/graph.ts'
import { shortestPath } from '../src/internal/graph/search.ts'
import { ALL_DIRECTIONS, type Pin, visibilityGraph } from '../src/internal/graph/visibility.ts'

// Deterministic scenes, so runs are comparable. A grid places boxes in rows
// and columns that share lines, and a staircase offsets every box so that no
// two share a line, the worst case for the number of lines.
const sizes = [40, 70, 55, 90, 30, 65] as const

function grid(count: number): Array<Obstacle> {
  const side = Math.ceil(Math.sqrt(count))
  return Array.from({ length: count }, (_, i) => {
    const left = (i % side) * 120
    const top = Math.floor(i / side) * 120
    return {
      left,
      top,
      right: left + (sizes[i % sizes.length] as number),
      bottom: top + (sizes[(i + 2) % sizes.length] as number),
    }
  })
}

function staircase(count: number): Array<Obstacle> {
  const side = Math.ceil(Math.sqrt(count))
  return Array.from({ length: count }, (_, i) => {
    const left = (i % side) * 120 + i * 0.75
    const top = Math.floor(i / side) * 120 + i * 0.5
    return {
      left,
      top,
      right: left + (sizes[i % sizes.length] as number),
      bottom: top + (sizes[(i + 3) % sizes.length] as number),
    }
  })
}

// Two free pins per eight boxes, in the gaps of the grid.
const pins = (count: number): Array<Pin> =>
  Array.from({ length: Math.ceil(count / 4) }, (_, i) => ({
    x: (i % 7) * 120 + 105,
    y: Math.floor(i / 7) * 120 + 105,
    directions: ALL_DIRECTIONS,
  }))

for (const count of [25, 100, 400]) {
  describe(`${count} obstacles`, () => {
    const aligned = grid(count)
    const offset = staircase(count)
    const free = pins(count)
    bench('grid', () => {
      visibilityGraph(aligned, free)
    })
    bench('staircase', () => {
      visibilityGraph(offset, free)
    })
    // A route from the first gap to the last, across the whole scene.
    const { graph, pins: nodes } = visibilityGraph(offset, free)
    bench('route across the staircase', () => {
      shortestPath(graph, nodes[0] as number, nodes.at(-1) as number, { bendCost: 20 })
    })
  })
}
