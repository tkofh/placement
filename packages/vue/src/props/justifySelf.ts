import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { type JustifySelfInput, resolveJustifySelf } from '../internal/props/justifySelf.ts'

export function useJustifySelf(
  justifySelf: MaybeRefOrGetter<JustifySelfInput>,
  fallback: MaybeRefOrGetter<number> = 0,
): ComputedRef<number> {
  return computed(() => resolveJustifySelf(toValue(justifySelf), toValue(fallback)))
}
