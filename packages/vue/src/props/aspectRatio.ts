import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AspectRatioInput,
  resolveAspectRatio,
} from '../internal/props/aspectRatio'

export type { AspectRatioInput }

export function useAspectRatio(
  aspectRatio: MaybeRefOrGetter<AspectRatioInput>,
  fallback: MaybeRefOrGetter<number> = 1,
) {
  return computed(() => {
    return resolveAspectRatio(toValue(aspectRatio), toValue(fallback))
  })
}
