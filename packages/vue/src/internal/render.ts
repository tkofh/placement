import type { Rect } from 'placement/rect'
import {
  type InjectionKey,
  type MaybeRefOrGetter,
  computed,
  h,
  inject,
  provide,
  toValue,
  useAttrs,
  useSlots,
} from 'vue'

const SHOULD_RENDER_GROUPS: InjectionKey<MaybeRefOrGetter<0 | 2>> = Symbol.for(
  'placement/debug-groups',
)

export function useGroupRenderer(
  rect: MaybeRefOrGetter<Rect>,
  debugProp: MaybeRefOrGetter<boolean | undefined> = false,
  slot = 'default',
) {
  const global = inject(SHOULD_RENDER_GROUPS, 0)
  const attrs = useAttrs()
  const mode = computed(() => {
    const globalDebug = toValue(global) === 2
    if (toValue(debugProp) || globalDebug) {
      return 2
    }
    if ('class' in attrs || 'style' in attrs) {
      return 1
    }
    return 0
  })

  const slots = useSlots()

  return () => {
    const rectValue = toValue(rect)
    const modeValue = toValue(mode)

    const children = slots[slot]?.({ rect: rectValue }) ?? []

    if (modeValue > 0) {
      return h(
        'g',
        modeValue === 1 ? attrs : { ...attrs, ...rectValue },
        children,
      )
    }

    return children
  }
}

export function provideShouldRenderGroups(value: MaybeRefOrGetter<0 | 2>) {
  provide(SHOULD_RENDER_GROUPS, value)
}
