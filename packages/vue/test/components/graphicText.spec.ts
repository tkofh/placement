import * as Rect from 'placement/rect'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { h, nextTick, toRaw } from 'vue'
import type { GraphicTextProps } from '../../src/components/GraphicText.ts'
import { GraphicText } from '../../src/components/GraphicText.ts'
import { FakeResizeObserver, findOne, mountWithRect } from '../host.ts'
import { TestNode } from '../renderer.ts'

const host = Rect.make(0, 0, 200, 100)

// The component checks these globals at setup/watch time, so they must be
// stubbed before mounting.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('Element', TestNode)
})

afterEach(() => {
  vi.unstubAllGlobals()
  FakeResizeObserver.reset()
})

async function mountText(props: GraphicTextProps | null) {
  const mounted = mountWithRect(host, () => [h(GraphicText, props, () => 'hello')])
  // The template-ref watch observes the text node on the next tick.
  await nextTick()
  return mounted
}

// GraphicText holds its element in a deep `ref` (not `shallowRef`), and Vue
// only exempts real DOM element types from reactive conversion -- so the
// observer watches a reactive proxy of the TestNode. Unwrap to match.
async function measure(root: TestNode, width: number, height: number) {
  const node = findOne(root, 'text')
  for (const instance of FakeResizeObserver.instances) {
    for (const target of instance.targets) {
      if (toRaw(target) === node) {
        FakeResizeObserver.resize(target, { x: 0, y: 0, width, height })
      }
    }
  }
  await nextTick()
}

describe('measurement', () => {
  test('before any measurement the box is zero-size at the parent origin', async () => {
    const { root } = await mountText(null)

    expect(findOne(root, 'text').props).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  test('a measurement becomes the box size, with y at the text baseline', async () => {
    const { root } = await mountText(null)
    await measure(root, 40, 10)

    // y attr = solved rect.y + measured height.
    expect(findOne(root, 'text').props).toEqual({ x: 0, y: 10, width: 40, height: 10 })
  })

  test('a re-measure updates the box', async () => {
    const { root } = await mountText(null)
    await measure(root, 40, 10)
    await measure(root, 60, 20)

    expect(findOne(root, 'text').props).toEqual({ x: 0, y: 20, width: 60, height: 20 })
  })
})

describe('positioning', () => {
  test('top and left place the measured box', async () => {
    const { root } = await mountText({ top: 5, left: 10 })
    await measure(root, 40, 10)

    expect(findOne(root, 'text').props).toEqual({ x: 10, y: 15, width: 40, height: 10 })
  })

  test('percentages resolve against the parent', async () => {
    const { root } = await mountText({ left: '50%' })
    await measure(root, 40, 10)

    expect(findOne(root, 'text').props['x']).toBe(100)
  })

  test('right and bottom measure from the far edges using the measured size', async () => {
    const { root } = await mountText({ right: 10, bottom: 20 })
    await measure(root, 40, 10)

    // x = 200 - 40 - 10, rect.y = 100 - 10 - 20, y attr adds the height.
    expect(findOne(root, 'text').props).toEqual({ x: 150, y: 80, width: 40, height: 10 })
  })
})

describe('rendering', () => {
  test('paint props spread onto the node and the slot renders as content', async () => {
    const { root } = await mountText({ fill: 'red', opacity: 0.5 })

    const text = findOne(root, 'text')
    expect(text.props['fill']).toBe('color(srgb 1 0 0)')
    expect(text.props['fill-opacity']).toBe(0.5)
    expect(text.children.map((child) => child.text)).toContain('hello')
  })
})
