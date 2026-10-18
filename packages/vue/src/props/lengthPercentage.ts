import type * as Length from 'placement/length'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useOverrideablePercentBasis } from '../internal/parent.ts'
import { type Size1DInput, resolveSize1D, toLength } from '../internal/props/size1d.ts'

export type LengthPercentageInput = Size1DInput

export function useLengthPercentage(
  prop: MaybeRefOrGetter<LengthPercentageInput>,
  fallback: MaybeRefOrGetter<number> = 0,
  percentBasis: 'width' | 'height' | MaybeRefOrGetter<number> = 'width',
) {
  const percentBasisRef = useOverrideablePercentBasis(percentBasis)

  return computed(() => {
    return resolveSize1D(toValue(prop), toValue(fallback), toValue(percentBasisRef))
  })
}

/**
 * Parses a length prop without resolving it. A percentage stays a `Length`
 * for the core to resolve against the basis it knows (see `placement/box`
 * and `placement/frame`), so the component reads no parent rect for it.
 *
 * @param prop - The prop value.
 * @param fallback - The value for unset, `auto`, and unparsable inputs.
 * @returns The pixels, or the percentage left unresolved.
 */
export function useLength(
  prop: MaybeRefOrGetter<LengthPercentageInput>,
  fallback: MaybeRefOrGetter<number> = 0,
): ComputedRef<Length.LengthInput> {
  return computed(() => toLength(toValue(prop), toValue(fallback)))
}
