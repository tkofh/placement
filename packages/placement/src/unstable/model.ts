/**
 * A typed, live layout model. A tree of node specs (`group`, `flex`, `item`)
 * becomes a store with `store`. The store places every node, and `get` and
 * `subscribe` read a node's output by its path. `mutate` changes the model
 * through a draft of ops and returns the store typed for the result.
 *
 * A node's key is the string it was given, else its index among its
 * siblings when it was created. Its path joins the keys from the root with
 * dots. The checker knows every path of a model built from literal keys, so
 * a path that does not exist is a type error.
 *
 * Props take lengths where the specs they build take numbers. A
 * percentage (`Length.percent` from `placement/length`) resolves against
 * the node's basis: a box against its parent's rect, a flex's gutter and a
 * translation against the node's own placed rect, and an item's frame
 * against its flex container's content rect. It re-resolves whenever the
 * basis changes.
 *
 * This subpath is not covered by semver: an export can change or move in any
 * release.
 *
 * @module
 */
export { flex, group, isSpec, item } from '../internal/model/spec.ts'
export type { Constructor, Spec } from '../internal/model/spec.ts'
export { isStore, mutate, store } from '../internal/model/store.ts'
export type { Change, Draft, Store, StoreOptions } from '../internal/model/store.ts'
export type {
  Dynamic,
  FlexProps,
  GroupProps,
  GutterInput,
  Index,
  IndexOf,
  ItemProps,
  Kind,
  Kinds,
  OutputName,
  Outputs,
  Paths,
  RootKind,
  TranslateInput,
} from '../internal/model/types.ts'
