import * as Flexbox from 'placement/flexbox'
import * as Frame from 'placement/frame'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import {
  type MaybeRefOrGetter,
  type PropType,
  type Ref,
  type VNodeArrayChildren,
  defineComponent,
  h,
  nextTick,
  ref,
  shallowRef,
} from 'vue'
import { useFlexItem, useFlexLayout } from '../../src/composables/useFlex.ts'
import { createApp, createRoot } from '../renderer.ts'

function makeItem(rects: Array<Readonly<Ref<Rect.Rect>>>, initials?: Array<Rect.Rect>) {
  return defineComponent({
    name: 'Item',
    props: { frame: { type: Object as PropType<Frame.Frame>, required: true } },
    setup(props) {
      const rect = useFlexItem(() => props.frame)
      rects.push(rect)
      initials?.push(rect.value)
      return () => null
    },
  })
}

function mountFlex(
  layout: MaybeRefOrGetter<Flexbox.Flexbox>,
  inner: MaybeRefOrGetter<Rect.Rect>,
  content: () => VNodeArrayChildren,
) {
  let renders = 0
  const Provider = defineComponent({
    name: 'Provider',
    setup() {
      useFlexLayout(layout, inner)
      return () => {
        renders++
        return h('root', content())
      }
    },
  })
  createApp(Provider).mount(createRoot())
  return {
    get renders() {
      return renders
    },
  }
}

describe('solving', () => {
  test('a row lays items out along the main axis', async () => {
    const rects: Array<Readonly<Ref<Rect.Rect>>> = []
    const initials: Array<Rect.Rect> = []
    const Item = makeItem(rects, initials)
    mountFlex(Flexbox.make({}), Rect.make(0, 0, 100, 50), () => [
      h(Item, { frame: Frame.make({ width: 30, height: 50 }) }),
      h(Item, { frame: Frame.make({ width: 70, height: 50 }) }),
    ])
    await nextTick()

    // The batch resolves during mount itself; only at setup time does the
    // returned ref still hold the zero rect.
    expect(initials).toEqual([Rect.make(), Rect.make()])
    expect(rects[0]!.value).toEqual(Rect.make(0, 0, 30, 50))
    expect(rects[1]!.value).toEqual(Rect.make(30, 0, 70, 50))
  })

  test('grow splits free space in proportion to the factors', async () => {
    const rects: Array<Readonly<Ref<Rect.Rect>>> = []
    const Item = makeItem(rects)
    mountFlex(Flexbox.make({}), Rect.make(0, 0, 100, 50), () => [
      h(Item, { frame: Frame.make({ width: 20, height: 50, grow: 1 }) }),
      h(Item, { frame: Frame.make({ width: 20, height: 50, grow: 3 }) }),
    ])
    await nextTick()

    // 60 free: 15 to the first item, 45 to the second.
    expect(rects[0]!.value).toEqual(Rect.make(0, 0, 35, 50))
    expect(rects[1]!.value).toEqual(Rect.make(35, 0, 65, 50))
  })

  test('a column stacks items vertically', async () => {
    const rects: Array<Readonly<Ref<Rect.Rect>>> = []
    const Item = makeItem(rects)
    mountFlex(
      Flexbox.make({ direction: Flexbox.direction.column }),
      Rect.make(0, 0, 100, 50),
      () => [
        h(Item, { frame: Frame.make({ width: 100, height: 10 }) }),
        h(Item, { frame: Frame.make({ width: 100, height: 40 }) }),
      ],
    )
    await nextTick()

    expect(rects[0]!.value).toEqual(Rect.make(0, 0, 100, 10))
    expect(rects[1]!.value).toEqual(Rect.make(0, 10, 100, 40))
  })

  test('the inner rect origin offsets every result', async () => {
    const rects: Array<Readonly<Ref<Rect.Rect>>> = []
    const Item = makeItem(rects)
    mountFlex(Flexbox.make({}), Rect.make(10, 20, 100, 50), () => [
      h(Item, { frame: Frame.make({ width: 30, height: 50 }) }),
    ])
    await nextTick()

    expect(rects[0]!.value).toEqual(Rect.make(10, 20, 30, 50))
  })
})

describe('structure changes', () => {
  test('an item unmounting re-solves the remainder', async () => {
    const rects: Array<Readonly<Ref<Rect.Rect>>> = []
    const Item = makeItem(rects)
    const show = ref(true)
    mountFlex(Flexbox.make({}), Rect.make(0, 0, 100, 50), () => [
      h(Item, { key: 'a', frame: Frame.make({ width: 10, height: 50 }) }),
      show.value ? h(Item, { key: 'b', frame: Frame.make({ width: 20, height: 50 }) }) : null,
      h(Item, { key: 'c', frame: Frame.make({ width: 30, height: 50 }) }),
    ])
    await nextTick()
    expect(rects[1]!.value).toEqual(Rect.make(10, 0, 20, 50))
    expect(rects[2]!.value).toEqual(Rect.make(30, 0, 30, 50))

    show.value = false
    await nextTick()

    expect(rects[0]!.value).toEqual(Rect.make(0, 0, 10, 50))
    expect(rects[2]!.value).toEqual(Rect.make(10, 0, 30, 50))
    // The departed item's ref keeps its last solved value.
    expect(rects[1]!.value).toEqual(Rect.make(10, 0, 20, 50))
  })
})

describe('input reactivity', () => {
  test('a frame change re-solves without a provider render', async () => {
    const rects: Array<Readonly<Ref<Rect.Rect>>> = []
    const Item = makeItem(rects)
    const frame = shallowRef(Frame.make({ width: 20, height: 50 }))
    const Dynamic = defineComponent({
      name: 'DynamicItem',
      setup() {
        rects.push(useFlexItem(() => frame.value))
        return () => null
      },
    })
    const provider = mountFlex(Flexbox.make({}), Rect.make(0, 0, 100, 50), () => [
      h(Dynamic),
      h(Item, { frame: Frame.make({ width: 30, height: 50 }) }),
    ])
    await nextTick()
    expect(rects[0]!.value).toEqual(Rect.make(0, 0, 20, 50))
    expect(rects[1]!.value).toEqual(Rect.make(20, 0, 30, 50))
    expect(provider.renders).toBe(1)

    frame.value = Frame.make({ width: 60, height: 50 })
    await nextTick()

    expect(rects[0]!.value).toEqual(Rect.make(0, 0, 60, 50))
    expect(rects[1]!.value).toEqual(Rect.make(60, 0, 30, 50))
    expect(provider.renders).toBe(1)
  })
})
