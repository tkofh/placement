import * as Point from 'placement/point'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { type RadiusInput, resolveRadius } from '../internal/props/radius.ts'
import { useParentHeight, useParentWidth } from './useSizingContext.ts'

export interface RadiusProps {
  r?: RadiusInput | Point.Point | number | undefined
}

export const RADIUS_PROP_KEYS = ['r'] as const

export function useRadius(
  input: MaybeRefOrGetter<RadiusProps>,
  defaultRadius: MaybeRefOrGetter<Point.Point> = Point.zero,
): ComputedRef<Point.Point> {
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()

  return computed(() =>
    resolveRadius(toValue(input).r, toValue(defaultRadius), parentWidth.value, parentHeight.value),
  )
}
