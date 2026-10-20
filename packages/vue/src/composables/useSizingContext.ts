import type { Rect } from 'placement/rect'
import {
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  computed,
  inject,
  provide,
  toValue,
} from 'vue'
import { blockOutlines } from './useOutline.ts'

export type RectComponentGetter = () => ComputedRef<number>
export interface RectGetters {
  readonly x: RectComponentGetter
  readonly y: RectComponentGetter
  readonly width: RectComponentGetter
  readonly height: RectComponentGetter
}

const PARENT_RECT_X: InjectionKey<RectComponentGetter> = Symbol.for('placement/parent/x')
const PARENT_RECT_Y: InjectionKey<RectComponentGetter> = Symbol.for('placement/parent/y')
const PARENT_RECT_WIDTH: InjectionKey<RectComponentGetter> = Symbol.for('placement/parent/width')
const PARENT_RECT_HEIGHT: InjectionKey<RectComponentGetter> = Symbol.for('placement/parent/height')

// The provider creates the computeds eagerly in its own effect scope. If the
// first consumer created them lazily, its unmount disposes them while later
// consumers still hold them.
function useRectGetters(rect: MaybeRefOrGetter<Rect>): RectGetters {
  const x = computed(() => toValue(rect).x)
  const y = computed(() => toValue(rect).y)
  const width = computed(() => toValue(rect).width)
  const height = computed(() => toValue(rect).height)

  return {
    x: () => x,
    y: () => y,
    width: () => width,
    height: () => height,
  }
}

export function useSizingContextRoot(root: MaybeRefOrGetter<Rect>) {
  const { x, y, width, height } = useRectGetters(root)

  provide(PARENT_RECT_X, x)
  provide(PARENT_RECT_Y, y)
  provide(PARENT_RECT_WIDTH, width)
  provide(PARENT_RECT_HEIGHT, height)
}

export function useParentX(): ComputedRef<number> {
  const value = inject(PARENT_RECT_X)
  if (!value) {
    throw new Error('useParentX() was called outside of a sizing context')
  }

  return value()
}

export function useParentY(): ComputedRef<number> {
  const value = inject(PARENT_RECT_Y)
  if (!value) {
    throw new Error('useParentY() was called outside of a sizing context')
  }

  return value()
}

export function useParentWidth(): ComputedRef<number> {
  const value = inject(PARENT_RECT_WIDTH)
  if (!value) {
    throw new Error('useParentWidth() was called outside of a sizing context')
  }

  return value()
}

export function useParentHeight(): ComputedRef<number> {
  const value = inject(PARENT_RECT_HEIGHT)
  if (!value) {
    throw new Error('useParentHeight() was called outside of a sizing context')
  }

  return value()
}

export function useParentRectRegistration(rect: MaybeRefOrGetter<Rect>) {
  const { x, y, width, height } = useRectGetters(rect)

  // Children get a box of their own, so their outlines are not this
  // component's parent's.
  blockOutlines()

  provide(PARENT_RECT_X, x)
  provide(PARENT_RECT_Y, y)
  provide(PARENT_RECT_WIDTH, width)
  provide(PARENT_RECT_HEIGHT, height)
}
