import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AlignItemsInput,
  type AlignItemsValue,
  keywordResults,
  resolveAlignItems,
} from '../internal/props/alignItems'

export type { AlignItemsValue, AlignItemsInput }

function preferCachedAlignItems(
  value: AlignItemsValue,
  previous?: AlignItemsValue,
): AlignItemsValue {
  if (
    previous === undefined ||
    previous.alignItems !== value.alignItems ||
    previous.stretchItems !== value.stretchItems
  ) {
    return value
  }

  return previous
}

export function useAlignItems(
  value: MaybeRefOrGetter<AlignItemsInput>,
  fallback: MaybeRefOrGetter<AlignItemsValue> = keywordResults.start,
): ComputedRef<AlignItemsValue> {
  return computed(() => {
    const { alignItems, stretchItems } = toValue(fallback)
    return preferCachedAlignItems(
      resolveAlignItems(toValue(value), alignItems, stretchItems),
    )
  })
}
