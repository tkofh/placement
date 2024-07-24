import { type Dimensions, dimensions } from 'placement/dimensions'
import { auto } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'

function preferCachedDimensions(
  value: Dimensions,
  previous: Dimensions | undefined,
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
): ComputedRef<Dimensions> {
  return computed((previous: Dimensions | undefined) => {
    const newWidth = toValue(width)
    const newHeight = toValue(height)

    return preferCachedDimensions(dimensions(newWidth, newHeight), previous)
  })
}

export function autoDimensions(
  first: Dimensions,
  second: Dimensions,
): Dimensions {
  return dimensions(
    auto(first.width, second.width),
    auto(first.height, second.height),
  )
}
