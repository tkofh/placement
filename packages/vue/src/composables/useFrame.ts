import { Frame, type FrameOptions } from 'placement/Frame'
import type { Rect } from 'placement/Rect'
import {
  type ComputedRef,
  type MaybeRefOrGetter,
  computed,
  shallowRef,
  toValue,
  triggerRef,
  watchEffect,
} from 'vue'

export function useRootFrame(
  options: MaybeRefOrGetter<FrameOptions>,
): ComputedRef<Readonly<Rect>> {
  const frame = shallowRef(new Frame())

  watchEffect(() => {
    Object.assign(frame.value, toValue(options))
    triggerRef(frame)
  })

  // add event emitter functionality to frame
  // add listener to frame and trigger ref only when updated

  return computed(() => frame.value.computed)
}
