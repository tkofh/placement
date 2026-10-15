import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type VNodeArrayChildren, defineComponent, h, nextTick } from 'vue'
import { GraphicGroup } from '../../src/components/GraphicGroup.ts'
import { GraphicRect } from '../../src/components/GraphicRect.ts'
import type { GraphicRootProps } from '../../src/components/GraphicRoot.ts'
import { GraphicRoot } from '../../src/components/GraphicRoot.ts'
import { FakeResizeObserver, findAll, findOne } from '../host.ts'
import { TestNode, createApp, createRoot } from '../renderer.ts'

// The component checks these globals at setup/watch time, so the test must
// stub them before mounting.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('Element', TestNode)
})

afterEach(() => {
  vi.unstubAllGlobals()
  FakeResizeObserver.reset()
})

async function mountRoot(props: GraphicRootProps | null, content?: () => VNodeArrayChildren) {
  const App = defineComponent({
    name: 'App',
    setup: () => () => h(GraphicRoot, props, content === undefined ? undefined : content),
  })
  const root = createRoot()
  createApp(App).mount(root)
  // The template-ref watch observes the svg on the next tick.
  await nextTick()
  return root
}

async function measure(root: TestNode, width: number, height: number) {
  FakeResizeObserver.resize(findOne(root, 'svg'), { x: 0, y: 0, width, height })
  await nextTick()
}

describe('viewBox', () => {
  test('renders an <svg> with preserveAspectRatio none and an empty viewBox before measure', async () => {
    const root = await mountRoot(null)

    const svg = findOne(root, 'svg')
    expect(svg.props['preserveAspectRatio']).toBe('none')
    expect(svg.props['viewBox']).toBe('0 0 0 0')
  })

  test('without explicit sizing the viewBox adopts the measured rect', async () => {
    const root = await mountRoot(null)
    await measure(root, 200, 100)

    expect(findOne(root, 'svg').props['viewBox']).toBe('0 0 200 100')
  })

  // Explicit 50x50 content in a 200x100 viewport. Expectations follow the
  // Rect.align / Rect.cover / Rect.contain pipeline in the source.
  test('fit crop (the default) centers the viewport over the content rect without scaling', async () => {
    const root = await mountRoot({ width: 50, height: 50 })
    await measure(root, 200, 100)

    // The 200x100 viewport aligned at the center of the 50x50 root rect.
    expect(findOne(root, 'svg').props['viewBox']).toBe('-75 -25 200 100')
  })

  test('fit contain scales the viewport to cover the content rect', async () => {
    const root = await mountRoot({ width: 50, height: 50, fit: 'contain' })
    await measure(root, 200, 100)

    // Viewport aspect 2 covering 50x50 gives 100x50, centered, so the content fits.
    expect(findOne(root, 'svg').props['viewBox']).toBe('-25 0 100 50')
  })

  test('fit cover scales the viewport to fit inside the content rect', async () => {
    const root = await mountRoot({ width: 50, height: 50, fit: 'cover' })
    await measure(root, 200, 100)

    // Viewport aspect 2 contained by 50x50: 50x25, centered vertically.
    expect(findOne(root, 'svg').props['viewBox']).toBe('0 12.5 50 25')
  })

  test('origin shifts the alignment', async () => {
    const root = await mountRoot({ width: 50, height: 50, origin: 0 })
    await measure(root, 200, 100)

    expect(findOne(root, 'svg').props['viewBox']).toBe('0 0 200 100')
  })

  // Suspected bug: GraphicRootProps types x/y (via TransformProps), and the
  // setup pipes them through useXYTranslation. But the runtime props array
  // omits TRANSLATE_PROP_KEYS, so x/y stay in attrs, fall through onto the
  // <svg>, and never translate the viewBox. If this test fails with a
  // translated viewBox, the props array is fixed. Then update this test to
  // expect '-65 -5 200 100' with no x/y attrs on the svg.
  test('x and y do not translate the viewBox: they leak onto the svg as attrs', async () => {
    const root = await mountRoot({ width: 50, height: 50, x: 10, y: 20 })
    await measure(root, 200, 100)

    const svg = findOne(root, 'svg')
    expect(svg.props['viewBox']).toBe('-75 -25 200 100')
    expect(svg.props['x']).toBe(10)
    expect(svg.props['y']).toBe(20)
  })
})

describe('sizing context', () => {
  test('children resolve percentages against the root rect', async () => {
    const root = await mountRoot(null, () => [h(GraphicRect, { width: '50%' })])
    await measure(root, 200, 100)

    expect(findOne(root, 'rect').props).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rx: 0,
      ry: 0,
    })
  })
})

describe('debugGroups', () => {
  test('turns every descendant group into a rendered <g>', async () => {
    const root = await mountRoot({ debugGroups: true }, () => [
      h(GraphicGroup, null, { default: () => [h('probe', {})] }),
    ])
    await measure(root, 200, 100)

    expect(findOne(root, 'g').props).toEqual({ x: 0, y: 0, width: 200, height: 100 })
  })

  test('without it an attr-less group renders no wrapper', async () => {
    const root = await mountRoot(null, () => [
      h(GraphicGroup, null, { default: () => [h('probe', {})] }),
    ])
    await measure(root, 200, 100)

    expect(findAll(root, 'g')).toEqual([])
  })
})
