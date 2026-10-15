import * as Point from 'placement/point'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { preferCachedPoint } from '../data/point.ts'
import { type OriginInput, resolveOrigin } from '../internal/props/origin.ts'

export function useOrigin(
  value: MaybeRefOrGetter<OriginInput>,
  fallback: MaybeRefOrGetter<Point.Point> = Point.zero,
): ComputedRef<Point.Point> {
  return computed((previous: Point.Point | undefined) =>
    preferCachedPoint(resolveOrigin(toValue(value), toValue(fallback)), previous),
  )
}
