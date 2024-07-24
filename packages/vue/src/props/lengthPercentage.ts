import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useOverrideablePercentBasis } from '../internal/parent'
import { type Size1DInput, resolveSize1D } from '../internal/props/size1d'

export type LengthPercentageInput = Size1DInput

export function useLengthPercentage(
  prop: MaybeRefOrGetter<LengthPercentageInput>,
  fallback: MaybeRefOrGetter<number> = 0,
  percentBasis: 'width' | 'height' | MaybeRefOrGetter<number> = 'width',
) {
  const percentBasisRef = useOverrideablePercentBasis(percentBasis)

  return computed(() => {
    return resolveSize1D(
      toValue(prop),
      toValue(fallback),
      toValue(percentBasisRef),
    )
  })
}
