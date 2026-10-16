import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import * as Edge from 'placement/edge'
import * as Frame from 'placement/frame'
import * as Hierarchy from 'placement/hierarchy'
import type * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type VNodeArrayChildren, h, nextTick, ref } from 'vue'
import { GraphicGroup } from '../../src/components/GraphicGroup.ts'
import { HierarchyEdge, type HierarchyEdgeProps } from '../../src/components/HierarchyEdge.ts'
import { HierarchyLabel } from '../../src/components/HierarchyLabel.ts'
import { HierarchyLayout, type HierarchyLayoutProps } from '../../src/components/HierarchyLayout.ts'
import { HierarchyNode, type HierarchyNodeProps } from '../../src/components/HierarchyNode.ts'
import { roundPolyline } from '../../src/internal/corners.ts'
import type { RatioInput } from '../../src/internal/props/ratio.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'
import type { TestNode } from '../renderer.ts'

const host = Rect.make(0, 0, 400, 300)

function probe(rect: Rect.Rect, tag = 'probe') {
  return h(tag, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

function node(
  id: string,
  width: HierarchyNodeProps['width'],
  height: HierarchyNodeProps['height'],
  props: Record<string, unknown> = {},
) {
  return h(
    HierarchyNode,
    { id, width, height, ...props },
    {
      default: ({ rect }: { rect: Rect.Rect }) => [probe(rect)],
    },
  )
}

function edge(props: HierarchyEdgeProps, labels: () => VNodeArrayChildren = () => []) {
  return h(HierarchyEdge, props, {
    default: ({ points }: { points: ReadonlyArray<Point.Point> }) => [
      h('route', { points: points.map(({ x, y }) => [x, y]) }),
      ...labels(),
    ],
  })
}

async function mountLayout(
  props: HierarchyLayoutProps | (() => HierarchyLayoutProps),
  content: () => VNodeArrayChildren,
) {
  const mounted = mountWithRect(host, () => [
    h(HierarchyLayout, typeof props === 'function' ? props() : props, {
      default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, 'layout'), ...content()],
    }),
  ])
  // Registration resolves on the next tick.
  await nextTick()
  await nextTick()
  return mounted
}

function props(nodes: Array<TestNode>) {
  return nodes.map((n) => n.props)
}

function rectProps(rect: Rect.Rect) {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

function translatedPoints(points: ReadonlyArray<Point.Point>, dx = 0, dy = 0) {
  return points.map(({ x, y }) => [x + dx, y + dy])
}

const spec = Hierarchy.make({ rankGap: 20, nodeGap: 10 })
const frames = [
  Frame.make({ id: 'a', width: 40, height: 20 }),
  Frame.make({ id: 'b', width: 60, height: 30 }),
  Frame.make({ id: 'c', width: 40, height: 20 }),
]
const expected = Hierarchy.apply(
  frames,
  [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
  spec,
)

function graph() {
  return [
    edge({ from: 'a', to: 'b' }),
    edge({ from: 'a', to: 'c' }),
    node('a', 40, 20),
    node('b', 60, 30),
    node('c', 40, 20),
  ]
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('solving', () => {
  test('nodes and edges match the core solve', async () => {
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, graph)

    expect(props(findAll(root, 'probe'))).toEqual([
      rectProps(expected.nodes.a),
      rectProps(expected.nodes.b),
      rectProps(expected.nodes.c),
    ])
    expect(props(findAll(root, 'route'))).toEqual(
      expected.edges.map((route) => ({ points: translatedPoints(route.points) })),
    )
  })

  test('the layout is sized by its bounds and positioned by its insets', async () => {
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10, left: 30, top: 15 }, graph)

    expect(findOne(root, 'layout').props).toEqual({
      x: 30,
      y: 15,
      width: expected.bounds.width,
      height: expected.bounds.height,
    })
    expect(findAll(root, 'probe')[1]?.props).toEqual(
      rectProps(Rect.translate(expected.nodes.b, 30, 15)),
    )
    expect(findAll(root, 'route')[0]?.props).toEqual({
      points: translatedPoints(expected.edges[0]!.points, 30, 15),
    })
  })

  test('the origin prop aligns the drawing', async () => {
    const { root } = await mountLayout(
      { rankGap: 20, nodeGap: 10, left: '50%', top: '50%', origin: 'center' },
      graph,
    )

    expect(findOne(root, 'layout').props).toEqual({
      x: 200 - expected.bounds.width / 2,
      y: 150 - expected.bounds.height / 2,
      width: expected.bounds.width,
      height: expected.bounds.height,
    })
  })

  test('an edge draws its route as a path', async () => {
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, graph)

    const paths = findAll(root, 'path')
    expect(paths).toHaveLength(2)
    const data = LinearPath2d.toPathData(
      Linear2d.toPath(
        Linear2d.fromArray(expected.edges[0]!.points.map(({ x, y }) => Vector2.make(x, y))),
      ),
    )
    expect(paths[0]?.props['d']).toBe(data)
    expect(paths[0]?.props['fill']).toBe('none')
  })

  test('r and smoothing round the route', async () => {
    const { root } = await mountLayout({ rankGap: 20 }, () => [
      edge({ from: 'a', to: 'b', fromPort: 'right', r: 6, smoothing: 0.6 }),
      node('a', 40, 20),
      node('b', 40, 20),
    ])
    const solved = Hierarchy.apply(
      [
        Frame.make({ id: 'a', width: 40, height: 20 }),
        Frame.make({ id: 'b', width: 40, height: 20 }),
      ],
      [Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.right })],
      Hierarchy.make({ rankGap: 20 }),
    )

    expect(solved.edges[0]!.points.length).toBeGreaterThan(2)
    expect(findOne(root, 'path').props['d']).toBe(
      CubicPath2d.toPathData(roundPolyline(solved.edges[0]!.points, 6, 0.6)!),
    )
  })

  test('attrs and paint reach the path', async () => {
    const { root } = await mountLayout({}, () => [
      h(HierarchyEdge, { from: 'a', to: 'b', stroke: 'red 2px', 'marker-end': 'url(#arrow)' }),
      node('a', 10, 10),
      node('b', 10, 10),
    ])

    const path = findOne(root, 'path')
    expect(path.props['stroke']).toBe('color(srgb 1 0 0)')
    expect(path.props['stroke-width']).toBe('2px')
    expect(path.props['marker-end']).toBe('url(#arrow)')
  })

  test.each([
    ['down', Hierarchy.direction.down],
    ['up', Hierarchy.direction.up],
    ['right', Hierarchy.direction.right],
    ['left', Hierarchy.direction.left],
  ] as const)('direction %s maps to the core direction', async (name, direction) => {
    const { root } = await mountLayout({ direction: name, rankGap: 20, nodeGap: 10 }, graph)
    const solved = Hierarchy.apply(
      frames,
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      Hierarchy.make({ direction, rankGap: 20, nodeGap: 10 }),
    )

    expect(props(findAll(root, 'probe'))).toEqual([
      rectProps(solved.nodes.a),
      rectProps(solved.nodes.b),
      rectProps(solved.nodes.c),
    ])
  })

  test.each([
    ['orthogonal', Hierarchy.routing.orthogonal],
    ['polyline', Hierarchy.routing.polyline],
  ] as const)('routing %s maps to the core routing', async (name, routing) => {
    const { root } = await mountLayout({ routing: name, rankGap: 20, nodeGap: 10 }, graph)
    const solved = Hierarchy.apply(
      frames,
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      Hierarchy.make({ routing, rankGap: 20, nodeGap: 10 }),
    )

    expect(props(findAll(root, 'route'))).toEqual(
      solved.edges.map((route) => ({ points: translatedPoints(route.points) })),
    )
  })

  test('a layout prop replaces the other layout props', async () => {
    const layout = Hierarchy.make({ direction: Hierarchy.direction.right, rankGap: 20 })
    const { root } = await mountLayout({ layout, direction: 'down', rankGap: 100 }, graph)
    const solved = Hierarchy.apply(
      frames,
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      layout,
    )

    expect(findAll(root, 'probe')[2]?.props).toEqual(rectProps(solved.nodes.c))
  })

  test('nodes and edges may sit inside wrappers', async () => {
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, () => [
      h(GraphicGroup, null, () => [edge({ from: 'a', to: 'b' }), edge({ from: 'a', to: 'c' })]),
      h('g', [node('a', 40, 20), h(GraphicGroup, null, () => [node('b', 60, 30)])]),
      node('c', 40, 20),
    ])

    expect(props(findAll(root, 'probe'))).toEqual([
      rectProps(expected.nodes.a),
      rectProps(expected.nodes.b),
      rectProps(expected.nodes.c),
    ])
  })

  test('percentages resolve against the layout parent', async () => {
    // The layout's own size is the solved bounds, so it cannot be the basis.
    const { root } = await mountLayout({}, () => [
      node('a', '25%', '10%'),
      h(HierarchyNode, { id: 'b', width: 10, height: 10, marginLeft: '5%' }),
    ])

    expect(findAll(root, 'probe')[0]?.props).toEqual({ x: 0, y: 0, width: 100, height: 30 })
    expect(findOne(root, 'layout').props).toEqual({ x: 0, y: 0, width: 130, height: 30 })
  })

  test('node props reach the frame', async () => {
    const { root } = await mountLayout({ rankGap: 20 }, () => [
      edge({ from: 'a', to: 'b' }),
      edge({ from: 'a', to: 'c' }),
      node('a', 40, 20),
      node('b', 60, 30),
      node('c', 40, 20, { alignSelf: 'start', marginLeft: 8 }),
    ])
    const solved = Hierarchy.apply(
      [
        frames[0]!,
        frames[1]!,
        Frame.make({ id: 'c', width: 40, height: 20, align: 0, stretch: 0, offsetLeft: 8 }),
      ],
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      Hierarchy.make({ rankGap: 20 }),
    )

    expect(findAll(root, 'probe')[2]?.props).toEqual(rectProps(solved.nodes.c))
  })
})

describe('ports and labels', () => {
  test('port props reach the edge', async () => {
    const { root } = await mountLayout({ rankGap: 20 }, () => [
      edge({ from: 'a', to: 'b', fromPort: 'right 25%', toPort: 'left' }),
      node('a', 40, 20),
      node('b', 40, 20),
    ])
    const solved = Hierarchy.apply(
      [
        Frame.make({ id: 'a', width: 40, height: 20 }),
        Frame.make({ id: 'b', width: 40, height: 20 }),
      ],
      [
        Edge.make({
          source: 'a',
          target: 'b',
          sourceSide: Edge.side.right,
          sourceAt: 0.25,
          targetSide: Edge.side.left,
        }),
      ],
      Hierarchy.make({ rankGap: 20 }),
    )

    expect(findOne(root, 'route').props).toEqual({
      points: translatedPoints(solved.edges[0]!.points),
    })
  })

  test('labels take their rects from the route', async () => {
    const label = (at?: RatioInput) =>
      h(
        HierarchyLabel,
        { width: 30, height: 12, at },
        {
          default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, 'label')],
        },
      )
    const { root } = await mountLayout({ rankGap: 20, left: 5, top: 7 }, () => [
      edge({ from: 'a', to: 'b', weight: 2 }, () => [label(), label('end')]),
      node('a', 40, 20),
      node('b', 40, 20),
    ])
    const labelFrame = Frame.make({ width: 30, height: 12 })
    const solved = Hierarchy.apply(
      [
        Frame.make({ id: 'a', width: 40, height: 20 }),
        Frame.make({ id: 'b', width: 40, height: 20 }),
      ],
      [
        Edge.make({
          source: 'a',
          target: 'b',
          weight: 2,
          labels: [
            { frame: labelFrame, at: 0.5 },
            { frame: labelFrame, at: 1 },
          ],
        }),
      ],
      Hierarchy.make({ rankGap: 20 }),
    )

    expect(props(findAll(root, 'label'))).toEqual(
      solved.edges[0]!.labels.map((rect) => rectProps(Rect.translate(rect, 5, 7))),
    )
    expect(findAll(root, 'probe')[1]?.props).toEqual(
      rectProps(Rect.translate(solved.nodes.b, 5, 7)),
    )
  })
})

describe('reactivity', () => {
  test('a frame change re-solves', async () => {
    const width = ref(60)
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, () => [
      edge({ from: 'a', to: 'b' }),
      edge({ from: 'a', to: 'c' }),
      node('a', 40, 20),
      node('b', width.value, 30),
      node('c', 40, 20),
    ])

    width.value = 100
    await nextTick()

    const solved = Hierarchy.apply(
      [frames[0]!, Frame.make({ id: 'b', width: 100, height: 30 }), frames[2]!],
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
      spec,
    )
    expect(props(findAll(root, 'probe'))).toEqual([
      rectProps(solved.nodes.a),
      rectProps(solved.nodes.b),
      rectProps(solved.nodes.c),
    ])
    expect(findOne(root, 'layout').props['width']).toBe(solved.bounds.width)
  })

  test('adding and removing nodes and edges re-solves', async () => {
    const withC = ref(false)
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, () => [
      edge({ from: 'a', to: 'b' }),
      ...(withC.value ? [edge({ from: 'a', to: 'c' })] : []),
      node('a', 40, 20),
      node('b', 60, 30),
      ...(withC.value ? [node('c', 40, 20)] : []),
    ])

    const alone = Hierarchy.apply(
      frames.slice(0, 2),
      [Edge.make({ source: 'a', target: 'b' })],
      spec,
    )
    expect(props(findAll(root, 'probe'))).toEqual([
      rectProps(alone.nodes.a),
      rectProps(alone.nodes.b),
    ])

    withC.value = true
    await nextTick()
    expect(props(findAll(root, 'probe'))).toEqual([
      rectProps(expected.nodes.a),
      rectProps(expected.nodes.b),
      rectProps(expected.nodes.c),
    ])

    withC.value = false
    await nextTick()
    expect(props(findAll(root, 'probe'))).toEqual([
      rectProps(alone.nodes.a),
      rectProps(alone.nodes.b),
    ])
  })

  test('a spec change re-solves', async () => {
    const rankGap = ref(20)
    const { root } = await mountLayout(
      () => ({ rankGap: rankGap.value }),
      () => [edge({ from: 'a', to: 'b' }), node('a', 10, 10), node('b', 10, 10)],
    )

    expect(findAll(root, 'probe')[1]?.props['y']).toBe(30)
    rankGap.value = 50
    await nextTick()
    expect(findAll(root, 'probe')[1]?.props['y']).toBe(60)
  })
})

describe('incomplete graphs', () => {
  test('an edge to a missing node is skipped with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root } = await mountLayout({}, () => [
      edge({ from: 'a', to: 'nowhere' }),
      node('a', 10, 10),
    ])
    await nextTick()

    expect(findAll(root, 'path')).toHaveLength(0)
    expect(findOne(root, 'route').props).toEqual({ points: [] })
    expect(findOne(root, 'probe').props).toEqual({ x: 0, y: 0, width: 10, height: 10 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('"a" -> "nowhere"')
  })

  test('a duplicate id is skipped with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root } = await mountLayout({}, () => [node('a', 10, 10), node('a', 20, 20)])
    await nextTick()

    expect(props(findAll(root, 'probe'))).toEqual([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 0, height: 0 },
    ])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('nodes share the id "a"')
  })

  test('a transient mismatch does not warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const withB = ref(true)
    await mountLayout({}, () =>
      withB.value
        ? [edge({ from: 'a', to: 'b' }), node('a', 10, 10), node('b', 10, 10)]
        : [node('a', 10, 10)],
    )

    withB.value = false
    await nextTick()
    await nextTick()
    expect(warn).not.toHaveBeenCalled()
  })

  test('an empty layout has empty bounds', async () => {
    const { root } = await mountLayout({ left: 10, top: 10 }, () => [])
    expect(findOne(root, 'layout').props).toEqual({ x: 10, y: 10, width: 0, height: 0 })
  })

  test('a node outside a layout throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mountWithRect(host, () => [node('a', 10, 10)])).toThrow()
  })
})
