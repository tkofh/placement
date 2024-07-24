import { dimensions } from 'placement/dimensions'
import { type AspectRatioInput, resolveAspectRatio } from './props/aspectRatio'
import { type Size1DInput, resolveSize1D } from './props/size1d'
import { type Size2DInput, resolveSize2D } from './props/size2d'

export function calculateSize(
  parentWidth: number,
  parentHeight: number,

  auto: number,
  size: Size2DInput,
  width: Size1DInput,
  height: Size1DInput,
  aspectRatio: AspectRatioInput,
) {
  const sizeProp = resolveSize2D(
    size,
    dimensions.infinity,
    parentWidth,
    parentHeight,
  )

  if (Number.isFinite(sizeProp.width) && Number.isFinite(sizeProp.height)) {
    return sizeProp
  }

  const widthProp = resolveSize1D(width, Number.POSITIVE_INFINITY, parentWidth)

  const heightProp = resolveSize1D(
    height,
    Number.POSITIVE_INFINITY,
    parentHeight,
  )

  if (Number.isFinite(widthProp) && Number.isFinite(heightProp)) {
    return dimensions(widthProp, heightProp)
  }

  const aspectRatioProp =
    typeof aspectRatio === 'number'
      ? aspectRatio
      : resolveAspectRatio(aspectRatio)

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
