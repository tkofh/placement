import type { ReadonlyRect } from 'placement/rect'
import { type Ref, inject } from 'vue'
import { ParentRectSymbol } from '../internal/injections'

const defaultParentRect = {
  value: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
} as Ref<ReadonlyRect>

export function useParentRect() {
  return inject(ParentRectSymbol, defaultParentRect)
}
