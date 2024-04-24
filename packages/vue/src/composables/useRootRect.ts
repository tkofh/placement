import type { ReadonlyRect } from 'placement/rect'
import { type Ref, inject } from 'vue'
import { RootRectSymbol } from '../internal/injections'

const defaultRootRect = {
  value: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
} as Ref<ReadonlyRect>

export function useRootRect() {
  return inject(RootRectSymbol, defaultRootRect)
}
