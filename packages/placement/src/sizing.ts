import { clamp } from 'curvy/number'
import * as AspectRatio from './aspectRatio.ts'
import type { LengthInput } from './length.ts'

/**
 * The sizing inputs that every layout reads from its items: a preferred
 * size, its min/max bounds, and an aspect ratio. `Frame` and `Box` take
 * these fields, and `normalize` and `resolve` give them one meaning in
 * every layout.
 *
 * Every field is optional, and passing `undefined` is the same as omitting
 * it. An omitted or non-finite size is unset, and the layout supplies one
 * (see `resolve`).
 *
 * The type parameter `L` is the type of the length fields. Specs take
 * numbers, the default. A layer that knows the basis of a percentage can
 * take `SizingInput<LengthInput>` (see `placement/length`) and resolve its
 * lengths before it builds a spec.
 */
export interface SizingInput<L extends LengthInput = number> {
  /**
   * The preferred width. It is unset when omitted or non-finite. An unset
   * width derives from the height through `aspectRatio`, or takes the size
   * the layout supplies.
   */
  readonly width?: L | undefined
  /**
   * The preferred height. It is unset when omitted or non-finite. An unset
   * height derives from the width through `aspectRatio`, or takes the size
   * the layout supplies.
   */
  readonly height?: L | undefined
  /**
   * The width-to-height ratio, as a number (`width / height`) or a
   * `[width, height]` pair such as `[16, 9]` (see `placement/aspectRatio`).
   * It derives whichever of `width` and `height` nothing else sizes. A pair
   * derives it with one rounding. A ratio whose value is non-positive or
   * non-finite is unset, and so is an omitted one.
   */
  readonly aspectRatio?: AspectRatio.AspectRatio | undefined
  /**
   * The lower bound on the resolved width. Negative values clamp to `0`.
   * Defaults to `0`, and non-finite values act as unset.
   */
  readonly minWidth?: L | undefined
  /**
   * The lower bound on the resolved height. Negative values clamp to `0`.
   * Defaults to `0`, and non-finite values act as unset.
   */
  readonly minHeight?: L | undefined
  /**
   * The upper bound on the resolved width. Negative values clamp to `0`.
   * If the bounds cross, `minWidth` wins, as in CSS `clamp()`. Defaults to
   * `Infinity` (unconstrained), and non-finite values act as unset.
   */
  readonly maxWidth?: L | undefined
  /**
   * The upper bound on the resolved height. Negative values clamp to `0`.
   * If the bounds cross, `minHeight` wins, as in CSS `clamp()`. Defaults to
   * `Infinity` (unconstrained), and non-finite values act as unset.
   */
  readonly maxHeight?: L | undefined
}

/**
 * Sizing inputs in the form `resolve` reads, as `normalize` builds them.
 *
 * - `width` and `height` are the preferred sizes, `NaN` when unset.
 * - `aspectRatio` is the ratio as given, or `undefined` when unset.
 * - The bounds are never negative, and each maximum is at least its
 *   minimum.
 */
export interface Sizing {
  /** The preferred width, or `NaN` when unset. */
  readonly width: number
  /** The preferred height, or `NaN` when unset. */
  readonly height: number
  /** The width-to-height ratio as given, or `undefined` when unset. */
  readonly aspectRatio: AspectRatio.AspectRatio | undefined
  /** The lower bound on the width, at least `0`. */
  readonly minWidth: number
  /** The lower bound on the height, at least `0`. */
  readonly minHeight: number
  /** The upper bound on the width, at least `minWidth`. */
  readonly maxWidth: number
  /** The upper bound on the height, at least `minHeight`. */
  readonly maxHeight: number
}

/**
 * The sizing that `SizingInput` describes, in the form `resolve` reads.
 * Every non-finite size or bound is unset. An unset size is `NaN`, an unset
 * minimum is `0`, and an unset maximum is `Infinity`. Negative bounds clamp
 * to `0`, and a maximum below its minimum rises to it, so the minimum wins
 * as in CSS `clamp()`. A ratio whose value is non-positive or non-finite is
 * unset.
 *
 * @param input - The sizing inputs.
 * @returns The normalized sizing.
 * @example
 * ```ts
 * const sizing = Sizing.normalize({ width: 100, minHeight: 20, maxHeight: 10 })
 * sizing.height // NaN
 * sizing.maxHeight // 20
 * ```
 */
export function normalize(input: SizingInput): Sizing {
  const minWidth = bound(input.minWidth, 0)
  const minHeight = bound(input.minHeight, 0)
  const ratio = input.aspectRatio
  const value = ratio === undefined ? Number.NaN : AspectRatio.toNumber(ratio)
  return {
    width: finiteOrNaN(input.width),
    height: finiteOrNaN(input.height),
    aspectRatio: Number.isFinite(value) && value > 0 ? ratio : undefined,
    minWidth,
    minHeight,
    maxWidth: Math.max(bound(input.maxWidth, Number.POSITIVE_INFINITY), minWidth),
    maxHeight: Math.max(bound(input.maxHeight, Number.POSITIVE_INFINITY), minHeight),
  }
}

/**
 * What a layout knows about an item's axes when it resolves the item's
 * sizing: the size each axis takes when the item leaves it unset, and
 * whether the layout has fixed the axis.
 *
 * A layout fixes an axis when it decides the size itself, before the item
 * is sized: a stretch into space that is already known, or a pair of
 * insets. A fixed (definite) size overrides the item's own size on that
 * axis, and the ratio derives the other axis from it.
 */
export interface SizingContext {
  /** The width for an item that leaves it unset, or the fixed width when `definiteWidth` is `true`. */
  readonly width: number
  /** The height for an item that leaves it unset, or the fixed height when `definiteHeight` is `true`. */
  readonly height: number
  /** Whether the layout has fixed the width. Defaults to `false`. */
  readonly definiteWidth?: boolean | undefined
  /** Whether the layout has fixed the height. Defaults to `false`. */
  readonly definiteHeight?: boolean | undefined
}

/** A resolved width and height. */
export interface Size {
  /** The resolved width. */
  readonly width: number
  /** The resolved height. */
  readonly height: number
}

/**
 * The width and height of an item, from its sizing and its layout's
 * context. Each axis takes the first of these that applies:
 *
 * - the context's size, when the layout has fixed the axis,
 * - the item's preferred size,
 * - the other axis's size through `aspectRatio`, when the other axis has
 *   one of the two sizes above,
 * - the context's size.
 *
 * When neither axis has a fixed or preferred size and the ratio is set,
 * the ratio derives one axis from the other's context size, clamped. It
 * derives the height from the width, unless the clamped width is `0`, in
 * which case it derives the width from the height. A positive minimum on
 * one axis therefore drives the other.
 *
 * Every size clamps to its own bounds, after any derivation. The
 * arithmetic is exact IEEE 754 (see PRECISION.md).
 *
 * @param sizing - The item's sizing, as `normalize` builds it.
 * @param context - The size the layout gives each axis, and which axes it has fixed.
 * @returns The resolved width and height.
 * @example
 * ```ts
 * const sizing = Sizing.normalize({ height: 50, aspectRatio: 2 })
 * Sizing.resolve(sizing, { width: 0, height: 0 }) // { width: 100, height: 50 }
 * // A stretch fixes the height, and the ratio follows it.
 * Sizing.resolve(sizing, { width: 0, height: 80, definiteHeight: true }) // { width: 160, height: 80 }
 * ```
 */
export function resolve(sizing: Sizing, context: SizingContext): Size {
  const { aspectRatio, minWidth, minHeight, maxWidth, maxHeight } = sizing

  let width =
    context.definiteWidth === true
      ? clamp(context.width, minWidth, maxWidth)
      : Number.isNaN(sizing.width)
        ? Number.NaN
        : clamp(sizing.width, minWidth, maxWidth)
  let height =
    context.definiteHeight === true
      ? clamp(context.height, minHeight, maxHeight)
      : Number.isNaN(sizing.height)
        ? Number.NaN
        : clamp(sizing.height, minHeight, maxHeight)

  if (aspectRatio !== undefined) {
    if (Number.isNaN(width) && !Number.isNaN(height)) {
      width = clamp(AspectRatio.widthFor(aspectRatio, height), minWidth, maxWidth)
    } else if (Number.isNaN(height) && !Number.isNaN(width)) {
      height = clamp(AspectRatio.heightFor(aspectRatio, width), minHeight, maxHeight)
    } else if (Number.isNaN(width) && Number.isNaN(height)) {
      const fallbackWidth = clamp(context.width, minWidth, maxWidth)
      const fallbackHeight = clamp(context.height, minHeight, maxHeight)
      // `clamp` returns `0` itself when nothing raises the width, so the
      // raw comparison is an identity check (see PRECISION.md).
      if (fallbackWidth === 0) {
        height = fallbackHeight
        width = clamp(AspectRatio.widthFor(aspectRatio, height), minWidth, maxWidth)
      } else {
        width = fallbackWidth
        height = clamp(AspectRatio.heightFor(aspectRatio, width), minHeight, maxHeight)
      }
    }
  }

  return {
    width: Number.isNaN(width) ? clamp(context.width, minWidth, maxWidth) : width,
    height: Number.isNaN(height) ? clamp(context.height, minHeight, maxHeight) : height,
  }
}

function finiteOrNaN(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : Number.NaN
}

function bound(value: number | undefined, unset: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(value, 0) : unset
}
