// Function-plumbing helpers used throughout this package, re-exported so
// consumers need no direct dependency on `curvy`:
//
// - `pipe` (from `curvy/utils`) applies a value through a sequence of
//   functions left to right.
// - `flow` (from `curvy/utils`) composes functions left to right without
//   applying them.
// - `dual` (from `curvy/utils`) builds the data-first/data-last
//   dual-signature functions this package's operations are made of.
// - `auto` (from this package) returns the first finite number among its
//   arguments, or the last argument when none is finite — the resolver
//   behind the `Infinity`-as-auto sentinel convention.
export { dual, flow, pipe } from 'curvy/utils'
export { auto } from './utils/arguments.ts'
