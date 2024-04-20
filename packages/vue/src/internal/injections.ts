import type { Frame } from 'placement'
import type { ReadonlyRect } from 'placement/Box'
import type { InjectionKey, Ref } from 'vue'

export const ParentFrameSymbol = Symbol('ParentFrame') as InjectionKey<Frame>
export const ParentRectSymbol = Symbol('ParentFrame') as InjectionKey<
  Ref<Readonly<ReadonlyRect>>
>
export const RootRectSymbol = Symbol('RootFrame') as InjectionKey<
  Ref<Readonly<ReadonlyRect>>
>
