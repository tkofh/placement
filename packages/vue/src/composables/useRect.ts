import type { Dimensions } from 'placement/dimensions'
import { interval } from 'placement/interval'
import { type Offset, offset } from 'placement/offset'
import { type Point, isPoint } from 'placement/point'
import { type Rect, isRect, rect, translateX, translateY } from 'placement/rect'
import { auto, clamp } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { type InsetInput, parseInset } from '../internal/props/inset'
import type { OriginInput } from '../internal/props/origin'
import { type Size1DInput, parseSize1D } from '../internal/props/size1d'
import { useOrigin } from './useOrigin'
import { type Sizeable, useUnconstrainedSizes } from './useSize'

export interface Positionable extends Sizeable {
  origin?: OriginInput | Point | number
  top?: Size1DInput | number
  right?: Size1DInput | number
  bottom?: Size1DInput | number
  left?: Size1DInput | number
  inset?: InsetInput | Point | number
  x?: Size1DInput | number
  y?: Size1DInput | number
}

function resolveInset(
  inset: InsetInput | Point | number | undefined,
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
): Offset {
  if (inset === undefined) {
    return offset.infinity
  }

  if (typeof inset === 'number') {
    return offset(inset)
  }

  if (isPoint(inset)) {
    return offset.xy(inset.x, inset.y)
  }

  return parseInset(inset, parent, root)
}

function resolveEdgeInset(
  edge: Size1DInput | number | undefined,
  basis: 'width' | 'height',
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
): number {
  if (edge === undefined) {
    return Number.POSITIVE_INFINITY
  }

  if (typeof edge === 'number') {
    return edge
  }

  return parseSize1D(edge, basis, Number.POSITIVE_INFINITY, parent, root)
}

function resolveTranslation(
  axis: Size1DInput | number | undefined,
  basis: 'width' | 'height',
  self: Rect,
  root: Rect | Dimensions,
): number {
  if (axis === undefined) {
    return 0
  }

  if (typeof axis === 'number') {
    return axis
  }

  return parseSize1D(axis, basis, 0, self, root)
}

export function useRect(
  props: Positionable,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
): ComputedRef<Rect> {
  const origin = useOrigin(() => props.origin)

  const { size, minSize, maxSize } = useUnconstrainedSizes(props, parent, root)

  const top = computed(() =>
    resolveEdgeInset(props.top, 'height', toValue(parent), toValue(root)),
  )
  const right = computed(() =>
    resolveEdgeInset(props.right, 'width', toValue(parent), toValue(root)),
  )
  const bottom = computed(() =>
    resolveEdgeInset(props.bottom, 'height', toValue(parent), toValue(root)),
  )
  const left = computed(() =>
    resolveEdgeInset(props.left, 'width', toValue(parent), toValue(root)),
  )
  const inset = computed(() =>
    resolveInset(props.inset, toValue(parent), toValue(root)),
  )

  const position = computed(() =>
    offset.trbl(
      auto(top.value, inset.value.top, Number.POSITIVE_INFINITY),
      auto(right.value, inset.value.right, Number.POSITIVE_INFINITY),
      auto(bottom.value, inset.value.bottom, Number.POSITIVE_INFINITY),
      auto(left.value, inset.value.left, Number.POSITIVE_INFINITY),
    ),
  )

  const x = computed(() => {
    const originX = origin.value.x
    const left = position.value.left
    const right = position.value.right
    const width = size.value.width
    const parentRect = toValue(parent)

    const leftIsFinite = Number.isFinite(left)
    const rightIsFinite = Number.isFinite(right)
    const widthIsFinite = Number.isFinite(width)

    let x = isRect(parentRect) ? parentRect.x : 0
    let w = width

    if (leftIsFinite && widthIsFinite) {
      x += left - originX * width
      w = width
    } else if (rightIsFinite && widthIsFinite) {
      x += parentRect.width - right - originX * width
      w = width
    } else if (leftIsFinite && rightIsFinite) {
      x += left
      w = parentRect.width - left - right
    }

    return interval(
      x,
      clamp(auto(w, 0), minSize.value.width, maxSize.value.width),
    )
  })

  const y = computed(() => {
    const originY = origin.value.y
    const top = position.value.top
    const bottom = position.value.bottom
    const height = size.value.height
    const parentRect = toValue(parent)

    const topIsFinite = Number.isFinite(top)
    const bottomIsFinite = Number.isFinite(bottom)
    const heightIsFinite = Number.isFinite(height)

    let y = isRect(parentRect) ? parentRect.y : 0
    let h = height

    if (topIsFinite && heightIsFinite) {
      y += top - originY * height
      h = height
    } else if (bottomIsFinite && heightIsFinite) {
      y += parentRect.height - bottom - originY * height
      h = height
    } else if (topIsFinite && bottomIsFinite) {
      y += top
      h = parentRect.height - top - bottom
    }

    return interval(
      y,
      clamp(auto(h, 0), minSize.value.height, maxSize.value.height),
    )
  })

  const initialRect = computed(() => rect.fromInterval(x.value, y.value))

  const translationX = computed(() =>
    translateX(
      resolveTranslation(props.x, 'width', initialRect.value, toValue(root)),
    ),
  )
  const translationY = computed(() =>
    translateY(
      resolveTranslation(props.y, 'height', initialRect.value, toValue(root)),
    ),
  )

  return computed(() =>
    initialRect.value.pipe(translationX.value, translationY.value),
  )
}
