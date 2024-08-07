import {
  type Dimensions,
  clamp as clampDimensions,
  dimensions,
} from 'placement/dimensions'
import { type Point, point } from 'placement/point'
import { type Rect, align, rect, translate } from 'placement/rect'
import { auto, clamp } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { computedInterval } from '../data/interval'
import type {
  AspectRatioInput,
  // resolveAspectRatio,
} from '../internal/props/aspectRatio'
import type { OriginInput } from '../internal/props/origin'
import { type Size1DInput, resolveSize1D } from '../internal/props/size1d'
import { useLengthPercentage } from '../props/lengthPercentage'
import { useOrigin } from '../props/origin'
import { useSize } from '../props/size'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
} from './useSizingContext'

export interface MinSizeProps {
  minWidth?: Size1DInput | number | undefined
  minHeight?: Size1DInput | number | undefined
}

export const MIN_SIZE_PROP_KEYS = ['minWidth', 'minHeight'] as const

export interface MaxSizeProps {
  maxWidth?: Size1DInput | number | undefined
  maxHeight?: Size1DInput | number | undefined
}

export const MAX_SIZE_PROP_KEYS = ['maxWidth', 'maxHeight'] as const

export interface BasisSizeProps {
  width?: Size1DInput | number | undefined
  height?: Size1DInput | number | undefined
  aspectRatio?: AspectRatioInput | number | undefined
}

export const BASIS_SIZE_PROP_KEYS = ['width', 'height', 'aspectRatio'] as const

export interface SizeProps extends MinSizeProps, MaxSizeProps, BasisSizeProps {}

export const SIZE_PROP_KEYS = [
  ...MIN_SIZE_PROP_KEYS,
  ...MAX_SIZE_PROP_KEYS,
  ...BASIS_SIZE_PROP_KEYS,
] as const

export interface InsetProps {
  top?: Size1DInput | number
  right?: Size1DInput | number
  bottom?: Size1DInput | number
  left?: Size1DInput | number
}

export const INSET_PROP_KEYS = ['top', 'right', 'bottom', 'left'] as const

export interface OriginProps {
  origin?: OriginInput | Point | number
}

export const ORIGIN_PROP_KEYS = ['origin'] as const

export interface TranslateProps {
  x?: Size1DInput | number
  y?: Size1DInput | number
}

export const TRANSLATE_PROP_KEYS = ['x', 'y'] as const

export interface TransformProps extends OriginProps, TranslateProps {}

export const TRANSFORM_PROP_KEYS = [
  ...ORIGIN_PROP_KEYS,
  ...TRANSLATE_PROP_KEYS,
] as const

export interface RectProps extends InsetProps, SizeProps, TransformProps {}

export const RECT_PROP_KEYS = [
  ...SIZE_PROP_KEYS,
  ...INSET_PROP_KEYS,
  ...TRANSFORM_PROP_KEYS,
] as const

// function calculateSize(
//   parentWidth: number,
//   parentHeight: number,
//
//   auto: number,
//   size: Size2DInput,
//   width: Size1DInput,
//   height: Size1DInput,
//   aspectRatio: AspectRatioInput,
// ) {
//   const sizeProp = resolveSize2D(
//     size,
//     dimensions.infinity,
//     parentWidth,
//     parentHeight,
//   )
//
//   if (Number.isFinite(sizeProp.width) && Number.isFinite(sizeProp.height)) {
//     return sizeProp
//   }
//
//   const widthProp = resolveSize1D(width, Number.POSITIVE_INFINITY, parentWidth)
//
//   const heightProp = resolveSize1D(
//     height,
//     Number.POSITIVE_INFINITY,
//     parentHeight,
//   )
//
//   if (Number.isFinite(widthProp) && Number.isFinite(heightProp)) {
//     return dimensions(widthProp, heightProp)
//   }
//
//   const aspectRatioProp =
//     typeof aspectRatio === 'number'
//       ? aspectRatio
//       : resolveAspectRatio(aspectRatio)
//
//   if (Number.isFinite(widthProp) && Number.isFinite(aspectRatioProp)) {
//     return dimensions(widthProp, widthProp / aspectRatioProp)
//   }
//
//   if (Number.isFinite(aspectRatioProp) && Number.isFinite(heightProp)) {
//     return dimensions(heightProp * aspectRatioProp, heightProp)
//   }
//
//   return dimensions(
//     Number.isFinite(widthProp) ? widthProp : auto,
//     Number.isFinite(heightProp) ? heightProp : auto,
//   )
// }

export function useBasisSize(
  input: MaybeRefOrGetter<BasisSizeProps>,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions> = 'inherit',
): ComputedRef<Dimensions> {
  return useSize(
    () => toValue(input).width,
    () => toValue(input).height,
    () => toValue(input).aspectRatio,
    dimensions.infinity,
    parent,
  )
}

export function useMinSize(
  input: MaybeRefOrGetter<MinSizeProps>,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions> = 'inherit',
): ComputedRef<Dimensions> {
  return useSize(
    () => toValue(input).minWidth,
    () => toValue(input).minHeight,
    undefined,
    dimensions.zero,
    parent,
  )
}

export function useMaxSize(
  input: MaybeRefOrGetter<MaxSizeProps>,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions> = 'inherit',
): ComputedRef<Dimensions> {
  return useSize(
    () => toValue(input).maxWidth,
    () => toValue(input).maxHeight,
    undefined,
    dimensions.infinity,
    parent,
  )
}

export function useConstrainedSize(
  basis: MaybeRefOrGetter<Dimensions>,
  min: MaybeRefOrGetter<Dimensions>,
  max: MaybeRefOrGetter<Dimensions>,
): ComputedRef<Dimensions> {
  return computed(() =>
    clampDimensions(toValue(basis), toValue(min), toValue(max)),
  )
}

// export function useSize(input: MaybeRefOrGetter<SizeProps>) {
//   const basis = useBasisSize(input)
//   const min = useMinSize(input)
//   const max = useMaxSize(input)
//
//   return useConstrainedSize(basis, min, max)
// }

export function useAxisInterval(
  start: MaybeRefOrGetter<number>,
  end: MaybeRefOrGetter<number>,
  size: MaybeRefOrGetter<number>,
  parentStart: MaybeRefOrGetter<number>,
  parentSize: MaybeRefOrGetter<number>,
  minSize: MaybeRefOrGetter<number>,
  maxSize: MaybeRefOrGetter<number>,
) {
  return computedInterval(
    () => {
      const parentStartValue = toValue(parentStart)
      const startValue = toValue(start)

      if (Number.isFinite(startValue)) {
        return parentStartValue + startValue
      }

      const endValue = toValue(end)
      const sizeValue = toValue(size)
      const parentSizeValue = toValue(parentSize)

      if (Number.isFinite(sizeValue) && Number.isFinite(endValue)) {
        return parentStartValue + parentSizeValue - sizeValue - endValue
      }

      return parentStartValue
    },
    () => {
      const sizeValue = toValue(size)

      if (Number.isFinite(sizeValue)) {
        return sizeValue
      }

      const startValue = toValue(start)
      const endValue = toValue(end)
      const parentSizeValue = toValue(parentSize)

      return clamp(
        parentSizeValue - auto(startValue, 0) - auto(endValue, 0),
        toValue(minSize),
        toValue(maxSize),
      )
    },
  )

  // return computed(() => {
  //   const startValue = toValue(start)
  //   const endValue = toValue(end)
  //   const sizeValue = toValue(size)
  //
  //   const parentStartValue = toValue(parentStart)
  //   const parentSizeValue = toValue(parentSize)
  //
  //   const startIsFinite = Number.isFinite(startValue)
  //   const sizeIsFinite = Number.isFinite(sizeValue)
  //   const endIsFinite = Number.isFinite(endValue)
  //
  //   let resultStart: number = parentStartValue
  //   let resultSize: number = sizeValue
  //
  //   if (startIsFinite) {
  //     resultStart += startValue
  //   } else if (sizeIsFinite && endIsFinite) {
  //     resultStart += parentSizeValue - sizeValue - endValue
  //   }
  //
  //   if (!sizeIsFinite) {
  //     resultSize = parentSizeValue
  //
  //     if (startIsFinite) {
  //       resultSize -= startValue
  //     }
  //
  //     if (endIsFinite) {
  //       resultSize -= endValue
  //     }
  //   }
  //
  //   return interval(
  //     resultStart,
  //     clamp(resultSize, toValue(minSize), toValue(maxSize)),
  //   )
  // })
}

export function useXYTranslation(
  props: MaybeRefOrGetter<TranslateProps>,
  self: MaybeRefOrGetter<Rect | Dimensions>,
) {
  return computed(() => {
    const { x, y } = toValue(props)
    const { width, height } = toValue(self)

    return translate(resolveSize1D(x, 0, width), resolveSize1D(y, 0, height))
  })
}

// export function useOrigin(
//   props: MaybeRefOrGetter<OriginProps>,
//   defaultOrigin: MaybeRefOrGetter<Point | number> = 0,
// ): ComputedRef<Point> {
//   return computed(() => {
//     const { origin } = toValue(props)
//
//     const defaultOriginValue = toValue(defaultOrigin)
//
//     return resolveOrigin(
//       origin,
//       isPoint(defaultOriginValue)
//         ? defaultOriginValue
//         : point(defaultOriginValue, defaultOriginValue),
//     )
//   })
// }

export function useOriginTranslation(
  props: OriginProps,
  fallback: MaybeRefOrGetter<Point> = point.zero,
): ComputedRef<(self: Rect) => Rect> {
  const origin = useOrigin(() => props.origin, fallback)
  return computed(
    () => (self: Rect) => align(self, point(self.x, self.y), origin.value),
  )
}

export function useTransformedRect(
  rect: MaybeRefOrGetter<Rect>,
  props: TransformProps,
) {
  const originTranslation = useOriginTranslation(props)
  const translation = useXYTranslation(props, rect)

  return computed(() =>
    toValue(rect).pipe(originTranslation.value, translation.value),
  )
}

export function useRect(props: RectProps): ComputedRef<Rect> {
  const parentX = useParentX()
  const parentY = useParentY()
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()

  const basisSize = useBasisSize(props)
  const minSize = useMinSize(props)
  const maxSize = useMaxSize(props)

  const top = useLengthPercentage(
    () => props.top,
    Number.POSITIVE_INFINITY,
    'height',
  )
  const right = useLengthPercentage(
    () => props.right,
    Number.POSITIVE_INFINITY,
    'width',
  )
  const bottom = useLengthPercentage(
    () => props.bottom,
    Number.POSITIVE_INFINITY,
    'height',
  )
  const left = useLengthPercentage(
    () => props.left,
    Number.POSITIVE_INFINITY,
    'width',
  )

  const x = useAxisInterval(
    left,
    right,
    () => basisSize.value.width,
    parentX,
    parentWidth,
    () => minSize.value.width,
    () => maxSize.value.width,
  )

  const y = useAxisInterval(
    top,
    bottom,
    () => basisSize.value.height,
    parentY,
    parentHeight,
    () => minSize.value.height,
    () => maxSize.value.height,
  )

  return useTransformedRect(() => rect.fromInterval(x.value, y.value), props)
}
