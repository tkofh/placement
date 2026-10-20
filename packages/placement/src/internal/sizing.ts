import type * as Sizing from '../sizing.ts'

// The keys under which a spec keeps its sizing. They are symbols, not
// `#private` fields, so that reads still work through a `Proxy` (Vue's
// `ref`/`reactive`).

// The normalized sizing (see `normalize` in `placement/sizing`), so that
// the layouts can resolve an item's sizing again with their own context.
export const SizingOf: unique symbol = Symbol('placement/sizing')

// The size an item resolves to on its own, with `0` for an unset axis,
// which a spec that reports a width and height resolves once at
// construction.
export const SizeOf: unique symbol = Symbol('placement/sizing/size')

// The sizing inputs as given, `undefined` when omitted, so that unset
// fields survive setter round trips.
export type RawSizing = { readonly [K in keyof Sizing.SizingInput]-?: Sizing.SizingInput[K] }
