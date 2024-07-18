import { type Rect, rect } from 'placement/rect'
import { type MaybeRefOrGetter, inject, provide } from 'vue'
import { PARENT_RECT } from '../internal/injections'

const defaultParentRect = rect()

export function provideParentRect(rect: MaybeRefOrGetter<Rect>) {
  provide(PARENT_RECT, rect)
}

export function useParentRect() {
  return inject(PARENT_RECT, defaultParentRect)
}
