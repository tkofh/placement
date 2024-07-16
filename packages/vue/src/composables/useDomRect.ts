import { type Rect, rect } from 'placement/rect'
import {
  type MaybeRefOrGetter,
  type ShallowRef,
  shallowRef,
  toValue,
  watch,
} from 'vue'

export function useDomRect(
  element: MaybeRefOrGetter<Element | undefined>,
): Readonly<ShallowRef<Rect>> {
  const self = shallowRef(rect())

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(([entry]) => {
      self.value = rect.from(entry.contentRect)
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
  }

  return self
}
