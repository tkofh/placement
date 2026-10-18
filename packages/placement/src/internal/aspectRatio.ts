import * as AspectRatio from '../aspectRatio.ts'

// The stored form of a ratio field in `Box` and `Frame`: a number, an
// `AspectRatio` whose denominator is not `1`, or `undefined` when unset. A
// ratio over `1` is stored as its numerator, which derives exactly the same
// extents.
export type RawAspectRatio = number | AspectRatio.AspectRatio | undefined

interface AspectRatioRecord {
  readonly numerator: number | null
  readonly denominator: number | null
}

// It also reads back what `JSON.stringify` writes: `null` for an unset or
// non-finite number, and a `{ numerator, denominator }` record for a ratio.
export const toRawRatio = (
  input: AspectRatio.AspectRatioInput | null | undefined,
): RawAspectRatio => {
  if (input == null) {
    return undefined
  }
  if (typeof input === 'number') {
    return input
  }
  const ratio = AspectRatio.isAspectRatio(input)
    ? input
    : AspectRatio.make(
        (input as AspectRatioRecord).numerator ?? Number.NaN,
        (input as AspectRatioRecord).denominator ?? Number.NaN,
      )
  return ratio.denominator === 1 ? ratio.numerator : ratio
}
