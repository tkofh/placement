import type { ReadonlyRect } from 'placement/Box'
import { QuantityProperty } from 'placement/properties/QuantityProperty'
import {
  type MaybeRefOrGetter,
  shallowRef,
  toValue,
  watch,
  watchEffect,
} from 'vue'

export function useQuantityProp(
  value: MaybeRefOrGetter<string | number>,
  allowNegative: boolean,
  percentBasis: 'width' | 'height',
  parent: MaybeRefOrGetter<ReadonlyRect>,
  root: MaybeRefOrGetter<ReadonlyRect> = parent,
) {
  const property = new QuantityProperty(
    toValue(value),
    allowNegative,
    percentBasis,
  )

  const computed = shallowRef<number | null>(0)

  function recompute() {
    computed.value = property.compute(toValue(parent), toValue(root))
  }

  watchEffect(() => {
    property.value = toValue(value)
    recompute()
  })

  watch([() => toValue(parent), () => toValue(root)], recompute)

  return computed
}
