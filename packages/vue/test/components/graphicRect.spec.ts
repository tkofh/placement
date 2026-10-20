import { CubicPath2d } from 'curvy/path'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { GraphicRect, type GraphicRectProps } from '../../src/components/GraphicRect.ts'
import { roundRect } from '../../src/internal/corners.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

const host = Rect.make(0, 0, 200, 100)

describe('sizing', () => {
  test('fills the host rect by default', () => {
    const { root } = mountWithRect(host, () => [h(GraphicRect)])

    expect(findOne(root, 'rect').props).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      rx: 0,
      ry: 0,
    })
  })

  test('percentages resolve against the parent axes', () => {
    const { root } = mountWithRect(host, () => [h(GraphicRect, { width: '50%', height: '50%' })])

    const rect = findOne(root, 'rect')
    expect(rect.props['width']).toBe(100)
    expect(rect.props['height']).toBe(50)
  })

  test('top and left insets position the box', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicRect, { top: 10, left: 20, width: 50, height: 30 }),
    ])

    expect(findOne(root, 'rect').props).toEqual({
      x: 20,
      y: 10,
      width: 50,
      height: 30,
      rx: 0,
      ry: 0,
    })
  })

  test('right and bottom insets measure from the far edges', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicRect, { right: 20, bottom: 10, width: 50, height: 30 }),
    ])

    const rect = findOne(root, 'rect')
    expect(rect.props['x']).toBe(130)
    expect(rect.props['y']).toBe(60)
  })
})

describe('radius', () => {
  test('a numeric r sets both corner radii', () => {
    const { root } = mountWithRect(host, () => [h(GraphicRect, { r: 10 })])

    const rect = findOne(root, 'rect')
    expect(rect.props['rx']).toBe(10)
    expect(rect.props['ry']).toBe(10)
  })

  test('a two-value r sets rx and ry independently', () => {
    const { root } = mountWithRect(host, () => [h(GraphicRect, { r: '10 20' })])

    const rect = findOne(root, 'rect')
    expect(rect.props['rx']).toBe(10)
    expect(rect.props['ry']).toBe(20)
  })

  test('a lone percentage resolves both radii against the parent width', () => {
    const { root } = mountWithRect(host, () => [h(GraphicRect, { r: '50%' })])

    const rect = findOne(root, 'rect')
    expect(rect.props['rx']).toBe(100)
    expect(rect.props['ry']).toBe(100)
  })

  test('two percentages resolve against width then height', () => {
    const { root } = mountWithRect(host, () => [h(GraphicRect, { r: '10% 50%' })])

    const rect = findOne(root, 'rect')
    expect(rect.props['rx']).toBe(20)
    expect(rect.props['ry']).toBe(50)
  })
})

describe('paint', () => {
  test('fill, stroke, and opacity spread onto the node with kebab-case keys', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicRect, { fill: 'red', stroke: 'blue', opacity: 0.5 }),
    ])

    const rect = findOne(root, 'rect')
    expect(rect.props['fill']).toBe('color(srgb 1 0 0)')
    expect(rect.props['stroke']).toBe('color(srgb 0 0 1)')
    expect(rect.props['fill-opacity']).toBe(0.5)
    expect(rect.props['stroke-opacity']).toBe(0.5)
  })

  test('paint keys stay unset without paint props', () => {
    const { root } = mountWithRect(host, () => [h(GraphicRect)])

    const rect = findOne(root, 'rect')
    expect(rect.props['fill']).toBeUndefined()
    expect(rect.props['stroke']).toBeUndefined()
  })
})

describe('reactivity', () => {
  test('a prop change re-renders the node', async () => {
    const width = ref<number>(50)
    const { root } = mountWithRect(host, () => [h(GraphicRect, { width: width.value })])
    expect(findOne(root, 'rect').props['width']).toBe(50)

    width.value = 80
    await nextTick()

    expect(findOne(root, 'rect').props['width']).toBe(80)
  })
})

describe('smoothing', () => {
  test('smoothed corners render a closed path', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicRect, { top: 10, left: 20, width: 50, height: 30, r: 6, smoothing: 0.6 }),
    ])

    const expected = `${CubicPath2d.toPathData(roundRect(20, 10, 50, 30, 6, 6, 0.6))} Z`
    expect(findOne(root, 'path').props['d']).toBe(expected)
    expect(findAll(root, 'rect')).toEqual([])
  })

  test.each<[string, GraphicRectProps & { r?: number }]>([
    ['no smoothing', { r: 6 }],
    ['smoothing 0', { r: 6, smoothing: 0 }],
    ['no radius', { smoothing: 0.6 }],
    ['unparseable smoothing', { r: 6, smoothing: 'soft' as never }],
  ])('%s keeps the native rect', (_, props) => {
    const { root } = mountWithRect(host, () => [h(GraphicRect, props)])
    expect(findAll(root, 'path')).toEqual([])
    expect(findOne(root, 'rect').props['rx']).toBe(props.r ?? 0)
  })

  test('percent smoothing and paint reach the path', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicRect, { r: '8px 4px', smoothing: '100%', fill: 'red' }),
    ])

    const path = findOne(root, 'path')
    expect(path.props['d']).toBe(`${CubicPath2d.toPathData(roundRect(0, 0, 200, 100, 8, 4, 1))} Z`)
    expect(path.props['fill']).toBe('color(srgb 1 0 0)')
  })
})
