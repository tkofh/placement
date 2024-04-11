import { type ReadonlyRect, createMutableRect } from 'placement/Box'
import {
  type MaybeRefOrGetter,
  type ShallowRef,
  shallowRef,
  toValue,
  triggerRef,
  watch,
} from 'vue'

export function useDomRect(
  element: MaybeRefOrGetter<Element | undefined>,
): Readonly<ShallowRef<ReadonlyRect>> {
  const rect = shallowRef(createMutableRect())

  const observer = new ResizeObserver(([entry]) => {
    rect.value.width = entry.contentRect.width
    rect.value.height = entry.contentRect.height
    triggerRef(rect)
  })

  watch(
    () => toValue(element),
    (element, _, onCleanup) => {
      if (element instanceof Element) {
        observer.observe(element)
        onCleanup(() => observer.unobserve(element))
      }
    },
    { immediate: true },
  )

  return rect
}
