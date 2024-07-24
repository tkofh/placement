import { type Dimensions, dimensions } from 'placement/dimensions'
import { auto } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { computedDimensions } from '../data/dimensions'
import { useOverrideableParent } from '../internal/parent'
import type { AspectRatioInput } from '../internal/props/aspectRatio'
import { type Size1DInput, resolveSize1D } from '../internal/props/size1d'
import { useAspectRatio } from './aspectRatio'

export function useSize(
  width: MaybeRefOrGetter<Size1DInput>,
  height: MaybeRefOrGetter<Size1DInput>,
  aspectRatio?: MaybeRefOrGetter<AspectRatioInput> | undefined,
  fallback: MaybeRefOrGetter<Dimensions> = dimensions.zero,
  parent: 'inherit' | MaybeRefOrGetter<Dimensions> = 'inherit',
): ComputedRef<Dimensions> {
  const parentDimensions = useOverrideableParent(parent)

  const widthRef = computed(() =>
    resolveSize1D(
      toValue(width),
      Number.POSITIVE_INFINITY,
      toValue(parentDimensions.width),
    ),
  )
  const heightRef = computed(() =>
    resolveSize1D(
      toValue(height),
      Number.POSITIVE_INFINITY,
      toValue(parentDimensions.height),
    ),
  )

  const fallbackRef = computed((previous: Dimensions | undefined) => {
    const value = toValue(fallback)

    if (
      previous === undefined ||
      previous.width !== value.width ||
      previous.height !== value.height
    ) {
      return value
    }

    return previous
  })

  if (aspectRatio === undefined) {
    return computedDimensions(
      () => auto(toValue(widthRef), fallbackRef.value.width),
      () => auto(toValue(heightRef), fallbackRef.value.height),
    )
  }

  const aspectRatioRef = useAspectRatio(aspectRatio, Number.POSITIVE_INFINITY)

  return computedDimensions(
    () => {
      const widthValue = toValue(widthRef)

      if (Number.isFinite(widthValue)) {
        return widthValue
      }

      const heightValue = toValue(heightRef)
      const aspectRatioValue = toValue(aspectRatioRef)

      if (Number.isFinite(heightValue) && Number.isFinite(aspectRatioValue)) {
        return heightValue * aspectRatioValue
      }

      return toValue(fallbackRef).width
    },
    () => {
      const heightValue = toValue(heightRef)

      if (Number.isFinite(heightValue)) {
        return heightValue
      }

      const widthValue = toValue(widthRef)
      const aspectRatioValue = toValue(aspectRatioRef)

      if (Number.isFinite(widthValue) && Number.isFinite(aspectRatioValue)) {
        return widthValue / aspectRatioValue
      }

      return toValue(fallbackRef).height
    },
  )
}
