import * as Rect from 'placement/rect'
import { type MaybeRefOrGetter, type ShallowRef, shallowRef, toValue, watch } from 'vue'

function useResizeObserver<T extends Element>(
  element: MaybeRefOrGetter<T | undefined>,
  callback: (entry: ResizeObserverEntry & { target: T }) => void,
): void {
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(([entry]) =>
      callback(entry as ResizeObserverEntry & { target: T }),
    )

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
}

export function useDomRect(
  element: MaybeRefOrGetter<Element | undefined>,
): Readonly<ShallowRef<Rect.Rect>> {
  const self = shallowRef(Rect.make())

  useResizeObserver(element, (entry) => {
    self.value = Rect.from(entry.contentRect)
  })

  return self
}

export function useTextRect(
  element: MaybeRefOrGetter<SVGTextElement | undefined>,
): Readonly<ShallowRef<Rect.Rect>> {
  const self = shallowRef(Rect.make())

  useResizeObserver(element, (entry) => {
    self.value = Rect.from(entry.contentRect)
  })

  return self
}
