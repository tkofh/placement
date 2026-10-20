// The vocabulary of the field tables that each input concept exports
// (`fields` in `placement/sizing`, for one). A table names what each field
// of an input is, so that code which checks and resolves inputs, such as a
// prop layer, can stay generic over the concepts a layout composes.

/**
 * What an input field holds:
 *
 * - `x`: a length whose percentage resolves against the basis width.
 * - `y`: a length whose percentage resolves against the basis height.
 * - `ratio`: an aspect ratio (see `placement/aspectRatio`).
 * - `number`: a plain number.
 */
export type Field = 'x' | 'y' | 'ratio' | 'number'

/** A field table for the input `I`: one `Field` for each of its fields. */
export type FieldTable<I> = { readonly [K in keyof I]-?: Field }
