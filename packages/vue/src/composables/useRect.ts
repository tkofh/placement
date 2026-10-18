import * as Box from 'placement/box'
import type * as Dimensions from 'placement/dimensions'
import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import type { AspectRatioInput } from '../internal/props/aspectRatio.ts'
import type { OriginInput } from '../internal/props/origin.ts'
import { type Size1DInput, resolveSize1D } from '../internal/props/size1d.ts'
import { useAspectRatio } from '../props/aspectRatio.ts'
import { useLength } from '../props/lengthPercentage.ts'
import { useOrigin } from '../props/origin.ts'
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

/**
 * Whether a rect fills its parent exactly: none of its inset, size, or
 * transform props is set.
 *
 * @param props - The rect props.
 * @returns `true` when the rect is its parent's rect.
 */
export function fillsParent(props: RectProps): boolean {
  return RECT_PROP_KEYS.every((key) => props[key] === undefined)
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
   * Replaces the `width`/`height` props as the explicit size of the box. Use
   * it for dimensions that come from somewhere other than props, like a
   * measured DOM rect or a radius. `undefined` falls back to the props.
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

  // NaN is the unset sentinel of the core. Unset props parse to NaN, and Box
  // treats them as auto/unset. Percentages stay unresolved: `Box.apply`
  // resolves them against the parent rect (see `placement/box`).
  const width = useLength(() => props.width, Number.NaN)
  const height = useLength(() => props.height, Number.NaN)
  const aspectRatio = useAspectRatio(() => props.aspectRatio, Number.NaN)
  const minWidth = useLength(() => props.minWidth, Number.NaN)
  const minHeight = useLength(() => props.minHeight, Number.NaN)
  const maxWidth = useLength(() => props.maxWidth, Number.NaN)
  const maxHeight = useLength(() => props.maxHeight, Number.NaN)
  const top = useLength(() => props.top, Number.NaN)
  const right = useLength(() => props.right, Number.NaN)
  const bottom = useLength(() => props.bottom, Number.NaN)
  const left = useLength(() => props.left, Number.NaN)

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
