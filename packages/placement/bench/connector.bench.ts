import { bench, describe } from 'vitest'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import { type XY, nudge } from '../src/internal/connector/nudge.ts'
import { shortestPath } from '../src/internal/graph/search.ts'
import { type Pin, visibilityGraph } from '../src/internal/graph/visibility.ts'
import * as Rect from '../src/rect.ts'

// A deterministic diagram: boxes in a grid, with a pin on each side, and
// routes between pins far apart, so that many share corridors.
const sizes = [40, 70, 55, 90, 30, 65] as const
const headings = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const

function diagram(side: number, routeCount: number) {
  const clearance = 6
  const boxes = Array.from({ length: side * side }, (_, i) => {
    const left = (i % side) * 140 + (i % 3) * 7
    const top = Math.floor(i / side) * 140 + (i % 4) * 5
    return {
      left,
      top,
      right: left + (sizes[i % sizes.length] as number),
      bottom: top + (sizes[(i + 2) % sizes.length] as number),
    }
  })
  const obstacles = boxes.map((b) => ({
    left: b.left - clearance,
    top: b.top - clearance,
    right: b.right + clearance,
    bottom: b.bottom + clearance,
  }))
  const pins: Array<Pin> = boxes.flatMap((b, owner) => [
    { x: (b.left + b.right) / 2, y: b.top, directions: 1 << 0, owner },
    { x: b.right, y: (b.top + b.bottom) / 2, directions: 1 << 1, owner },
    { x: (b.left + b.right) / 2, y: b.bottom, directions: 1 << 2, owner },
    { x: b.left, y: (b.top + b.bottom) / 2, directions: 1 << 3, owner },
  ])
  const { graph, pins: nodes } = visibilityGraph(obstacles, pins)
  const routes: Array<Array<XY>> = []
  for (let k = 0; k < routeCount; k++) {
    const a = (k * 37) % pins.length
    const b = (k * 53 + pins.length / 2) % pins.length
    const into = headings[b % 4] as { x: number; y: number }
    const path = shortestPath(
      graph,
      [{ node: nodes[a] as number, headings: [headings[a % 4] as { x: number; y: number }] }],
      [{ node: nodes[b] as number, headings: [{ x: -into.x, y: -into.y }] }],
      { bendCost: 20 },
    )
    if (path !== undefined) {
      routes.push([...path.nodes].map((n) => [graph.xs[n] as number, graph.ys[n] as number]))
    }
  }
  return { obstacles, routes }
}

for (const [side, routeCount] of [
  [5, 20],
  [10, 50],
] as const) {
  describe(`${side * side} boxes, ${routeCount} routes`, () => {
    const { obstacles, routes } = diagram(side, routeCount)
    bench('nudge', () => {
      nudge(routes, obstacles, 4)
    })
  })
}

// The whole pipeline: sides, ports, routes, and nudging.
for (const [side, edgeCount] of [
  [5, 20],
  [10, 50],
] as const) {
  describe(`apply: ${side * side} rects, ${edgeCount} edges`, () => {
    const rects: Record<string, Rect.Rect> = {}
    for (let i = 0; i < side * side; i++) {
      rects[`r${i}`] = Rect.make(
        (i % side) * 140 + (i % 3) * 7,
        Math.floor(i / side) * 140 + (i % 4) * 5,
        sizes[i % sizes.length] as number,
        sizes[(i + 2) % sizes.length] as number,
      )
    }
    const ids = Object.keys(rects)
    const given = Array.from({ length: edgeCount }, (_, k) =>
      Edge.make({
        source: ids[(k * 37) % ids.length] as string,
        target: ids[(k * 53 + 11) % ids.length] as string,
        sourceSide: k % 2 === 0 ? (k / 2) % 4 : undefined,
      }),
    )
    const spec = Connector.make({ clearance: 6, gap: 4, bendCost: 20 })
    bench('Connector.apply', () => {
      Connector.apply(rects, given, spec)
    })
  })
}
