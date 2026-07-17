import type { Point } from 'placement/point'

export function preferCachedPoint(value: Point, previous: Point | undefined) {
  if (previous === undefined || previous.x !== value.x || previous.y !== value.y) {
    return value
  }

  return previous
}
