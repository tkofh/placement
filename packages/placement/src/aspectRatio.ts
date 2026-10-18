/**
 * A width-to-height ratio: a number (`width / height`), or a
 * `[width, height]` pair such as `[16, 9]`, which is CSS `16 / 9`.
 * `Box.make`, `Frame.make`, and the ratio ops of `Dimensions` take this
 * type.
 *
 * A pair derives an extent with one rounding, where a number takes two.
 * The number `16 / 9` is rounded once when it is divided, and every extent
 * derived from it rounds again: a height of `7` derives a width of
 * `12.444444444444443`. The pair derives `7 * 16 / 9`, where the product is
 * exact, so the division rounds once to the correctly rounded
 * `12.444444444444445`. A number `n` behaves exactly as `[n, 1]`.
 */
export type AspectRatio = number | readonly [width: number, height: number]

/**
 * Returns a ratio as one number, `width / height`, by exact IEEE division.
 * A number comes back as it is. A pair with a zero height gives `Infinity`
 * (or `NaN` with a zero width too).
 *
 * @param ratio - The ratio.
 * @returns The ratio as a number.
 * @example
 * ```ts
 * AspectRatio.toNumber([3, 2]) // 1.5
 * AspectRatio.toNumber(1.5) // 1.5
 * ```
 */
export const toNumber = (ratio: AspectRatio): number =>
  typeof ratio === 'number' ? ratio : ratio[0] / ratio[1]

/**
 * Derives the height that a width has at a ratio: `width * h / w` for a
 * `[w, h]` pair, or `width / ratio` for a number. Each form rounds once, so
 * a pair whose quotient a number cannot represent exactly (`[16, 9]`) still
 * derives a correctly rounded height from an integer width. The product can
 * overflow to `Infinity` where the quotient form would not, but only for
 * extents and ratio parts near `1e308`.
 *
 * @param ratio - The ratio.
 * @param width - The width to derive from.
 * @returns The height that gives `width` this ratio.
 * @example
 * ```ts
 * AspectRatio.heightFor([16, 9], 160) // 90
 * AspectRatio.heightFor(2, 100) // 50
 * ```
 */
export const heightFor = (ratio: AspectRatio, width: number): number =>
  typeof ratio === 'number' ? width / ratio : (width * ratio[1]) / ratio[0]

/**
 * Derives the width that a height has at a ratio: `height * w / h` for a
 * `[w, h]` pair, or `height * ratio` for a number. Each form rounds once,
 * as in `heightFor`.
 *
 * @param ratio - The ratio.
 * @param height - The height to derive from.
 * @returns The width that gives `height` this ratio.
 * @example
 * ```ts
 * AspectRatio.widthFor([16, 9], 7) // 12.444444444444445
 * AspectRatio.widthFor(2, 50) // 100
 * ```
 */
export const widthFor = (ratio: AspectRatio, height: number): number =>
  typeof ratio === 'number' ? height * ratio : (height * ratio[0]) / ratio[1]
