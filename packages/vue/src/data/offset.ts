import { type Offset, offset } from 'placement/offset'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'

export function preferCachedOffset(
  value: Offset,
  previous: Offset | undefined,
): Offset {
  if (
    previous === undefined ||
    previous.top !== value.top ||
    previous.right !== value.right ||
    previous.bottom !== value.bottom ||
    previous.left !== value.left
  ) {
    return value
  }
  return previous
}

export function computedOffset(
  value: MaybeRefOrGetter<number>,
): ComputedRef<Offset> {
  return computed((previous: Offset | undefined) =>
    preferCachedOffset(offset(toValue(value)), previous),
  )
}

export function computedXYOffset(
  x: MaybeRefOrGetter<number>,
  y: MaybeRefOrGetter<number>,
): ComputedRef<Offset> {
  return computed((previous: Offset | undefined) =>
    preferCachedOffset(offset.xy(toValue(x), toValue(y)), previous),
  )
}

export function computedTRBLOffset(
  top: MaybeRefOrGetter<number>,
  right: MaybeRefOrGetter<number>,
  bottom: MaybeRefOrGetter<number>,
  left: MaybeRefOrGetter<number>,
): ComputedRef<Offset> {
  return computed((previous: Offset | undefined) =>
    preferCachedOffset(
      offset.trbl(toValue(top), toValue(right), toValue(bottom), toValue(left)),
      previous,
    ),
  )
}
