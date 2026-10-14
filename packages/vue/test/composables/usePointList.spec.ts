import * as Point from 'placement/point'
import { describe, expect, test } from 'vitest'
import { type Ref, type VNodeArrayChildren, defineComponent, h, nextTick, ref } from 'vue'
import { usePoint, usePointList } from '../../src/composables/usePointList.ts'
import { createApp, createRoot } from '../renderer.ts'

const PointItem = defineComponent({
  name: 'PointItem',
  props: { x: { type: Number, required: true }, y: { type: Number, required: true } },
  setup(props) {
    usePoint(() => Point.make(props.x, props.y))
    return () => null
  },
})

function mountPoints(content: () => VNodeArrayChildren) {
  let points!: Readonly<Ref<ReadonlyArray<Point.Point>>>
  const Provider = defineComponent({
    name: 'Provider',
    setup() {
      points = usePointList()
      return () => h('root', content())
    },
  })
  createApp(Provider).mount(createRoot())
  return {
    get points() {
      return points.value
    },
  }
}

describe('registration', () => {
  test('collects points in document order across host elements', () => {
    const provider = mountPoints(() => [
      h(PointItem, { x: 1, y: 1 }),
      h('div', [h(PointItem, { x: 2, y: 2 }), h('span', [h(PointItem, { x: 3, y: 3 })])]),
      h(PointItem, { x: 4, y: 4 }),
    ])
    // The registration batch resolves during mount itself, so the list is
    // already complete before the next tick.
    expect(provider.points).toEqual([
      Point.make(1, 1),
      Point.make(2, 2),
      Point.make(3, 3),
      Point.make(4, 4),
    ])
  })

  test('an unmounting child leaves the list', async () => {
    const show = ref(true)
    const provider = mountPoints(() => [
      h(PointItem, { key: 'a', x: 1, y: 1 }),
      show.value ? h(PointItem, { key: 'b', x: 2, y: 2 }) : null,
      h(PointItem, { key: 'c', x: 3, y: 3 }),
    ])
    await nextTick()
    expect(provider.points).toEqual([Point.make(1, 1), Point.make(2, 2), Point.make(3, 3)])

    show.value = false
    await nextTick()

    expect(provider.points).toEqual([Point.make(1, 1), Point.make(3, 3)])
  })
})

describe('input reactivity', () => {
  test('a point getter reading a ref updates the list on change', async () => {
    const bump = ref(1)
    const Dynamic = defineComponent({
      name: 'DynamicPoint',
      setup() {
        usePoint(() => Point.make(0, bump.value))
        return () => null
      },
    })
    const provider = mountPoints(() => [h(Dynamic), h(PointItem, { x: 5, y: 5 })])
    await nextTick()
    expect(provider.points).toEqual([Point.make(0, 1), Point.make(5, 5)])

    bump.value = 2
    await nextTick()

    expect(provider.points).toEqual([Point.make(0, 2), Point.make(5, 5)])
  })
})
