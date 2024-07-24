import type { Dimensions } from 'placement/dimensions'
import { type MaybeRefOrGetter, toValue } from 'vue'
import {
  useParentHeight,
  useParentWidth,
} from '../composables/useSizingContext'

export function useOverrideablePercentBasis(
  percentBasis: 'width' | 'height' | MaybeRefOrGetter<number> = 'width',
): MaybeRefOrGetter<number> {
  let result: MaybeRefOrGetter<number>

  if (percentBasis === 'width') {
    result = useParentWidth()
  } else if (percentBasis === 'height') {
    result = useParentHeight()
  } else {
    result = percentBasis
  }

  return result
}

export function useOverrideableParent(
  parent: 'inherit' | MaybeRefOrGetter<Dimensions> = 'inherit',
): { width: MaybeRefOrGetter<number>; height: MaybeRefOrGetter<number> } {
  let width: MaybeRefOrGetter<number>
  let height: MaybeRefOrGetter<number>

  if (parent === 'inherit') {
    width = useParentWidth()
    height = useParentHeight()
  } else {
    width = () => toValue(parent).width
    height = () => toValue(parent).height
  }

  return { width, height }
}
