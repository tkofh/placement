import type * as AspectRatio from '../aspectRatio.ts'

// The stored form of a ratio field in `Box` and `Frame`: a number, a pair
// whose height is not `1`, or `undefined` when unset. A pair over `1` is
// stored as its width, which derives exactly the same extents.
export type RawAspectRatio = AspectRatio.AspectRatio | undefined

type AspectRatioJSON = number | readonly [number | null, number | null] | null | undefined

// The pair is copied, so the spec does not share an array (or a reactive
// proxy of one) with its caller. It also reads back what `JSON.stringify`
// writes: `null` for an unset ratio or a non-finite part.
export const toRawRatio = (input: AspectRatio.AspectRatio | null | undefined): RawAspectRatio => {
  const json = input as AspectRatioJSON
  if (json == null) {
    return undefined
  }
  if (typeof json === 'number') {
    return json
  }
  const width = json[0] ?? Number.NaN
  const height = json[1] ?? Number.NaN
  return height === 1 ? width : [width, height]
}
