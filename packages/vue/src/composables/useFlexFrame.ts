import { FlexFrame, type FlexOptions } from 'placement/FlexFrame'
import type { FrameOptions } from 'placement/Frame'
import type { Rect } from 'placement/Rect'
import {
  type MaybeRefOrGetter,
  type Ref,
  inject,
  provide,
  toValue,
  watch,
  watchEffect,
} from 'vue'
import { ParentFrameSymbol, ParentRectSymbol } from '../internal/injections'
import { frameRectRef } from '../utils/frameRectRef'
import { useChildIndex } from './useChildIndex'

export function useFlexFrame(
  frameOptions: MaybeRefOrGetter<FrameOptions>,
  flexOptions: MaybeRefOrGetter<FlexOptions>,
): Readonly<Ref<Readonly<Rect>>> {
  const parentFrame = inject(ParentFrameSymbol, null)

  if (parentFrame === null) {
    throw new Error('No parent frame found')
  }

  const index = useChildIndex()

  const frame = new FlexFrame()

  watch(
    index,
    (current, previous) => {
      if (previous == null || current > previous) {
        parentFrame.insertAt(frame, current)
      }
    },
    { immediate: true },
  )

  provide(ParentFrameSymbol, frame)

  watchEffect(() => {
    frame.configure(toValue(frameOptions), toValue(flexOptions))
  })

  const rect = frameRectRef(frame)

  provide(ParentRectSymbol, rect)

  return rect
}
