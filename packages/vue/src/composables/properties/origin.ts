import type { Input } from 'placement/property'
import type { ReadonlyRect } from 'placement/rect'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import { useProperty } from '../useProperty'

const originX = {
  length: true,
  percentage: 'width',
} as const

type OriginX = typeof originX

export type OriginXInput = Input<OriginX>

export function useOriginX(
  value: MaybeRefOrGetter<OriginXInput>,
  parent: MaybeRefOrGetter<ReadonlyRect>,
  root: MaybeRefOrGetter<ReadonlyRect> = parent,
): Readonly<ShallowRef<number>> {
  return useProperty(originX, value, parent, root)
}

const originY = {
  length: true,
  percentage: 'height',
} as const

type OriginY = typeof originY

export type OriginYInput = Input<OriginY>

export function useOriginY(
  value: MaybeRefOrGetter<OriginYInput>,
  parent: MaybeRefOrGetter<ReadonlyRect>,
  root: MaybeRefOrGetter<ReadonlyRect> = parent,
): Readonly<ShallowRef<number>> {
  return useProperty(originY, value, parent, root)
}
