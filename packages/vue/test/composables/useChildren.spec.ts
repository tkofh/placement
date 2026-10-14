import { type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  KeepAlive,
  type Ref,
  Suspense,
  type VNodeArrayChildren,
  createSSRApp,
  defineComponent,
  getCurrentInstance,
  h,
  nextTick,
  ref,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { type Child, useChild, useChildren } from '../../src/composables/useChildren.ts'
import { createApp, createRoot } from '../renderer.ts'

let warnSpy: MockInstance<Console['warn']>

function useChildrenWarnings(): Array<string> {
  return warnSpy.mock.calls
    .map((call) => String(call[0]))
    .filter((text) => text.includes('[useChildren]'))
}

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// Every test implicitly asserts the dev unreachable-child warning stays
// silent; tests that expect it clear the spy after asserting.
afterEach(() => {
  const leaked = useChildrenWarnings()
  warnSpy.mockRestore()
  expect(leaked).toEqual([])
})

function inputsOf(iterator: Iterable<Child<number>>): Array<number> {
  return [...iterator].map((child) => child.input.value)
}

function makeItem(channel: string) {
  return defineComponent({
    name: 'Item',
    props: { input: { type: Number, required: true } },
    setup(props) {
      useChild(channel, () => props.input)
      return () => null
    },
  })
}

function mountProvider(channel: string, content: () => VNodeArrayChildren) {
  const runs: Array<ReadonlyArray<number>> = []
  let children: ReadonlyArray<Child<number>> = []

  const Provider = defineComponent({
    name: 'Provider',
    setup() {
      useChildren<number>(channel, (list) => {
        children = list
        runs.push(list.map((child) => child.input.value))
      })
      return () => h('root', content())
    },
  })

  const app = createApp(Provider)
  app.mount(createRoot())

  return {
    app,
    get children() {
      return children
    },
    get observed() {
      return runs.at(-1)
    },
    runs,
  }
}

describe('document order', () => {
  test('collects children in tree order across host elements, batched into one resolution', async () => {
    const Item = makeItem('order:elements')
    const provider = mountProvider('order:elements', () => [
      h(Item, { input: 1 }),
      h('div', [h(Item, { input: 2 }), h('span', [h(Item, { input: 3 })])]),
      h(Item, { input: 4 }),
    ])
    await nextTick()

    // The mapper always observes the empty list first (its eager tracking
    // run), then exactly one resolution for the whole registration batch.
    expect(provider.runs).toEqual([[], [1, 2, 3, 4]])
  })

  test('collects children rendered by intermediate components', async () => {
    const Item = makeItem('order:intermediate')
    const Wrapper = defineComponent({
      setup: () => () => [h(Item, { input: 2 }), h(Item, { input: 3 })],
    })
    const provider = mountProvider('order:intermediate', () => [
      h(Item, { input: 1 }),
      h(Wrapper),
      h(Item, { input: 4 }),
    ])
    await nextTick()

    expect(provider.observed).toEqual([1, 2, 3, 4])
  })

  test('multiple registrations from one component keep call order', async () => {
    const Item = makeItem('order:pair')
    const Pair = defineComponent({
      setup() {
        useChild('order:pair', () => 2)
        useChild('order:pair', () => 3)
        return () => null
      },
    })
    const provider = mountProvider('order:pair', () => [
      h(Item, { input: 1 }),
      h(Pair),
      h(Item, { input: 4 }),
    ])
    await nextTick()

    expect(provider.observed).toEqual([1, 2, 3, 4])
  })

  test('a provider can register as its own first child', async () => {
    const Item = makeItem('order:self')
    let observed: ReadonlyArray<number> = []
    const Provider = defineComponent({
      setup() {
        useChildren<number>('order:self', (list) => {
          observed = list.map((child) => child.input.value)
        })
        useChild('order:self', () => 0)
        return () => h('root', [h(Item, { input: 1 })])
      },
    })
    createApp(Provider).mount(createRoot())
    await nextTick()

    expect(observed).toEqual([0, 1])
  })

  test('nested providers of the same component own their subtrees', async () => {
    const record: Record<string, ReadonlyArray<number>> = {}
    const Layout = defineComponent({
      name: 'Layout',
      props: { label: { type: String, required: true } },
      setup(props, { slots }) {
        useChildren<number>('order:nested', (list) => {
          record[props.label] = list.map((child) => child.input.value)
        })
        return () => h('div', slots['default']?.())
      },
    })
    const Item = makeItem('order:nested')
    const App = defineComponent({
      setup: () => () =>
        h(Layout, { label: 'outer' }, () => [
          h(Item, { input: 1 }),
          h(Layout, { label: 'inner' }, () => [h(Item, { input: 10 }), h(Item, { input: 11 })]),
          h(Item, { input: 2 }),
        ]),
    })
    createApp(App).mount(createRoot())
    await nextTick()

    expect(record['outer']).toEqual([1, 2])
    expect(record['inner']).toEqual([10, 11])
  })

  test('channels are independent', async () => {
    const ItemA = makeItem('multi:a')
    const ItemB = makeItem('multi:b')
    const record: Record<string, ReadonlyArray<number>> = {}
    const Provider = defineComponent({
      setup() {
        useChildren<number>('multi:a', (list) => {
          record['a'] = list.map((child) => child.input.value)
        })
        useChildren<number>('multi:b', (list) => {
          record['b'] = list.map((child) => child.input.value)
        })
        return () =>
          h('root', [h(ItemA, { input: 1 }), h(ItemB, { input: 2 }), h(ItemA, { input: 3 })])
      },
    })
    createApp(Provider).mount(createRoot())
    await nextTick()

    expect(record['a']).toEqual([1, 3])
    expect(record['b']).toEqual([2])
  })
})

describe('solving', () => {
  test('writes outputs back through the mapper in document order', async () => {
    const outputs: Array<Readonly<Ref<number>>> = []
    const Sized = defineComponent({
      props: { size: { type: Number, required: true } },
      setup(props) {
        outputs.push(useChild('solve:offsets', () => props.size, -1))
        return () => null
      },
    })
    const Provider = defineComponent({
      setup() {
        useChildren<number, number>('solve:offsets', (list) => {
          let offset = 0
          for (const child of list) {
            child.output.value = offset
            offset += child.input.value
          }
        })
        return () =>
          h('root', [h(Sized, { size: 10 }), h(Sized, { size: 20 }), h(Sized, { size: 30 })])
      },
    })
    createApp(Provider).mount(createRoot())
    await nextTick()

    expect(outputs.map((output) => output.value)).toEqual([0, 10, 30])
  })

  test('a child without an initial value gets no output ref', async () => {
    const returned: Array<unknown> = []
    const outputsSeen: Array<unknown> = []
    const Bare = defineComponent({
      setup() {
        returned.push(useChild('solve:bare', () => 1))
        return () => null
      },
    })
    const Provider = defineComponent({
      setup() {
        useChildren<number>('solve:bare', (list) => {
          outputsSeen.length = 0
          outputsSeen.push(...list.map((child) => child.output))
        })
        return () => h('root', [h(Bare)])
      },
    })
    createApp(Provider).mount(createRoot())
    await nextTick()

    expect(returned).toEqual([undefined])
    expect(outputsSeen).toEqual([null])
  })

  test('an input change re-runs the mapper without a provider render', async () => {
    const Item = makeItem('solve:input')
    const bump = ref(1)
    // Wrapper owns the reactive read, so the provider itself never re-renders.
    const Wrapper = defineComponent({
      setup: () => () => h(Item, { input: bump.value }),
    })
    const provider = mountProvider('solve:input', () => [h(Wrapper), h(Item, { input: 10 })])
    await nextTick()
    expect(provider.observed).toEqual([1, 10])
    const runsBefore = provider.runs.length

    bump.value = 5
    await nextTick()

    expect(provider.observed).toEqual([5, 10])
    expect(provider.runs.length).toBe(runsBefore + 1)
  })

  test('the mapper observes the empty resolution when the last child leaves', async () => {
    const Item = makeItem('solve:empty')
    const show = ref(true)
    const provider = mountProvider('solve:empty', () => (show.value ? [h(Item, { input: 1 })] : []))
    await nextTick()
    expect(provider.observed).toEqual([1])

    show.value = false
    await nextTick()

    expect(provider.observed).toEqual([])
  })

  test('pre and post mappers both run, pre first', async () => {
    const sequence: Array<string> = []
    const Item = makeItem('solve:prepost')
    const Provider = defineComponent({
      setup() {
        useChildren<number>('solve:prepost', {
          pre: (list) => sequence.push(`pre:${list.length}`),
          post: (list) => sequence.push(`post:${list.length}`),
        })
        return () => h('root', [h(Item, { input: 1 })])
      },
    })
    createApp(Provider).mount(createRoot())
    await nextTick()

    // The pre mapper's eager tracking run observes the empty list, then the
    // batch resolution. The post mapper's first run is deferred past the
    // initial resolution, so it only ever observes resolved lists.
    expect(sequence).toEqual(['pre:0', 'pre:1', 'post:1'])
  })
})

describe('structure changes', () => {
  test('a child inserted mid-list lands in tree position, not registration order', async () => {
    const Item = makeItem('structure:insert')
    const showMiddle = ref(false)
    const provider = mountProvider('structure:insert', () => [
      h(Item, { key: 'a', input: 1 }),
      showMiddle.value ? h(Item, { key: 'b', input: 2 }) : null,
      h(Item, { key: 'c', input: 3 }),
    ])
    await nextTick()
    expect(provider.observed).toEqual([1, 3])

    showMiddle.value = true
    await nextTick()

    expect(provider.observed).toEqual([1, 2, 3])
  })

  test('removing a child mid-list unregisters it', async () => {
    const Item = makeItem('structure:remove')
    const order = ref([1, 2, 3])
    const provider = mountProvider('structure:remove', () =>
      order.value.map((input) => h(Item, { key: input, input })),
    )
    await nextTick()
    expect(provider.observed).toEqual([1, 2, 3])

    order.value = [1, 3]
    await nextTick()

    expect(provider.observed).toEqual([1, 3])
  })

  test('a keyed reorder in the provider updates the resolved order', async () => {
    const Item = makeItem('structure:reorder')
    const order = ref([1, 2, 3])
    const provider = mountProvider('structure:reorder', () =>
      order.value.map((input) => h(Item, { key: input, input })),
    )
    await nextTick()
    expect(provider.observed).toEqual([1, 2, 3])

    order.value = [3, 1, 2]
    await nextTick()

    expect(provider.observed).toEqual([3, 1, 2])
  })

  // Known limitation: a keyed move neither registers, unregisters, mounts,
  // nor unmounts anything, and Vue has no "moved" hook, so a reorder rendered
  // by an intermediate component (not the provider) triggers nothing. The
  // list stays stale until the provider's own next render. If this ever
  // starts passing with a fresh order, the limitation is fixed -- delete the
  // stale assertion and celebrate.
  test('a keyed reorder inside an intermediate component is stale until the provider re-renders', async () => {
    const Item = makeItem('structure:deep-reorder')
    const wrapperOrder = ref([1, 2])
    const Wrapper = defineComponent({
      setup: () => () => wrapperOrder.value.map((input) => h(Item, { key: input, input })),
    })
    const providerBump = ref(0)
    const provider = mountProvider('structure:deep-reorder', () => [
      h('div', { bump: providerBump.value }, [h(Wrapper)]),
      h(Item, { key: 'tail', input: 3 }),
    ])
    await nextTick()
    expect(provider.observed).toEqual([1, 2, 3])

    wrapperOrder.value = [2, 1]
    await nextTick()

    // Stale: the document order is now [2, 1, 3] but nothing invalidated.
    expect(provider.observed).toEqual([1, 2, 3])

    providerBump.value++
    await nextTick()

    expect(provider.observed).toEqual([2, 1, 3])
  })
})

describe('keep-alive', () => {
  test('deactivated children leave the layout and rejoin on activation', async () => {
    const Item = makeItem('keepalive')
    const show = ref(true)
    // Gate owns the toggle, so the provider never re-renders: only the
    // activation hooks can keep the list current.
    const Gate = defineComponent({
      setup: () => () =>
        h(KeepAlive, null, {
          default: () => (show.value ? [h(Item, { key: 'a', input: 1 })] : []),
        }),
    })
    const provider = mountProvider('keepalive', () => [h(Gate), h(Item, { key: 'b', input: 2 })])
    await nextTick()
    expect(provider.observed).toEqual([1, 2])
    const uid = provider.children[0]?.uid

    show.value = false
    await nextTick()
    expect(provider.observed).toEqual([2])

    show.value = true
    await nextTick()
    expect(provider.observed).toEqual([1, 2])
    expect(provider.children[0]?.uid).toBe(uid)

    show.value = false
    await nextTick()
    expect(provider.observed).toEqual([2])
  })
})

describe('suspense', () => {
  test('children under a pending Suspense join on resolve in tree order', async () => {
    const Item = makeItem('suspense')
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const AsyncItem = defineComponent({
      async setup() {
        useChild('suspense', () => 1)
        await gate
        return () => null
      },
    })
    const provider = mountProvider('suspense', () => [
      h(Suspense, null, {
        default: () => h('div', [h(AsyncItem), h(Item, { input: 2 })]),
      }),
      h(Item, { input: 3 }),
    ])
    await nextTick()

    // While pending, the suspense subtree's children are registered but
    // unmounted: absent from the layout and exempt from the dev warning.
    expect(provider.observed).toEqual([3])

    release()
    // Suspense resolution invalidates through the children's mount hooks a
    // few microtasks after the gate opens.
    await vi.waitFor(() => expect(provider.observed).toEqual([1, 2, 3]))
  })
})

describe('sibling iterators', () => {
  async function mountIterators() {
    const Item = makeItem('iterators')
    const provider = mountProvider('iterators', () => [
      h(Item, { input: 1 }),
      h('div', [h(Item, { input: 2 }), h(Item, { input: 3 })]),
      h(Item, { input: 4 }),
    ])
    await nextTick()
    expect(provider.observed).toEqual([1, 2, 3, 4])
    return provider.children
  }

  // The iterators cover a child's own group plus its enclosing chain -- not
  // document order: children inside sibling containers (the nested [2, 3])
  // never appear for the outer children.
  test('before() yields earlier children in the group and enclosing chain', async () => {
    const children = await mountIterators()

    expect(inputsOf(children[0]!.before())).toEqual([])
    expect(inputsOf(children[1]!.before())).toEqual([1])
    expect(inputsOf(children[2]!.before())).toEqual([1, 2])
    expect(inputsOf(children[3]!.before())).toEqual([1])
  })

  test('after() yields later children in the group and enclosing chain', async () => {
    const children = await mountIterators()

    expect(inputsOf(children[0]!.after())).toEqual([4])
    expect(inputsOf(children[1]!.after())).toEqual([3, 4])
    expect(inputsOf(children[2]!.after())).toEqual([4])
    expect(inputsOf(children[3]!.after())).toEqual([])
  })

  test('sibling groups are per container, not per depth', async () => {
    const Item = makeItem('iterators:containers')
    const provider = mountProvider('iterators:containers', () => [
      h(Item, { input: 1 }),
      h('div', [h(Item, { input: 2 }), h(Item, { input: 3 })]),
      h(Item, { input: 4 }),
      h('div', [h(Item, { input: 5 }), h(Item, { input: 6 })]),
      h(Item, { input: 7 }),
    ])
    await nextTick()
    const children = provider.children
    expect(provider.observed).toEqual([1, 2, 3, 4, 5, 6, 7])

    expect(inputsOf(children[0]!.siblings)).toEqual([1, 4, 7])
    expect(inputsOf(children[1]!.siblings)).toEqual([2, 3])
    expect(inputsOf(children[4]!.siblings)).toEqual([5, 6])
    expect(children[1]!.siblings).not.toBe(children[4]!.siblings)

    expect(inputsOf(children[1]!.after())).toEqual([3, 4, 7])
    expect(inputsOf(children[4]!.before())).toEqual([1, 4])
    expect(inputsOf(children[4]!.after())).toEqual([6, 7])
    expect(inputsOf(children[6]!.before())).toEqual([1, 4])
  })

  test('is() compares by identity', async () => {
    const children = await mountIterators()

    expect(children[0]!.is(children[0])).toBe(true)
    expect(children[0]!.is(children[1])).toBe(false)
    expect(children[0]!.is(undefined)).toBe(false)
  })
})

describe('ssr', () => {
  test('resolves progressively during renderToString', async () => {
    const Sized = defineComponent({
      props: { size: { type: Number, required: true } },
      setup(props) {
        const output = useChild('ssr:static', () => props.size, -1)
        return () => h('i', null, String(output.value))
      },
    })
    const Provider = defineComponent({
      setup() {
        useChildren<number, number>('ssr:static', (list) => {
          let offset = 0
          for (const child of list) {
            child.output.value = offset
            offset += child.input.value
          }
        })
        return () =>
          h('div', [h(Sized, { size: 10 }), h(Sized, { size: 20 }), h(Sized, { size: 30 })])
      },
    })

    const html = await renderToString(createSSRApp(Provider))

    expect(html).toBe('<div><i>0</i><i>10</i><i>30</i></div>')
  })

  test('an input change mid-render synchronously re-maps', async () => {
    const shared = ref(1)
    const SharedItem = defineComponent({
      setup() {
        const output = useChild('ssr:update', () => shared.value, -1)
        return () => h('i', null, String(output.value))
      },
    })
    const Sized = defineComponent({
      props: { size: { type: Number, required: true } },
      setup(props) {
        const output = useChild('ssr:update', () => props.size, -1)
        return () => h('i', null, String(output.value))
      },
    })
    const Mutator = defineComponent({
      props: { size: { type: Number, required: true } },
      setup(props) {
        const output = useChild('ssr:update', () => props.size, -1)
        shared.value = 5
        return () => h('i', null, String(output.value))
      },
    })
    const Provider = defineComponent({
      setup() {
        useChildren<number, number>('ssr:update', (list) => {
          let offset = 0
          for (const child of list) {
            child.output.value = offset
            offset += child.input.value
          }
        })
        return () =>
          h('div', [
            h(SharedItem),
            h(Sized, { size: 2 }),
            h(Sized, { size: 3 }),
            h(Mutator, { size: 4 }),
          ])
      },
    })

    const html = await renderToString(createSSRApp(Provider))

    // Each child renders the offset solved at its own point in the stream;
    // the mutator's own offset reflects the first child's new input (5),
    // not the value it registered with (1).
    expect(html).toBe('<div><i>0</i><i>1</i><i>3</i><i>10</i></div>')
  })
})

describe('dev warnings', () => {
  test('warns once for a mounted child the walk cannot reach, then dedupes and clears', async () => {
    const Item = makeItem('stray')
    const key = Symbol.for('use-children:stray')
    const order = ref([1])
    let capturedContext: unknown
    const Provider = defineComponent({
      setup() {
        useChildren<number>('stray', () => {})
        const vm = getCurrentInstance() as unknown as { provides: Record<symbol, unknown> }
        capturedContext = vm.provides[key]
        return () =>
          h(
            'root',
            order.value.map((input) => h(Item, { key: input, input })),
          )
      },
    })
    createApp(Provider).mount(createRoot())
    await nextTick()
    expect(useChildrenWarnings()).toEqual([])

    // A second app sharing the context via app-level provide: its child is
    // mounted and registered but lives in a vnode tree the walk cannot reach.
    const Stray = defineComponent({
      name: 'StrayItem',
      setup() {
        useChild('stray', () => 99)
        return () => null
      },
    })
    const strayApp = createApp(Stray)
    strayApp.provide(key as never, capturedContext as never)
    strayApp.mount(createRoot())
    await nextTick()

    expect(useChildrenWarnings()).toHaveLength(1)
    expect(useChildrenWarnings()[0]).toContain('"stray"')
    expect(useChildrenWarnings()[0]).toContain('StrayItem')

    // Same missing set on a later resolve: no repeat warning.
    order.value = [1, 2]
    await nextTick()
    expect(useChildrenWarnings()).toHaveLength(1)

    // The stray unmounts and unregisters; the condition clears silently.
    strayApp.unmount()
    await nextTick()
    expect(useChildrenWarnings()).toHaveLength(1)

    warnSpy.mockClear()
  })
})

describe('errors', () => {
  test('useChild reports a missing provider', () => {
    const errors: Array<unknown> = []
    const Orphan = defineComponent({
      setup() {
        useChild('errors:missing', () => 1)
        return () => null
      },
    })
    const app = createApp(Orphan)
    app.config.errorHandler = (error) => {
      errors.push(error)
    }
    app.mount(createRoot())

    expect(String(errors[0])).toContain('No context found for channel "errors:missing"')
  })

  test('both composables require a component instance', () => {
    expect(() => useChild('errors:outside', () => 1)).toThrow(
      'useChild must be called within a Vue component',
    )
    expect(() => useChildren('errors:outside', () => {})).toThrow(
      'useChildren must be called within a Vue component',
    )
  })
})
