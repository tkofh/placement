import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h } from 'vue'
import { GraphicPolygon } from '../../src/components/GraphicPolygon.ts'
import { roundPolyline } from '../../src/internal/corners.ts'
import { parsePolygon } from '../../src/internal/props/polygon.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

const host = Rect.make(10, 20, 200, 100)

const linear = (points: Array<[number, number]>) =>
  `${LinearPath2d.toPathData(
    Linear2d.toPath(Linear2d.fromArray(points.map(([x, y]) => Vector2.make(x, y)))),
  )} Z`

describe('parsePolygon', () => {
  test.each([
    ['0% 0%, 100% 50%, 0% 100%', 3],
    ['  -10px 5,20% -3px ', 2],
  ] as const)('parses %j', (input, count) => {
    expect(parsePolygon(input)).toHaveLength(count)
  })

  test('keeps units', () => {
    expect(parsePolygon('-10px 50%')).toEqual([
      [
        { value: -10, percent: false },
        { value: 50, percent: true },
      ],
    ])
  })

  test.each(['', '0 0 0', '1em 0', 'a b'])('rejects %j', (input) => {
    expect(parsePolygon(input)).toBeNull()
  })
})

describe('GraphicPolygon', () => {
  test('percentages resolve against its box, and the outline closes', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicPolygon, { points: '0% 0%, 100% 50%, 0% 100%', fill: 'red' }),
    ])

    const path = findOne(root, 'path')
    expect(path.props['d']).toBe(
      linear([
        [10, 20],
        [210, 70],
        [10, 120],
      ]),
    )
    expect(path.props['fill']).toBe('color(srgb 1 0 0)')
  })

  test('lengths are offsets from the top left corner of its box', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicPolygon, {
        left: 5,
        top: 5,
        width: 20,
        height: 20,
        points: '0 0, 10px 0, 100% 100%',
      }),
    ])

    expect(findOne(root, 'path').props['d']).toBe(
      linear([
        [15, 25],
        [25, 25],
        [35, 45],
      ]),
    )
  })

  test('r rounds every corner, the closing ones too', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicPolygon, { points: '0% 0%, 100% 50%, 0% 100%', r: 4, smoothing: 0.5 }),
    ])

    const rounded = roundPolyline(
      [Vector2.make(10, 20), Vector2.make(210, 70), Vector2.make(10, 120)],
      4,
      0.5,
      true,
    )
    expect(findOne(root, 'path').props['d']).toBe(`${CubicPath2d.toPathData(rounded!)} Z`)
  })

  test.each([undefined, 'nonsense', '0 0'])('renders nothing for points %j', (points) => {
    const { root } = mountWithRect(host, () => [
      h(GraphicPolygon, points === undefined ? {} : { points }),
    ])
    expect(findAll(root, 'path')).toHaveLength(0)
  })
})
