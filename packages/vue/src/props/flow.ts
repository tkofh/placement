import * as Flexbox from 'placement/flexbox'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { type FlowInput, type FlowValue, resolveFlow } from '../internal/props/flow.ts'

export type { FlowValue, FlowInput }

function preferCachedFlow(value: FlowValue, previous?: FlowValue): FlowValue {
  if (
    previous === undefined ||
    previous.direction !== value.direction ||
    previous.wrap !== value.wrap
  ) {
    return value
  }

  return previous
}

export function useFlow(
  value: MaybeRefOrGetter<FlowInput>,
  fallback: MaybeRefOrGetter<FlowValue> = {
    direction: Flexbox.direction.row,
    wrap: Flexbox.wrap.nowrap,
  },
): ComputedRef<FlowValue> {
  return computed((previous: FlowValue | undefined) => {
    const { direction, wrap } = toValue(fallback)
    return preferCachedFlow(resolveFlow(toValue(value), direction, wrap), previous)
  })
}
