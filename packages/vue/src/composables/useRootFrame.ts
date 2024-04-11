import { Frame, type FrameOptions } from 'placement'
import type { Rect } from 'placement/Rect'
import {
  type MaybeRefOrGetter,
  type Ref,
  onBeforeUpdate,
  provide,
  toValue,
  watchEffect,
} from 'vue'
import {
  ParentFrameSymbol,
  ParentRectSymbol,
  RootRectSymbol,
} from '../internal/injections'
import { frameRectRef } from '../utils/frameRectRef'
import { registerIndexParent } from './useChildIndex'

export function useRootFrame(
  options: MaybeRefOrGetter<FrameOptions>,
): Readonly<Ref<Readonly<Rect>>> {
  const frame = new Frame()

  provide(ParentFrameSymbol, frame)
  registerIndexParent()

  watchEffect(() => {
    frame.configure(toValue(options))
  })

  onBeforeUpdate(() => {
    frame.update()
  })

  const rect = frameRectRef(frame)

  provide(RootRectSymbol, rect)
  provide(ParentRectSymbol, rect)

  return rect
}
