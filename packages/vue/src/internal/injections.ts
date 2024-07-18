import type { Rect } from 'placement/rect'
import type { InjectionKey, MaybeRefOrGetter } from 'vue'

export const ROOT_RECT = Symbol('placement/vue/root-rect') as InjectionKey<
  MaybeRefOrGetter<Rect>
>
export const PARENT_RECT = Symbol('placement/vue/parent-rect') as InjectionKey<
  MaybeRefOrGetter<Rect>
>
