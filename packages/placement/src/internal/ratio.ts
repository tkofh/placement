// The derivations behind `AspectRatio.heightFor` and `widthFor`, without
// the dual dispatch, for the sizing code that runs on every construction.
// A ratio is a number (`width / height`) or a numerator over a denominator.

export interface RatioParts {
  readonly numerator: number
  readonly denominator: number
}

export const heightOf = (ratio: number | RatioParts, width: number): number =>
  typeof ratio === 'number' ? width / ratio : (width * ratio.denominator) / ratio.numerator

export const widthOf = (ratio: number | RatioParts, height: number): number =>
  typeof ratio === 'number' ? height * ratio : (height * ratio.numerator) / ratio.denominator

export const valueOf = (ratio: number | RatioParts): number =>
  typeof ratio === 'number' ? ratio : ratio.numerator / ratio.denominator
