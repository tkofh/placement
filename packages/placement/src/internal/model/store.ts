import { Pipeable } from 'curvy/utils'
import type { Rect } from '../../rect.ts'
import { type Change, type Op, Runtime } from './runtime.ts'
import type { Spec } from './spec.ts'
import type {
  AcceptsOf,
  ChildPaths,
  ContainerPaths,
  DuplicateKey,
  Flatten,
  Index,
  IndexOf,
  IsDynamic,
  Kind,
  MissingKey,
  NotAccepted,
  OutputAt,
  OutputName,
  Outputs,
  Paths,
  Place,
  PropsOf,
  RemovablePaths,
  RootKind,
  Without,
} from './types.ts'

export type { Change }

const StoreBrand: unique symbol = Symbol('placement/model/store')
const DraftBrand: unique symbol = Symbol('placement/model/draft')

/** The options of `Model.store`. */
export interface StoreOptions {
  /** The rect the root node is placed against. */
  readonly root: Rect
}

/**
 * A live model. Every node has a path, and `get` and `subscribe` take only
 * the paths that the type index `I` holds. `Model.mutate` changes the model
 * and returns the same store typed for the result.
 *
 * Subscriptions belong to the store, so they survive every `mutate`. Path
 * listeners and any-change listeners run synchronously once per `mutate`,
 * after every write of it.
 */
export interface Store<I extends Index> extends Pipeable {
  /**
   * Reads the output of the node at `path`.
   *
   * @param path - The node's path.
   * @param expect - The output the caller expects. It narrows the result
   * on a path that a pattern matches, and the store checks it.
   * @returns The output.
   * @throws `RangeError` when no node has the path.
   * @throws `TypeError` when the node gives another output than `expect`.
   */
  get<K extends Paths<I>>(path: K): Outputs[OutputAt<I, K>]
  get<K extends Paths<I>, O extends OutputAt<I, K>>(path: K, expect: O): Outputs[O]

  /**
   * Calls `listener` after each `mutate` that changes the output of the node
   * at `path`. Removing the node ends the subscription without a call.
   *
   * @param path - The node's path.
   * @param expect - The output the caller expects. It narrows the listener's
   * arguments on a path that a pattern matches, and the store checks it once.
   * @param listener - Called with the new and the previous output.
   * @returns A function that ends the subscription. Calling it again does
   * nothing.
   * @throws `RangeError` when no node has the path.
   * @throws `TypeError` when the node gives another output than `expect`.
   */
  subscribe<K extends Paths<I>>(
    path: K,
    listener: (next: Outputs[OutputAt<I, K>], prev: Outputs[OutputAt<I, K>]) => void,
  ): () => void
  subscribe<K extends Paths<I>, O extends OutputAt<I, K>>(
    path: K,
    expect: O,
    listener: (next: Outputs[O], prev: Outputs[O]) => void,
  ): () => void
  /**
   * Calls `listener` once per `mutate` that changes any output, with every
   * change by path. An inserted node has no `prev`, and a removed one has no
   * `next`.
   *
   * @param listener - Called with the changes.
   * @returns A function that ends the subscription.
   */
  subscribe(
    listener: (changes: ReadonlyMap<Paths<I>, Change<Outputs[OutputName]>>) => void,
  ): () => void
}

/** An op's result: a dynamic index stays as it is. */
type Step<I extends Index, J extends Index> =
  IsDynamic<I> extends true ? Draft<I> : Flatten<J> extends infer F extends Index ? Draft<F> : never

/** What `insert` accepts under `P`, or the error type that explains why not. */
type Insertable<I extends Index, P extends Paths<I>, S extends Spec> =
  S['kind'] extends AcceptsOf<I[P]>
    ? string extends S['key']
      ? S
      : S['key'] extends string
        ? IsDynamic<I> extends true
          ? S
          : `${P}.${S['key']}` extends Paths<I>
            ? DuplicateKey<S['key']>
            : S
        : MissingKey
    : NotAccepted<I[P], S['kind']>

/**
 * The ops of one `mutate`, as an immutable list. Each op returns a new
 * draft whose type is the index after it, and `mutate` applies the draft
 * that its callback returns.
 */
export interface Draft<I extends Index> {
  /**
   * Merges props into the node at `path`. A field set to `undefined` goes
   * back to its default.
   */
  update<K extends Paths<I>>(path: K, props: PropsOf<I[K]>): Draft<I>
  /**
   * Inserts a spec under `parent`, last or before the child `before`. The
   * spec needs a key, and its path is `parent` and that key.
   */
  insert<P extends ContainerPaths<I>, S extends Spec>(
    parent: P,
    spec: Insertable<I, P, S> & S,
    options?: { readonly before?: ChildPaths<I, P> | undefined },
  ): Step<
    I,
    string extends S['key']
      ? I & { readonly [_ in `${P}.${string}`]: Kind }
      : I & Place<`${P}.${S['key'] & string}`, S>
  >
  /** Removes the node at `path` and its descendants. */
  remove<K extends RemovablePaths<I>>(path: K): Step<I, Without<I, K>>
  /** Reorders the children of `parent`. `paths` lists each child once. */
  setChildren<P extends ContainerPaths<I>>(
    parent: P,
    paths: ReadonlyArray<ChildPaths<I, P>>,
  ): Draft<I>
  /** Sets the rect the root is placed against. */
  setRoot(rect: Rect): Draft<I>
}

class DraftImpl {
  readonly [DraftBrand] = DraftBrand
  readonly ops: ReadonlyArray<Op>

  constructor(ops: ReadonlyArray<Op>) {
    this.ops = ops
  }

  #with(op: Op): DraftImpl {
    return new DraftImpl([...this.ops, op])
  }

  update(path: string, props: unknown): DraftImpl {
    return this.#with({ op: 'update', path, props })
  }

  insert(
    parent: string,
    spec: unknown,
    options?: { readonly before?: string | undefined },
  ): DraftImpl {
    return this.#with({ op: 'insert', parent, spec, before: options?.before })
  }

  remove(path: string): DraftImpl {
    return this.#with({ op: 'remove', path })
  }

  setChildren(parent: string, paths: ReadonlyArray<string>): DraftImpl {
    return this.#with({ op: 'setChildren', parent, paths: [...paths] })
  }

  setRoot(rect: unknown): DraftImpl {
    return this.#with({ op: 'setRoot', rect })
  }
}

const emptyDraft = new DraftImpl([])

class StoreImpl extends Pipeable {
  readonly [StoreBrand] = StoreBrand
  readonly #runtime: Runtime

  constructor(runtime: Runtime) {
    super()
    this.#runtime = runtime
  }

  get(path: string, expect?: OutputName): unknown {
    return this.#runtime.get(path, expect)
  }

  subscribe(...args: ReadonlyArray<unknown>): () => void {
    if (typeof args[0] === 'function') {
      return this.#runtime.subscribeAll(args[0] as never)
    }
    const path = args[0] as string
    if (typeof args[1] === 'function') {
      return this.#runtime.subscribe(path, undefined, args[1] as never)
    }
    if (typeof args[2] !== 'function') {
      throw new TypeError('subscribe needs a listener')
    }
    return this.#runtime.subscribe(path, args[1] as OutputName, args[2] as never)
  }

  apply(ops: ReadonlyArray<Op>): void {
    this.#runtime.apply(ops)
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return 'Store'
  }
}

/**
 * Checks whether a value is a store.
 *
 * @param value - The value to check.
 * @returns `true` when `value` is a store from `Model.store`.
 * @example
 * ```ts
 * Model.isStore(Model.store(Model.group({}), { root: Rect.make(100) })) // true
 * ```
 */
export const isStore = (value: unknown): value is Store<Index> => value instanceof StoreImpl

/**
 * Builds a live store from a root spec. The root's path is its key, or
 * `'root'` when it has none, and every other path adds a child's key to its
 * parent's path. A spec whose root key is a runtime `string` gives a
 * `Store<Model.Dynamic>`, which takes any path.
 *
 * @param spec - The root spec: a group or a flex.
 * @param options - The root rect.
 * @returns The store.
 * @throws `TypeError` when the root is not a group or a flex, or the root
 * rect is not a `Rect`.
 * @example
 * ```ts
 * const store = Model.store(
 *   Model.flex('toolbar', {}, [Model.item({ frame: Frame.make({ width: 100 }) })]),
 *   { root: Rect.make(800, 600) },
 * )
 * store.get('toolbar.0') // Rect [0, 0, 100, 600]
 * ```
 */
export function store<S extends Spec<string | undefined, RootKind>>(
  spec: S,
  options: StoreOptions,
): Store<IndexOf<S>> {
  return new StoreImpl(new Runtime(spec, options.root)) as unknown as Store<IndexOf<S>>
}

/**
 * Applies the ops of a draft to a store and returns the same store, typed
 * for the model after them. The callback receives an empty draft and must
 * return the draft its ops built. The store checks every op before it
 * writes anything, then applies them all in one batch, then calls the
 * listeners of what changed.
 *
 * A listener that calls `mutate` gets its ops applied at once. Its
 * notifications follow in a second round, after the current one.
 *
 * TypeScript cannot retype a variable, so bind the result to a new name to
 * keep the types in step. The old name still reaches the same store. There
 * is no data-last form, because its draft could not see the store's type.
 *
 * @param self - The store.
 * @param f - Builds the draft.
 * @returns `self`, retyped.
 * @throws `RangeError` when an op names a path that does not exist at that
 * point of the draft, inserts a duplicate or keyless node, removes the root,
 * or gives `setChildren` a list that is not a permutation of the children.
 * @throws `TypeError` when an op gives props of the wrong type, inserts a
 * kind that the parent does not accept, or `f` does not return a draft.
 * @example
 * ```ts
 * const next = Model.mutate(store, (m) =>
 *   m.insert('toolbar', Model.item('c', {})).update('toolbar.c', { frame: Frame.make({ grow: 1 }) }),
 * )
 * next.get('toolbar.c') // Rect
 * ```
 */
export function mutate<I extends Index, J extends Index>(
  self: Store<I>,
  f: (draft: Draft<I>) => Draft<J>,
): Store<J> {
  if (!(self instanceof StoreImpl)) {
    throw new TypeError('mutate needs a store')
  }
  const draft: unknown = f(emptyDraft as unknown as Draft<I>)
  if (!(draft instanceof DraftImpl)) {
    throw new TypeError('The mutate callback must return the draft')
  }
  self.apply(draft.ops)
  return self as unknown as Store<J>
}
