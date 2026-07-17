import type { Point } from 'placement/point'
import { type MaybeRefOrGetter, type Ref, shallowRef } from 'vue'
import { useChild, useChildren } from './useChildren.ts'

export function usePointList(): Readonly<Ref<ReadonlyArray<Point>>> {
  const points = shallowRef<ReadonlyArray<Point>>([])

  useChildren<Point>('placement/points', (children) => {
    points.value = children.map((child) => child.input.value)
  })

  return points
}

export function usePoint(input: MaybeRefOrGetter<Point>): void {
  useChild('placement/points', input)
}
