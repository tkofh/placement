import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Cardinal2d, Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h, nextTick, ref } from 'vue'
import type { GraphicCurveProps } from '../../src/components/GraphicCurve.ts'
import { GraphicCurve } from '../../src/components/GraphicCurve.ts'
import { GraphicPoint } from '../../src/components/GraphicPoint.ts'
import { roundPolyline } from '../../src/internal/corners.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

// Origin at zero so the registered points equal the raw left/top inputs.
const host = Rect.make(0, 0, 200, 100)

interface XY {
  x: number
  y: number
}

const wiggle: Array<XY> = [
  { x: 0, y: 0 },
  { x: 10, y: 20 },
  { x: 30, y: 5 },
  { x: 40, y: 25 },
]

function points(list: Array<XY>) {
  return list.map(({ x, y }) => h(GraphicPoint, { left: x, top: y }))
}

function vectors(list: Array<XY>) {
  return list.map(({ x, y }) => Vector2.make(x, y))
}

async function mountCurve(props: GraphicCurveProps, list: Array<XY>) {
  const mounted = mountWithRect(host, () => [h(GraphicCurve, props, () => points(list))])
  // Point registration resolves on the next tick.
  await nextTick()
  return mounted
}

describe('linear', () => {
  test('two points produce the same path data curvy produces for the polyline', async () => {
    const list: Array<XY> = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]
    const { root } = await mountCurve({ curve: 'linear' }, list)

    const expected = LinearPath2d.toPathData(Linear2d.toPath(Linear2d.fromArray(vectors(list))))
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })

  test('closed appends Z', async () => {
    const list: Array<XY> = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]
    const { root } = await mountCurve({ curve: 'linear', closed: true }, list)

    const expected = LinearPath2d.toPathData(Linear2d.toPath(Linear2d.fromArray(vectors(list))))
    expect(findOne(root, 'path').props['d']).toBe(`${expected} Z`)
  })
})

describe('minimum point counts', () => {
  test('below the minimum no <path> renders at all', async () => {
    // Cardinal (the default) needs 2.
    const { root } = await mountCurve({}, [{ x: 0, y: 0 }])
    expect(findAll(root, 'path')).toEqual([])
  })

  test('cardinal with natural ends needs four points', async () => {
    const three = await mountCurve({ ends: 'natural' }, wiggle.slice(0, 3))
    expect(findAll(three.root, 'path')).toEqual([])

    const four = await mountCurve({ ends: 'natural' }, wiggle)
    expect(findAll(four.root, 'path')).toHaveLength(1)
  })

  test('bezier needs 3n+1 points, at least four', async () => {
    const four = await mountCurve({ curve: 'bezier' }, wiggle)
    expect(findAll(four.root, 'path')).toHaveLength(1)

    const five = await mountCurve({ curve: 'bezier' }, [...wiggle, { x: 50, y: 0 }])
    expect(findAll(five.root, 'path')).toEqual([])

    const three = await mountCurve({ curve: 'bezier' }, wiggle.slice(0, 3))
    expect(findAll(three.root, 'path')).toEqual([])
  })
})

describe('cardinal', () => {
  test('is the default curve, with duplicated endpoints', async () => {
    const { root } = await mountCurve({}, wiggle)

    const expected = CubicPath2d.toPathData(
      Cardinal2d.toPath(
        Cardinal2d.withDuplicatedEndpoints(Cardinal2d.fromArray(vectors(wiggle), {})),
      ),
    )
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })

  // Uniform alpha, because at the default centripetal alpha a reflected
  // neighbor sits symmetrically and zeroes the endpoint tangent exactly as
  // a duplicated one does. Every padding mode then draws the same curve.
  test('each ends mode produces a defined d; reflect and natural differ from duplicate', async () => {
    const byEnds: Record<string, unknown> = {}
    await Promise.all(
      (['duplicate', 'reflect', 'interpolate', 'natural'] as const).map(async (ends) => {
        const { root } = await mountCurve({ ends, alpha: 0 }, wiggle)
        const d = findOne(root, 'path').props['d']
        expect(typeof d).toBe('string')
        byEnds[ends] = d
      }),
    )

    expect(byEnds['reflect']).not.toBe(byEnds['duplicate'])
    expect(byEnds['natural']).not.toBe(byEnds['duplicate'])
    expect(byEnds['natural']).not.toBe(byEnds['reflect'])
    // curvy 2.0.0-alpha.17 aliases withInterpolatedEndpoints to
    // withDuplicatedEndpoints, so the test cannot tell the modes apart yet.
    // If this test fails, curvy has a real implementation, and you must flip
    // the assertion.
    expect(byEnds['interpolate']).toBe(byEnds['duplicate'])
  })

  test('tension and alpha accept numeric strings', async () => {
    const asNumber = await mountCurve({ tension: 0, alpha: 1 }, wiggle)
    const asString = await mountCurve({ tension: '0', alpha: '1' }, wiggle)
    const defaults = await mountCurve({}, wiggle)

    const numberD = findOne(asNumber.root, 'path').props['d']
    expect(findOne(asString.root, 'path').props['d']).toBe(numberD)
    expect(findOne(defaults.root, 'path').props['d']).not.toBe(numberD)
  })
})

describe('rendering', () => {
  test('fill defaults to none; an explicit fill wins', async () => {
    const bare = await mountCurve({ curve: 'linear' }, wiggle.slice(0, 2))
    expect(findOne(bare.root, 'path').props['fill']).toBe('none')

    const filled = await mountCurve({ curve: 'linear', fill: 'red' }, wiggle.slice(0, 2))
    expect(findOne(filled.root, 'path').props['fill']).toBe('color(srgb 1 0 0)')
  })

  test('stroke paints and extra attrs land on the path', async () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicCurve, { curve: 'linear', stroke: 'red', 'data-testid': 'curve' }, () =>
        points(wiggle.slice(0, 2)),
      ),
    ])
    await nextTick()

    const path = findOne(root, 'path')
    expect(path.props['stroke']).toBe('color(srgb 1 0 0)')
    expect(path.props['data-testid']).toBe('curve')
  })

  test('the parent origin translates the control points', async () => {
    const list: Array<XY> = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]
    const { root } = mountWithRect(Rect.make(7, 11, 200, 100), () => [
      h(GraphicCurve, { curve: 'linear' }, () => points(list)),
    ])
    await nextTick()

    const shifted = list.map(({ x, y }) => Vector2.make(x + 7, y + 11))
    const expected = LinearPath2d.toPathData(Linear2d.toPath(Linear2d.fromArray(shifted)))
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })
})

describe('reactivity', () => {
  test('the path appears once enough points register', async () => {
    const list = ref<Array<XY>>([{ x: 0, y: 0 }])
    const { root } = mountWithRect(host, () => [
      h(GraphicCurve, { curve: 'linear' }, () =>
        list.value.map(({ x, y }) => h(GraphicPoint, { key: `${x}:${y}`, left: x, top: y })),
      ),
    ])
    await nextTick()
    expect(findAll(root, 'path')).toEqual([])

    list.value = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]
    await nextTick()

    const expected = LinearPath2d.toPathData(
      Linear2d.toPath(Linear2d.fromArray([Vector2.make(0, 0), Vector2.make(10, 10)])),
    )
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })
})

describe('rounded corners', () => {
  const corner: Array<XY> = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
  ]

  test('r rounds the corners of a linear curve', async () => {
    const { root } = await mountCurve({ curve: 'linear', r: 8, smoothing: 0.5 }, corner)

    const expected = CubicPath2d.toPathData(roundPolyline(corner, 8, 0.5)!)
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })

  test('a closed rounded curve rounds its closing corners', async () => {
    const { root } = await mountCurve(
      { curve: 'linear', r: 8, smoothing: '60%', closed: true },
      corner,
    )

    const expected = CubicPath2d.toPathData(roundPolyline(corner, 8, 0.6, true)!)
    expect(findOne(root, 'path').props['d']).toBe(`${expected} Z`)
  })

  test('other curves ignore r', async () => {
    const { root: rounded } = await mountCurve({ curve: 'basis', r: 8 }, corner)
    const { root: plain } = await mountCurve({ curve: 'basis' }, corner)
    expect(findOne(rounded, 'path').props['d']).toBe(findOne(plain, 'path').props['d'])
  })
})
