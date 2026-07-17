// The flexbox container module: `make` builds the container
// specification, `direction` and `wrap` name its numeric encodings, and
// `apply` solves a list of `Frame` items into `Rect`s inside a parent
// rect. Doc blocks live on the declarations in `internal/flexbox.ts`.
export { apply, direction, isFlexbox, make, wrap } from './internal/flexbox.ts'
export type { FlexDirection, Flexbox, FlexboxInput, FlexWrap } from './internal/flexbox.ts'
