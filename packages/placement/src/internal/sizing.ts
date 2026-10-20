import type * as Sizing from '../sizing.ts'

// The key under which a spec keeps its normalized sizing (see `normalize`
// in `placement/sizing`), so that the layouts can resolve an item's sizing
// again with what they supply. It is a symbol, not a `#private` field, so
// that reads still work through a `Proxy` (Vue's `ref`/`reactive`).
export const SizingOf: unique symbol = Symbol('placement/sizing')

/** A spec that keeps its normalized sizing under `SizingOf`. */
export interface Sized {
  readonly [SizingOf]: Sizing.Sizing
}
