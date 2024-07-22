import { type Point, point } from 'placement/point'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { type RadiusInput, resolveRadius } from '../internal/props/radius'
import {
  useParentHeight,
  useParentWidth,
  useRootHeight,
  useRootWidth,
} from './useSizingContext'

export interface RadiusProps {
  r?: RadiusInput | Point | number | undefined
}

export const RADIUS_PROP_KEYS = ['r'] as const

export function useRadius(
  input: MaybeRefOrGetter<RadiusProps>,
  defaultRadius: MaybeRefOrGetter<Point> = point.zero,
): ComputedRef<Point> {
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()
  const rootWidth = useRootWidth()
  const rootHeight = useRootHeight()

  return computed(() =>
    resolveRadius(
      toValue(input).r,
      toValue(defaultRadius),
      parentWidth.value,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
    ),
  )
}
