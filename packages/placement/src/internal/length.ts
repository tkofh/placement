import * as Length from '../length.ts'

// The stored form of a length field in `Box` and `Frame`: a number, a
// percentage still waiting for its basis, or `undefined` when unset. A
// `'px'` length is stored as its number, so a percentage is the only
// `Length` that a spec keeps.
export type RawLength = number | Length.Length | undefined

// Set at construction on `Box` and `Frame`: whether any length field is a
// percentage. Layouts read it to skip `resolve` without scanning the fields.
export const HasPercent: unique symbol = Symbol('placement/length/hasPercent')

export const anyPercent = <K extends string>(
  raw: { readonly [F in K]: RawLength },
  fields: ReadonlyArray<K>,
): boolean => {
  for (const field of fields) {
    if (Length.isLength(raw[field])) {
      return true
    }
  }
  return false
}

// It also reads back what `JSON.stringify` writes: `null` for unset or
// non-finite numbers, and a `{ value, unit }` record for a `Length`.
export const toRaw = (input: Length.LengthInput | null | undefined): RawLength => {
  if (input == null) {
    return undefined
  }
  if (typeof input === 'number') {
    return input
  }
  const length = Length.isLength(input)
    ? input
    : Length.make((input as LengthRecord).value ?? Number.NaN, (input as LengthRecord).unit)
  return length.unit === 'px' ? length.value : length
}

interface LengthRecord {
  readonly value: number | null
  readonly unit: Length.Unit
}

// The value of a field before its basis is known. A percentage reads as
// unset, as a CSS percentage does against an indefinite basis.
export const absolute = (raw: RawLength): number | undefined =>
  Length.isLength(raw) ? undefined : raw

export const resolveRaw = (raw: RawLength, basis: number): number | undefined =>
  raw === undefined ? undefined : Length.resolve(raw, basis)
