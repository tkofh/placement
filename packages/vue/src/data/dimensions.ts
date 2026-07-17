import * as Dimensions from 'placement/dimensions'
import { auto } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'

function preferCachedDimensions(
  value: Dimensions.Dimensions,
  previous: Dimensions.Dimensions | undefined,
) {
  if (
    previous === undefined ||
    previous.width !== value.width ||
    previous.height !== value.height
  ) {
    return value
  }

  return previous
}

export function computedDimensions(
  width: MaybeRefOrGetter<number>,
  height: MaybeRefOrGetter<number>,
): ComputedRef<Dimensions.Dimensions> {
  return computed((previous: Dimensions.Dimensions | undefined) => {
    const newWidth = toValue(width)
    const newHeight = toValue(height)

    return preferCachedDimensions(Dimensions.make(newWidth, newHeight), previous)
  })
}

export function autoDimensions(
  first: Dimensions.Dimensions,
  second: Dimensions.Dimensions,
): Dimensions.Dimensions {
  return Dimensions.make(auto(first.width, second.width), auto(first.height, second.height))
}
