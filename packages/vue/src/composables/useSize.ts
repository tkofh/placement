import {
  type Dimensions,
  clamp,
  dimensions,
  isDimensions,
} from 'placement/dimensions'
import type { Rect } from 'placement/rect'
import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AspectRatioInput,
  parseAspectRatio,
} from '../internal/props/aspectRatio'
import { type Size1DInput, parseSize1D } from '../internal/props/size1d'
import { type Size2DInput, parseSize2D } from '../internal/props/size2d'

export interface Sizeable {
  size?: Size2DInput | Dimensions | number | undefined
  minSize?: Size2DInput | Dimensions | number | undefined
  maxSize?: Size2DInput | Dimensions | number | undefined
  width?: Size1DInput | number | undefined
  height?: Size1DInput | number | undefined
  aspectRatio?: AspectRatioInput | number | undefined
  minWidth?: Size1DInput | number | undefined
  minHeight?: Size1DInput | number | undefined
  maxWidth?: Size1DInput | number | undefined
  maxHeight?: Size1DInput | number | undefined
}

function resolveSize1D(
  input: Size1DInput | number | undefined,
  basis: 'width' | 'height',
  auto: number,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
) {
  return typeof input === 'number'
    ? input
    : parseSize1D(input ?? '', basis, auto, parent, root)
}

function resolveSize2D(
  input: Size2DInput | Dimensions | number | undefined,
  auto: number,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
) {
  return isDimensions(input)
    ? input
    : typeof input === 'number'
      ? dimensions(input)
      : parseSize2D(input ?? '', auto, parent, root)
}

function calculateSize(
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
  auto: number,
  size: Size2DInput | Dimensions | number | undefined,
  width: Size1DInput | number | undefined,
  height: Size1DInput | number | undefined,
  aspectRatio: AspectRatioInput | number | undefined,
) {
  const sizeProp = resolveSize2D(size, Number.POSITIVE_INFINITY, parent, root)

  if (Number.isFinite(sizeProp.width) && Number.isFinite(sizeProp.height)) {
    return sizeProp
  }

  const widthProp = resolveSize1D(
    width,
    'width',
    Number.POSITIVE_INFINITY,
    parent,
    root,
  )

  const heightProp = resolveSize1D(
    height,
    'height',
    Number.POSITIVE_INFINITY,
    parent,
    root,
  )

  if (Number.isFinite(widthProp) && Number.isFinite(heightProp)) {
    return dimensions(widthProp, heightProp)
  }

  const aspectRatioProp =
    typeof aspectRatio === 'number'
      ? aspectRatio
      : parseAspectRatio((aspectRatio as string) ?? '')

  if (Number.isFinite(widthProp) && Number.isFinite(aspectRatioProp)) {
    return dimensions(widthProp, widthProp / aspectRatioProp)
  }

  if (Number.isFinite(aspectRatioProp) && Number.isFinite(heightProp)) {
    return dimensions(heightProp * aspectRatioProp, heightProp)
  }

  return dimensions(
    Number.isFinite(widthProp) ? widthProp : auto,
    Number.isFinite(heightProp) ? heightProp : auto,
  )
}

export interface Sizeable {
  size?: Size2DInput | Dimensions | number
  minSize?: Size2DInput | Dimensions | number
  maxSize?: Size2DInput | Dimensions | number
  width?: Size1DInput | number
  height?: Size1DInput | number
  aspectRatio?: AspectRatioInput | number
  minWidth?: Size1DInput | number
  minHeight?: Size1DInput | number
  maxWidth?: Size1DInput | number
  maxHeight?: Size1DInput | number
}

export function useUnconstrainedSizes(
  input: MaybeRefOrGetter<Sizeable>,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
) {
  const size = computed(() => {
    const { size, width, height, aspectRatio } = toValue(input)

    return calculateSize(
      toValue(parent),
      toValue(root),
      Number.POSITIVE_INFINITY,
      size,
      width,
      height,
      aspectRatio,
    )
  })

  const minSize = computed(() => {
    const { minSize, minWidth, minHeight } = toValue(input)

    return calculateSize(
      toValue(parent),
      toValue(root),
      0,
      minSize,
      minWidth,
      minHeight,
      Number.POSITIVE_INFINITY,
    )
  })

  const maxSize = computed(() => {
    const { maxSize, maxWidth, maxHeight } = toValue(input)

    return calculateSize(
      toValue(parent),
      toValue(root),
      Number.POSITIVE_INFINITY,
      maxSize,
      maxWidth,
      maxHeight,
      Number.POSITIVE_INFINITY,
    )
  })

  return { size, minSize, maxSize }
}

export function useSize(
  input: MaybeRefOrGetter<Sizeable>,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
) {
  const { size, minSize, maxSize } = useUnconstrainedSizes(input, parent, root)

  return computed(() => clamp(size.value, minSize.value, maxSize.value))
}
