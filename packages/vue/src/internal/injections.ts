import type { Frame } from 'placement'
import type { Rect } from 'placement/Rect'
import type { InjectionKey, Ref } from 'vue'

export const ParentFrameSymbol = Symbol('ParentFrame') as InjectionKey<Frame>
export const ParentRectSymbol = Symbol('ParentFrame') as InjectionKey<
  Ref<Readonly<Rect>>
>
export const RootRectSymbol = Symbol('RootFrame') as InjectionKey<
  Ref<Readonly<Rect>>
>
