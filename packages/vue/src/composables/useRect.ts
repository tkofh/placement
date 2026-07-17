import { clamp } from 'curvy/number'
import * as Dimensions from 'placement/dimensions'
import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { auto } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { computedInterval } from '../data/interval.ts'
import type { AspectRatioInput } from '../internal/props/aspectRatio.ts'
import type { OriginInput } from '../internal/props/origin.ts'
import { type Size1DInput, resolveSize1D } from '../internal/props/size1d.ts'
import { useLengthPercentage } from '../props/lengthPercentage.ts'
import { useOrigin } from '../props/origin.ts'
import { useSize } from '../props/size.ts'
import { useParentHeight, useParentWidth, useParentX, useParentY } from './useSizingContext.ts'

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
  origin?: OriginInput | Point.Point | number
}

export const ORIGIN_PROP_KEYS = ['origin'] as const

export interface TranslateProps {
  x?: Size1DInput | number
  y?: Size1DInput | number
}

export const TRANSLATE_PROP_KEYS = ['x', 'y'] as const

export interface TransformProps extends OriginProps, TranslateProps {}

export const TRANSFORM_PROP_KEYS = [...ORIGIN_PROP_KEYS, ...TRANSLATE_PROP_KEYS] as const

export interface RectProps extends InsetProps, SizeProps, TransformProps {}

export const RECT_PROP_KEYS = [
  ...SIZE_PROP_KEYS,
  ...INSET_PROP_KEYS,
  ...TRANSFORM_PROP_KEYS,
] as const

export function useBasisSize(
  input: MaybeRefOrGetter<BasisSizeProps>,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions.Dimensions> = 'inherit',
): ComputedRef<Dimensions.Dimensions> {
  return useSize(
    () => toValue(input).width,
    () => toValue(input).height,
    () => toValue(input).aspectRatio,
    Dimensions.infinity,
    parent,
  )
}

export function useMinSize(
  input: MaybeRefOrGetter<MinSizeProps>,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions.Dimensions> = 'inherit',
): ComputedRef<Dimensions.Dimensions> {
  return useSize(
    () => toValue(input).minWidth,
    () => toValue(input).minHeight,
    undefined,
    Dimensions.zero,
    parent,
  )
}

export function useMaxSize(
  input: MaybeRefOrGetter<MaxSizeProps>,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions.Dimensions> = 'inherit',
): ComputedRef<Dimensions.Dimensions> {
  return useSize(
    () => toValue(input).maxWidth,
    () => toValue(input).maxHeight,
    undefined,
    Dimensions.infinity,
    parent,
  )
}

export function useConstrainedSize(
  basis: MaybeRefOrGetter<Dimensions.Dimensions>,
  min: MaybeRefOrGetter<Dimensions.Dimensions>,
  max: MaybeRefOrGetter<Dimensions.Dimensions>,
): ComputedRef<Dimensions.Dimensions> {
  return computed(() => Dimensions.clamp(toValue(basis), toValue(min), toValue(max)))
}

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

      // The minimum wins when the bounds cross (CSS clamp semantics); curvy's
      // clamp assumes min <= max.
      const minSizeValue = toValue(minSize)
      return clamp(
        parentSizeValue - auto(startValue, 0) - auto(endValue, 0),
        minSizeValue,
        Math.max(minSizeValue, toValue(maxSize)),
      )
    },
  )
}

export function useXYTranslation(
  props: MaybeRefOrGetter<TranslateProps>,
  self: MaybeRefOrGetter<Rect.Rect | Dimensions.Dimensions>,
) {
  return computed(() => {
    const { x, y } = toValue(props)
    const { width, height } = toValue(self)

    return Rect.translate(resolveSize1D(x, 0, width), resolveSize1D(y, 0, height))
  })
}

export function useOriginTranslation(
  props: OriginProps,
  fallback: MaybeRefOrGetter<Point.Point> = Point.zero,
): ComputedRef<(self: Rect.Rect) => Rect.Rect> {
  const origin = useOrigin(() => props.origin, fallback)
  return computed(
    () => (self: Rect.Rect) => Rect.align(self, Point.make(self.x, self.y), origin.value),
  )
}

export function useTransformedRect(rect: MaybeRefOrGetter<Rect.Rect>, props: TransformProps) {
  const originTranslation = useOriginTranslation(props)
  const translation = useXYTranslation(props, rect)

  return computed(() => toValue(rect).pipe(originTranslation.value, translation.value))
}

export function useRect(props: RectProps): ComputedRef<Rect.Rect> {
  const parentX = useParentX()
  const parentY = useParentY()
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()

  const basisSize = useBasisSize(props)
  const minSize = useMinSize(props)
  const maxSize = useMaxSize(props)

  const top = useLengthPercentage(() => props.top, Number.POSITIVE_INFINITY, 'height')
  const right = useLengthPercentage(() => props.right, Number.POSITIVE_INFINITY, 'width')
  const bottom = useLengthPercentage(() => props.bottom, Number.POSITIVE_INFINITY, 'height')
  const left = useLengthPercentage(() => props.left, Number.POSITIVE_INFINITY, 'width')

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

  return useTransformedRect(() => Rect.fromInterval(x.value, y.value), props)
}
