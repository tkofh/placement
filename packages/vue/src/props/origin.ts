import { type Point, point } from 'placement/point'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { preferCachedPoint } from '../data/point'
import { type OriginInput, resolveOrigin } from '../internal/props/origin'

export function useOrigin(
  value: MaybeRefOrGetter<OriginInput>,
  fallback: MaybeRefOrGetter<Point> = point.zero,
): ComputedRef<Point> {
  return computed((previous: Point | undefined) =>
    preferCachedPoint(
      resolveOrigin(toValue(value), toValue(fallback)),
      previous,
    ),
  )
}
