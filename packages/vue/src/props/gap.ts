import type { Dimensions } from 'placement/dimensions'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useOverrideableParent } from '../internal/parent'
import { type GapInput, type GapValue, resolveGap } from '../internal/props/gap'

export type { GapValue, GapInput }

function preferCachedGap(value: GapValue, previous?: GapValue): GapValue {
  if (
    previous === undefined ||
    previous.rowGap !== value.rowGap ||
    previous.columnGap !== value.columnGap
  ) {
    return value
  }

  return previous
}

export function useGap(
  value: MaybeRefOrGetter<GapInput>,
  fallback: MaybeRefOrGetter<GapValue | number> = 0,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions> = 'inherit',
): ComputedRef<GapValue> {
  const parentDimensions = useOverrideableParent(parent)

  return computed(() => {
    const fallbackValue = toValue(fallback)
    const fallbackRow =
      typeof fallbackValue === 'number' ? fallbackValue : fallbackValue.rowGap
    const fallbackColumn =
      typeof fallbackValue === 'number'
        ? fallbackValue
        : fallbackValue.columnGap

    return preferCachedGap(
      resolveGap(
        toValue(value),
        fallbackRow,
        fallbackColumn,
        toValue(parentDimensions.width),
        toValue(parentDimensions.height),
      ),
    )
  })
}
