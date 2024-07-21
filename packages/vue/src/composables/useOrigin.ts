import { type Point, isPoint, point } from 'placement/point'
import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { type OriginInput, parseOrigin } from '../internal/props/origin'

export function useOrigin(
  input: MaybeRefOrGetter<OriginInput | Point | number | undefined>,
) {
  return computed(() => {
    const origin = toValue(input)
    return origin == null
      ? point(0)
      : isPoint(origin)
        ? origin
        : typeof origin === 'number'
          ? point(origin)
          : parseOrigin(origin)
  })
}
