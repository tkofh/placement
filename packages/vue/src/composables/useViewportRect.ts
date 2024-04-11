import { Rect, type RectLike } from 'placement/Rect'
import { clamp } from 'placement/utils'
import {
  type MaybeRefOrGetter,
  type ShallowRef,
  shallowRef,
  toValue,
  triggerRef,
  watchEffect,
} from 'vue'
import type { FrameFit } from '../internal/types'
import { computeDimensionProp } from '../utils/parseDimensionProp'

function createRectRef() {
  const rect = new Rect()

  const rectRef = shallowRef(rect)
  return {
    update: (x: number, y: number, width: number, height: number) => {
      let didUpdate = false

      if (rect.x !== x) {
        rect.x = x
        didUpdate = true
      }

      if (rect.y !== y) {
        rect.y = y
        didUpdate = true
      }

      if (rect.width !== width) {
        rect.width = width
        didUpdate = true
      }

      if (rect.height !== height) {
        rect.height = height
        didUpdate = true
      }

      if (didUpdate) {
        triggerRef(rectRef)
      }
    },
    rectRef,
  }
}

function computeViewportScale(
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

function computeViewportOffset(delta: number, offset: number) {
  if (delta === 0) {
    return 0
  }

  return delta * clamp(offset, 0, 1)
}

export function useViewportRect(
  basis: MaybeRefOrGetter<RectLike>,
  content: MaybeRefOrGetter<RectLike>,
  fit: MaybeRefOrGetter<FrameFit>,
  originX: MaybeRefOrGetter<number | string>,
  originY: MaybeRefOrGetter<number | string>,
): Readonly<ShallowRef<Rect>> {
  const { update, rectRef } = createRectRef()

  watchEffect(() => {
    const basisRect = toValue(basis)

    if (basisRect.width === 0 || basisRect.height === 0) {
      update(0, 0, 0, 0)
      return
    }

    const contentRect = toValue(content)

    const scale = computeViewportScale(
      toValue(fit),
      basisRect.width,
      basisRect.height,
      contentRect.width,
      contentRect.height,
    )

    const width = basisRect.width * scale
    const height = basisRect.height * scale

    update(
      computeViewportOffset(
        contentRect.width - width,
        (computeDimensionProp(toValue(originX), 'width', contentRect) ?? 0) /
          contentRect.width,
      ),
      computeViewportOffset(
        contentRect.height - height,
        (computeDimensionProp(toValue(originY), 'height', contentRect) ?? 0) /
          contentRect.height,
      ),
      width,
      height,
    )
  })

  return rectRef
}
