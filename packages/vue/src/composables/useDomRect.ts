import { type Rect, rect } from 'placement/rect'
import {
  type MaybeRefOrGetter,
  type ShallowRef,
  shallowRef,
  toValue,
  watch,
} from 'vue'

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
): Readonly<ShallowRef<Rect>> {
  const self = shallowRef(rect())

  useResizeObserver(element, (entry) => {
    self.value = rect.from(entry.contentRect)
  })

  return self
}

export function useTextRect(
  element: MaybeRefOrGetter<SVGTextElement | undefined>,
): Readonly<ShallowRef<Rect>> {
  const self = shallowRef(rect())

  useResizeObserver(element, (entry) => {
    // let minX = Number.POSITIVE_INFINITY
    // let minY = Number.POSITIVE_INFINITY
    // let maxX = Number.NEGATIVE_INFINITY
    // let maxY = Number.NEGATIVE_INFINITY
    //
    // const numChars = entry.target.getNumberOfChars()
    // for (let i = 0; i < numChars; i++) {
    //   const charRect = entry.target.getExtentOfChar(i)
    //   minX = Math.min(minX, charRect.x)
    //   minY = Math.min(minY, charRect.y)
    //   maxX = Math.max(maxX, charRect.x + charRect.width)
    //   maxY = Math.max(maxY, charRect.y + charRect.height)
    // }
    // self.value = rect(0, 0, maxX - minX, maxY - minY)
    self.value = rect.from(entry.contentRect)
  })

  return self
}
