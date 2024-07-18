import { type Rect, rect } from 'placement/rect'
import { type MaybeRefOrGetter, inject, provide } from 'vue'
import { ROOT_RECT } from '../internal/injections'

const defaultRootRect = rect()

export function provideRootRect(rect: MaybeRefOrGetter<Rect>) {
  provide(ROOT_RECT, rect)
}

export function useRootRect() {
  return inject(ROOT_RECT, defaultRootRect)
}
