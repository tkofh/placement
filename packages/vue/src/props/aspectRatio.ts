import type * as AspectRatio from 'placement/aspectRatio'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AspectRatioInput,
  resolveAspectRatio,
  toAspectRatio,
} from '../internal/props/aspectRatio.ts'

export type { AspectRatioInput }

export function useAspectRatio(
  aspectRatio: MaybeRefOrGetter<AspectRatioInput>,
  fallback: MaybeRefOrGetter<number> = 1,
) {
  return computed(() => {
    return resolveAspectRatio(toValue(aspectRatio), toValue(fallback))
  })
}

/**
 * Parses a ratio prop for a core ratio field. Unlike `useAspectRatio`, it
 * keeps a `16 / 9` prop as a numerator over a denominator, so the core
 * derives extents from it with one rounding (see `placement/aspectRatio`).
 *
 * @param aspectRatio - The prop value.
 * @param fallback - The value for unset, `auto`, degenerate, and unparsable inputs.
 * @returns The ratio input.
 */
export function useAspectRatioInput(
  aspectRatio: MaybeRefOrGetter<AspectRatioInput>,
  fallback: MaybeRefOrGetter<number> = 1,
): ComputedRef<AspectRatio.AspectRatioInput> {
  return computed(() => toAspectRatio(toValue(aspectRatio), toValue(fallback)))
}
