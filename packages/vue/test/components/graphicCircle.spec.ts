import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { GraphicCircle } from '../../src/components/GraphicCircle.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

const host = Rect.make(0, 0, 200, 100)

describe('sized by width and height', () => {
  test('equal dimensions render a <circle> centered in the box', () => {
    const { root } = mountWithRect(host, () => [h(GraphicCircle, { width: 50, height: 50 })])

    expect(findAll(root, 'ellipse')).toEqual([])
    expect(findOne(root, 'circle').props).toEqual({ cx: 25, cy: 25, r: 25 })
  })

  test('insets position the corner, not the center', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicCircle, { top: 10, left: 20, width: 50, height: 50 }),
    ])

    expect(findOne(root, 'circle').props).toEqual({ cx: 45, cy: 35, r: 25 })
  })

  test('unequal dimensions render an <ellipse>', () => {
    const { root } = mountWithRect(host, () => [h(GraphicCircle, { width: 80, height: 40 })])

    expect(findAll(root, 'circle')).toEqual([])
    expect(findOne(root, 'ellipse').props).toEqual({ cx: 40, cy: 20, rx: 40, ry: 20 })
  })
})

describe('sized by radius', () => {
  test('r overrides the sizing props and the insets position the center', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicCircle, { r: 30, top: 40, left: 50, width: 10, height: 10 }),
    ])

    // Size is 2r despite width/height, and cx/cy land exactly on left/top.
    expect(findOne(root, 'circle').props).toEqual({ cx: 50, cy: 40, r: 30 })
  })

  test('a percentage radius resolves against the parent width', () => {
    const { root } = mountWithRect(host, () => [h(GraphicCircle, { r: '50%', top: 50, left: 100 })])

    // 50% of the 200-wide (not 100-tall) parent.
    expect(findOne(root, 'circle').props).toEqual({ cx: 100, cy: 50, r: 100 })
  })

  test('two radius values resolve per axis and render an <ellipse>', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicCircle, { r: '50% 50%', top: 50, left: 100 }),
    ])

    expect(findOne(root, 'ellipse').props).toEqual({ cx: 100, cy: 50, rx: 100, ry: 50 })
  })
})

describe('paint', () => {
  test('paint props spread onto the node', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicCircle, { width: 50, height: 50, fill: 'red', opacity: 0.5 }),
    ])

    const circle = findOne(root, 'circle')
    expect(circle.props['fill']).toBe('color(srgb 1 0 0)')
    expect(circle.props['fill-opacity']).toBe(0.5)
  })
})

describe('reactivity', () => {
  test('a width change can switch the tag from circle to ellipse', async () => {
    const width = ref<number>(50)
    const { root } = mountWithRect(host, () => [
      h(GraphicCircle, { width: width.value, height: 50 }),
    ])
    expect(findAll(root, 'circle')).toHaveLength(1)
    expect(findAll(root, 'ellipse')).toEqual([])

    width.value = 80
    await nextTick()

    expect(findAll(root, 'circle')).toEqual([])
    expect(findOne(root, 'ellipse').props).toEqual({ cx: 40, cy: 25, rx: 40, ry: 25 })
  })
})
