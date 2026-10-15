import { LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Affine2d } from 'curvy/transform'
import { Vector2 } from 'curvy/vector'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { GraphicPath } from '../../src/components/GraphicPath.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

// A 10x10 square polyline anchored at the origin.
const square = Linear2d.toPath(
  Linear2d.fromArray([
    Vector2.make(0, 0),
    Vector2.make(10, 0),
    Vector2.make(10, 10),
    Vector2.make(0, 10),
    Vector2.make(0, 0),
  ]),
)

function transformed(scaleX: number, scaleY: number, x: number, y: number): string {
  return LinearPath2d.toPathData(
    LinearPath2d.transform(
      square,
      Affine2d.scale(scaleX, scaleY).pipe(Affine2d.andThen(Affine2d.translate(x, y))),
    ),
  )
}

describe('fit', () => {
  test('none translates the path by the parent origin', () => {
    const { root } = mountWithRect(Rect.make(7, 11, 200, 100), () => [
      h(GraphicPath, { path: square }),
    ])

    const expected = LinearPath2d.toPathData(
      LinearPath2d.transform(square, Affine2d.translate(7, 11)),
    )
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })

  test('fill stretches each axis onto the parent', () => {
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: square, fit: 'fill' }),
    ])

    // 10x10 box onto 200x100: scale 20x10, no leftover space to center.
    expect(findOne(root, 'path').props['d']).toBe(transformed(20, 10, 0, 0))
  })

  test('contain scales uniformly by the min factor and centers', () => {
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: square, fit: 'contain' }),
    ])

    // min(20, 10) = 10 gives 100x100, centered horizontally at x 50.
    expect(findOne(root, 'path').props['d']).toBe(transformed(10, 10, 50, 0))
  })

  test('cover scales uniformly by the max factor and centers', () => {
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: square, fit: 'cover' }),
    ])

    // max(20, 10) = 20 gives 200x200, centered vertically at y -50.
    expect(findOne(root, 'path').props['d']).toBe(transformed(20, 20, 0, -50))
  })

  test('fitting accounts for a box not anchored at the path origin', () => {
    const offsetSquare = Linear2d.toPath(
      Linear2d.fromArray([
        Vector2.make(20, 30),
        Vector2.make(30, 30),
        Vector2.make(30, 40),
        Vector2.make(20, 40),
        Vector2.make(20, 30),
      ]),
    )
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: offsetSquare, fit: 'contain' }),
    ])

    // Scale 10 about the box origin (20, 30), then center the box:
    // x = 50 - 20 * 10 = -150, y = 0 - 30 * 10 = -300.
    const expected = LinearPath2d.toPathData(
      LinearPath2d.transform(
        offsetSquare,
        Affine2d.scale(10, 10).pipe(Affine2d.andThen(Affine2d.translate(-150, -300))),
      ),
    )
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })
})

describe('inputs', () => {
  test('a spline input converts through its toPath', () => {
    const spline = Linear2d.fromArray([Vector2.make(0, 0), Vector2.make(10, 10)])
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: spline }),
    ])

    const expected = LinearPath2d.toPathData(
      LinearPath2d.transform(Linear2d.toPath(spline), Affine2d.translate(0, 0)),
    )
    expect(findOne(root, 'path').props['d']).toBe(expected)
  })

  test('no path prop renders nothing', () => {
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [h(GraphicPath)])

    expect(findAll(root, 'path')).toEqual([])
  })
})

describe('rendering', () => {
  test('fill defaults to none; an explicit fill wins', () => {
    const bare = mountWithRect(Rect.make(0, 0, 200, 100), () => [h(GraphicPath, { path: square })])
    expect(findOne(bare.root, 'path').props['fill']).toBe('none')

    const filled = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: square, fill: 'red' }),
    ])
    expect(findOne(filled.root, 'path').props['fill']).toBe('color(srgb 1 0 0)')
  })

  test('stroke paints and extra attrs merge onto the path node', () => {
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: square, stroke: 'blue', 'data-testid': 'path' }),
    ])

    const path = findOne(root, 'path')
    expect(path.props['stroke']).toBe('color(srgb 0 0 1)')
    expect(path.props['data-testid']).toBe('path')
  })
})

describe('reactivity', () => {
  test('a fit change retransforms the path', async () => {
    const fit = ref<'fill' | 'contain'>('fill')
    const { root } = mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(GraphicPath, { path: square, fit: fit.value }),
    ])
    expect(findOne(root, 'path').props['d']).toBe(transformed(20, 10, 0, 0))

    fit.value = 'contain'
    await nextTick()

    expect(findOne(root, 'path').props['d']).toBe(transformed(10, 10, 50, 0))
  })
})
