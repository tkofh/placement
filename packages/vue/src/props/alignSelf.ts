import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AlignSelfInput,
  type AlignSelfValue,
  keywordResults,
  resolveAlignSelf,
} from '../internal/props/alignSelf'

export type { AlignSelfValue, AlignSelfInput }

function preferCachedAlignSelf(
  value: AlignSelfValue,
  previous?: AlignSelfValue,
): AlignSelfValue {
  if (
    previous === undefined ||
    previous.align !== value.align ||
    previous.stretchCross !== value.stretchCross
  ) {
    return value
  }

  return previous
}

export function useAlignSelf(
  alignSelf: MaybeRefOrGetter<AlignSelfInput>,
  fallback: MaybeRefOrGetter<AlignSelfValue> = keywordResults.start,
): ComputedRef<AlignSelfValue> {
  return computed((previous: AlignSelfValue | undefined) => {
    const { align, stretchCross } = toValue(fallback)
    return preferCachedAlignSelf(
      resolveAlignSelf(toValue(alignSelf), align, stretchCross),
      previous,
    )
  })
}
