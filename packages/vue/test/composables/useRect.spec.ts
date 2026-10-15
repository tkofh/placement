import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import {
  type ComputedRef,
  type MaybeRefOrGetter,
  defineComponent,
  h,
  nextTick,
  shallowRef,
} from 'vue'
import { type RectProps, type UseRectOptions, useRect } from '../../src/composables/useRect.ts'
import { mountWithRect } from '../host.ts'

// Host rect: width 200 and height 100 are the two percent bases. Unset props
// act as the unset sentinel of Box, so an undetermined axis fills the
// parent.
function mountRect(
  props: RectProps,
  options?: UseRectOptions,
  rect: MaybeRefOrGetter<Rect.Rect> = Rect.make(0, 0, 200, 100),
): ComputedRef<Rect.Rect> {
  let result!: ComputedRef<Rect.Rect>
  const Probe = defineComponent({
    name: 'Probe',
    setup() {
      result = useRect(props, options)
      return () => null
    },
  })
  mountWithRect(rect, () => [h(Probe)])
  return result
}

describe('sizing', () => {
  test('numeric width and height size the box at the parent origin', () => {
    expect(mountRect({ width: 40, height: 20 }).value).toEqual(Rect.make(0, 0, 40, 20))
  })

  test('a percentage width resolves against the parent width; the free axis fills', () => {
    expect(mountRect({ width: '50%' }).value).toEqual(Rect.make(0, 0, 100, 100))
  })

  test('a percentage height resolves against the parent height; the free axis fills', () => {
    expect(mountRect({ height: '50%' }).value).toEqual(Rect.make(0, 0, 200, 50))
  })

  test('aspectRatio derives the unset dimension from the set one', () => {
    expect(mountRect({ width: 50, aspectRatio: 2 }).value).toEqual(Rect.make(0, 0, 50, 25))
    expect(mountRect({ height: 25, aspectRatio: 2 }).value).toEqual(Rect.make(0, 0, 50, 25))
  })

  test('min and max constraints clamp the resolved size', () => {
    expect(mountRect({ width: '50%', maxWidth: 80, height: 10, minHeight: 25 }).value).toEqual(
      Rect.make(0, 0, 80, 25),
    )
  })
})

describe('insets', () => {
  test('top and left position the box within the parent', () => {
    expect(mountRect({ top: 10, left: 20, width: 40, height: 20 }).value).toEqual(
      Rect.make(20, 10, 40, 20),
    )
  })

  test('left and right without a width stretch between them', () => {
    expect(mountRect({ left: 30, right: 50 }).value).toEqual(Rect.make(30, 0, 120, 100))
  })

  test('bottom alone anchors the box to the bottom edge', () => {
    expect(mountRect({ bottom: 10, width: 40, height: 20 }).value).toEqual(Rect.make(0, 70, 40, 20))
  })

  test('the parent origin offsets an inset-free box', () => {
    expect(
      mountRect({ width: 40, height: 20 }, undefined, Rect.make(10, 20, 200, 100)).value,
    ).toEqual(Rect.make(10, 20, 40, 20))
  })
})

describe('transform', () => {
  test('origin centers the box on the position the insets gave its corner', () => {
    expect(mountRect({ top: 50, left: 100, width: 40, height: 20, origin: 0.5 }).value).toEqual(
      Rect.make(80, 40, 40, 20),
    )
  })

  test('percentage x and y translate by the box own size', () => {
    expect(mountRect({ width: 40, height: 20, x: '50%' }).value).toEqual(Rect.make(20, 0, 40, 20))
    expect(mountRect({ width: 40, height: 20, y: '50%' }).value).toEqual(Rect.make(0, 10, 40, 20))
  })

  test('numeric x and y translate absolutely', () => {
    expect(mountRect({ width: 40, height: 20, x: 15, y: 5 }).value).toEqual(
      Rect.make(15, 5, 40, 20),
    )
  })
})

describe('options', () => {
  test('options.size overrides the size props and falls back when undefined', async () => {
    const size = shallowRef<{ readonly width: number; readonly height: number } | undefined>({
      width: 60,
      height: 30,
    })
    const rect = mountRect({ width: 40, height: 20 }, { size })
    await nextTick()

    expect(rect.value).toEqual(Rect.make(0, 0, 60, 30))

    size.value = undefined
    await nextTick()

    expect(rect.value).toEqual(Rect.make(0, 0, 40, 20))
  })

  test('options.origin is the fallback when the origin prop is unset', () => {
    const options: UseRectOptions = { origin: Point.make(1, 1) }

    expect(mountRect({ top: 50, left: 100, width: 40, height: 20 }, options).value).toEqual(
      Rect.make(60, 30, 40, 20),
    )
    // A set origin prop wins over the fallback.
    expect(
      mountRect({ top: 50, left: 100, width: 40, height: 20, origin: 0 }, options).value,
    ).toEqual(Rect.make(100, 50, 40, 20))
  })
})

describe('reactivity', () => {
  test('a host rect change re-resolves percentages', async () => {
    const host = shallowRef(Rect.make(0, 0, 200, 100))
    const rect = mountRect({ width: '50%', height: '50%' }, undefined, host)
    await nextTick()

    expect(rect.value).toEqual(Rect.make(0, 0, 100, 50))

    host.value = Rect.make(0, 0, 400, 300)
    await nextTick()

    expect(rect.value).toEqual(Rect.make(0, 0, 200, 150))
  })
})
