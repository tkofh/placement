import type { Rect } from '../rect'

export const LAYOUT_APPLY: unique symbol = Symbol('placement/layout/apply')

export interface Layout {
  readonly [LAYOUT_APPLY]: (rect: Rect) => Rect
}
