import type { Rect } from 'placement/rect'
import {
  type InjectionKey,
  type MaybeRefOrGetter,
  computed,
  h,
  inject,
  provide,
  toValue,
  useSlots,
} from 'vue'

const SHOULD_RENDER_GROUPS: InjectionKey<MaybeRefOrGetter<boolean>> = Symbol()

export function useGroupRenderer(
  rect: MaybeRefOrGetter<Rect>,
  prop: MaybeRefOrGetter<boolean | undefined> = false,
  slot = 'default',
) {
  const global = inject(SHOULD_RENDER_GROUPS, false)
  const shouldRender = computed(() => {
    if (prop !== undefined) {
      return toValue(prop)
    }
    return global
  })

  const slots = useSlots()

  return () => {
    const rectValue = toValue(rect)
    if (shouldRender.value) {
      const { x, y, width, height } = rectValue
      return h(
        'g',
        {
          x,
          y,
          width,
          height,
        },
        slots[slot]?.({ rect: rectValue }),
      )
    }

    return slots[slot]?.({ rect: rectValue })
  }
}

export function provideShouldRenderGroups(value: MaybeRefOrGetter<boolean>) {
  provide(SHOULD_RENDER_GROUPS, value)
}
