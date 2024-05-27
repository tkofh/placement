import type { ReadonlyRect } from 'placement/rect'
import { clamp } from 'placement/utils'
import {
  type MaybeRefOrGetter,
  type ShallowRef,
  toValue,
  watchEffect,
} from 'vue'
import type { FrameFit } from '../internal/types'
import { rectRef } from '../utils/rectRef'
import {
  type OriginXInput,
  type OriginYInput,
  useOriginX,
  useOriginY,
} from './properties/origin'

function viewportScale(
  fit: FrameFit,
  basisWidth: number,
  basisHeight: number,
  contentWidth: number,
  contentHeight: number,
) {
  let scale = 1
  if (fit === 'cover') {
    scale = Math.min(contentWidth / basisWidth, contentHeight / basisHeight)
  } else if (fit === 'contain') {
    scale = Math.max(contentWidth / basisWidth, contentHeight / basisHeight)
  }

  return scale
}

function viewportOffset(delta: number, offset: number) {
  if (delta === 0) {
    return 0
  }

  return delta * clamp(offset, 0, 1)
}

export function useViewportRect(
  basis: MaybeRefOrGetter<ReadonlyRect>,
  content: MaybeRefOrGetter<ReadonlyRect>,
  fit: MaybeRefOrGetter<FrameFit>,
  originX: MaybeRefOrGetter<OriginXInput>,
  originY: MaybeRefOrGetter<OriginYInput>,
): Readonly<ShallowRef<ReadonlyRect>> {
  const { update, rect } = rectRef()

  const computedOriginX = useOriginX(originX, content)
  const computedOriginY = useOriginY(originY, content)

  watchEffect(() => {
    const basisRect = toValue(basis)

    if (basisRect.width === 0 || basisRect.height === 0) {
      update(0, 0, 0, 0)
      return
    }

    const contentRect = toValue(content)

    const scale = viewportScale(
      toValue(fit),
      basisRect.width,
      basisRect.height,
      contentRect.width,
      contentRect.height,
    )

    const width = basisRect.width * scale
    const height = basisRect.height * scale

    update(
      viewportOffset(
        contentRect.width - width,
        contentRect.width > 0
          ? (computedOriginX.value ?? 0) / contentRect.width
          : 0,
      ),
      viewportOffset(
        contentRect.height - height,
        contentRect.height > 0
          ? (computedOriginY.value ?? 0) / contentRect.height
          : 0,
      ),
      width,
      height,
    )
  })

  return rect
}
