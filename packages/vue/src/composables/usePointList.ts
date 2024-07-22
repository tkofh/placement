import type { Point } from 'placement/point'
import {
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  inject,
  provide,
  ref,
  toValue,
  watch,
} from 'vue'
import { useIndexParent } from './useChildIndex'

const POINTS: InjectionKey<Ref<Array<Point>>> = Symbol()

export function usePointList(): Readonly<Ref<ReadonlyArray<Point>>> {
  const length = useIndexParent()

  const points = ref<Array<Point>>([])

  // biome-ignore lint/suspicious/noExplicitAny: vue ref type mapping is dumb sometimes
  provide(POINTS, points as any)

  watch(length, (length) => {
    points.value.length = length
  })

  // biome-ignore lint/suspicious/noExplicitAny: vue ref type mapping is dumb sometimes
  return points as any
}

export function usePoint(input: MaybeRefOrGetter<Point>) {
  const index = useIndexParent()

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
      points.value =
        index.value >= points.value.length
          ? points.value.concat(point)
          : points.value.with(index.value, point)
    },
    { immediate: true },
  )
}
