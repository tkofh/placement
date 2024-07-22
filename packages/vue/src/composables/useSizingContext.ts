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

export type RectComponentGetter = () => ComputedRef<number>
export interface RectGetters {
  readonly x: RectComponentGetter
  readonly y: RectComponentGetter
  readonly width: RectComponentGetter
  readonly height: RectComponentGetter
}

const ROOT_RECT_X: InjectionKey<RectComponentGetter> = Symbol('root/x')
const ROOT_RECT_Y: InjectionKey<RectComponentGetter> = Symbol('root/y')
const ROOT_RECT_WIDTH: InjectionKey<RectComponentGetter> = Symbol('root/width')
const ROOT_RECT_HEIGHT: InjectionKey<RectComponentGetter> =
  Symbol('root/height')

const PARENT_RECT_X: InjectionKey<RectComponentGetter> = Symbol('parent/x')
const PARENT_RECT_Y: InjectionKey<RectComponentGetter> = Symbol('parent/y')
const PARENT_RECT_WIDTH: InjectionKey<RectComponentGetter> =
  Symbol('parent/width')
const PARENT_RECT_HEIGHT: InjectionKey<RectComponentGetter> =
  Symbol('parent/height')

class RectGetterStorage {
  private _x?: ComputedRef<number>
  private _y?: ComputedRef<number>
  private _width?: ComputedRef<number>
  private _height?: ComputedRef<number>

  constructor(private rect: MaybeRefOrGetter<Rect>) {}

  get x() {
    if (!this._x) {
      this._x = computed(() => toValue(this.rect).x)
    }
    return this._x
  }

  get y() {
    if (!this._y) {
      this._y = computed(() => toValue(this.rect).y)
    }
    return this._y
  }

  get width() {
    if (!this._width) {
      this._width = computed(() => toValue(this.rect).width)
    }
    return this._width
  }

  get height() {
    if (!this._height) {
      this._height = computed(() => toValue(this.rect).height)
    }
    return this._height
  }
}

function useRectGetters(rect: MaybeRefOrGetter<Rect>): RectGetters {
  const getters = new RectGetterStorage(rect)

  return {
    x: () => getters.x,
    y: () => getters.y,
    width: () => getters.width,
    height: () => getters.height,
  }
}

export function useSizingContextRoot(root: MaybeRefOrGetter<Rect>) {
  const { x, y, width, height } = useRectGetters(root)

  provide(ROOT_RECT_X, x)
  provide(ROOT_RECT_Y, y)
  provide(ROOT_RECT_WIDTH, width)
  provide(ROOT_RECT_HEIGHT, height)

  provide(PARENT_RECT_X, x)
  provide(PARENT_RECT_Y, y)
  provide(PARENT_RECT_WIDTH, width)
  provide(PARENT_RECT_HEIGHT, height)
}

export function useRootX(): ComputedRef<number> {
  const value = inject(ROOT_RECT_X)
  if (!value) {
    throw new Error('useRootX() was called outside of a sizing context')
  }

  return value()
}

export function useRootY(): ComputedRef<number> {
  const value = inject(ROOT_RECT_Y)
  if (!value) {
    throw new Error('useRootY() was called outside of a sizing context')
  }

  return value()
}

export function useRootWidth(): ComputedRef<number> {
  const value = inject(ROOT_RECT_WIDTH)
  if (!value) {
    throw new Error('useRootWidth() was called outside of a sizing context')
  }

  return value()
}

export function useRootHeight(): ComputedRef<number> {
  const value = inject(ROOT_RECT_HEIGHT)
  if (!value) {
    throw new Error('useRootHeight() was called outside of a sizing context')
  }

  return value()
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

  provide(PARENT_RECT_X, x)
  provide(PARENT_RECT_Y, y)
  provide(PARENT_RECT_WIDTH, width)
  provide(PARENT_RECT_HEIGHT, height)
}
