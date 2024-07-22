import { type Offset, offset } from 'placement/offset'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { type OffsetInput, resolveOffset } from '../internal/props/offset'
import {
  useParentHeight,
  useParentWidth,
  useRootHeight,
  useRootWidth,
} from './useSizingContext'

export function useOffset(
  input: MaybeRefOrGetter<OffsetInput>,
): ComputedRef<Offset> {
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()
  const rootWidth = useRootWidth()
  const rootHeight = useRootHeight()
  return computed(() =>
    resolveOffset(
      toValue(input),
      offset.zero,
      true,
      parentWidth.value,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
    ),
  )
}
