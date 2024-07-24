import { type Point, point } from 'placement/point'
import { type MaybeRefOrGetter, computed, toValue } from 'vue'

export function preferCachedPoint(value: Point, previous: Point | undefined) {
  if (
    previous === undefined ||
    previous.x !== value.x ||
    previous.y !== value.y
  ) {
    return value
  }

  return previous
}

export function computedPoint(
  x: MaybeRefOrGetter<number>,
  y: MaybeRefOrGetter<number>,
) {
  return computed((previous: Point | undefined) =>
    preferCachedPoint(point(toValue(x), toValue(y)), previous),
  )
}
