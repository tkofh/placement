import type { LengthInput } from './length.ts'

/**
 * The margin inputs of an item: the space it reserves outside itself on
 * each side, as CSS `margin` does. `Frame` and `Adornment` take these
 * fields, and the layouts that place them read the margins.
 *
 * Every field is optional, and passing `undefined` is the same as omitting
 * it. An omitted margin is `0`. A non-finite margin is auto: a layout that
 * supports auto margins gives the side an equal share of the free space on
 * its axis.
 *
 * The type parameter `L` is the type of the length fields. Specs take
 * numbers, the default. A layer that knows the basis of a percentage can
 * take `MarginInput<LengthInput>` (see `placement/length`) and resolve its
 * lengths before it builds a spec.
 */
export interface MarginInput<L extends LengthInput = number> {
  /**
   * The space reserved above the item. A non-finite value requests an auto
   * margin. Defaults to `0`.
   */
  readonly marginTop?: L | undefined
  /**
   * The space reserved to the right of the item. A non-finite value
   * requests an auto margin. Defaults to `0`.
   */
  readonly marginRight?: L | undefined
  /**
   * The space reserved below the item. A non-finite value requests an auto
   * margin. Defaults to `0`.
   */
  readonly marginBottom?: L | undefined
  /**
   * The space reserved to the left of the item. A non-finite value
   * requests an auto margin. Defaults to `0`.
   */
  readonly marginLeft?: L | undefined
}

/** The four margins of an item, with omitted ones `0`. A non-finite margin is auto. */
export interface Margin {
  /** The top margin. */
  readonly marginTop: number
  /** The right margin. */
  readonly marginRight: number
  /** The bottom margin. */
  readonly marginBottom: number
  /** The left margin. */
  readonly marginLeft: number
}

/**
 * The margins that `MarginInput` describes, with each omitted one `0`.
 * Non-finite margins stay as given: they are auto.
 *
 * @param input - The margin inputs.
 * @returns The four margins.
 * @example
 * ```ts
 * Margin.normalize({ marginLeft: 8 }) // { marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 8 }
 * ```
 */
export function normalize(input: MarginInput): Margin {
  return {
    marginTop: input.marginTop ?? 0,
    marginRight: input.marginRight ?? 0,
    marginBottom: input.marginBottom ?? 0,
    marginLeft: input.marginLeft ?? 0,
  }
}
