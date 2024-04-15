import { Rect } from './Rect'

export type { ReadonlyRect, MutableRect } from './types'

export function createRect(x = 0, y = 0, width = 0, height = 0, precision = 0) {
  const rect = new Rect(precision)
  rect.x = x
  rect.y = y
  rect.width = width
  rect.height = height

  return rect
}
