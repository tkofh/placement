import * as Interval from 'placement/interval'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'

function preferCachedInterval(value: Interval.Interval, previous: Interval.Interval | undefined) {
  if (previous === undefined || previous.start !== value.start || previous.end !== value.end) {
    return value
  }

  return previous
}

export function computedInterval(
  start: MaybeRefOrGetter<number>,
  size: MaybeRefOrGetter<number>,
): ComputedRef<Interval.Interval> {
  return computed((previous: Interval.Interval | undefined) =>
    preferCachedInterval(Interval.make(toValue(start), toValue(size)), previous),
  )
}
