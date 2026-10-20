import type { Field, FieldTable } from './internal/fields.ts'
import { auto } from './utils/arguments.ts'

export type { Field, FieldTable }

/**
 * The inherit sentinel, `Number.POSITIVE_INFINITY`. An alignment field
 * that is omitted or non-finite takes its parent layout's default (see
 * `resolve`).
 */
export const inherit: number = Number.POSITIVE_INFINITY

/**
 * The self-alignment of an item on one axis that its layout names, as CSS
 * `align-self` is in flex: the cross axis of a flex line, the thickness of
 * a hierarchy rank, or the side of an edge an adornment sits on. A layout
 * that names no axis reads `Align2dInput` instead.
 *
 * Every field is optional, and passing `undefined` is the same as omitting
 * it. An omitted or non-finite field inherits the layout's default.
 */
export interface AlignInput {
  /**
   * Where the item sits in the free space on the axis, as a fraction: `0`
   * at the start, `0.5` centered, `1` at the end. Defaults to `inherit`.
   */
  readonly align?: number | undefined
  /**
   * How much of the free space on the axis the item absorbs into its size,
   * as a fraction: `0` keeps its size, `1` fills the space, within its
   * min/max bounds. Defaults to `inherit`.
   */
  readonly stretch?: number | undefined
}

/**
 * The self-alignment of an item on both physical axes, for a layout that
 * names no axis of its own, such as `Box.apply`. CSS splits it into
 * `justify-self` (x) and `align-self` (y).
 *
 * Every field is optional, and passing `undefined` is the same as omitting
 * it. An omitted or non-finite field inherits the layout's default.
 */
export interface Align2dInput {
  /**
   * Where the item sits in the free space across x, as a fraction: `0` at
   * the left, `0.5` centered, `1` at the right. Defaults to `inherit`.
   */
  readonly alignX?: number | undefined
  /**
   * Where the item sits in the free space across y, as a fraction: `0` at
   * the top, `0.5` centered, `1` at the bottom. Defaults to `inherit`.
   */
  readonly alignY?: number | undefined
  /**
   * How much of the free space across x the item absorbs into its width,
   * as a fraction: `0` keeps its width, `1` fills the space, within its
   * min/max bounds. Defaults to `inherit`.
   */
  readonly stretchX?: number | undefined
  /**
   * How much of the free space across y the item absorbs into its height,
   * as a fraction: `0` keeps its height, `1` fills the space, within its
   * min/max bounds. Defaults to `inherit`.
   */
  readonly stretchY?: number | undefined
}

/**
 * The field table of `AlignInput`: both fields are plain numbers.
 *
 * @example
 * ```ts
 * Alignment.fields.stretch // 'number'
 * ```
 */
export const fields = {
  align: 'number',
  stretch: 'number',
} as const satisfies FieldTable<AlignInput>

/**
 * The field table of `Align2dInput`: every field is a plain number.
 *
 * @example
 * ```ts
 * Alignment.fields2d.alignY // 'number'
 * ```
 */
export const fields2d = {
  alignX: 'number',
  alignY: 'number',
  stretchX: 'number',
  stretchY: 'number',
} as const satisfies FieldTable<Align2dInput>

/** A resolved alignment on one axis: both fractions finite. */
export interface Alignment {
  /** Where the item sits in the free space, as a fraction. */
  readonly align: number
  /** How much of the free space the item absorbs, as a fraction. */
  readonly stretch: number
}

/**
 * The x axis of a two-axis alignment, as the one-axis fields that
 * `resolve` reads.
 *
 * @param input - The two-axis alignment.
 * @returns The alignment across x.
 * @example
 * ```ts
 * Alignment.x({ alignX: 1, stretchY: 1 }) // { align: 1, stretch: undefined }
 * ```
 */
export function x(input: Align2dInput): AlignInput {
  return { align: input.alignX, stretch: input.stretchX }
}

/**
 * The y axis of a two-axis alignment, as the one-axis fields that
 * `resolve` reads.
 *
 * @param input - The two-axis alignment.
 * @returns The alignment across y.
 * @example
 * ```ts
 * Alignment.y({ alignX: 1, stretchY: 1 }) // { align: undefined, stretch: 1 }
 * ```
 */
export function y(input: Align2dInput): AlignInput {
  return { align: input.alignY, stretch: input.stretchY }
}

/**
 * An item's alignment on one axis, with each inherited field taken from
 * its layout's default. A field inherits when it is omitted or non-finite.
 * A default that is itself omitted or non-finite resolves to `0`, so the
 * result is always finite.
 *
 * Every layout resolves alignment through this function: one-axis layouts
 * on an `AlignInput`, and two-axis layouts on each of `x` and `y`.
 *
 * @param item - The item's alignment on the axis.
 * @param defaults - The layout's default alignment on the axis.
 * @returns The finite alignment on the axis.
 * @example
 * ```ts
 * Alignment.resolve({ align: 1 }, { align: 0.5, stretch: 1 }) // { align: 1, stretch: 1 }
 * Alignment.resolve(Alignment.y({ alignY: Alignment.inherit }), { align: 0.5 })
 * // { align: 0.5, stretch: 0 }
 * ```
 */
export function resolve(item: AlignInput, defaults: AlignInput): Alignment {
  return {
    align: auto(item.align ?? inherit, defaults.align ?? inherit, 0),
    stretch: auto(item.stretch ?? inherit, defaults.stretch ?? inherit, 0),
  }
}
