import type * as Polygon from 'placement/polygon'
import {
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  toValue,
  watchEffect,
} from 'vue'

// A node's outline comes from the graphics drawn in it. A graphic that
// fills its parent registers the polygon it draws with the nearest outline
// collector, and a node uses the first one registered. A component that
// gives its children a box of their own blocks the graphics below it,
// whose box is no longer the node's.

type Register = (polygon: MaybeRefOrGetter<Polygon.Polygon | undefined>) => void

const OUTLINE: InjectionKey<Register | null> = Symbol.for('placement/outline')

/**
 * Collects the outlines that graphics filling this component register, and
 * returns the first one.
 *
 * @returns The outline of the first registered graphic that has one, or
 * `undefined`.
 */
export function useOutlineCollector(): Readonly<Ref<Polygon.Polygon | undefined>> {
  const registered = shallowRef<ReadonlyArray<MaybeRefOrGetter<Polygon.Polygon | undefined>>>([])
  provide(OUTLINE, (polygon) => {
    registered.value = [...registered.value, polygon]
    onScopeDispose(() => {
      registered.value = registered.value.filter((entry) => entry !== polygon)
    })
  })
  // An effect rather than a computed. With Vue 3.5, a computed here kept a
  // graphic's first polygon after the graphic's props changed, while an
  // effect reading the same values saw each change (see the hierarchy
  // component tests).
  const outline = shallowRef<Polygon.Polygon | undefined>(undefined)
  watchEffect(() => {
    let first: Polygon.Polygon | undefined
    for (const entry of registered.value) {
      first = toValue(entry)
      if (first !== undefined) {
        break
      }
    }
    outline.value = first
  })
  return outline
}

/** Keeps the graphics below this component from registering outlines above it. */
export function blockOutlines(): void {
  provide(OUTLINE, null)
}

/**
 * Registers the outline a graphic draws with the nearest collector. The
 * graphic passes `undefined` while it does not fill its parent (see
 * `fillsParent`).
 *
 * @param polygon - The polygon the graphic draws, which fills its parent.
 */
export function useOutline(polygon: MaybeRefOrGetter<Polygon.Polygon | undefined>): void {
  inject(OUTLINE, null)?.(polygon)
}
