import { type Dimensions, dimensions } from 'placement/dimensions'
import {
  type MaybeRefOrGetter,
  type ShallowRef,
  shallowRef,
  toValue,
  watch,
} from 'vue'

export function useDomDimensions(
  element: MaybeRefOrGetter<Element | undefined>,
): Readonly<ShallowRef<Dimensions>> {
  const self = shallowRef(dimensions())

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(([entry]) => {
      self.value = dimensions(entry.contentRect.width, entry.contentRect.height)
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
