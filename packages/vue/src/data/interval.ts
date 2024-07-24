import { type Interval, interval } from 'placement/interval'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'

function preferCachedInterval(value: Interval, previous: Interval | undefined) {
  if (
    previous === undefined ||
    previous.start !== value.start ||
    previous.end !== value.end
  ) {
    return value
  }

  return previous
}

export function computedInterval(
  start: MaybeRefOrGetter<number>,
  size: MaybeRefOrGetter<number>,
): ComputedRef<Interval> {
  return computed((previous: Interval | undefined) =>
    preferCachedInterval(interval(toValue(start), toValue(size)), previous),
  )
}
