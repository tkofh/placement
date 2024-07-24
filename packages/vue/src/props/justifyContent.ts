import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type JustifyContentInput,
  type JustifyContentValue,
  keywordResults,
  resolveJustifyContent,
} from '../internal/props/justifyContent'

export type { JustifyContentValue, JustifyContentInput }

function preferCachedJustifyContent(
  value: JustifyContentValue,
  previous?: JustifyContentValue,
): JustifyContentValue {
  if (
    previous === undefined ||
    previous.justifyContent !== value.justifyContent ||
    previous.justifyContentSpace !== value.justifyContentSpace ||
    previous.justifyContentSpaceOuter !== value.justifyContentSpaceOuter
  ) {
    return value
  }

  return previous
}

export function useJustifyContent(
  value: MaybeRefOrGetter<JustifyContentInput>,
  fallback: MaybeRefOrGetter<JustifyContentValue> = keywordResults.start,
): ComputedRef<JustifyContentValue> {
  return computed(() => {
    const { justifyContent, justifyContentSpace, justifyContentSpaceOuter } =
      toValue(fallback)
    return preferCachedJustifyContent(
      resolveJustifyContent(
        toValue(value),
        justifyContent,
        justifyContentSpace,
        justifyContentSpaceOuter,
      ),
    )
  })
}
