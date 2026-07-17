import { type Flexbox, applyFlexbox } from 'placement/flexbox'
import type { Frame } from 'placement/frame'
import { type Rect, rect } from 'placement/rect'
import { type MaybeRefOrGetter, type Ref, toValue } from 'vue'
import { useChild, useChildren } from './useChildren.ts'

const zero = rect()

export function useFlexLayout(
  layout: MaybeRefOrGetter<Flexbox>,
  innerRect: MaybeRefOrGetter<Rect>,
): void {
  // The mapper is a reactive effect: reads of the layout, the inner rect, and
  // every child frame are tracked, so any of them changing re-runs the solve.
  useChildren<Frame, Rect>('placement/flex', (children) => {
    const rects = applyFlexbox(
      children.map((child) => child.input.value),
      toValue(layout),
      toValue(innerRect),
    )

    for (const [index, child] of children.entries()) {
      child.output.value = rects[index] ?? zero
    }
  })
}

export function useFlexItem(frame: MaybeRefOrGetter<Frame>): Readonly<Ref<Rect>> {
  return useChild('placement/flex', frame, zero)
}
