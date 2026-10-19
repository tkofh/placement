# Placement Model module

Oct 18, 2026 · @tim

Build `placement/unstable/model` as a tree of node specs that `Model.store` turns into a typed store and `Model.mutate` changes, backed internally by alien-signals. The checker knows every path in a model, so `get` and `subscribe` reject a node that does not exist. The vue layer then becomes an adapter: `useChildren` keeps producing ordered child arrays and the model does all the layout.

## What the model must reproduce

Today's vue layer has two protocols. Boxes inherit their parent's rect through injected computeds, and containers collect ordered children through `useChildren` and solve them all at once.

&#91;embedded content: dependency directions in today's vue tree\]

Dependencies run three ways. Hierarchy bounds also flow up into the layout's own size, which is safe only because its percent basis is the layout's parent. Vue's lazy computeds discover all of this today, so the model needs an engine that does the same.

## Store engine

Use alien-signals, kept internal. A custom dirty-flag store would need a fixed pass order per layout type: boxes top-down, flex solves, hierarchy shapes and bounds up then rects down, connectors after their subtree. Every new layout type would mean hand-wiring its dependencies into that scheduler. Signals discover them, and they make re-solving only dirty containers free.

| Option                                                       | Version              | Size (min+gz)                   | Custom equality                                                                 | Fit for per-node derived rects                                                                          |
| ------------------------------------------------------------ | -------------------- | ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [alien-signals](https://github.com/stackblitz/alien-signals) | 3.2.1                | 1.7 KB (signal/computed/effect) | No option, but the computed getter receives `prev`, so return `prev` when equal | Best. Glitch-free push-pull, no deps, same author as vue's reactivity; vue 3.6 (RC) ports its algorithm |
| [@preact/signals-core](https://github.com/preactjs/signals)  | 1.14.4               | 1.95 KB                         | No; getter gets no `prev`, keep it in a closure                                 | Good. Collects unwatched computeds, which alien does not                                                |
| [@tanstack/store](https://tanstack.com/store)                | 0.11.2               | 2.1 KB                          | Yes, per-atom `compare`                                                         | Good, alien underneath, but 0.x with API churn                                                          |
| [@vue/reactivity](https://github.com/vuejs/core)             | 3.5.44 / 3.6.0-rc.12 | 5.8–7.9 KB                      | `prev` arg, `customRef`                                                         | Can't be a core dependency                                                                              |
| [nanostores](https://github.com/nanostores/nanostores)       | 1.5.5                | 1.0 KB                          | No                                                                              | Explicit deps, no auto-tracking                                                                         |
| zustand / valtio                                             | 5.0.15 / 2.3.2       | 0.3 / 1.6 KB                    | Selector equality / n/a                                                         | Poor: no derived graph, every listener runs per mutation                                                |
| Custom dirty flags                                           | —                    | —                               | Whatever we write                                                               | Hand-wired evaluation order per layout type                                                             |

The [TC39 signals proposal](https://github.com/tc39/proposal-signals) is still stage 1, and [signal-polyfill](https://github.com/proposal-signals/signal-polyfill) says not to use it in production. `alien-signals/system` (`createReactiveSystem`, 0.8 KB) would allow custom node types with an `equals` option, but the `prev` trick already covers that. Keep signals out of the public API so the engine can be swapped without a breaking change.

## alien-signals gotchas

Each one is tested against 3.2.1, and each has a fixed answer in the design.

| Gotcha                                  | What happens                                                                                       | Design answer                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Equality is `!==` only                  | A container solve returns a fresh `Rect[]`, so every child would notify                            | One computed per child that returns `prev` when the rect is equal        |
| Effects run inside the setter           | Two writes give two effect runs                                                                    | `mutate` wraps all writes in `startBatch`/`endBatch`                     |
| Computeds stay linked to their sources  | A dropped computed is never collected (0 of 1000 in the test); the parent's solve keeps walking it | The store owns node lifetimes and unlinks a node's computeds on `remove` |
| An effect's return value is its cleanup | `effect(() => arr.push(x))` crashes on the next run                                                | Block-bodied effects only                                                |
| No scheduler or error hooks             | Effects can't be deferred to a microtask                                                           | Not needed: subscribers fire once at the end of each `mutate`            |

## Public API

A spec is plain immutable data. `Model.store` turns it into a live store, which is the compiled form, with no separate compile step. `Model.store` is a pure function of the spec and options. `Model.mutate` applies a batch of **ops** (`update`, `insert`, `remove`, `setChildren`) to a store and returns the store typed for the model after them. Every node has a path, because `get` and `subscribe` address nodes by path. A flex's output is its content rect, its placed rect contracted by its gutter, as `FlexLayout` exposes it today.

```ts
import * as Model from 'placement/unstable/model'

const spec = Model.flex('toolbar', { layout: Flexbox.make({ columnGap: 8 }) }, [
  Model.item({ frame: Frame.make({ width: 100 }) }),
  Model.item('b', { frame: Frame.make({ grow: 1 }) }),
])

const store = Model.store(spec, { root: Rect.make(800, 600) })
// paths: 'toolbar' | 'toolbar.0' | 'toolbar.b'

store.get('toolbar.b') // Rect
const off = store.subscribe('toolbar.b', (next, prev) => {})
store.subscribe((changes) => {}) // once per mutate: Map<path, { prev, next }>
store.subscribe('b', () => {}) // type error: no node at 'b'

const next = Model.mutate(store, (m) =>
  m
    .update('toolbar.b', { frame: Frame.make({ grow: 2 }) })
    .insert('toolbar', Model.item('c', { frame: Frame.make({ width: 40 }) }), {
      before: 'toolbar.b',
    })
    .remove('toolbar.0')
    .setChildren('toolbar', ['toolbar.c', 'toolbar.b']),
)

next.get('toolbar.c') // Rect
next.get('toolbar.0') // type error: removed
```

### Paths

A node's **key** is the string it was given, else its index among all its siblings, keyed or not, when it was created. Its **path** joins the keys from the root with dots, and the path is the node's id. Siblings need distinct keys and cousins may share one, so two flex containers can each hold an `'a'`. A root without a key gets the key `'root'`.

A positional key is fixed when its node is created. Reordering keeps it, so `'toolbar.1'` can sit at index 0. Subscriptions follow a node by path, and renumbering would move them to other nodes. `insert` requires an explicit key, because an inserted node has no position in a spec to take one from. A key may contain no dot and may not start with a digit, so an explicit key never collides with a positional one.

Hierarchy edges name their endpoints by sibling key (`source: 'n1'`), and connector edges by path relative to the connector (`'toolbar.b'` names `'app.toolbar.b'` under a connector at `'app'`), so a subtree spec reads the same wherever it is mounted.

### Store and mutate

The store is a typed view of one signal graph, its **runtime**. `Model.mutate` applies its ops to the runtime and returns the same object, retyped. Subscriptions belong to the runtime, so they survive every `mutate` and nothing re-wires them. TypeScript cannot retype a variable, so each typed step binds a new name: `const next = Model.mutate(store, ...)`. `mutate` has no data-last form, because a draft built before it meets the store cannot know the store's type.

An old binding still works after `mutate`, but its type can name a removed path. The runtime checks every path, so that read throws a `RangeError` instead of returning stale data.

The callback receives a **draft**, an immutable list of ops. Each op returns a new draft, and `mutate` applies the list that the callback returns. The callback has to return it, because a callback that returns `void` cannot change the store's type. An op whose result is dropped (`m.remove('a'); return m`) applies nowhere and leaves the index unchanged, so the types still match the runtime. `mutate` validates every op before it writes a signal, so a bad runtime path throws with no partial write. It then applies the list inside one `startBatch`/`endBatch`.

A spec whose root key is a runtime `string` gives a `Store<Model.Dynamic>`, which accepts every path and has the same type after every op. The vue adapter holds one for the life of the root and ignores the return value of `mutate`.

- `get` and `subscribe(path, cb)` are typed by the node's **output**, which its kind determines: boxes and items give `'rect'` (a `Rect`), edges give `'route'`, adornments give `'placement'` (`{ rect, angle, along }`). A new layout type adds its outputs to one map from output name to type.
- Both take an optional expected output before the callback: `store.get(path, 'rect')` and `store.subscribe(path, 'route', cb)`. The checker accepts only an output that the path can give, so `'route'` on an item is a type error and a pattern path narrows to the output named. The runtime checks the node once, when `get` reads it or `subscribe` registers, and throws a `TypeError` on a mismatch. A path keeps its kind while it exists, and removal disposes its subscriptions, so one check covers a subscription's life.
- The any-change `subscribe` is transactional: one call per `mutate` with the changed paths, never a stream of per-frame events.
- Removing a node disposes the path subscriptions on it and its descendants without a final call, and calling their unsubscribe afterwards does nothing. The any-change map lists the node and each descendant with `next: undefined`.
- `replace(spec)` can come later as a path-keyed diff on top of these ops.

### Type index

Each constructor computes a type-level **index** of its subtree, from relative path to node kind. It captures keys with `const` type parameters, as `Frame.make` and `Hierarchy.apply` capture ids today. A parent prefixes its children's entries with their keys, so the root's index lists every path in the model:

```ts
Store<{
  readonly toolbar: 'flex'
  readonly 'toolbar.0': 'item'
  readonly 'toolbar.b': 'item'
}>
```

The paths carry the tree. The descendants of `p` are the paths under `` `${p}.` ``, and its children are the ones with a single segment more. Each op maps the index before it to the index after it, so the checker rejects:

- a path that is not in the model, in `get`, `subscribe`, and every op
- a path removed earlier in the same draft, or one under it
- props of the wrong kind for the node, in `update`
- a child kind that the parent does not accept, such as a hierarchy node in a flex, in constructors and `insert`
- a key used twice among siblings, a dotted key, and a key that starts with a digit
- an `insert` without a key
- a `before` or a `setChildren` path that is not a child of the parent
- a hierarchy edge that names a key outside its nodes, when the hierarchy is constructed (removals are design call 12)
- an expected output that the path cannot give, in `get` and `subscribe`
- a `mutate` callback that does not return the draft

Keys known only at runtime degrade to patterns. Children from `.map` give `` `app.grid.${number}` `` for positional items and `` `app.list.${string}` `` for keyed ones, and a child or an `insert` with a runtime key gives a pattern under its parent. The checker still rejects `'app.nope'`. A pattern's kind is any kind, so `get` on it returns the union of every output unless the call names one (`get(path, 'rect')`). TypeScript intersects every signature and property that matches a path, so a narrower pattern kind could exclude a node inserted later and make a lookup `never`. A literal path that a pattern also matches keeps its own kind. A removed path that a pattern matches stays valid to the checker, and the runtime check catches the read. A runtime root key makes the whole index `Model.Dynamic`.

`test/model.test-d.ts` checks each of these rejections with TypeScript 6.0.3. On a literal spec of 621 nodes the module costs 77k instantiations and 0.23 s of check time, of which the module alone takes 10k and 0.14 s. Flat ids whose entries track parent and ancestors cost 2.5M and 0.96 s on the same spec, so paths cut instantiations about 25 times. The error for an unknown path prints the whole index, and a precomputed path-union parameter on `Store` would shorten it.

## Internal graph

Each node gets two signals, each container gets one solve computed, and each child gets one stabilizing computed. Granularity matches vue today: any input change re-solves its whole container.

```ts
import { computed, signal } from 'alien-signals'

// per node
const props = signal(node.props)
const children = signal<ReadonlyArray<string>>(node.children)

// per flex container: one solve for all children
const solved = computed(() =>
  Flexbox.apply(
    children().map((id) => frameOf(id)()),
    props().layout,
    innerRect(),
  ),
)

// per child: returns prev when unchanged, so siblings stay quiet
const rect = computed<Rect>((prev) => {
  const next = solved()[indexOf(id)()] ?? Rect.zero
  return prev !== undefined && sameRect(prev, next) ? prev : next
})
```

- Box nodes compute `Box.apply(box, parentRect())`; a parent's `rect` computed is the child's `parentRect`.
- Hierarchy containers solve locally at the origin, then translate by their own box. Their percent basis is the layout's parent, as in `useHierarchy.ts` today, which breaks the bounds loop.
- Connector containers read the `rect` computeds of descendants carrying a connector role, so the sideways dependency is just another tracked read.
- The runtime keys its nodes by path. `subscribe(path)` is an effect on that node's output computed, and disposing it is the unsubscribe.

## Vue on the model

Vue keeps the component-API concerns and hands the model ordered arrays. `useChildren` stays in vue because it exists to turn a component tree into ordered children; the model never has that problem because it receives its children as an array. Layout semantics then live in one place, so vue and the model can't drift.

| Concern                                       | Lives in                         | Notes                                                                                                                   |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Child ordering (vnode DFS)                    | Vue: `useChildren`               | Its mapper becomes `m.setChildren(parentPath, paths)`                                                                   |
| Prop parsing (`'50%'`, gap and align strings) | Vue: `internal/props/*`          | Parses to values; percentages stay unresolved (see the paragraph below)                                                 |
| Percent resolution against the parent         | Model                            | Must move, or vue reads a parent rect just to write a child prop                                                        |
| Box, flex, hierarchy, connector solves        | Model                            | Replaces `useRect`, `useFlex`, `useHierarchy`, `useConnector`                                                           |
| Bad-id filtering and problems list            | Model                            | Now in `useHierarchy.ts:114` and `useConnector.ts:84`                                                                   |
| Edge to adornment two-phase solve             | Model                            | Now in `internal/edge.ts`                                                                                               |
| Node shape from a filling child graphic       | Vue: `useOutlineCollector`       | Model takes an explicit `shape`; vue keeps the inference and writes it                                                  |
| Root size and text size                       | Vue: `useDomRect`, `useTextRect` | Written into the model as root rect and intrinsic size; no measure hook in core                                         |
| Node keys                                     | Vue                              | Use the `id` prop as the key, else a key generated from the component's uid. The path is the parent's path plus the key |
| Paint, viewBox, SVG output                    | Vue                              | Render-only                                                                                                             |

**Percentages resolve in the model.** `placement/length` is the value type (`Length.px`, `Length.percent`, `Length.resolve`). `Box` and `Frame` take numbers only, because the basis of a percentage is a tree decision: the parent rect for a box, the container's inner rect for a flex item, and the layout's parent for a hierarchy. If vue kept resolving them, every percentage would round-trip: read the parent rect from the store, resolve, then mutate the child, which turns a pure derivation into a write-after-read loop. So each spec prop also takes a plain **input**, the spec's fields as data whose lengths are `Length.LengthInput` (`number | Length`), and the node resolves it against its basis with `Length.resolve` inside the computed that solves it. The core inputs carry the length type as a parameter that defaults to `number`, so `Box.BoxInput<LengthInput>` and `Frame.FrameInput<undefined, LengthInput>` are the model's inputs, with no second copy of the fields:

| Prop                      | Plain input                                | Basis                                   |
| ------------------------- | ------------------------------------------ | --------------------------------------- |
| `box` (group, flex)       | `Box.BoxInput<LengthInput>`                | The parent rect                         |
| `gutter` (flex)           | `Model.GutterInput`                        | The flex's placed rect                  |
| `translate` (group, flex) | `Model.TranslateInput`                     | The node's own rect, as CSS `translate` |
| `frame` (item)            | `Frame.FrameInput<undefined, LengthInput>` | The flex container's content rect       |

Horizontal fields (`left`, `right`, `x`, the widths, and a frame's left and right margins) resolve against the basis width, and vertical fields against its height, as `useRect` and `internal/frame.ts` do in vue. A frame's vertical margins resolve against the height, unlike CSS. A built `Box`, `Frame`, `Offset`, or `Point` is still accepted and used as is, so a consumer with numbers alone never builds an input. An aspect ratio needs no basis and passes through. A size that resolves to `NaN` is unset, because `Frame` reads a `NaN` bound literally, while a `NaN` margin stays an auto margin, both as in vue. `Box` already reads `NaN` as unset, so the rule changes nothing for a box. A frame input takes no `id` (its `id` is typed `undefined`, and `check` rejects one), because the path is the item's id.

One internal module, `internal/model/props.ts`, owns what props mean. Its `check` rejects an input field the spec lacks and a length that is neither a number nor a `Length` (through `Length.isLengthInput` and `AspectRatio.isAspectRatio`), and it freezes a copy of each input. Its `place`, `content`, `frame`, and `layout` take a node's props and the basis once, and return the rect or the spec the solve reads. Each plain input has one table naming each field's kind and axis, which the check and the resolution both read. The runtime is the signal graph alone and never sees a `Length`. `update` replaces a prop whole, so an input is never merged into the one before it. A change to the basis (`setRoot`, an update to an ancestor or to the container's gutter) re-resolves every percentage below it through the signal graph, with no write from the adapter.

**Bridging.** Vue and alien-signals are two reactive systems. Each output becomes `shallowRef` plus an alien effect, disposed in `onScopeDispose`. Each input becomes a vue `watch` (`flush: 'pre'`) that queues its change as a function of a draft. Once per vue pre-flush the adapter folds the queue into one `mutate` (`(m) => queue.reduce((d, op) => op(d), m)`), so a render that changes many props runs one `mutate` and one round of subscribers. The adapter holds one `Store<Model.Dynamic>` and never re-wires a subscription. Adapters subscribe to output computeds, not raw signals, so vue rerenders only when a rect actually changes.

## Design calls

These need settling before code; each states the recommendation.

1. **Length-percentage in core.** `placement/length` holds the value. `Box` and `Frame` keep taking numbers. Each model prop that holds a spec also takes a plain input whose lengths may be percentages (`Box.BoxInput<LengthInput>`, `Frame.FrameInput<undefined, LengthInput>`, `Model.GutterInput`, `Model.TranslateInput`), and the node resolves it against its basis before it builds the spec (see the table above). Required for vue on the model, which hands over its parsed lengths unresolved.
2. **Change detection vs PRECISION.md.** It bans raw `===` for discrete questions. Exact field comparison is still right for "did this rect change": the solvers are pure, so identical inputs give identical outputs, and tolerance would hide real sub-epsilon moves. Write the carve-out into PRECISION.md.
3. **Connector membership by role.** Hierarchy nodes are structural children, because the hierarchy positions them. Connector nodes are not positioned by the connector, so any rect-bearing node carries `connector: { id }`, and the nearest connector ancestor collects them, stopping at nested connector layouts. This keeps a connector node inside a flex item working as it does today.
4. **Where alien-signals lives.** Make it a dependency of core under `placement/unstable/model`, since vue would pull it in anyway. `unstable/utils` is the path precedent. Core goes from one dependency (`curvy`) to two.
5. **v1 output scope.** Ship boxes and flex with `Rect` outputs first. Add edge routes and adornment placements with the hierarchy and connector nodes.
6. **Subscriber timing.** Synchronous, once at the end of each `mutate`. No microtask scheduling in v1.
7. **Ids are paths.** Dotted paths, with positional keys for keyless children that stay fixed after creation. Paths let cousins share keys, type `.map` children as patterns, and cut type instantiations about 25 times against flat ids. `insert` requires a key.
8. **Store handles are views of one runtime.** `mutate` returns the same object retyped, and subscriptions belong to the runtime. A fresh runtime per `mutate` would make every mounted component dispose and recreate its alien effect and `shallowRef`. Each new effect runs when created and pulls its computed, so a mutation would cost work in proportion to the mounted nodes instead of the changed ones. The price is that an old binding can carry a stale type, and the runtime's path check catches its reads.
9. **`setChildren` reorders only.** Its list must be a permutation of the current children. The types check membership and the runtime checks the count. Mounts and unmounts call `insert` and `remove`, and the `useChildren` mapper then calls `setChildren` for the order.
10. **Ops for the root and intrinsic sizes.** `m.setRoot(rect)` sets the rect the root is placed against. Intrinsic sizes need a field on box and item props that `update` writes, which vue's `useTextRect` calls. Vue's `useDomRect` calls `setRoot`.
11. **Reentrant `mutate`.** A subscriber that calls `mutate` during notification gets its ops applied at once, so the store it gets back is true. The store holds that call's notifications until the current round ends and then runs a second round. Throwing would forbid a subscriber that resizes a sibling, and notifying at once would interleave rounds.
12. **Removing a referenced node.** Removing a hierarchy node leaves the edges that name it. Report them in the runtime problems list, as today. A type error would need entries to carry their references and a scan of every edge per op, and connector edges reference paths across a whole subtree.

## Rollout

Each step ships on its own and leaves vue working.

1. Add `placement/length` to core and resolve vue's percentages through `Length.resolve`, with no behavior change.
2. Extract the tolerant `solve` adapters from `useHierarchy.ts` and `useConnector.ts` into core.
3. Ship `placement/unstable/model` with root, box/group and flex nodes, paths, `get`/`subscribe`/`Model.mutate`, and the alien-signals dependency. Type tests cover every rejection in the type index list, with `expectTypeOf` and `@ts-expect-error` under vitest's typecheck mode.
4. Port `GraphicRoot`, `GraphicGroup`, `FlexLayout` and `FlexItem` onto the model. The existing component tests are the parity check.
5. Add hierarchy nodes and edges with typed route outputs, then port the vue hierarchy components.
6. Add connector roles and edges, then port the vue connector components and delete the old composables.

## Sources

Versions are from `npm view` on 2026-10-17. Code references are to the `hierarchy` branch.

- [alien-signals](https://github.com/stackblitz/alien-signals) and its [stock implementation](https://github.com/stackblitz/alien-signals/blob/master/src/index.ts)
- [vuejs/core PR 12349](https://github.com/vuejs/core/pull/12349), the alien-signals port for vue 3.6
- [TC39 signals proposal](https://github.com/tc39/proposal-signals) and [signal-polyfill](https://github.com/proposal-signals/signal-polyfill)
- [Preact signals](https://github.com/preactjs/signals), [TanStack Store](https://tanstack.com/store), [nanostores](https://github.com/nanostores/nanostores)
- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
