import * as Flexbox from 'placement/flexbox'
import type { Frame } from 'placement/frame'
import * as Rect from 'placement/rect'
import { type MaybeRefOrGetter, type Ref, toValue } from 'vue'
import { useChild, useChildren } from './useChildren.ts'

const zero = Rect.make()

export function useFlexLayout(
  layout: MaybeRefOrGetter<Flexbox.Flexbox>,
  innerRect: MaybeRefOrGetter<Rect.Rect>,
): void {
  // The mapper is a reactive effect: reads of the layout, the inner rect, and
  // every child frame are tracked, so any of them changing re-runs the solve.
  useChildren<Frame, Rect.Rect>('placement/flex', (children) => {
    const rects = Flexbox.apply(
      children.map((child) => child.input.value),
      toValue(layout),
      toValue(innerRect),
    )

    for (const [index, child] of children.entries()) {
      child.output.value = rects[index] ?? zero
    }
  })
}

export function useFlexItem(frame: MaybeRefOrGetter<Frame>): Readonly<Ref<Rect.Rect>> {
  return useChild('placement/flex', frame, zero)
}
