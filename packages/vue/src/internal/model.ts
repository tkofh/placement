// The bridge from components to `placement/unstable/model`. The model does
// the layout, and this module only mirrors the component tree into it.
//
// A component that places a rect (`GraphicRoot`, `GraphicGroup`,
// `FlexLayout`, `FlexItem`) owns one model node. The node attaches to the
// nearest model node above it, which provides itself through `MODEL_PARENT`.
// A flex item attaches to the nearest flex instead, as `useChild` does, and
// the flex's `useChildren` mapper sets the order of its items. A component
// with no model node above it to attach to is a root: it builds a store of
// its own, placed against the rect of the sizing context it sits in. That
// covers a group under a layout that is not on the model yet (hierarchy,
// connector) and a group directly inside a flex, which the model has no
// child kind for.
//
// Vue and alien-signals are two reactive systems, and they meet in two
// places. Inputs: a pre-flush `watch` per node queues its props as an op,
// and the root folds the queue into one `mutate` per pre-flush. Outputs: a
// store subscription per node writes its rect into a `shallowRef`. A node
// that mounts applies the queue at once, so its first render reads a placed
// rect.
import * as Rect from 'placement/rect'
import * as Model from 'placement/unstable/model'
import {
  type InjectionKey,
  type MaybeRefOrGetter,
  type ShallowRef,
  getCurrentInstance,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onScopeDispose,
  provide,
  shallowRef,
  ssrContextKey,
  toValue,
  triggerRef,
  watch,
} from 'vue'
import { useChild, useChildren } from '../composables/useChildren.ts'
import { blockOutlines } from '../composables/useOutline.ts'
import {
  MODEL_PARENT,
  provideParentRect,
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
} from '../composables/useSizingContext.ts'

type Kind = 'group' | 'flex' | 'item'

interface PropsByKind {
  group: Model.GroupProps
  flex: Model.FlexProps
  item: Model.ItemProps
}

type Op = (draft: Model.Draft<Model.Dynamic>) => Model.Draft<Model.Dynamic>

const FLEX_CHANNEL = 'placement/flex'

const FLEX_PARENT: InjectionKey<ModelNode<'flex'>> = Symbol.for('placement/model/flex')

// One store and the ops waiting for it. The store opens once its root
// node can give its spec.
class ModelRoot {
  readonly #ssr: boolean
  readonly #trigger = shallowRef(0)
  #store: Model.Store<Model.Dynamic> | undefined
  #queue: Array<Op> = []

  constructor(ssr: boolean) {
    this.#ssr = ssr
    // Server renders discard pre-flush watchers, so `enqueue` applies at
    // once there instead.
    watch(
      this.#trigger,
      () => {
        this.flush()
      },
      { flush: 'pre' },
    )
  }

  get store(): Model.Store<Model.Dynamic> {
    if (this.#store === undefined) {
      throw new Error('The model store is not open yet')
    }
    return this.#store
  }

  open(spec: Model.Spec, rect: Rect.Rect): void {
    this.#store = Model.store(spec as Model.Spec<string, Model.RootKind>, { root: rect })
  }

  enqueue(op: Op): void {
    this.#queue.push(op)
    if (this.#ssr) {
      this.flush()
    } else {
      triggerRef(this.#trigger)
    }
  }

  flush(): void {
    if (this.#queue.length === 0) {
      return
    }
    const ops = this.#queue
    this.#queue = []
    Model.mutate(this.store, (m) => ops.reduce((draft, op) => op(draft), m))
  }
}

// A key is the `id` attribute when the model takes it and no sibling has
// it, else one made from the component's uid. The model's rule: non-empty,
// no dot, and no leading digit.
function keyFor(siblings: ReadonlyArray<ModelNode>, id: unknown, uid: number): string {
  const taken = (key: string) => siblings.some((sibling) => sibling.key === key)
  if (typeof id === 'string' && id !== '' && !id.includes('.') && !/^\d/.test(id) && !taken(id)) {
    return id
  }
  let key = `_${uid}`
  for (let n = 1; taken(key); n++) {
    key = `_${uid}_${n}`
  }
  return key
}

/**
 * A component's node in the model, and a mirror of the model's tree that
 * outlives a `KeepAlive` deactivation, so a reactivated subtree can go back
 * in whole.
 */
export class ModelNode<T extends Kind = Kind> {
  readonly kind: T
  readonly key: string
  readonly path: string
  readonly parent: ModelNode | undefined
  readonly children: Array<ModelNode> = []
  /** The node's rect, as the model places it. */
  readonly output: ShallowRef<Rect.Rect>
  readonly root: ModelRoot
  readonly #props: () => PropsByKind[T]
  // Whether the node is in the store, and whether its component is active.
  #live = true
  #active = true
  #off: (() => void) | undefined

  constructor(
    kind: T,
    key: string,
    parent: ModelNode | undefined,
    root: ModelRoot,
    props: () => PropsByKind[T],
  ) {
    this.kind = kind
    this.key = key
    this.path = parent === undefined ? key : `${parent.path}.${key}`
    this.parent = parent
    this.root = root
    this.#props = props
    this.output = shallowRef(Rect.zero)
  }

  /** The spec of the node and its active descendants, with their current props. */
  spec(): Model.Spec {
    const children = this.children.filter((child) => child.#active).map((child) => child.spec())
    // The mirror holds only the children each kind accepts.
    const boxes = children as ReadonlyArray<Model.Spec<string, 'group' | 'flex'>>
    switch (this.kind) {
      case 'group':
        return Model.group(this.key, this.#props() as Model.GroupProps, boxes)
      case 'flex':
        return Model.flex(
          this.key,
          this.#props() as Model.FlexProps,
          children as ReadonlyArray<Model.Spec<string, 'item'>>,
        )
      case 'item':
        return Model.item(this.key, this.#props() as Model.ItemProps, boxes)
    }
    throw new TypeError(`Unknown node kind "${this.kind}"`)
  }

  /** Subscribes the node's output, and those of its live descendants. */
  bind(): void {
    if (!this.#live) {
      return
    }
    const store = this.root.store
    this.output.value = store.get(this.path, 'rect')
    this.#off?.()
    this.#off = store.subscribe(this.path, 'rect', (next) => {
      this.output.value = next
    })
    for (const child of this.children) {
      child.bind()
    }
  }

  unbind(): void {
    this.#off?.()
    this.#off = undefined
  }

  update(props: PropsByKind[T]): void {
    if (this.#live) {
      this.root.enqueue((m) => m.update(this.path, props))
    }
  }

  /** Inserts the node under its parent and applies the queue, so its output is placed. */
  insert(): void {
    const parent = this.parent as ModelNode
    parent.children.push(this)
    this.root.enqueue((m) => m.insert(parent.path, this.spec()))
    this.root.flush()
  }

  /** Sets the order of the children that `ordered` lists, the rest after them. */
  order(ordered: ReadonlyArray<ModelNode>): void {
    const live = this.children.filter((child) => child.#live)
    const listed = ordered.filter((child) => child.parent === this && child.#live)
    const next = [...new Set([...listed, ...live])]
    if (next.every((child, index) => child === live[index])) {
      return
    }
    const rest = this.children.filter((child) => !child.#live)
    this.children.splice(0, this.children.length, ...next, ...rest)
    this.root.enqueue((m) =>
      m.setChildren(
        this.path,
        next.map((child) => child.path),
      ),
    )
  }

  /** Removes the node for good, as its component unmounts. */
  detach(): void {
    this.#drop()
    const siblings = this.parent?.children
    siblings?.splice(siblings.indexOf(this), 1)
  }

  deactivate(): void {
    this.#active = false
    this.#drop()
  }

  // A deactivated parent takes this node back in with its own subtree, so
  // the node waits for it.
  activate(): void {
    this.#active = true
    const parent = this.parent
    if (this.#live || parent === undefined || !parent.#live) {
      return
    }
    // The model appends it, so the mirror does too.
    parent.children.splice(parent.children.indexOf(this), 1)
    parent.children.push(this)
    this.root.enqueue((m) => m.insert(parent.path, this.spec()))
    this.root.flush()
    this.#revive()
    this.bind()
  }

  setRoot(rect: Rect.Rect): void {
    this.root.enqueue((m) => m.setRoot(rect))
  }

  #drop(): void {
    if (this.#live && this.parent !== undefined) {
      this.root.enqueue((m) => m.remove(this.path))
      this.#die()
    }
  }

  #die(): void {
    this.#live = false
    this.unbind()
    for (const child of this.children) {
      child.#die()
    }
  }

  #revive(): void {
    this.#live = true
    for (const child of this.children) {
      if (child.#active) {
        child.#revive()
      }
    }
  }
}

// The rect of the sizing context the component sits in.
function useParentRect(): () => Rect.Rect {
  const x = useParentX()
  const y = useParentY()
  const width = useParentWidth()
  const height = useParentHeight()
  return () => Rect.make(x.value, y.value, width.value, height.value)
}

export interface ModelNodeOptions {
  /**
   * Makes the node a root, placed against this rect. Without it, the node
   * attaches to the model node above it, or becomes a root placed against
   * its sizing context when there is none it can attach to.
   */
  readonly root?: MaybeRefOrGetter<Rect.Rect>
}

/**
 * Gives the current component a node in the model. The node takes `props`
 * now and queues every change to them, and its output follows the model.
 * The component's children see the node as their parent, both as a model
 * node and as a sizing context.
 *
 * @param kind - The node kind.
 * @param props - The node's props, read reactively.
 * @param options - Makes the node a root.
 * @returns The node.
 * @throws `Error` when an item has no flex above it.
 */
export function useModelNode<T extends Kind>(
  kind: T,
  props: () => PropsByKind[T],
  options: ModelNodeOptions = {},
): ModelNode<T> {
  const vm = getCurrentInstance()
  if (!vm) {
    throw new Error('useModelNode must be called within a Vue component')
  }
  const id = vm.vnode.props?.['id']

  let parent: ModelNode | undefined
  if (kind === 'item') {
    parent = inject(FLEX_PARENT, undefined)
    if (parent === undefined) {
      throw new Error(`No context found for channel "${FLEX_CHANNEL}"`)
    }
  } else if (options.root === undefined) {
    const above = inject(MODEL_PARENT, null)
    // The model's group and item hold boxes; a flex holds items only.
    parent = above !== null && above.kind !== 'flex' ? above : undefined
  }

  let node: ModelNode<T>
  if (parent === undefined) {
    const rect = options.root ?? useParentRect()
    const root = new ModelRoot(inject(ssrContextKey, null) !== null)
    node = new ModelNode(kind, keyFor([], id, vm.uid), undefined, root, props)
    root.open(node.spec(), toValue(rect))
    watch(
      () => toValue(rect),
      (next) => {
        node.setRoot(next)
      },
      { flush: 'pre' },
    )
  } else {
    node = new ModelNode(kind, keyFor(parent.children, id, vm.uid), parent, parent.root, props)
    node.insert()
  }
  node.bind()

  watch(
    props,
    (next) => {
      node.update(next)
    },
    { flush: 'pre' },
  )

  onBeforeUnmount(() => {
    node.detach()
  })
  // A deactivated node leaves the layout, and a reactivated one rejoins it.
  // Both hooks are inert outside a `KeepAlive`.
  onDeactivated(() => {
    node.deactivate()
  })
  onActivated(() => {
    node.activate()
  })
  onScopeDispose(() => {
    node.unbind()
  })

  if (kind === 'item') {
    useChild(FLEX_CHANNEL, () => node)
  } else if (kind === 'flex') {
    const flex = node as ModelNode<'flex'>
    provide(FLEX_PARENT, flex)
    useChildren<ModelNode>(FLEX_CHANNEL, (children) => {
      flex.order(children.map((child) => child.input.value))
    })
  }

  if (options.root === undefined) {
    // The children get a box of their own, so their outlines are not this
    // component's parent's.
    blockOutlines()
  }
  provide(MODEL_PARENT, node)
  provideParentRect(node.output)

  return node
}
