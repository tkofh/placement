import type { ComputedOutput, Input, PropConfig } from 'placement/property'
import { createProperty } from 'placement/property'
import type { ReadonlyRect } from 'placement/rect'
import {
  type MaybeRefOrGetter,
  type ShallowRef,
  shallowRef,
  toValue,
  watch,
  watchEffect,
} from 'vue'

export function useProperty<const Config extends Partial<PropConfig<string>>>(
  config: Config,
  value: MaybeRefOrGetter<Input<Config>>,
  parent: MaybeRefOrGetter<ReadonlyRect>,
  root: MaybeRefOrGetter<ReadonlyRect> = parent,
) {
  const property = createProperty(config, toValue(value))

  const computed = shallowRef() as ShallowRef<ComputedOutput<Config>>

  function recompute() {
    computed.value = property.getComputed(toValue(parent), toValue(root))
  }

  watchEffect(() => {
    property.value = toValue(value)
    recompute()
  })

  watch([() => toValue(parent), () => toValue(root)], recompute)

  return computed
}
