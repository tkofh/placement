import { createFrame } from 'placement'
import type { FrameOptions } from 'placement/frame'
import type { ReadonlyRect } from 'placement/rect'
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

type RootFrameOptions = Pick<
  FrameOptions,
  | 'width'
  | 'height'
  | 'aspectRatio'
  | 'minWidth'
  | 'minHeight'
  | 'maxWidth'
  | 'maxHeight'
>

export function useRootFrame(
  domRect: MaybeRefOrGetter<ReadonlyRect>,
  options: MaybeRefOrGetter<RootFrameOptions>,
): Readonly<Ref<ReadonlyRect>> {
  const root = createFrame({ layout: 'absolute' })
  watchEffect(() => {
    const { width, height } = toValue(domRect)
    root.assign({ width, height })
    root.update()
  })

  const frame = root.appendChild(createFrame({ layout: 'absolute' }))

  provide(ParentFrameSymbol, frame)
  registerIndexParent()

  watchEffect(() => {
    const frameOptions = toValue(options)
    frame.assign({
      ...frameOptions,
      width: frameOptions.width ?? '100%',
      height: frameOptions.height ?? '100%',
    })
  })

  onBeforeUpdate(() => {
    root.update()
  })

  const rect = frameRectRef(frame)

  provide(RootRectSymbol, rect)
  provide(ParentRectSymbol, rect)

  return rect
}
