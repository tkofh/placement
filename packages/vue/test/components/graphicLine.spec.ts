// This file also covers GraphicPoint, which renders nothing on its own. The
// tests observe every point behavior through the line that it feeds.
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { GraphicLine } from '../../src/components/GraphicLine.ts'
import { GraphicPoint } from '../../src/components/GraphicPoint.ts'
import type { GraphicPointProps } from '../../src/components/GraphicPoint.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

// Nonzero origin so the line's parent-rect translation is visible.
const host = Rect.make(7, 11, 200, 100)

async function mountLine(points: Array<GraphicPointProps>) {
  const mounted = mountWithRect(host, () => [
    h(GraphicLine, null, () => points.map((point) => h(GraphicPoint, point))),
  ])
  // Point registration resolves on the next tick.
  await nextTick()
  return mounted
}

describe('endpoints', () => {
  test('the first two points become x1/y1 and x2/y2, translated by the parent origin', async () => {
    const { root } = await mountLine([
      { top: 20, left: 10 },
      { top: 40, left: 30 },
    ])

    expect(findOne(root, 'line').props).toEqual({ x1: 17, y1: 31, x2: 37, y2: 51 })
  })

  test('right and bottom measure from the far edges', async () => {
    const { root } = await mountLine([
      { top: 0, left: 0 },
      { bottom: 20, right: 10 },
    ])

    // parentWidth - right = 190, parentHeight - bottom = 80, plus the
    // line's own (7, 11) translation.
    expect(findOne(root, 'line').props).toEqual({ x1: 7, y1: 11, x2: 197, y2: 91 })
  })

  test('x and y translate the point, percentages against the parent dimensions', async () => {
    const { root } = await mountLine([
      { top: 20, left: 10, x: 5, y: -5 },
      { top: 0, left: 0, x: '50%', y: '50%' },
    ])

    expect(findOne(root, 'line').props).toEqual({ x1: 22, y1: 26, x2: 107, y2: 61 })
  })

  test('missing points fall back to the (translated) origin', async () => {
    const none = await mountLine([])
    expect(findOne(none.root, 'line').props).toEqual({ x1: 7, y1: 11, x2: 7, y2: 11 })

    const one = await mountLine([{ top: 20, left: 10 }])
    expect(findOne(one.root, 'line').props).toEqual({ x1: 17, y1: 31, x2: 7, y2: 11 })
  })

  // `global` adds the parent origin to the point itself, and the line then
  // translates every point by the same origin. A global point therefore
  // shifts twice. This looks wrong, because a "global" point presumably
  // belongs at its absolute coordinates once, but it is what the code does.
  test('a global point is translated twice: once by the point, once by the line', async () => {
    const { root } = await mountLine([
      { top: 20, left: 10, global: true },
      { top: 0, left: 0 },
    ])

    expect(findOne(root, 'line').props).toEqual({ x1: 24, y1: 42, x2: 7, y2: 11 })
  })
})

describe('rendering', () => {
  test('slot children render before the line node', async () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicLine, null, () => [h(GraphicPoint, { top: 0, left: 0 }), h('marker')]),
    ])
    await nextTick()

    const svg = findOne(root, 'svg')
    const marker = findOne(root, 'marker')
    const line = findOne(root, 'line')
    expect(svg.children.indexOf(marker)).toBeLessThan(svg.children.indexOf(line))
  })

  test('stroke and opacity paint the line', async () => {
    const { root } = mountWithRect(host, () => [h(GraphicLine, { stroke: 'red', opacity: 0.5 })])
    await nextTick()

    const line = findOne(root, 'line')
    expect(line.props['stroke']).toBe('color(srgb 1 0 0)')
    expect(line.props['stroke-opacity']).toBe(0.5)
  })

  test('extra attrs land on the line node', async () => {
    const { root } = mountWithRect(host, () => [h(GraphicLine, { 'data-testid': 'line' })])
    await nextTick()

    expect(findOne(root, 'line').props['data-testid']).toBe('line')
  })
})

describe('reactivity', () => {
  test('a point prop change moves the endpoint', async () => {
    const left = ref<number>(10)
    const { root } = mountWithRect(host, () => [
      h(GraphicLine, null, () => [
        h(GraphicPoint, { top: 0, left: left.value }),
        h(GraphicPoint, { top: 0, left: 100 }),
      ]),
    ])
    await nextTick()
    expect(findOne(root, 'line').props['x1']).toBe(17)

    left.value = 50
    await nextTick()

    expect(findOne(root, 'line').props['x1']).toBe(57)
  })

  test('a removed point drops out of the endpoints', async () => {
    const show = ref(true)
    const { root } = mountWithRect(host, () => [
      h(GraphicLine, null, () => [
        show.value ? h(GraphicPoint, { key: 'a', top: 20, left: 10 }) : null,
        h(GraphicPoint, { key: 'b', top: 40, left: 30 }),
      ]),
    ])
    await nextTick()
    expect(findOne(root, 'line').props).toEqual({ x1: 17, y1: 31, x2: 37, y2: 51 })

    show.value = false
    await nextTick()

    // The remaining point becomes the first endpoint. The second falls back.
    expect(findAll(root, 'line')[0]?.props).toEqual({ x1: 37, y1: 51, x2: 7, y2: 11 })
  })
})
