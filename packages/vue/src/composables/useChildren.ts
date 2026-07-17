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
  onBeforeUnmount,
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

    watch(
      input,
      () => {
        context.update(this)
      },
      { flush: 'sync' },
    )
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
  const siblingLists = new Map<number, Array<Child<I, O>>>()
  let depth = 0

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
      depth = value
    } else {
      if (value === parent) {
        continue
      }
      const refs = storage.get(value)
      if (refs === undefined) {
        continue
      }

      const siblings = siblingLists.get(depth) ?? []
      siblingLists.set(depth, siblings)

      const ancestors: Array<Child<I, O>> = []
      for (const list of siblingLists.values()) {
        if (list !== siblings) {
          ancestors.push(...list)
        }
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

class Context<I, O = never> {
  readonly children: ShallowRef<ReadonlyArray<Child<I, O>>>
  readonly #parentType: VNodeTypes
  readonly #preMap: ChildrenMapper<I, O> | undefined
  readonly #ssr: boolean
  readonly #storage: Map<ComponentInternalInstance, Array<Child<I, O>>>
  readonly #updateTrigger: ShallowRef<number>
  readonly #vm: ComponentInternalInstance

  constructor(vm: ComponentInternalInstance, map?: ChildrenMapperOption<I, O>) {
    this.#vm = vm
    this.#parentType = vm.vnode.type

    // `renderToString` provides the SSR context app-wide. Its presence means
    // Vue discards pre-flush watchers, so `invalidate` must resolve and map
    // synchronously instead of going through the scheduler.
    this.#ssr = inject(ssrContextKey, null) !== null

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

    // The mappers run over the empty list too: when the last child leaves,
    // downstream state must observe the empty resolution or it goes stale.
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
  }

  invalidate() {
    if (this.#ssr) {
      // Children registered later in the same server render are not visible
      // yet, so each child renders from the list resolved so far -- the same
      // partial-layout semantics the index-based system had on the server.
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

  const context = new Context<I, O>(vm, handler)
  provide(Symbol.for(`use-children:${channel}`), context)

  // A keyed reorder moves existing children without registering, mounting, or
  // unmounting anything, so nothing above re-fires. Re-resolving on every
  // provider update is cheap (one vnode walk), and the resolution is dropped
  // unless the ordered list actually changed.
  onUpdated(() => {
    context.invalidate()
  })
}
