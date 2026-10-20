import type * as Sizing from '../sizing.ts'
import type { FieldTable } from './fields.ts'

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

// What each sizing field holds: the width fields resolve a percentage
// against the basis width (`x`), the height fields against its height
// (`y`), and `aspectRatio` is a ratio.
export const fields = {
  width: 'x',
  height: 'y',
  aspectRatio: 'ratio',
  minWidth: 'x',
  minHeight: 'y',
  maxWidth: 'x',
  maxHeight: 'y',
} as const satisfies FieldTable<Sizing.SizingInput>
