import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import * as Adornment from 'placement/adornment'
import * as Edge from 'placement/edge'
import * as Frame from 'placement/frame'
import * as Hierarchy from 'placement/hierarchy'
import type * as Point from 'placement/point'
import * as Polygon from 'placement/polygon'
import * as Rect from 'placement/rect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type VNodeArrayChildren, h, nextTick, ref } from 'vue'
import { GraphicGroup } from '../../src/components/GraphicGroup.ts'
import { GraphicPolygon } from '../../src/components/GraphicPolygon.ts'
import { GraphicRect } from '../../src/components/GraphicRect.ts'
import {
  HierarchyAdornment,
  type HierarchyAdornmentProps,
} from '../../src/components/HierarchyAdornment.ts'
import { HierarchyEdge, type HierarchyEdgeProps } from '../../src/components/HierarchyEdge.ts'
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
    // A side port needs room beside its node to turn in, which the gaps
    // give it.
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10, edgeGap: 4 }, () => [
      edge({ from: 'a', to: 'b', fromPort: 'right', r: 6, smoothing: 0.6 }),
      node('a', 40, 20),
      node('b', 40, 20),
    ])
    // The layout sizes corners by their reach, (1 + smoothing) radii.
    const solved = Hierarchy.apply(
      [
        Frame.make({ id: 'a', width: 40, height: 20 }),
        Frame.make({ id: 'b', width: 40, height: 20 }),
      ],
      [Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.right, radius: 1.6 * 6 })],
      Hierarchy.make({ rankGap: 20, nodeGap: 10, edgeGap: 4 }),
    )
    const { points, radii } = solved.edges[0]!

    expect(points.length).toBeGreaterThan(2)
    expect(findOne(root, 'path').props['d']).toBe(
      CubicPath2d.toPathData(roundPolyline(points, 6, 0.6, false, radii)!),
    )
  })

  test('the radius keeps room for corners in the layout', async () => {
    const fan = ['a', 'b', 'c'].map((id) => Frame.make({ id, width: 40, height: 20 }))
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, () => [
      ...['b', 'c'].map((to) => edge({ from: 'a', to, r: 12 })),
      ...fan.map((frame) => node(frame.id, 40, 20)),
    ])
    const solved = Hierarchy.apply(
      fan,
      ['b', 'c'].map((target) => Edge.make({ source: 'a', target, radius: 12 })),
      Hierarchy.make({ rankGap: 20, nodeGap: 10 }),
    )

    expect(props(findAll(root, 'route'))).toEqual(
      solved.edges.map((route) => ({ points: translatedPoints(route.points) })),
    )
    expect(solved.edges[0]!.radii).toEqual([0, 12, 12, 0])
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
    ['direct', Hierarchy.backEdges.direct],
    ['loop', Hierarchy.backEdges.loop],
  ] as const)('backEdges %s maps to the core back edge style', async (name, backEdges) => {
    const cycle = () => [
      edge({ from: 'a', to: 'b' }),
      edge({ from: 'b', to: 'a' }),
      node('a', 40, 20),
      node('b', 60, 30),
    ]
    const { root } = await mountLayout({ backEdges: name, rankGap: 20, edgeGap: 10 }, cycle)
    const solved = Hierarchy.apply(
      frames.slice(0, 2),
      [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'b', target: 'a' })],
      Hierarchy.make({ backEdges, rankGap: 20, edgeGap: 10 }),
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

describe('ports and adornments', () => {
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

  // A node drawn with `children`, and a probe of its rect.
  const drawnNode = (
    id: string,
    width: number,
    height: number,
    children: () => VNodeArrayChildren,
  ) =>
    h(
      HierarchyNode,
      { id, width, height },
      { default: ({ rect }: { rect: Rect.Rect }) => [probe(rect), ...children()] },
    )

  const shapedGraph = (children: () => VNodeArrayChildren) => () => [
    edge({ from: 'a', to: 'b' }),
    edge({ from: 'b', to: 'c', fromPort: 'bottom 12.5%' }),
    edge({ from: 'b', to: 'c', fromPort: 'right 25%' }),
    node('a', 40, 20),
    drawnNode('b', 60, 30, children),
    node('c', 40, 20),
  ]

  const solveShaped = (shape: Polygon.Polygon | undefined) =>
    Hierarchy.apply(
      frames,
      [
        Edge.make({ source: 'a', target: 'b' }),
        Edge.make({ source: 'b', target: 'c', sourceSide: Edge.side.bottom, sourceAt: 0.125 }),
        Edge.make({ source: 'b', target: 'c', sourceSide: Edge.side.right, sourceAt: 0.25 }),
      ],
      spec,
      shape === undefined ? {} : { shapes: { b: shape } },
    )

  const routesOf = (root: TestNode) => props(findAll(root, 'route'))
  const routesFrom = (layout: Hierarchy.HierarchyLayout<string>) =>
    layout.edges.map((route) => ({ points: translatedPoints(route.points) }))

  test.each([
    ['a polygon', () => [h(GraphicPolygon, { phase: 0.5 })], Polygon.make({ phase: 0.5 })],
    [
      'a rounded polygon',
      () => [h(GraphicPolygon, { sides: 6, r: 4, smoothing: 0.6 })],
      Polygon.make({ sides: 6, radius: 4 }),
    ],
    ['a rounded rect', () => [h(GraphicRect, { r: 10 })], Polygon.make({ radius: 10 })],
    [
      'the first of two graphics',
      () => [h(GraphicPolygon, { sides: 3 }), h(GraphicPolygon, { phase: 0.5 })],
      Polygon.make({ sides: 3 }),
    ],
  ])('%s that fills the node gives it its outline', async (_, children, shape) => {
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, shapedGraph(children))
    expect(routesOf(root)).toEqual(routesFrom(solveShaped(shape)))
    // The outline moves a port off the rect.
    expect(routesOf(root)).not.toEqual(routesFrom(solveShaped(undefined)))
  })

  test.each([
    ['with an inset', () => [h(GraphicPolygon, { phase: 0.5, left: '2px' })]],
    ['with a size', () => [h(GraphicPolygon, { phase: 0.5, width: '100%' })]],
    [
      'inside a group',
      () => [h(GraphicGroup, {}, { default: () => [h(GraphicPolygon, { phase: 0.5 })] })],
    ],
  ])('a graphic %s leaves the node its rect', async (_, children) => {
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, shapedGraph(children))
    expect(routesOf(root)).toEqual(routesFrom(solveShaped(undefined)))
  })

  test('the outline follows the graphic as it changes and unmounts', async () => {
    const phase = ref<number | undefined>(0.5)
    const { root } = await mountLayout(
      { rankGap: 20, nodeGap: 10 },
      shapedGraph(() =>
        phase.value === undefined ? [] : [h(GraphicPolygon, { phase: phase.value })],
      ),
    )
    expect(routesOf(root)).toEqual(routesFrom(solveShaped(Polygon.make({ phase: 0.5 }))))
    phase.value = 0.25
    await nextTick()
    await nextTick()
    expect(routesOf(root)).toEqual(routesFrom(solveShaped(Polygon.make({ phase: 0.25 }))))
    phase.value = undefined
    await nextTick()
    await nextTick()
    expect(routesOf(root)).toEqual(routesFrom(solveShaped(undefined)))
  })

  test.each([0, 0.8, 1])(
    'ports meet the rounded tips of a drawn diamond, smoothing %f',
    async (smoothing) => {
      const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, () => [
        edge({ from: 'a', to: 'b' }),
        edge({ from: 'b', to: 'c', fromPort: 'left' }),
        node('a', 40, 20),
        drawnNode('b', 92, 56, () => [h(GraphicPolygon, { phase: 0.5, r: 10, smoothing })]),
        node('c', 40, 20),
      ])
      const b = Rect.make(
        ...((['x', 'y', 'width', 'height'] as const).map(
          (key) => findAll(root, 'probe')[1]!.props[key] as number,
        ) as [number, number, number, number]),
      )
      const { outlines, radius } = Polygon.apply(Polygon.make({ phase: 0.5, radius: 10 }), b)
      const drawn = roundPolyline(
        outlines[0]!.map(({ x, y }) => Vector2.make(x, y)),
        radius,
        smoothing,
        true,
      )
      const box = CubicPath2d.boundingBox(drawn!)
      const [into, out] = props(findAll(root, 'route')) as Array<{
        points: Array<[number, number]>
      }>
      // The rounded tips are the drawn diamond's extremes, on the node's
      // rect.
      expect(into!.points.at(-1)![1]).toBeCloseTo(box.y.start, 1)
      expect(out!.points[0]![0]).toBeCloseTo(box.x.start, 1)
      expect(box.y.start).toBeCloseTo(b.y, 1)
      expect(box.x.start).toBeCloseTo(b.x, 1)
    },
  )

  test('adornments along the edge take their rects from the route', async () => {
    const label = (at?: RatioInput) =>
      h(
        HierarchyAdornment,
        { width: 30, height: 12, at },
        {
          default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, 'label')],
        },
      )
    const { root } = await mountLayout({ rankGap: 20, left: 5, top: 7 }, () => [
      edge({ from: 'a', to: 'b', weight: 2 }, () => [label(), label('100%')]),
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
          adornments: [
            Adornment.make({ frame: labelFrame, at: 0.5 }),
            Adornment.make({ frame: labelFrame, at: 1 }),
          ],
        }),
      ],
      Hierarchy.make({ rankGap: 20 }),
    )

    expect(props(findAll(root, 'label'))).toEqual(
      solved.edges[0]!.adornments.map(({ rect }) => rectProps(Rect.translate(rect, 5, 7))),
    )
    expect(findAll(root, 'probe')[1]?.props).toEqual(
      rectProps(Rect.translate(solved.nodes.b, 5, 7)),
    )
  })
})

// A turned adornment at one end of an edge, as `at="start"` and `at="end"` make.
const turned = (frame: Frame.Frame, at: number) =>
  Adornment.make({
    frame,
    at,
    orient: at === 0 ? Adornment.orient.backward : Adornment.orient.forward,
  })

describe('end adornments', () => {
  const frames = [
    Frame.make({ id: 'a', width: 40, height: 20 }),
    Frame.make({ id: 'b', width: 40, height: 20 }),
  ]
  const solved = Hierarchy.apply(
    frames,
    [Edge.make({ source: 'a', target: 'b' })],
    Hierarchy.make({ rankGap: 20 }),
  )
  const route = solved.edges[0]!.points
  const head = route[0]!
  const tip = route[route.length - 1]!

  const adornment = (props: HierarchyAdornmentProps, tag: string) =>
    h(HierarchyAdornment, props, {
      default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, tag)],
    })

  function mountArrows(arrows: () => VNodeArrayChildren) {
    return mountLayout({ rankGap: 20 }, () => [
      edge({ from: 'a', to: 'b' }, arrows),
      node('a', 40, 20),
      node('b', 40, 20),
    ])
  }

  test('an end adornment sits against the target, turned to point into it', async () => {
    const { root } = await mountArrows(() => [
      adornment({ at: 'end', width: 8, height: 6 }, 'arrow'),
    ])

    // The route runs down, so the frame turns a quarter turn clockwise
    // about its center, 4 above the tip.
    expect(findOne(root, 'arrow').props).toEqual({
      x: tip.x - 4,
      y: tip.y - 7,
      width: 8,
      height: 6,
    })
    expect(findOne(root, 'g').props).toEqual({
      transform: `rotate(90 ${tip.x} ${tip.y - 4})`,
    })
  })

  test('a start adornment turns to point into the source', async () => {
    const { root } = await mountArrows(() => [
      adornment({ at: 'start', width: 8, height: 6 }, 'arrow'),
    ])

    expect(findOne(root, 'arrow').props).toEqual({
      x: head.x - 4,
      y: head.y + 1,
      width: 8,
      height: 6,
    })
    expect(findOne(root, 'g').props).toEqual({
      transform: `rotate(-90 ${head.x} ${head.y + 4})`,
    })
  })

  test('the drawn line stops where the end adornments begin', async () => {
    const { root } = await mountArrows(() => [
      adornment({ at: 'start', width: 4, height: 4 }, 'tail'),
      adornment({ at: 'end', width: 8, height: 6 }, 'arrow'),
      adornment({ at: 'end', width: 5, height: 6 }, 'arrow'),
    ])
    const solvedEnds = Hierarchy.apply(
      frames,
      [
        Edge.make({
          source: 'a',
          target: 'b',
          adornments: [
            turned(Frame.make({ width: 4, height: 4 }), 0),
            turned(Frame.make({ width: 8, height: 6 }), 1),
            turned(Frame.make({ width: 5, height: 6 }), 1),
          ],
        }),
      ],
      Hierarchy.make({ rankGap: 20 }),
    )
    const [start, end] = solvedEnds.edges[0]!.points

    // The two at the end line up, so the line stops 13 short of it.
    const data = LinearPath2d.toPathData(
      Linear2d.toPath(
        Linear2d.fromArray([
          Vector2.make(start!.x, start!.y + 4),
          Vector2.make(end!.x, end!.y - 13),
        ]),
      ),
    )
    expect(findOne(root, 'path').props['d']).toBe(data)
  })

  test('an end adornment and its margin keep the route straight', async () => {
    const fan = ['a', 'b', 'c'].map((id) => Frame.make({ id, width: 40, height: 20 }))
    const { root } = await mountLayout({ rankGap: 20, nodeGap: 10 }, () => [
      ...['b', 'c'].map((to) =>
        edge({ from: 'a', to, r: 4, smoothing: 0.5 }, () => [
          adornment({ at: 'end', width: 8, height: 6, marginLeft: 6 }, 'arrow'),
        ]),
      ),
      ...fan.map((frame) => node(frame.id, 40, 20)),
    ])
    const arrow = Adornment.make({
      frame: Frame.make({ width: 8, height: 6, offsetLeft: 6 }),
      at: 1,
      orient: Adornment.orient.forward,
    })
    const solvedFan = Hierarchy.apply(
      fan,
      ['b', 'c'].map((target) =>
        Edge.make({ source: 'a', target, radius: 6, adornments: [arrow] }),
      ),
      Hierarchy.make({ rankGap: 20, nodeGap: 10 }),
    )

    expect(props(findAll(root, 'route'))).toEqual(
      solvedFan.edges.map(({ points }) => ({ points: translatedPoints(points) })),
    )
    // The route runs straight for the arrow (8) and its margin (6), then
    // for the corner's reach of (1 + 0.5) * 4.
    const points = solvedFan.edges[0]!.points
    expect(points.at(-1)!.y - points.at(-2)!.y).toBeGreaterThanOrEqual(20)
  })

  test('layers and positions reach the core adornments', async () => {
    const { root } = await mountLayout({ rankGap: 20 }, () => [
      edge({ from: 'a', to: 'b', fromPort: 'right', r: 4 }, () => [
        adornment({ width: 20, height: 10 }, 'label'),
        adornment({ width: 20, height: 10 }, 'label'),
        adornment({ width: 6, height: 6, layer: 1 }, 'label'),
        adornment(
          { at: '25%', position: 'absolute', orient: 'forward', width: 4, height: 4 },
          'dot',
        ),
      ]),
      node('a', 40, 20),
      node('b', 40, 20),
    ])
    const solvedMixed = Hierarchy.apply(
      frames,
      [
        Edge.make({
          source: 'a',
          target: 'b',
          sourceSide: Edge.side.right,
          radius: 4,
          adornments: [
            Adornment.make({ frame: Frame.make({ width: 20, height: 10 }) }),
            Adornment.make({ frame: Frame.make({ width: 20, height: 10 }) }),
            Adornment.make({ frame: Frame.make({ width: 6, height: 6 }), layer: 1 }),
            Adornment.make({
              frame: Frame.make({ width: 4, height: 4 }),
              at: 0.25,
              position: Adornment.position.absolute,
              orient: Adornment.orient.forward,
            }),
          ],
        }),
      ],
      Hierarchy.make({ rankGap: 20 }),
    )
    const placed = solvedMixed.edges[0]!.adornments

    expect(props(findAll(root, 'label'))).toEqual(
      placed.slice(0, 3).map(({ rect }) => rectProps(rect)),
    )
    expect(findOne(root, 'dot').props).toEqual(rectProps(placed[3]!.rect))
  })

  test('a lone end adornment on a straight edge takes no room in the layout', async () => {
    const { root } = await mountArrows(() => [
      adornment({ at: 'end', width: 8, height: 6 }, 'arrow'),
    ])

    expect(findOne(root, 'route').props).toEqual({ points: translatedPoints(route) })
    expect(findAll(root, 'probe')[1]?.props).toEqual(rectProps(solved.nodes.b))
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
