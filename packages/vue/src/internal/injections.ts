import type { Frame } from 'placement'
import type { ReadonlyRect } from 'placement/rect'
import type { InjectionKey, Ref } from 'vue'

export const ParentFrameSymbol = Symbol(
  'ParentFrame',
) as InjectionKey<Frame | null>
export const ParentRectSymbol = Symbol('ParentFrame') as InjectionKey<
  Ref<Readonly<ReadonlyRect>>
>
export const RootRectSymbol = Symbol('RootFrame') as InjectionKey<
  Ref<Readonly<ReadonlyRect>>
>
