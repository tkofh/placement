import {
  type ComponentInternalInstance,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
  type VNode,
  type VNodeArrayChildren,
  type VNodeTypes,
  getCurrentInstance,
  inject,
  isVNode,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  onUpdated,
  provide,
  shallowRef,
  ssrContextKey,
  toRef,
  triggerRef,
  watch,
  watchEffect,
} from 'vue'

// Bundlers statically replace `process.env.NODE_ENV` (the same convention
// that the esm-bundler builds of Vue use), so production output drops the
// guarded blocks. The check stays inline at each guard, because hoisting it
// into a const defeats the dead-branch elimination of esbuild. esbuild is the
// default production minifier of Vite.
declare const process: { env: { NODE_ENV?: string } }

type ChildOutput<O> = [O] extends [never] ? null : ShallowRef<O>

class Child<I, O = never> {
  ancestors: ReadonlyArray<Child<I, O>> = []
  readonly input: Readonly<Ref<I>>
  readonly instance: ComponentInternalInstance
  readonly output: ChildOutput<O>
  siblings: ReadonlyArray<Child<I, O>> = []
  readonly uid: number

  constructor(
    context: Context<I, O>,
    instance: ComponentInternalInstance,
    uid: number,
    input: Readonly<Ref<I>>,
    initial: O | undefined,
  ) {
    this.instance = instance
    this.uid = uid
    this.input = input
    this.output = (initial === undefined ? null : shallowRef(initial)) as ChildOutput<O>

    // On the client, the mappers are reactive effects that track their own
    // reads of child inputs. An input change re-runs them directly, and only
    // structural changes need re-resolution. During SSR, nothing re-runs on
    // its own. An input change must re-resolve and re-map synchronously, so
    // that children that render later observe it.
    if (context.ssr) {
      watch(
        input,
        () => {
          context.update(this)
        },
        { flush: 'sync' },
      )
    }
  }

  *after() {
    // oxlint-disable-next-line typescript/no-this-alias
    let current: Child<I, O> | undefined = this
    while (current != null) {
      for (const ref of current.siblings.slice(current.siblings.indexOf(current) + 1)) {
        yield ref
      }

      current = current.ancestors.at(-1)
    }
  }

  *before() {
    for (const ref of this.ancestors) {
      yield ref
    }
    for (const ref of this.siblings) {
      if (ref === this) {
        break
      }
      yield ref
    }
  }

  is(other: Child<I, O> | undefined): boolean {
    return other != null && this.uid === other.uid
  }
}

type ChildrenMapper<I, O> = (children: ReadonlyArray<Child<I, O>>) => void

type ChildrenMapperOption<I, O> =
  | {
      post?: ChildrenMapper<I, O>
      pre?: ChildrenMapper<I, O>
    }
  | ChildrenMapper<I, O>

function* vnodeChildrenOf(vnode: VNode): Generator<VNode> {
  if (vnode.component?.subTree) {
    yield vnode.component.subTree
  } else if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (isVNode(child)) {
        yield child
      }
    }
  } else if (isVNode(vnode.suspense?.activeBranch)) {
    yield vnode.suspense.activeBranch
  }
}

function* walkChildComponents(
  root: VNode,
  shouldTraverseChildrenOf: (node: VNode) => boolean,
): Generator<ComponentInternalInstance | number> {
  const queue = [...vnodeChildrenOf(root)]
  let depth = 0

  const riseAt = [] as VNodeArrayChildren

  while (queue.length > 0) {
    const vnode = queue.shift()

    if (vnode == null) {
      break
    }

    while (riseAt.length > 0 && riseAt[0] === vnode) {
      riseAt.shift()
      depth--
      yield depth
    }

    if (vnode.component) {
      yield vnode.component
    }

    if (!shouldTraverseChildrenOf(vnode)) {
      continue
    }

    if (typeof vnode.type === 'string') {
      if (queue[0] != null) {
        riseAt.unshift(queue[0])
      }
      depth++
      yield depth
    }

    queue.unshift(...vnodeChildrenOf(vnode))
  }
}

function resolveChildren<I, O>(
  parent: ComponentInternalInstance,
  shouldTraverseChildrenOf: (node: VNode) => boolean,
  storage: ReadonlyMap<ComponentInternalInstance, ReadonlyArray<Child<I, O>>>,
): Array<Child<I, O>> {
  const children = [] as Array<Child<I, O>>
  // The stack of open sibling groups. Entering a host element opens a new
  // group, and rising closes the deepest ones. Two containers at the same
  // depth therefore hold distinct groups, and the groups below the top are
  // exactly the enclosing chain.
  const groups: Array<Array<Child<I, O>>> = [[]]

  let totalChildCount = 0
  for (const refs of storage.values()) {
    totalChildCount += refs.length
  }

  const selfRefs = storage.get(parent)
  if (selfRefs !== undefined && selfRefs.length > 0) {
    const selfSiblings = [...selfRefs]
    for (const child of selfRefs) {
      child.siblings = selfSiblings
      child.ancestors = []
      children.push(child)
    }
    if (children.length === totalChildCount) {
      return children
    }
  }

  for (const value of walkChildComponents(parent.vnode, shouldTraverseChildrenOf)) {
    if (typeof value === 'number') {
      while (groups.length > value + 1) {
        groups.pop()
      }
      while (groups.length < value + 1) {
        groups.push([])
      }
    } else {
      if (value === parent) {
        continue
      }
      const refs = storage.get(value)
      if (refs === undefined) {
        continue
      }

      const siblings = groups.at(-1)!

      // Take a snapshot. The enclosing groups hold only the members that
      // preceded this child in the walk, so later children of the same group
      // never appear in its ancestors.
      const ancestors: Array<Child<I, O>> = []
      for (const group of groups.slice(0, -1)) {
        ancestors.push(...group)
      }

      for (const child of refs) {
        siblings.push(child)
        child.siblings = siblings
        child.ancestors = ancestors
        children.push(child)
      }

      if (children.length === totalChildCount) {
        break
      }
    }
  }

  return children
}

// Dev-only dedupe state for the unreachable-child warning. It lives at module
// scope inside DEV guards, not on the class. Bundlers strip dead branches but
// not class fields or methods, and production builds must carry none of this.
let warnState: WeakMap<object, { channel: string; warned: string }> | undefined

// Every failure mode of the vnode walk shows up as a mounted child that is
// silently missing from the layout. Examples are a change in the shape of a
// Vue internal, a child rendered outside the subtree of the provider, and a
// traversal bug. Dev builds therefore warn about it. Two states are
// legitimately unreachable and exempt: unmounted children (mid-patch), and
// children whose suspense boundary is still pending. Those children are
// already mounted, but into an off-tree container that the walk cannot see
// until the boundary resolves.
function warnUnreachable<I, O>(
  context: object,
  storage: ReadonlyMap<ComponentInternalInstance, ReadonlyArray<Child<I, O>>>,
  resolved: ReadonlyArray<Child<I, O>>,
) {
  const state = warnState?.get(context)
  if (state === undefined) {
    return
  }

  const found = new Set<Child<I, O>>(resolved)
  const missing = [] as Array<string>
  let key = ''

  for (const refs of storage.values()) {
    for (const ref of refs) {
      if (found.has(ref) || !ref.instance.isMounted) {
        continue
      }

      // The suspense boundary that the instance mounted under, if any. It is
      // present at runtime but absent from the published type.
      const suspense = (ref.instance as unknown as { suspense: { pendingBranch: unknown } | null })
        .suspense
      if (suspense?.pendingBranch != null) {
        continue
      }

      const type = ref.instance.type as { __name?: string; name?: string }
      missing.push(type.name || type.__name || '(anonymous)')
      key += `${ref.uid} `
    }
  }

  if (key !== '' && key !== state.warned) {
    console.warn(
      `[useChildren] ${missing.length} mounted child(ren) on channel ` +
        `"${state.channel}" (${missing.join(', ')}) cannot be reached from ` +
        `the provider's vnode tree and are missing from the resolved list.`,
    )
  }
  state.warned = key
}

class Context<I, O = never> {
  readonly children: ShallowRef<ReadonlyArray<Child<I, O>>>
  readonly ssr: boolean
  readonly #parentType: VNodeTypes
  readonly #preMap: ChildrenMapper<I, O> | undefined
  readonly #storage: Map<ComponentInternalInstance, Array<Child<I, O>>>
  readonly #updateTrigger: ShallowRef<number>
  readonly #vm: ComponentInternalInstance

  constructor(vm: ComponentInternalInstance, channel: string, map?: ChildrenMapperOption<I, O>) {
    this.#vm = vm
    this.#parentType = vm.vnode.type

    // `renderToString` provides the SSR context app-wide. Its presence means
    // Vue discards pre-flush watchers, so `invalidate` must resolve and map
    // synchronously instead of going through the scheduler.
    this.ssr = inject(ssrContextKey, null) !== null

    // SSR contexts never warn, because partial resolution on the server is by design.
    if (process.env.NODE_ENV !== 'production' && !this.ssr) {
      warnState ??= new WeakMap()
      warnState.set(this, { channel, warned: '' })
    }

    this.#storage = new Map()
    const children = shallowRef<ReadonlyArray<Child<I, O>>>([])
    this.children = children
    this.#updateTrigger = shallowRef(0)

    watch(
      this.#updateTrigger,
      () => {
        this.#resolve()
      },
      { flush: 'pre' },
    )

    const preMap = typeof map === 'function' ? map : map?.pre
    const postMap = typeof map === 'function' ? undefined : map?.post
    this.#preMap = preMap

    // The mappers also run over the empty list. When the last child leaves,
    // downstream state must observe the empty resolution, or it goes stale.
    if (preMap !== undefined) {
      watchEffect(
        () => {
          preMap(children.value)
        },
        { flush: 'pre' },
      )
    }
    if (postMap !== undefined) {
      watchEffect(
        () => {
          postMap(children.value)
        },
        { flush: 'post' },
      )
    }
  }

  #resolve() {
    const next = resolveChildren(
      this.#vm,
      (vnode) => vnode.type !== this.#parentType,
      this.#storage,
    )
    const prev = this.children.value
    if (next.length !== prev.length || next.some((child, index) => child !== prev[index])) {
      this.children.value = next
    }

    if (process.env.NODE_ENV !== 'production') {
      warnUnreachable(this, this.#storage, next)
    }
  }

  invalidate() {
    if (this.ssr) {
      // Children that register later in the same server render are not
      // visible yet, so each child renders from the list resolved so far. The
      // index-based system had the same partial-layout semantics on the server.
      this.#resolve()
      this.#preMap?.(this.children.value)
    } else {
      triggerRef(this.#updateTrigger)
    }
  }

  mount(ref: Child<I, O>) {
    if (!this.children.value.includes(ref)) {
      this.invalidate()
    }
  }

  register(ref: Child<I, O>) {
    const refs = this.#storage.get(ref.instance)
    if (refs) {
      // This is re-entrant for KeepAlive, because `onActivated` also fires
      // after the initial mount, when the setup registration is still in place.
      if (refs.includes(ref)) {
        return
      }
      refs.push(ref)
    } else {
      this.#storage.set(ref.instance, [ref])
    }
    this.invalidate()
  }

  unregister(ref: Child<I, O>) {
    const refs = this.#storage.get(ref.instance)
    if (!refs) {
      return
    }
    const i = refs.indexOf(ref)
    if (i !== -1) {
      refs.splice(i, 1)
    }
    if (refs.length === 0) {
      this.#storage.delete(ref.instance)
    }
    this.invalidate()
  }

  update(ref: Child<I, O>) {
    if (this.children.value.includes(ref)) {
      this.invalidate()
    }
  }
}

export type { Child, ChildrenMapper, ChildrenMapperOption }

let nextId = 0

export function useChild<I>(channel: string, value: MaybeRefOrGetter<I>): void
export function useChild<I, O = I>(
  channel: string,
  value: MaybeRefOrGetter<I>,
  initial: O,
): Readonly<Ref<O>>
export function useChild<I, O = never>(
  channel: string,
  value: MaybeRefOrGetter<I>,
  initial?: O,
): Readonly<Ref<O>> | undefined {
  const vm = getCurrentInstance()

  if (!vm) {
    throw new Error('useChild must be called within a Vue component')
  }

  const key = Symbol.for(`use-children:${channel}`)
  const ownProvides = (vm as unknown as { provides: Record<symbol, unknown> }).provides
  const context =
    (key in ownProvides ? (ownProvides[key] as Context<I, O>) : null) ??
    inject(key as InjectionKey<Context<I, O>>, null)

  if (!context) {
    throw new Error(`No context found for channel "${channel}"`)
  }

  const ref = new Child<I, O>(context, vm, nextId++, toRef(value) as Ref<I>, initial)

  context.register(ref)

  onMounted(() => {
    context.mount(ref)
  })

  // A KeepAlive toggle neither mounts nor unmounts the child, and the provider
  // does not always re-render when it happens. Activation state therefore
  // drives registration directly. A deactivated child leaves the layout, and
  // a reactivated one rejoins it. Both hooks are inert outside a KeepAlive.
  onActivated(() => {
    context.register(ref)
  })

  onDeactivated(() => {
    context.unregister(ref)
  })

  onBeforeUnmount(() => {
    context.unregister(ref)
  })

  if (ref.output != null) {
    return ref.output
  }
}

export function useChildren<I, O = never>(
  channel: string,
  handler: ChildrenMapperOption<I, O>,
): void {
  const vm = getCurrentInstance()

  if (!vm) {
    throw new Error('useChildren must be called within a Vue component')
  }

  const context = new Context<I, O>(vm, channel, handler)
  provide(Symbol.for(`use-children:${channel}`), context)

  // A keyed reorder moves existing children without registering, mounting, or
  // unmounting anything, so nothing above re-fires. Re-resolving on every
  // provider update is cheap (one vnode walk), and the resolution is dropped
  // unless the ordered list changed.
  onUpdated(() => {
    context.invalidate()
  })
}
