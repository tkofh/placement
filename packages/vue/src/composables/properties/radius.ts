import type { Input } from 'placement/property'
import type { ReadonlyRect } from 'placement/rect'
import { type MaybeRefOrGetter, type ShallowRef, computed, toValue } from 'vue'
import { useProperty } from '../useProperty'

const radius = {
  length: true,
  percentage: 'width',
} as const

export type RadiusInput = Input<RadiusX>

export function useRadius(
  value: MaybeRefOrGetter<RadiusXInput>,
  parent: MaybeRefOrGetter<ReadonlyRect>,
  root: MaybeRefOrGetter<ReadonlyRect> = parent,
): Readonly<ShallowRef<number>> {
  return useProperty(radius, value, parent, root)
}

const radiusX = {
  length: true,
  percentage: 'width',
} as const

type RadiusX = typeof radiusX

export type RadiusXInput = Input<RadiusX>

export function useRadiusX(
  value: MaybeRefOrGetter<RadiusXInput | undefined>,
  fallback: MaybeRefOrGetter<RadiusInput | undefined>,
  parent: MaybeRefOrGetter<ReadonlyRect>,
  root: MaybeRefOrGetter<ReadonlyRect> = parent,
): Readonly<ShallowRef<number>> {
  const rx = useProperty(radiusX, () => toValue(value) ?? 0, parent, root)
  const r = useProperty(radius, () => toValue(fallback) ?? 0, parent, root)

  return computed(() => (toValue(value) != null ? rx.value : r.value))
}

const radiusY = {
  length: true,
  percentage: 'height',
} as const

type RadiusY = typeof radiusY

export type RadiusYInput = Input<RadiusY>

export function useRadiusY(
  value: MaybeRefOrGetter<RadiusYInput | undefined>,
  fallback: MaybeRefOrGetter<RadiusInput | undefined>,
  parent: MaybeRefOrGetter<ReadonlyRect>,
  root: MaybeRefOrGetter<ReadonlyRect> = parent,
): Readonly<ShallowRef<number>> {
  const ry = useProperty(radiusY, () => toValue(value) ?? 0, parent, root)
  const r = useProperty(radius, () => toValue(fallback) ?? 0, parent, root)

  return computed(() => (toValue(value) != null ? ry.value : r.value))
}
