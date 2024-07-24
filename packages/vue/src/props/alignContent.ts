import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AlignContentInput,
  type AlignContentValue,
  keywordResults,
  resolveAlignContent,
} from '../internal/props/alignContent'

export type { AlignContentValue, AlignContentInput }

function preferCachedAlignContent(
  value: AlignContentValue,
  previous?: AlignContentValue,
): AlignContentValue {
  if (
    previous === undefined ||
    previous.alignContent !== value.alignContent ||
    previous.alignContentSpace !== value.alignContentSpace ||
    previous.alignContentSpaceOuter !== value.alignContentSpaceOuter ||
    previous.stretchContent !== value.stretchContent
  ) {
    return value
  }

  return previous
}

export function useAlignContent(
  value: MaybeRefOrGetter<AlignContentInput>,
  fallback: MaybeRefOrGetter<AlignContentValue> = keywordResults.start,
): ComputedRef<AlignContentValue> {
  return computed(() => {
    const {
      alignContent,
      alignContentSpace,
      alignContentSpaceOuter,
      stretchContent,
    } = toValue(fallback)
    return preferCachedAlignContent(
      resolveAlignContent(
        toValue(value),
        alignContent,
        alignContentSpace,
        alignContentSpaceOuter,
        stretchContent,
      ),
    )
  })
}
