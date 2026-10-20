import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import * as Polygon from 'placement/polygon'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h } from 'vue'
import { GraphicPolygon } from '../../src/components/GraphicPolygon.ts'
import { roundPolyline } from '../../src/internal/corners.ts'
import { findOne, mountWithRect } from '../host.ts'

const host = Rect.make(10, 20, 200, 100)

const linear = (points: ReadonlyArray<readonly [number, number]>) =>
  `${LinearPath2d.toPathData(
    Linear2d.toPath(Linear2d.fromArray(points.map(([x, y]) => Vector2.make(x, y)))),
  )} Z`

describe('GraphicPolygon', () => {
  test('a rect by default, filling its box', () => {
    const { root } = mountWithRect(host, () => [h(GraphicPolygon, { fill: 'red' })])

    const path = findOne(root, 'path')
    expect(path.props['d']).toBe(
      linear([
        [10, 20],
        [210, 20],
        [210, 120],
        [10, 120],
      ]),
    )
    expect(path.props['fill']).toBe('color(srgb 1 0 0)')
  })

  test.each([0.5, '50%', '0.5'] as const)(
    'a phase of %j turns the rect into a diamond',
    (phase) => {
      const { root } = mountWithRect(host, () => [h(GraphicPolygon, { phase })])

      expect(findOne(root, 'path').props['d']).toBe(
        linear([
          [110, 20],
          [210, 70],
          [110, 120],
          [10, 70],
        ]),
      )
    },
  )

  test('sides and loops reach the core polygon, and its box places it', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicPolygon, { left: 5, top: 5, width: 40, height: 30, sides: '6', loops: 2 }),
    ])

    const { outlines } = Polygon.apply(
      Polygon.make({ sides: 6, loops: 2 }),
      Rect.make(15, 25, 40, 30),
    )
    expect(findOne(root, 'path').props['d']).toBe(
      outlines.map((outline) => linear(outline.map(({ x, y }) => [x, y] as const))).join(' '),
    )
  })

  test('r rounds every corner of the grown polygon, the closing ones too', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicPolygon, { sides: 3, phase: 0.5, r: 8, smoothing: 0.5 }),
    ])

    const { outlines, radius } = Polygon.apply(
      Polygon.make({ sides: 3, phase: 0.5, radius: 8 }),
      host,
    )
    expect(radius).toBe(8)
    const rounded = roundPolyline(
      outlines[0]!.map(({ x, y }) => Vector2.make(x, y)),
      radius,
      0.5,
      true,
    )
    expect(findOne(root, 'path').props['d']).toBe(`${CubicPath2d.toPathData(rounded!)} Z`)
  })

  test('a rounded diamond still touches its box', () => {
    const { root } = mountWithRect(host, () => [h(GraphicPolygon, { phase: 0.5, r: 10 })])

    const { outlines } = Polygon.apply(Polygon.make({ phase: 0.5, radius: 10 }), host)
    const drawn = roundPolyline(
      outlines[0]!.map(({ x, y }) => Vector2.make(x, y)),
      10,
      0,
      true,
    )
    expect(findOne(root, 'path').props['d']).toBe(`${CubicPath2d.toPathData(drawn!)} Z`)
    const box = CubicPath2d.boundingBox(drawn!)
    expect(box.x.start).toBeCloseTo(10, 1)
    expect(box.x.end).toBeCloseTo(210, 1)
    expect(box.y.start).toBeCloseTo(20, 1)
    expect(box.y.end).toBeCloseTo(120, 1)
  })
})
