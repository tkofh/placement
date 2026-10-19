import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import * as Adornment from 'placement/adornment'
import * as Connector from 'placement/connector'
import * as Edge from 'placement/edge'
import * as Frame from 'placement/frame'
import type * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type VNodeArrayChildren, h, nextTick, ref } from 'vue'
import {
  ConnectorAdornment,
  type ConnectorAdornmentProps,
} from '../../src/components/ConnectorAdornment.ts'
import { ConnectorEdge, type ConnectorEdgeProps } from '../../src/components/ConnectorEdge.ts'
import {
  ConnectorLayout,
  type ConnectorLayoutExposed,
  type ConnectorLayoutProps,
  type ConnectorScene,
} from '../../src/components/ConnectorLayout.ts'
import { ConnectorNode, type ConnectorNodeProps } from '../../src/components/ConnectorNode.ts'
import { GraphicGroup } from '../../src/components/GraphicGroup.ts'
import { roundPolyline } from '../../src/internal/corners.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'
import type { TestNode } from '../renderer.ts'

const host = Rect.make(0, 0, 400, 300)

function probe(rect: Rect.Rect, tag = 'probe') {
  return h(tag, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

// A node placed by its own rect props.
function node(id: string | undefined, rect: Rect.Rect, props: ConnectorNodeProps = {}) {
  return h(
    ConnectorNode,
    {
      ...(id === undefined ? {} : { id }),
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      ...props,
    },
    { default: ({ rect: placed }: { rect: Rect.Rect }) => [probe(placed)] },
  )
}

function edge(props: ConnectorEdgeProps, adornments: () => VNodeArrayChildren = () => []) {
  return h(ConnectorEdge, props, {
    default: ({ points }: { points: ReadonlyArray<Point.Point> }) => [
      h('route', { points: points.map(({ x, y }) => [x, y]) }),
      ...adornments(),
    ],
  })
}

async function mountLayout(
  props: ConnectorLayoutProps | (() => ConnectorLayoutProps),
  content: () => VNodeArrayChildren,
) {
  const mounted = mountWithRect(host, () => [
    h(ConnectorLayout, typeof props === 'function' ? props() : props, {
      default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, 'layout'), ...content()],
    }),
  ])
  // Registration resolves on the next tick.
  await nextTick()
  await nextTick()
  return mounted
}

function routes(root: TestNode) {
  return findAll(root, 'route').map((n) => n.props['points'])
}

function pointsOf(route: Connector.ConnectorRoute | undefined) {
  return route?.points.map(({ x, y }) => [x, y]) ?? []
}

const rects = {
  a: Rect.make(20, 20, 60, 30),
  b: Rect.make(220, 120, 60, 30),
  c: Rect.make(220, 20, 60, 30),
}

function graph() {
  return [
    edge({ from: 'a', to: 'b' }),
    edge({ from: 'a', to: 'c' }),
    node('a', rects.a),
    node('b', rects.b),
    node('c', rects.c),
  ]
}

const spec = Connector.make({ clearance: 10, gap: 6 })
const expected = Connector.apply(
  rects,
  [Edge.make({ source: 'a', target: 'b' }), Edge.make({ source: 'a', target: 'c' })],
  spec,
)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('routing', () => {
  test('routes match the core solve', async () => {
    const { root } = await mountLayout({ clearance: 10, gap: 6 }, graph)

    expect(routes(root)).toEqual(expected.edges.map(pointsOf))
    expect(findAll(root, 'probe').map((n) => n.props)).toEqual([
      { x: 20, y: 20, width: 60, height: 30 },
      { x: 220, y: 120, width: 60, height: 30 },
      { x: 220, y: 20, width: 60, height: 30 },
    ])
  })

  test('the layout fills its parent, and nodes fill theirs by default', async () => {
    const { root } = await mountLayout({ clearance: 10, gap: 6 }, () => [
      ...graph().slice(0, 2),
      ...(['a', 'b', 'c'] as const).map((id) =>
        h(
          GraphicGroup,
          {
            left: rects[id].x,
            top: rects[id].y,
            width: rects[id].width,
            height: rects[id].height,
          },
          { default: () => [h(ConnectorNode, { id })] },
        ),
      ),
    ])

    expect(findOne(root, 'layout').props).toEqual({ x: 0, y: 0, width: 400, height: 300 })
    expect(routes(root)).toEqual(expected.edges.map(pointsOf))
  })

  test('an edge draws its route as a path', async () => {
    const { root } = await mountLayout({ clearance: 10, gap: 6 }, graph)

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
    const { root } = await mountLayout({ clearance: 10 }, () => [
      edge({ from: 'a', to: 'b', r: 6, smoothing: 0.5 }),
      node('a', rects.a),
      node('b', rects.b),
    ])
    // The layout sizes corners by their reach, (1 + smoothing) radii.
    const solved = Connector.apply(
      { a: rects.a, b: rects.b },
      [Edge.make({ source: 'a', target: 'b', radius: 1.5 * 6 })],
      Connector.make({ clearance: 10 }),
    )
    const { points, radii } = solved.edges[0]!

    expect(points.length).toBeGreaterThan(2)
    expect(findOne(root, 'path').props['d']).toBe(
      CubicPath2d.toPathData(roundPolyline(points, 6, 0.5, false, radii)!),
    )
  })

  test('attrs and paint reach the path', async () => {
    const { root } = await mountLayout({}, () => [
      h(ConnectorEdge, { from: 'a', to: 'b', stroke: 'red 2px', 'marker-end': 'url(#arrow)' }),
      node('a', rects.a),
      node('b', rects.b),
    ])

    const path = findOne(root, 'path')
    expect(path.props['stroke']).toBe('color(srgb 1 0 0)')
    expect(path.props['stroke-width']).toBe('2px')
    expect(path.props['marker-end']).toBe('url(#arrow)')
  })

  test('ports, waypoints, and turns reach the core edge', async () => {
    const layout = { clearance: 10, bendCost: 200 }
    const { root } = await mountLayout(layout, () => [
      edge({ from: 'a', to: 'c', fromPort: 'bottom 25%', toPort: 'bottom', turn: 'clockwise' }),
      edge({ from: 'a', to: 'b', via: [{ x: 150, y: 250 }] }),
      node('a', rects.a),
      node('b', rects.b),
      node('c', rects.c),
    ])
    const solved = Connector.apply(
      rects,
      [
        Edge.make({
          source: 'a',
          target: 'c',
          sourceSide: Edge.side.bottom,
          sourceAt: 0.25,
          targetSide: Edge.side.bottom,
        }),
        Edge.make({ source: 'a', target: 'b' }),
      ],
      Connector.make(layout),
      { edges: [{ turn: Connector.turn.clockwise }, { via: [{ x: 150, y: 250 }] }] },
    )

    expect(routes(root)).toEqual(solved.edges.map(pointsOf))
    // The second route passes through its waypoint, on a run or at a
    // corner.
    const points = (routes(root)[1] ?? []) as Array<[number, number]>
    const through = points.some(([x, y], i) => {
      const next = points[i + 1]
      if (next === undefined) {
        return false
      }
      const [nx, ny] = next
      return (
        (x === nx && x === 150 && Math.min(y, ny) <= 250 && Math.max(y, ny) >= 250) ||
        (y === ny && y === 250 && Math.min(x, nx) <= 150 && Math.max(x, nx) >= 150)
      )
    })
    expect(through).toBe(true)
  })

  test('a node without an id is an obstacle', async () => {
    const wall = Rect.make(120, -100, 20, 360)
    const { root } = await mountLayout({ clearance: 10, bendCost: 0 }, () => [
      edge({ from: 'a', to: 'c' }),
      node('a', rects.a),
      node('c', rects.c),
      node(undefined, wall),
    ])
    const solved = Connector.apply(
      { a: rects.a, c: rects.c, wall },
      [Edge.make({ source: 'a', target: 'c' })],
      Connector.make({ clearance: 10, bendCost: 0 }),
    )

    expect(routes(root)).toEqual(solved.edges.map(pointsOf))
    // The straight line between the nodes runs through the obstacle.
    expect(routes(root)[0]).toHaveLength(6)
  })

  test('jogAt moves jogs along their runs, and an edge overrides the layout', async () => {
    const { root } = await mountLayout({ clearance: 10, bendCost: 0, jogAt: 'start' }, () => [
      edge({ from: 'a', to: 'b' }),
      edge({ from: 'a', to: 'b', fromPort: 'bottom', toPort: 'top', jogAt: 'end' }),
      node('a', rects.a),
      node('b', rects.b),
    ])
    const solved = Connector.apply(
      { a: rects.a, b: rects.b },
      [
        Edge.make({ source: 'a', target: 'b' }),
        Edge.make({ source: 'a', target: 'b', sourceSide: 2, targetSide: 0 }),
      ],
      Connector.make({ clearance: 10, bendCost: 0, jogAt: 0 }),
      { edges: [undefined, { jogAt: 1 }] },
    )

    expect(routes(root)).toEqual(solved.edges.map(pointsOf))
    // Against the source's clearance, and against the target's.
    expect(solved.edges[0]?.points[1]?.x).toBe(90)
    expect(solved.edges[1]?.points[1]?.y).toBe(110)
  })

  test('a layout prop replaces the other routing props', async () => {
    const { root } = await mountLayout({ clearance: 40, layout: spec }, graph)
    expect(routes(root)).toEqual(expected.edges.map(pointsOf))
  })

  test('percentages resolve against the layout parent', async () => {
    const { root } = await mountLayout({ clearance: '2.5%', gap: '1.5%' }, graph)
    expect(routes(root)).toEqual(expected.edges.map(pointsOf))
  })
})

describe('adornments', () => {
  const adornment = (props: ConnectorAdornmentProps, tag: string) =>
    h(ConnectorAdornment, props, {
      default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, tag)],
    })

  // A straight edge from the right of `a` to the left of `b`, (80, 35) to
  // (220, 35).
  const pair = { a: rects.a, b: Rect.make(220, 20, 60, 30) }

  function mountAdorned(adornments: () => VNodeArrayChildren, layout: ConnectorLayoutProps = {}) {
    return mountLayout({ clearance: 10, ...layout }, () => [
      edge({ from: 'a', to: 'b' }, adornments),
      node('a', pair.a),
      node('b', pair.b),
    ])
  }

  test('an end adornment packs against the target, pointing into it', async () => {
    const { root } = await mountAdorned(() => [
      adornment({ at: 'end', width: 8, height: 6, marginLeft: 2 }, 'arrow'),
    ])

    expect(routes(root)).toEqual([
      [
        [80, 35],
        [220, 35],
      ],
    ])
    expect(findOne(root, 'arrow').props).toEqual({ x: 212, y: 32, width: 8, height: 6 })
    // Upright, it needs no turn.
    expect(findAll(root, 'g')).toHaveLength(0)
  })

  test('a start adornment turns to point into the source', async () => {
    const { root } = await mountAdorned(() => [
      adornment({ at: 'start', width: 8, height: 6 }, 'arrow'),
    ])

    expect(findOne(root, 'arrow').props).toEqual({ x: 80, y: 32, width: 8, height: 6 })
    expect(findOne(root, 'g').props).toEqual({ transform: 'rotate(180 84 35)' })
  })

  test('the drawn line stops where the end adornments begin', async () => {
    const { root } = await mountAdorned(() => [
      adornment({ at: 'start', width: 4, height: 4 }, 'tail'),
      adornment({ at: 'end', width: 8, height: 6, marginLeft: 2 }, 'arrow'),
    ])

    // The margin trails the arrow, so the line runs on through it.
    const data = LinearPath2d.toPathData(
      Linear2d.toPath(Linear2d.fromArray([Vector2.make(84, 35), Vector2.make(212, 35)])),
    )
    expect(findOne(root, 'path').props['d']).toBe(data)
  })

  test('merged ends draw their shared arrowhead once, and every line stops behind it', async () => {
    const merged = { a: rects.a, d: Rect.make(20, 120, 60, 30), b: Rect.make(220, 70, 60, 30) }
    const arrow = () => [adornment({ at: 'end', width: 8, height: 6 }, 'arrow')]
    const { root } = await mountLayout({ clearance: 10, gap: 4, merge: 'side' }, () => [
      edge({ from: 'a', to: 'b', toPort: 'left' }, arrow),
      edge({ from: 'd', to: 'b', toPort: 'left' }, arrow),
      node('a', merged.a),
      node('d', merged.d),
      node('b', merged.b),
    ])
    const head = Adornment.make({ frame: Frame.make({ width: 8, height: 6 }), at: 1, orient: 1 })
    const core = Connector.apply(
      merged,
      [
        Edge.make({ source: 'a', target: 'b', targetSide: Edge.side.left, adornments: [head] }),
        Edge.make({ source: 'd', target: 'b', targetSide: Edge.side.left, adornments: [head] }),
      ],
      Connector.make({ clearance: 10, gap: 4, merge: Connector.merge.side }),
    )
    expect(routes(root)).toEqual(core.edges.map(pointsOf))
    expect(core.edges.map((route) => route?.merged)).toEqual([
      [-1, 0],
      [-1, 0],
    ])
    expect(findAll(root, 'arrow').map((n) => n.props)).toEqual([
      { x: 212, y: 82, width: 8, height: 6 },
    ])
    // Both lines end at the back of the arrowhead, on the line out of the
    // port.
    for (const path of findAll(root, 'path')) {
      expect(String(path.props['d']).trim().endsWith('212,85')).toBe(true)
    }
  })

  test.each([0, 40, undefined])('a bend cost of %s reaches the core', async (cost) => {
    // Ports on the bottom of a trade places when their routes would cross,
    // with a crossing cost, two fifths of the bend cost.
    const traded = {
      a: Rect.make(0, 0, 40, 40),
      b: Rect.make(140, 100, 40, 40),
      c: Rect.make(150, 0, 40, 40),
    }
    const pairs = [
      ['b', 'c'],
      ['a', 'b'],
      ['b', 'a'],
    ] as const
    const { root } = await mountLayout(
      {
        clearance: 10,
        gap: 4,
        ...(cost === undefined ? {} : { bendCost: cost }),
      },
      () => [
        ...pairs.map(([from, to]) => edge({ from, to })),
        ...(['a', 'b', 'c'] as const).map((id) => node(id, traded[id])),
      ],
    )
    const core = Connector.apply(
      traded,
      pairs.map(([source, target]) => Edge.make({ source, target })),
      Connector.make({ clearance: 10, gap: 4, bendCost: cost }),
    )
    expect(routes(root)).toEqual(core.edges.map(pointsOf))
  })

  test.each(['side', 'none'] as const)('merging %s reaches the core', async (merge) => {
    // From b, the top and the left of t cost the same; pulled along a's
    // line, b comes in on the left.
    const pulled = {
      a: Rect.make(0, 120, 40, 40),
      b: Rect.make(60, 0, 40, 40),
      t: Rect.make(140, 120, 40, 40),
    }
    const pairs = [
      ['a', 't'],
      ['b', 't'],
    ] as const
    const { root } = await mountLayout(
      {
        clearance: 10,
        gap: 4,
        bendCost: 20,
        merge,
      },
      () => [
        ...pairs.map(([from, to]) => edge({ from, to })),
        ...(['a', 'b', 't'] as const).map((id) => node(id, pulled[id])),
      ],
    )
    const core = Connector.apply(
      pulled,
      pairs.map(([source, target]) => Edge.make({ source, target })),
      Connector.make({
        clearance: 10,
        gap: 4,
        bendCost: 20,
        merge: Connector.merge[merge],
      }),
    )
    expect(routes(root)).toEqual(core.edges.map(pointsOf))
  })

  test('the merge gap reaches the core', async () => {
    const merged = { a: rects.a, d: Rect.make(20, 120, 60, 30), b: Rect.make(220, 70, 60, 30) }
    const arrow = () => [adornment({ at: 'end', width: 8, height: 6 }, 'arrow')]
    const { root } = await mountLayout(
      { clearance: 10, gap: 4, merge: 'near', mergeGap: 2 },
      () => [
        edge({ from: 'a', to: 'b', toPort: 'left' }, arrow),
        edge({ from: 'd', to: 'b', toPort: 'left' }, arrow),
        node('a', merged.a),
        node('d', merged.d),
        node('b', merged.b),
      ],
    )
    const head = Adornment.make({ frame: Frame.make({ width: 8, height: 6 }), at: 1, orient: 1 })
    const core = Connector.apply(
      merged,
      (['a', 'd'] as const).map((source) =>
        Edge.make({ source, target: 'b', targetSide: Edge.side.left, adornments: [head] }),
      ),
      Connector.make({ clearance: 10, gap: 4, merge: Connector.merge.near, mergeGap: 2 }),
    )
    expect(routes(root)).toEqual(core.edges.map(pointsOf))
  })

  test.each([
    ['black 3px', {}, 3],
    ['black', {}, 1],
    ['black 6px', { thickness: '3px' }, 3],
  ] as const)(
    'a stroke of %s %o reaches the core as thickness %i',
    async (stroke, pinned, thickness) => {
      const merged = { a: rects.a, d: Rect.make(20, 120, 60, 30), b: Rect.make(220, 70, 60, 30) }
      const arrow = () => [adornment({ at: 'end', width: 8, height: 6 }, 'arrow')]
      const { root } = await mountLayout(
        { clearance: 10, gap: 4, merge: 'side', mergeGap: 2 },
        () => [
          edge({ from: 'a', to: 'b', toPort: 'left', stroke, ...pinned }, arrow),
          edge({ from: 'd', to: 'b', toPort: 'left', stroke, ...pinned }, arrow),
          node('a', merged.a),
          node('d', merged.d),
          node('b', merged.b),
        ],
      )
      const head = Adornment.make({ frame: Frame.make({ width: 8, height: 6 }), at: 1, orient: 1 })
      const core = Connector.apply(
        merged,
        (['a', 'd'] as const).map((source) =>
          Edge.make({
            source,
            target: 'b',
            targetSide: Edge.side.left,
            thickness,
            adornments: [head],
          }),
        ),
        Connector.make({ clearance: 10, gap: 4, merge: Connector.merge.side, mergeGap: 2 }),
      )
      expect(routes(root)).toEqual(core.edges.map(pointsOf))
      // Thicker strokes set the lanes farther apart than bare lines.
      const bare = Connector.apply(
        merged,
        (['a', 'd'] as const).map((source) =>
          Edge.make({ source, target: 'b', targetSide: Edge.side.left, adornments: [head] }),
        ),
        Connector.make({ clearance: 10, gap: 4, merge: Connector.merge.side, mergeGap: 2 }),
      )
      expect(core.edges.map(pointsOf)).not.toEqual(bare.edges.map(pointsOf))
    },
  )

  test('labels reach the core adornments', async () => {
    const { root } = await mountAdorned(
      () => [
        adornment({ width: 30, height: 10 }, 'label'),
        adornment({ at: 0.25, position: 'absolute', width: 10, height: 10 }, 'dot'),
      ],
      { alignAdornments: 'start' },
    )
    const solved = Connector.apply(
      pair,
      [
        Edge.make({
          source: 'a',
          target: 'b',
          adornments: [
            Adornment.make({ frame: Frame.make({ width: 30, height: 10 }), at: 0.5 }),
            Adornment.make({
              frame: Frame.make({ width: 10, height: 10 }),
              at: 0.25,
              position: Adornment.position.absolute,
            }),
          ],
        }),
      ],
      Connector.make({ clearance: 10, alignAdornments: 0 }),
    )
    const [label, dot] = solved.edges[0]!.adornments

    expect(findOne(root, 'label').props).toEqual({
      x: label!.rect.x,
      y: label!.rect.y,
      width: 30,
      height: 10,
    })
    // Above the line, centered on its run.
    expect(label!.rect).toEqual(Rect.make(135, 25, 30, 10))
    expect(findOne(root, 'dot').props).toEqual({
      x: dot!.rect.x,
      y: dot!.rect.y,
      width: 10,
      height: 10,
    })
  })
})

test.each([
  [{ justifyAdornments: 'space-between' }, [80, 190]],
  [{ justifyAdornments: 'start', adornmentGap: 4 }, [80, 114]],
  [{ justifyAdornments: 'end', adornmentGap: '1%' }, [156, 190]],
] as const)('%o lays out the labels on a run', async (layout, xs) => {
  const pair = { a: rects.a, b: Rect.make(220, 20, 60, 30) }
  const { root } = await mountLayout({ clearance: 10, ...layout }, () => [
    edge({ from: 'a', to: 'b' }, () =>
      ['first', 'second'].map((tag, i) =>
        h(
          ConnectorAdornment,
          { at: 0.25 + i / 2, width: 30, height: 10 },
          { default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, tag)] },
        ),
      ),
    ),
    node('a', pair.a),
    node('b', pair.b),
  ])
  expect([findOne(root, 'first').props['x'], findOne(root, 'second').props['x']]).toEqual(xs)
})

describe('snapshot', () => {
  const wall = Rect.make(120, -100, 20, 360)

  async function mountSnapshot() {
    const exposed = ref<ConnectorLayoutExposed>()
    const { root } = mountWithRect(host, () => [
      h(
        ConnectorLayout,
        { ref: exposed, clearance: 10, gap: 6, merge: 'side' },
        {
          default: () => [
            edge({ from: 'a', to: 'c', fromPort: 'bottom 25%', turn: 'clockwise' }, () => [
              h(ConnectorAdornment, { at: 'end', width: 8, height: 6, marginLeft: 2 }),
            ]),
            edge({ from: 'a', to: 'b', via: [{ x: 150, y: 250 }], jogAt: 0.25 }),
            node('a', rects.a),
            node('b', rects.b),
            node('c', rects.c),
            node(undefined, wall),
          ],
        },
      ),
    ])
    await nextTick()
    await nextTick()
    return { root, scene: exposed.value?.snapshot() }
  }

  // Rebuilds the core inputs from a scene.
  function apply(scene: ConnectorScene) {
    const rectOf = ({ x, y, width, height }: Rect.RectLike) => Rect.make(x, y, width, height)
    return Connector.apply(
      Object.fromEntries(Object.entries(scene.rects).map(([id, rect]) => [id, rectOf(rect)])),
      scene.edges.map(({ adornments = [], ...fields }) =>
        Edge.make({
          ...fields,
          adornments: adornments.map(({ at, position, layer, orient, ...frame }) =>
            Adornment.make({ frame: Frame.make(frame), at, position, layer, orient }),
          ),
        }),
      ),
      Connector.make(scene.spec),
      {
        edges: scene.options.edges.map(({ avoid, ...rest }) => ({
          ...rest,
          avoid: avoid?.map(rectOf),
        })),
      },
    )
  }

  test('reads the routed problem back as plain JSON', async () => {
    const { scene } = await mountSnapshot()

    expect(scene).toEqual({
      spec: {
        clearance: 10,
        gap: 6,
        alignAdornments: 0.5,
        justifyAdornments: 0.5,
        justifyAdornmentsSpace: 0,
        justifyAdornmentsSpaceOuter: 0,
        adornmentGap: 0,
        jogAt: 0.5,
        jogSlant: 1,
        merge: Connector.merge.side,
      },
      rects: {
        a: { x: 20, y: 20, width: 60, height: 30 },
        b: { x: 220, y: 120, width: 60, height: 30 },
        c: { x: 220, y: 20, width: 60, height: 30 },
        // The obstacle without an id.
        '\u00000': { x: 120, y: -100, width: 20, height: 360 },
      },
      edges: [
        {
          source: 'a',
          target: 'c',
          weight: 1,
          minLength: 1,
          sourceSide: Edge.side.bottom,
          sourceAt: 0.25,
          radius: 0,
          thickness: 0,
          adornments: [
            {
              offsetTop: 0,
              offsetRight: 0,
              offsetBottom: 0,
              offsetLeft: 2,
              width: 8,
              height: 6,
              grow: 0,
              shrink: 0,
              at: 1,
              position: Adornment.position.flow,
              layer: 0,
              orient: Adornment.orient.forward,
            },
          ],
        },
        { source: 'a', target: 'b', weight: 1, minLength: 1, radius: 0, thickness: 0 },
      ],
      options: {
        edges: [
          { turn: Connector.turn.clockwise },
          { via: [{ x: 150, y: 250 }], turn: Connector.turn.none, jogAt: 0.25 },
        ],
      },
    })
    expect(JSON.parse(JSON.stringify(scene))).toEqual(scene)
  })

  test('the scene routes as the layout did', async () => {
    const { root, scene } = await mountSnapshot()

    expect(scene).toBeDefined()
    expect(apply(scene as ConnectorScene).edges.map(pointsOf)).toEqual(routes(root))
  })
})

describe('reactivity', () => {
  test('moving a node routes again', async () => {
    const top = ref(120)
    const { root } = await mountLayout({ clearance: 10, gap: 6 }, () => [
      edge({ from: 'a', to: 'b' }),
      node('a', rects.a),
      node('b', Rect.make(220, top.value, 60, 30)),
    ])

    top.value = 200
    await nextTick()

    const solved = Connector.apply(
      { a: rects.a, b: Rect.make(220, 200, 60, 30) },
      [Edge.make({ source: 'a', target: 'b' })],
      spec,
    )
    expect(routes(root)).toEqual(solved.edges.map(pointsOf))
  })

  test('adding and removing edges routes again', async () => {
    const withC = ref(false)
    const { root } = await mountLayout({ clearance: 10, gap: 6 }, () => [
      edge({ from: 'a', to: 'b' }),
      ...(withC.value ? [edge({ from: 'a', to: 'c' })] : []),
      node('a', rects.a),
      node('b', rects.b),
      node('c', rects.c),
    ])

    withC.value = true
    await nextTick()
    await nextTick()
    expect(routes(root)).toEqual(expected.edges.map(pointsOf))

    withC.value = false
    await nextTick()
    await nextTick()
    const alone = Connector.apply(rects, [Edge.make({ source: 'a', target: 'b' })], spec)
    expect(routes(root)).toEqual(alone.edges.map(pointsOf))
  })
})

describe('incomplete graphs', () => {
  test('an edge to a missing node has no route, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root } = await mountLayout({}, () => [
      edge({ from: 'a', to: 'nowhere' }),
      node('a', rects.a),
    ])
    await nextTick()

    expect(findAll(root, 'path')).toHaveLength(0)
    expect(routes(root)).toEqual([[]])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('"a" -> "nowhere"')
  })

  test('a duplicate id is only an obstacle, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root } = await mountLayout({ clearance: 10 }, () => [
      edge({ from: 'a', to: 'c' }),
      node('a', rects.a),
      node('c', rects.c),
      node('a', Rect.make(120, -100, 20, 360)),
    ])
    await nextTick()

    const solved = Connector.apply(
      { a: rects.a, c: rects.c, wall: Rect.make(120, -100, 20, 360) },
      [Edge.make({ source: 'a', target: 'c' })],
      Connector.make({ clearance: 10 }),
    )
    expect(routes(root)).toEqual(solved.edges.map(pointsOf))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('nodes share the id "a"')
  })

  test('an enclosed node leaves its edge unrouted, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root } = await mountLayout({ clearance: 5 }, () => [
      edge({ from: 'a', to: 'b' }),
      node('a', Rect.make(40, 40, 20, 20)),
      node('b', rects.b),
      node(undefined, Rect.make(0, 0, 100, 20)),
      node(undefined, Rect.make(0, 80, 100, 20)),
      node(undefined, Rect.make(0, 20, 20, 60)),
      node(undefined, Rect.make(80, 20, 20, 60)),
    ])
    await nextTick()

    expect(routes(root)).toEqual([[]])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('no route connects the edge "a" -> "b"')
  })

  test('a transient mismatch does not warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const withB = ref(true)
    await mountLayout({}, () =>
      withB.value
        ? [edge({ from: 'a', to: 'b' }), node('a', rects.a), node('b', rects.b)]
        : [node('a', rects.a)],
    )

    withB.value = false
    await nextTick()
    await nextTick()
    expect(warn).not.toHaveBeenCalled()
  })

  test('a node outside a layout throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mountWithRect(host, () => [node('a', rects.a)])).toThrow()
  })
})
