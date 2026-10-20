import * as Rect from 'placement/rect'
import * as Model from 'placement/unstable/model'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  KeepAlive,
  type VNodeArrayChildren,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  ref,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { FlexItem } from '../../src/components/FlexItem.ts'
import { FlexLayout } from '../../src/components/FlexLayout.ts'
import { GraphicGroup } from '../../src/components/GraphicGroup.ts'
import { GraphicRoot } from '../../src/components/GraphicRoot.ts'
import { useSizingContextRoot } from '../../src/composables/useSizingContext.ts'
import { FakeResizeObserver, findAll, findOne, mountWithRect } from '../host.ts'
import { TestNode, createApp, createRoot } from '../renderer.ts'

// Counts the mutates while the components still apply them.
vi.mock('placement/unstable/model', async (original) => {
  const actual = await original<typeof Model>()
  return { ...actual, mutate: vi.fn(actual.mutate) }
})

const host = Rect.make(0, 0, 200, 100)

function probe(rect: Rect.Rect, label?: string) {
  return h('probe', { label, x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

const probeSlot = (label?: string) => ({
  default: ({ rect }: { rect: Rect.Rect }) => [probe(rect, label)],
})

function probes(root: TestNode) {
  return findAll(root, 'probe').map(({ props: { label: _, ...rect } }) => rect)
}

function labelled(root: TestNode, label: string) {
  const { label: _, ...rect } = findAll(root, 'probe').find(
    (node) => node.props['label'] === label,
  )!.props
  return rect
}

describe('structure changes', () => {
  test('an item unmounting re-solves the rest', async () => {
    const show = ref(true)
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () => [
          h(FlexItem, { key: 'a', width: 10, height: 50 }, probeSlot()),
          show.value ? h(FlexItem, { key: 'b', width: 20, height: 50 }, probeSlot()) : null,
          h(FlexItem, { key: 'c', width: 30, height: 50 }, probeSlot()),
        ],
      }),
    ])
    await nextTick()
    expect(probes(root).map(({ x }) => x)).toEqual([0, 10, 30])

    show.value = false
    await nextTick()

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 10, height: 50 },
      { x: 10, y: 0, width: 30, height: 50 },
    ])
  })

  test('an item mounting between two others takes its place in the order', async () => {
    const show = ref(false)
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () => [
          h(FlexItem, { key: 'a', width: 10, height: 50 }, probeSlot('a')),
          show.value ? h(FlexItem, { key: 'b', width: 20, height: 50 }, probeSlot('b')) : null,
          h(FlexItem, { key: 'c', width: 30, height: 50 }, probeSlot('c')),
        ],
      }),
    ])
    await nextTick()

    show.value = true
    await nextTick()

    expect(['a', 'b', 'c'].map((label) => labelled(root, label).x)).toEqual([0, 10, 30])
  })

  test('a keyed reorder moves the items', async () => {
    const order = ref(['a', 'b', 'c'])
    const widths: Record<string, number> = { a: 10, b: 20, c: 30 }
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () =>
          order.value.map((key) =>
            h(FlexItem, { key, width: widths[key], height: 50 }, probeSlot(key)),
          ),
      }),
    ])
    await nextTick()

    order.value = ['c', 'a', 'b']
    await nextTick()

    expect(['c', 'a', 'b'].map((label) => labelled(root, label).x)).toEqual([0, 30, 40])
  })
})

describe('input reactivity', () => {
  test('a render that changes many props applies them in one mutate', async () => {
    const width = ref(10)
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () =>
          [1, 2, 3].map((n) => h(FlexItem, { width: width.value * n, height: 10 }, probeSlot())),
      }),
    ])
    await nextTick()
    vi.mocked(Model.mutate).mockClear()

    width.value = 20
    await nextTick()

    expect(vi.mocked(Model.mutate)).toHaveBeenCalledTimes(1)
    expect(probes(root).map(({ x }) => x)).toEqual([0, 20, 60])
  })

  test('an item change re-solves its siblings without rendering the layout', async () => {
    const width = ref(20)
    let layoutRenders = 0
    const Dynamic = defineComponent({
      name: 'DynamicItem',
      setup: () => () => h(FlexItem, { width: width.value, height: 50 }, probeSlot()),
    })
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () => {
          layoutRenders++
          return [h(Dynamic), h(FlexItem, { width: 30, height: 50 }, probeSlot())]
        },
      }),
    ])
    await nextTick()
    const before = layoutRenders

    width.value = 60
    await nextTick()

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 60, height: 50 },
      { x: 60, y: 0, width: 30, height: 50 },
    ])
    expect(layoutRenders).toBe(before)
  })

  test('a group resize re-resolves the percentages below it', async () => {
    const width = ref(100)
    const { root } = mountWithRect(host, () => [
      h(
        GraphicGroup,
        { width: width.value },
        {
          default: () => [
            h(FlexLayout, null, {
              default: () => [h(FlexItem, { width: '50%', height: '50%' }, probeSlot())],
            }),
          ],
        },
      ),
    ])
    await nextTick()
    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 50, height: 50 }])

    width.value = 160
    await nextTick()

    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 80, height: 50 }])
  })
})

describe('nesting', () => {
  test('a group inside an item is placed against the item', async () => {
    const { root } = mountWithRect(host, () => [
      h(
        GraphicGroup,
        { left: 10, top: 10, width: 180, height: 80 },
        {
          default: () => [
            h(
              FlexLayout,
              { gap: 20 },
              {
                default: () => [
                  h(FlexItem, { grow: 1, height: '100%' }),
                  h(
                    FlexItem,
                    { grow: 1, height: '100%' },
                    {
                      default: () => [h(GraphicGroup, { left: '10%', width: '50%' }, probeSlot())],
                    },
                  ),
                ],
              },
            ),
          ],
        },
      ),
    ])
    await nextTick()

    // The second item spans x 110 to 190; the group starts 8 into it.
    expect(probes(root)).toEqual([{ x: 118, y: 10, width: 40, height: 80 }])
  })

  test('a group directly inside a flex is placed against its content rect', async () => {
    const { root } = mountWithRect(host, () => [
      h(
        FlexLayout,
        { gutterLeft: 10, gutterTop: 20 },
        {
          default: () => [h(GraphicGroup, { width: '50%' }, probeSlot())],
        },
      ),
    ])
    await nextTick()

    expect(probes(root)).toEqual([{ x: 10, y: 20, width: 95, height: 80 }])
  })

  test('an item inside a group still belongs to the enclosing flex', async () => {
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () => [
          h(FlexItem, { width: 30, height: 10 }, probeSlot('a')),
          h(GraphicGroup, null, {
            default: () => [h(FlexItem, { width: 40, height: 10 }, probeSlot('b'))],
          }),
        ],
      }),
    ])
    await nextTick()

    expect(labelled(root, 'b')).toEqual({ x: 30, y: 0, width: 40, height: 10 })
  })
})

describe('keys', () => {
  test.each([
    ['shared', ['same', 'same']],
    ['dotted', ['a.b', 'c.d']],
    ['leading digits', ['1', '2']],
    ['empty', ['', '']],
  ])('%s ids still give every sibling its own node', async (_, ids) => {
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () => ids.map((id) => h(FlexItem, { id, width: 30, height: 10 }, probeSlot())),
      }),
    ])
    await nextTick()

    expect(probes(root).map(({ x }) => x)).toEqual([0, 30])
  })
})

describe('KeepAlive', () => {
  test('a deactivated item leaves the layout and rejoins it with its subtree', async () => {
    const shown = ref<'item' | 'none'>('item')
    const Shown = defineComponent({
      name: 'Shown',
      setup: () => () =>
        h(
          FlexItem,
          { width: 40, height: 20 },
          {
            default: () => [h(GraphicGroup, { left: 5 }, probeSlot('inner'))],
          },
        ),
    })
    const None = defineComponent({ name: 'None', setup: () => () => null })
    const { root } = mountWithRect(host, () => [
      h(FlexLayout, null, {
        default: () => [
          h(KeepAlive, null, { default: () => h(shown.value === 'item' ? Shown : None) }),
          h(FlexItem, { width: 30, height: 20 }, probeSlot('after')),
        ],
      }),
    ])
    await nextTick()
    expect(labelled(root, 'after').x).toBe(40)

    shown.value = 'none'
    await nextTick()
    expect(labelled(root, 'after').x).toBe(0)

    shown.value = 'item'
    await nextTick()
    await nextTick()
    expect(labelled(root, 'after').x).toBe(40)
    expect(labelled(root, 'inner')).toEqual({ x: 5, y: 0, width: 35, height: 20 })
  })
})

describe('GraphicRoot', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    vi.stubGlobal('Element', TestNode)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    FakeResizeObserver.reset()
  })

  test('a measurement re-places every node below the root', async () => {
    const App = defineComponent({
      setup: () => () =>
        h(GraphicRoot, null, {
          default: () => [
            h(FlexLayout, null, {
              default: () => [h(FlexItem, { grow: 1, height: '100%' }, probeSlot())],
            }),
          ],
        }),
    })
    const root = createRoot()
    createApp(App).mount(root)
    await nextTick()
    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 0, height: 0 }])

    FakeResizeObserver.resize(findOne(root, 'svg'), { x: 0, y: 0, width: 200, height: 100 })
    await nextTick()

    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 200, height: 100 }])
  })
})

describe('ssr', () => {
  function renderWithRect(content: () => VNodeArrayChildren) {
    const Host = defineComponent({
      setup() {
        useSizingContextRoot(host)
        return () => h('svg', content())
      },
    })
    return renderToString(createSSRApp(Host))
  }

  test('groups render placed', async () => {
    const html = await renderWithRect(() => [
      h(
        GraphicGroup,
        { left: 10, width: 100 },
        {
          default: () => [h(GraphicGroup, { left: '50%', debug: true })],
        },
      ),
    ])

    expect(html).toBe('<svg><!--[--><g x="60" y="0" width="50" height="100"></g><!--]--></svg>')
  })

  test('items render the layout solved so far, as the children context does', async () => {
    const html = await renderWithRect(() => [
      h(FlexLayout, null, {
        default: () => [
          h(FlexItem, { grow: 1, height: '100%', debug: true }),
          h(FlexItem, { grow: 1, height: '100%', debug: true }),
        ],
      }),
    ])

    expect(html).toBe(
      '<svg><!--[-->' +
        '<g x="0" y="0" width="200" height="100"></g>' +
        '<g x="100" y="0" width="100" height="100"></g>' +
        '<!--]--></svg>',
    )
  })
})
