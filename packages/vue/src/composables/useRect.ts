import * as Box from 'placement/box'
import * as Dimensions from 'placement/dimensions'
import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import type { AspectRatioInput } from '../internal/props/aspectRatio.ts'
import type { OriginInput } from '../internal/props/origin.ts'
import { type Size1DInput, resolveSize1D } from '../internal/props/size1d.ts'
import { useAspectRatio } from '../props/aspectRatio.ts'
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

export function useTransformedRect(
  rect: MaybeRefOrGetter<Rect.Rect>,
  props: TransformProps,
  originFallback: MaybeRefOrGetter<Point.Point> = Point.zero,
) {
  const originTranslation = useOriginTranslation(props, originFallback)
  const translation = useXYTranslation(props, rect)

  return computed(() => toValue(rect).pipe(originTranslation.value, translation.value))
}

export interface UseRectOptions {
  /**
   * Replaces the `width`/`height` props as the box's explicit size — for
   * dimensions that come from somewhere other than props, like a measured
   * DOM rect or a radius. `undefined` falls back to the props.
   */
  size?: MaybeRefOrGetter<{ readonly width: number; readonly height: number } | undefined>
  /** The origin the `origin` prop falls back to when unset. */
  origin?: MaybeRefOrGetter<Point.Point>
}

export function useRect(props: RectProps, options: UseRectOptions = {}): ComputedRef<Rect.Rect> {
  const parentX = useParentX()
  const parentY = useParentY()
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()

  // NaN is the core's unset sentinel: unset props parse to NaN and Box
  // treats them as auto/unset (see `placement/box`).
  const width = useLengthPercentage(() => props.width, Number.NaN, 'width')
  const height = useLengthPercentage(() => props.height, Number.NaN, 'height')
  const aspectRatio = useAspectRatio(() => props.aspectRatio, Number.NaN)
  const minWidth = useLengthPercentage(() => props.minWidth, Number.NaN, 'width')
  const minHeight = useLengthPercentage(() => props.minHeight, Number.NaN, 'height')
  const maxWidth = useLengthPercentage(() => props.maxWidth, Number.NaN, 'width')
  const maxHeight = useLengthPercentage(() => props.maxHeight, Number.NaN, 'height')
  const top = useLengthPercentage(() => props.top, Number.NaN, 'height')
  const right = useLengthPercentage(() => props.right, Number.NaN, 'width')
  const bottom = useLengthPercentage(() => props.bottom, Number.NaN, 'height')
  const left = useLengthPercentage(() => props.left, Number.NaN, 'width')

  const box = computed(() => {
    const size = toValue(options.size)
    return Box.make({
      top: top.value,
      right: right.value,
      bottom: bottom.value,
      left: left.value,
      width: size !== undefined ? size.width : width.value,
      height: size !== undefined ? size.height : height.value,
      aspectRatio: aspectRatio.value,
      minWidth: minWidth.value,
      minHeight: minHeight.value,
      maxWidth: maxWidth.value,
      maxHeight: maxHeight.value,
    })
  })

  return useTransformedRect(
    () =>
      Box.apply(
        box.value,
        Rect.make(parentX.value, parentY.value, parentWidth.value, parentHeight.value),
      ),
    props,
    options.origin,
  )
}
