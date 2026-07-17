import type { Point } from 'placement/point'
import {
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  inject,
  onBeforeUnmount,
  provide,
  shallowRef,
  toValue,
  watch,
} from 'vue'
import { useChildIndex, useIndexParent } from './useChildIndex.ts'

const POINTS = Symbol.for('placement/points') as InjectionKey<Ref<ReadonlyArray<Point>>>

export function usePointList(): Readonly<Ref<ReadonlyArray<Point>>> {
  const length = useIndexParent()

  const points = shallowRef<ReadonlyArray<Point>>([])

  provide(POINTS, points)

  watch(length, (length) => {
    if (length < points.value.length) {
      points.value = points.value.slice(0, length)
    }
  })

  return points
}

export function usePoint(input: MaybeRefOrGetter<Point>) {
  const index = useChildIndex()

  const points = inject(POINTS)

  if (points === undefined) {
    throw new Error('no point parent')
  }

  watch(
    index,
    (current, previous) => {
      const point = toValue(input)

      if (previous === undefined || previous === -1) {
        points.value = points.value.toSpliced(current, 0, point)
      } else if (current === -1) {
        points.value = points.value.toSpliced(previous, 1)
      } else {
        points.value = points.value.with(current, point)
      }
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    () => toValue(input),
    (point) => {
      if (index.value === -1) {
        return
      }

      points.value =
        index.value >= points.value.length
          ? points.value.concat(point)
          : points.value.with(index.value, point)
    },
    { immediate: true },
  )

  // Drop this point while its index is still valid. The index storage is
  // cleaned up in onUnmounted, after this component's watchers are stopped,
  // so the index watcher above cannot perform the removal itself.
  onBeforeUnmount(() => {
    const at = index.value
    if (at !== -1 && at < points.value.length) {
      points.value = points.value.toSpliced(at, 1)
    }
  })
}
