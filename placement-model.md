# Placement Model module

Oct 18, 2026 · @tim

Build `placement/unstable/model` as a tree of node specs compiled to a store with `get`, `subscribe` and `mutate`, backed internally by alien-signals. The vue layer then becomes an adapter: `useChildren` keeps producing ordered child arrays and the model does all the layout.

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

## Public API sketch

A spec is plain immutable data, and `Model.store` turns it into the live store. There is no separate compile step: the store is the compiled form, and targeted ops mutate it. Every node has an id, because `subscribe` is addressed by id.

```ts
import * as Model from 'placement/unstable/model'

const spec = Model.flex('toolbar', { layout: Flexbox.make({ gap: 8 }) }, [
  Model.item('a', { frame: Frame.make({ width: 100 }) }),
  Model.item('b', { frame: Frame.make({ grow: 1 }) }),
])

const store = Model.store(spec, { root: Rect.make(800, 600) })

store.get('b') // Rect
const off = store.subscribe('b', (next, prev) => {})
store.subscribe((changes) => {}) // once per mutate: Map<id, { prev, next }>

store.mutate((m) => {
  m.update('b', { frame: Frame.make({ grow: 2 }) })
  m.insert('toolbar', Model.item('c', { frame: Frame.make({ width: 40 }) }), { before: 'b' })
  m.remove('a')
  m.setChildren('toolbar', ['c', 'b']) // what a vue adapter calls after useChildren resolves
})
```

- `subscribe(id, cb)` is typed by node kind: boxes and items give a `Rect`, edges give a route, adornments give `{ rect, angle, along }`.
- The any-change `subscribe` is transactional: one call per `mutate` with the set of changed ids, never a stream of per-frame events.
- `replace(spec)` can come later as an id-keyed diff on top of these ops.

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
- `subscribe(id)` is an effect on that node's output computed; disposing it is the unsubscribe.

## Vue on the model

Vue keeps the component-API concerns and hands the model ordered arrays. `useChildren` stays in vue because it exists to turn a component tree into ordered children; the model never has that problem because it receives its children as an array. Layout semantics then live in one place, so vue and the model can't drift.

| Concern                                       | Lives in                         | Notes                                                                           |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| Child ordering (vnode DFS)                    | Vue: `useChildren`               | Its mapper becomes `m.setChildren(parentId, ids)`                               |
| Prop parsing (`'50%'`, gap and align strings) | Vue: `internal/props/*`          | Parses to values; percentages stay unresolved (see the blocker below)           |
| Percent resolution against the parent         | Model                            | Must move, or vue reads a parent rect just to write a child prop                |
| Box, flex, hierarchy, connector solves        | Model                            | Replaces `useRect`, `useFlex`, `useHierarchy`, `useConnector`                   |
| Bad-id filtering and problems list            | Model                            | Now in `useHierarchy.ts:114` and `useConnector.ts:84`                           |
| Edge to adornment two-phase solve             | Model                            | Now in `internal/edge.ts`                                                       |
| Node shape from a filling child graphic       | Vue: `useOutlineCollector`       | Model takes an explicit `shape`; vue keeps the inference and writes it          |
| Root size and text size                       | Vue: `useDomRect`, `useTextRect` | Written into the model as root rect and intrinsic size; no measure hook in core |
| Node ids                                      | Vue                              | Use the `id` prop, else an id generated from the component's uid                |
| Paint, viewBox, SVG output                    | Vue                              | Render-only                                                                     |

**Blocker: core has no length-percentage value.** `grep -i percent` finds nothing under `packages/placement/src`. Vue resolves percentages itself (`resolveSize1D` in `internal/props/size1d.ts`). If vue kept that, every percentage would round-trip: read the parent rect from the store, resolve, then mutate the child, which turns a pure derivation into a write-after-read loop. So something like vue's `Size1DValue` has to move into core and become a `Box`/`Frame` input.

**Bridging.** Vue and alien-signals are two reactive systems. Each output becomes `shallowRef` plus an alien effect, disposed in `onScopeDispose`. Each input becomes a vue `watch` (`flush: 'pre'`) that calls `mutate`. Adapters subscribe to output computeds, not raw signals, so vue rerenders only when a rect actually changes.

## Design calls

These need settling before code; each states the recommendation.

1. **Length-percentage in core.** Add a parsed length value (px or %) that `Box` and `Frame` accept and the model resolves against the right basis. Required for vue on the model.
2. **Change detection vs PRECISION.md.** It bans raw `===` for discrete questions. Exact field comparison is still right for "did this rect change": the solvers are pure, so identical inputs give identical outputs, and tolerance would hide real sub-epsilon moves. Write the carve-out into PRECISION.md.
3. **Connector membership by role.** Hierarchy nodes are structural children, because the hierarchy positions them. Connector nodes are not positioned by the connector, so any rect-bearing node carries `connector: { id }`, and the nearest connector ancestor collects them, stopping at nested connector layouts. This keeps a connector node inside a flex item working as it does today.
4. **Where alien-signals lives.** Make it a dependency of core under `placement/unstable/model`, since vue would pull it in anyway. `unstable/utils` is the path precedent. Core goes from one dependency (`curvy`) to two.
5. **v1 output scope.** Ship boxes and flex with `Rect` outputs first. Add edge routes and adornment placements with the hierarchy and connector nodes.
6. **Subscriber timing.** Synchronous, once at the end of each `mutate`. No microtask scheduling in v1.

## Rollout

Each step ships on its own and leaves vue working.

1. Move length-percentage parsing into core, with `Box`/`Frame` accepting it. Vue switches to it with no behavior change.
2. Extract the tolerant `solve` adapters from `useHierarchy.ts` and `useConnector.ts` into core.
3. Ship `placement/unstable/model` with root, box/group and flex nodes, `get`/`subscribe`/`mutate`, and the alien-signals dependency.
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
