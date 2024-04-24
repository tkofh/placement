import { createFrame } from 'placement/frame'
import type { FrameOptions } from 'placement/frame'
import type { ReadonlyRect } from 'placement/rect'
import {
  type MaybeRefOrGetter,
  type Ref,
  inject,
  onBeforeUnmount,
  onBeforeUpdate,
  provide,
  toValue,
  watch,
  watchEffect,
} from 'vue'
import { ParentFrameSymbol, ParentRectSymbol } from '../internal/injections'
import { frameRectRef } from '../utils/frameRectRef'
import { registerIndexParent, useChildIndex } from './useChildIndex'

export function useFrame(
  layout: 'absolute' | 'flex',
  options: MaybeRefOrGetter<FrameOptions>,
  isLeaf: boolean,
): Readonly<Ref<Readonly<ReadonlyRect>>> {
  const parentFrame = inject(ParentFrameSymbol, null)

  if (parentFrame === null) {
    throw new Error('No parent frame found')
  }

  const index = useChildIndex()

  registerIndexParent()

  const frame = createFrame({ layout })

  watch(
    index,
    (current) => {
      if (current > -1) {
        parentFrame.insertAt(frame, current)
        parentFrame.update()
      }
    },
    { immediate: true },
  )

  onBeforeUpdate(() => {
    frame.update()
  })

  watchEffect(() => {
    frame.assign(toValue(options))
  })

  onBeforeUnmount(() => {
    parentFrame.removeChild(frame)
    parentFrame.update()
  })

  const rect = frameRectRef(frame)

  provide(ParentFrameSymbol, isLeaf ? null : frame)

  provide(ParentRectSymbol, rect)

  return rect
}
