// The live side of a model: one signal graph per store, with a node per path.
//
// Each node holds its props, its ordered children, and an `alive` flag in
// signals. Its output is a computed that returns the previous rect when the
// new one is equal, so an unchanged node never notifies. A flex node adds a
// solve computed that places all of its items at once. The graph discovers
// its own evaluation order, so each kind only states what it reads.
//
// Callbacks never run inside alien-signals. A watcher effect per observed
// node records changes, and the runtime delivers them in rounds after each
// batch (see `apply` and `#deliver`).
import { computed, effect, endBatch, setActiveSub, signal, startBatch } from 'alien-signals'
import * as Box from '../../box.ts'
import * as Frame from '../../frame.ts'
import * as Point from '../../point.ts'
import * as Rect from '../../rect.ts'
import * as Flexbox from '../flexbox.ts'
import { ACCEPTS, ROOT_KINDS, type Spec, checkKey, checkProps, isSpec, keyAt } from './spec.ts'
import type { FlexProps, GroupProps, ItemProps, Kind, OutputName, Outputs } from './types.ts'

interface Signal<T> {
  (): T
  (value: T): void
}

type Props = GroupProps | FlexProps | ItemProps

/** One output change: `prev` is `undefined` for an insert, `next` for a removal. */
export interface Change<T> {
  readonly prev: T | undefined
  readonly next: T | undefined
}

type Output = Outputs[OutputName]

type PathListener = (next: Output, prev: Output) => void
type AnyListener = (changes: ReadonlyMap<string, Change<Output>>) => void

interface Node {
  readonly path: string
  readonly kind: Kind
  readonly parent: Node | undefined
  readonly props: Signal<Props>
  readonly children: Signal<ReadonlyArray<Node>>
  readonly alive: Signal<boolean>
  /** The node's output. */
  readonly rect: () => Rect.Rect
  /** For a flex: each item's rect. */
  readonly solved: (() => ReadonlyMap<Node, Rect.Rect>) | undefined
  /** Every computed of the node, to unlink when it is removed. */
  readonly computeds: ReadonlyArray<() => unknown>
  readonly listeners: Set<PathListener>
  watcher: (() => void) | undefined
  /** The output the watcher saw last. */
  seen: Rect.Rect | undefined
}

/** One op of a draft. */
export type Op =
  | { readonly op: 'update'; readonly path: string; readonly props: unknown }
  | {
      readonly op: 'insert'
      readonly parent: string
      readonly spec: unknown
      readonly before: string | undefined
    }
  | { readonly op: 'remove'; readonly path: string }
  | { readonly op: 'setChildren'; readonly parent: string; readonly paths: ReadonlyArray<string> }
  | { readonly op: 'setRoot'; readonly rect: unknown }

const OUTPUT_OF: { readonly [T in Kind]: OutputName } = {
  group: 'rect',
  flex: 'rect',
  item: 'rect',
}

const defaultBox = Box.make({})
const defaultLayout = Flexbox.make({})
const defaultFrame = Frame.make({})
const noItems: ReadonlyMap<Node, Rect.Rect> = new Map()

// "Did this rect change" compares fields exactly. The solvers are pure, so
// equal inputs give equal outputs, and a tolerance would hide real moves
// (see the carve-out in PRECISION.md).
const sameRect = (a: Rect.Rect, b: Rect.Rect): boolean =>
  Object.is(a.x, b.x) &&
  Object.is(a.y, b.y) &&
  Object.is(a.width, b.width) &&
  Object.is(a.height, b.height)

// Places a group or a flex: the box against the parent rect, then the
// origin and the translation, as `useRect` does in `@placement/vue`.
function place(props: GroupProps, parent: Rect.Rect): Rect.Rect {
  let rect = Box.apply(props.box ?? defaultBox, parent)
  if (props.origin !== undefined) {
    rect = Rect.align(rect, Point.make(rect.x, rect.y), props.origin)
  }
  if (props.translate !== undefined) {
    rect = Rect.translate(rect, props.translate.x, props.translate.y)
  }
  return rect
}

// Runs `fn` outside any active subscriber, so effects created inside it are
// not owned by whatever is running.
function detached<T>(fn: () => T): T {
  const prev = setActiveSub(undefined)
  try {
    return fn()
  } finally {
    setActiveSub(prev)
  }
}

/** A path's parent path, or `undefined` for the root. */
const parentOf = (path: string): string | undefined => {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? undefined : path.slice(0, dot)
}

/**
 * The structure of a model as a draft would leave it, without touching any
 * signal, so `apply` can reject a draft before it writes anything.
 */
class Shadow {
  readonly #runtime: Runtime
  // A path's kind, or `null` once removed.
  readonly #kinds = new Map<string, Kind | null>()
  readonly #children = new Map<string, Array<string>>()

  constructor(runtime: Runtime) {
    this.#runtime = runtime
  }

  kind(path: string): Kind | undefined {
    const kind = this.#kinds.get(path)
    if (kind !== undefined) {
      return kind ?? undefined
    }
    return this.#runtime.node(path)?.kind
  }

  children(path: string): Array<string> {
    let children = this.#children.get(path)
    if (children === undefined) {
      children = (this.#runtime.node(path)?.children() ?? []).map((child) => child.path)
      this.#children.set(path, children)
    }
    return children
  }

  require(path: string): Kind {
    const kind = this.kind(path)
    if (kind === undefined) {
      throw new RangeError(`No node at "${path}"`)
    }
    return kind
  }

  insert(parent: string, spec: Spec, path: string, before: string | undefined): void {
    const siblings = this.children(parent)
    const at = before === undefined ? siblings.length : siblings.indexOf(before)
    siblings.splice(at, 0, path)
    this.#add(spec, path)
  }

  #add(spec: Spec, path: string): void {
    this.#kinds.set(path, spec.kind)
    const children = spec.children.map((child, index) => `${path}.${keyAt(child, index)}`)
    this.#children.set(path, children)
    for (const [index, child] of spec.children.entries()) {
      this.#add(child, children[index] as string)
    }
  }

  remove(path: string): void {
    const parent = parentOf(path) as string
    const siblings = this.children(parent)
    siblings.splice(siblings.indexOf(path), 1)
    this.#drop(path)
  }

  #drop(path: string): void {
    for (const child of this.children(path)) {
      this.#drop(child)
    }
    this.#kinds.set(path, null)
    this.#children.delete(path)
  }

  reorder(parent: string, paths: ReadonlyArray<string>): void {
    this.#children.set(parent, [...paths])
  }
}

/** The signal graph of one store. */
export class Runtime {
  readonly #nodes = new Map<string, Node>()
  readonly #root: Signal<Rect.Rect>
  readonly #anyListeners = new Set<AnyListener>()
  #pending = new Map<Node, { prev: Rect.Rect | undefined; next: Rect.Rect | undefined }>()
  #delivering = false

  constructor(spec: Spec, root: Rect.Rect) {
    if (!isSpec(spec)) {
      throw new TypeError('The model root must be a spec')
    }
    if (!ROOT_KINDS.has(spec.kind)) {
      throw new TypeError(`A model root cannot be a ${spec.kind}`)
    }
    if (!Rect.isRect(root)) {
      throw new TypeError('The root rect must be a Rect')
    }
    this.#root = signal(root)
    this.#build(spec, spec.key ?? 'root', undefined)
  }

  node(path: string): Node | undefined {
    return this.#nodes.get(path)
  }

  #require(path: string): Node {
    const node = this.#nodes.get(path)
    if (node === undefined) {
      throw new RangeError(`No node at "${path}"`)
    }
    return node
  }

  #build(spec: Spec, path: string, parent: Node | undefined): Node {
    const node = this.#create(spec.kind, path, parent, spec.props)
    this.#nodes.set(path, node)
    node.children(
      spec.children.map((child, index) =>
        this.#build(child, `${path}.${keyAt(child, index)}`, node),
      ),
    )
    return node
  }

  #create(kind: Kind, path: string, parent: Node | undefined, initial: Props): Node {
    const props = signal<Props>(initial)
    const children = signal<ReadonlyArray<Node>>([])
    const alive = signal(true)
    const root = this.#root

    // A removed node's computeds read only `alive`, which unlinks them from
    // everything else on their next evaluation.
    const stable = (next: () => Rect.Rect) =>
      computed<Rect.Rect>((prev) => {
        if (!alive()) {
          return prev ?? Rect.zero
        }
        const rect = next()
        return prev !== undefined && sameRect(prev, rect) ? prev : rect
      })

    const parentRect = (): Rect.Rect => (parent === undefined ? root() : parent.rect())

    let rect: () => Rect.Rect
    let solved: (() => ReadonlyMap<Node, Rect.Rect>) | undefined
    const computeds: Array<() => unknown> = []

    if (kind === 'item') {
      rect = stable(() => parent?.solved?.().get(node) ?? Rect.zero)
    } else if (kind === 'group') {
      rect = stable(() => place(props() as GroupProps, parentRect()))
    } else {
      const outer = computed(() =>
        alive() ? place(props() as FlexProps, parentRect()) : Rect.zero,
      )
      rect = stable(() => {
        const gutter = (props() as FlexProps).gutter
        return gutter === undefined ? outer() : Rect.contract(outer(), gutter)
      })
      solved = computed(() => {
        if (!alive()) {
          return noItems
        }
        const items = children()
        const rects = Flexbox.apply(
          items.map((child) => (child.props() as ItemProps).frame ?? defaultFrame),
          (props() as FlexProps).layout ?? defaultLayout,
          rect(),
        )
        return new Map(items.map((child, index) => [child, rects[index] ?? Rect.zero]))
      })
      computeds.push(outer, solved)
    }
    computeds.push(rect)

    const node: Node = {
      path,
      kind,
      parent,
      props,
      children,
      alive,
      rect,
      solved,
      computeds,
      listeners: new Set(),
      watcher: undefined,
      seen: undefined,
    }
    return node
  }

  /**
   * Reads a node's output.
   *
   * @throws `RangeError` when no node has the path.
   * @throws `TypeError` when the node's output is not `expect`.
   */
  get(path: string, expect: OutputName | undefined): Output {
    const node = this.#require(path)
    this.#expect(node, expect)
    return node.rect()
  }

  #expect(node: Node, expect: OutputName | undefined): void {
    if (expect !== undefined && OUTPUT_OF[node.kind] !== expect) {
      throw new TypeError(
        `The node at "${node.path}" gives a ${OUTPUT_OF[node.kind]}, not a ${expect}`,
      )
    }
  }

  subscribe(path: string, expect: OutputName | undefined, listener: PathListener): () => void {
    const node = this.#require(path)
    this.#expect(node, expect)
    // Wrap the listener so that subscribing one function twice gives two
    // subscriptions, each with its own unsubscribe.
    const entry: PathListener = (next, prev) => listener(next, prev)
    node.listeners.add(entry)
    this.#watch(node, false)
    return () => {
      if (node.listeners.delete(entry)) {
        this.#unwatch(node)
      }
    }
  }

  subscribeAll(listener: AnyListener): () => void {
    const entry: AnyListener = (changes) => listener(changes)
    this.#anyListeners.add(entry)
    if (this.#anyListeners.size === 1) {
      for (const node of this.#nodes.values()) {
        this.#watch(node, false)
      }
    }
    return () => {
      if (this.#anyListeners.delete(entry) && this.#anyListeners.size === 0) {
        for (const node of this.#nodes.values()) {
          this.#unwatch(node)
        }
      }
    }
  }

  // A watcher records each new output of its node. On an inserted node it
  // records the first one too, with no `prev`.
  #watch(node: Node, recordFirst: boolean): void {
    if (node.watcher !== undefined) {
      return
    }
    let first = !recordFirst
    node.watcher = detached(() =>
      effect(() => {
        const next = node.rect()
        if (first) {
          first = false
          node.seen = next
        } else if (next !== node.seen) {
          this.#record(node, node.seen, next)
          node.seen = next
        }
      }),
    )
  }

  #unwatch(node: Node): void {
    if (node.watcher !== undefined && node.listeners.size === 0 && this.#anyListeners.size === 0) {
      node.watcher()
      node.watcher = undefined
      node.seen = undefined
    }
  }

  #record(node: Node, prev: Rect.Rect | undefined, next: Rect.Rect | undefined): void {
    const pending = this.#pending.get(node)
    if (pending === undefined) {
      this.#pending.set(node, { prev, next })
    } else {
      pending.next = next
    }
  }

  /**
   * Validates every op, then applies them in one batch and delivers the
   * changes they caused.
   *
   * @throws `RangeError` or `TypeError` from validation, before any write.
   */
  apply(ops: ReadonlyArray<Op>): void {
    const checked = this.#validate(ops)

    const inserted: Array<Node> = []
    const removed: Array<Node> = []
    startBatch()
    try {
      for (const op of checked) {
        this.#exec(op, inserted, removed)
      }
      if (this.#anyListeners.size > 0) {
        for (const node of inserted) {
          if (node.alive()) {
            this.#watch(node, true)
          }
        }
      }
    } finally {
      endBatch()
    }

    for (const node of removed) {
      this.#unlink(node)
    }
    this.#deliver()
  }

  #validate(ops: ReadonlyArray<Op>): ReadonlyArray<Op> {
    const shadow = new Shadow(this)
    const checked: Array<Op> = []
    for (const op of ops) {
      switch (op.op) {
        case 'update': {
          const props = checkProps(shadow.require(op.path), op.props)
          checked.push({ op: 'update', path: op.path, props })
          break
        }
        case 'insert': {
          const parentKind = shadow.require(op.parent)
          const spec = op.spec
          if (!isSpec(spec)) {
            throw new TypeError('Only a spec can be inserted')
          }
          if (spec.key === undefined) {
            throw new RangeError(`An insert under "${op.parent}" needs a key`)
          }
          checkKey(spec.key)
          if (!ACCEPTS[parentKind].has(spec.kind)) {
            throw new TypeError(
              `The ${parentKind} at "${op.parent}" does not accept a ${spec.kind}`,
            )
          }
          const path = `${op.parent}.${spec.key}`
          if (shadow.kind(path) !== undefined) {
            throw new RangeError(`A node already has the path "${path}"`)
          }
          if (op.before !== undefined && !shadow.children(op.parent).includes(op.before)) {
            throw new RangeError(`"${op.before}" is not a child of "${op.parent}"`)
          }
          shadow.insert(op.parent, spec, path, op.before)
          checked.push(op)
          break
        }
        case 'remove': {
          shadow.require(op.path)
          if (parentOf(op.path) === undefined) {
            throw new RangeError('The root cannot be removed')
          }
          shadow.remove(op.path)
          checked.push(op)
          break
        }
        case 'setChildren': {
          shadow.require(op.parent)
          const current = shadow.children(op.parent)
          const next = new Set(op.paths)
          if (
            next.size !== op.paths.length ||
            next.size !== current.length ||
            !current.every((path) => next.has(path))
          ) {
            throw new RangeError(
              `setChildren must list each child of "${op.parent}" once: ${current.join(', ')}`,
            )
          }
          shadow.reorder(op.parent, op.paths)
          checked.push(op)
          break
        }
        case 'setRoot': {
          if (!Rect.isRect(op.rect)) {
            throw new TypeError('The root rect must be a Rect')
          }
          checked.push(op)
          break
        }
      }
    }
    return checked
  }

  #exec(op: Op, inserted: Array<Node>, removed: Array<Node>): void {
    switch (op.op) {
      case 'update': {
        const node = this.#require(op.path)
        node.props({ ...node.props(), ...(op.props as Props) })
        break
      }
      case 'insert': {
        const parent = this.#require(op.parent)
        const spec = op.spec as Spec
        const node = this.#build(spec, `${op.parent}.${spec.key}`, parent)
        const siblings = [...parent.children()]
        const at =
          op.before === undefined
            ? siblings.length
            : siblings.findIndex((child) => child.path === op.before)
        siblings.splice(at, 0, node)
        parent.children(siblings)
        this.#collect(node, inserted)
        break
      }
      case 'remove': {
        const node = this.#require(op.path)
        const parent = node.parent as Node
        parent.children(parent.children().filter((child) => child !== node))
        const subtree: Array<Node> = []
        this.#collect(node, subtree)
        for (const each of subtree) {
          this.#nodes.delete(each.path)
          each.alive(false)
          each.listeners.clear()
          if (each.watcher !== undefined) {
            each.watcher()
            each.watcher = undefined
          }
          if (this.#anyListeners.size > 0 && (each.seen !== undefined || this.#pending.has(each))) {
            this.#record(each, each.seen, undefined)
          }
          each.seen = undefined
          removed.push(each)
        }
        break
      }
      case 'setChildren': {
        const parent = this.#require(op.parent)
        parent.children(op.paths.map((path) => this.#require(path)))
        break
      }
      case 'setRoot': {
        this.#root(op.rect as Rect.Rect)
        break
      }
    }
  }

  #collect(node: Node, into: Array<Node>): void {
    into.push(node)
    for (const child of node.children()) {
      this.#collect(child, into)
    }
  }

  // alien-signals keeps a computed linked to its sources until it loses its
  // last subscriber, and one that was only ever read never has one. Watching
  // each computed for a moment re-evaluates it (it reads only `alive` now)
  // and then drops it, which unlinks it from `alive` as well.
  #unlink(node: Node): void {
    detached(() => {
      for (const read of node.computeds) {
        effect(() => {
          read()
        })()
      }
    })
  }

  // Delivers recorded changes in rounds: path listeners first, then the
  // any-change listeners with every change of the round. A listener that
  // calls `mutate` adds to the next round. A listener that throws stops
  // delivery, and changes not yet delivered are dropped.
  #deliver(): void {
    if (this.#delivering) {
      return
    }
    this.#delivering = true
    try {
      while (this.#pending.size > 0) {
        const round = this.#pending
        this.#pending = new Map()

        for (const [node, { prev, next }] of round) {
          if (prev !== undefined && next !== undefined && node.alive()) {
            for (const listener of node.listeners) {
              listener(next, prev)
            }
          }
        }

        if (this.#anyListeners.size > 0) {
          const changes = new Map<string, Change<Output>>()
          for (const [node, change] of round) {
            // A path removed and inserted again in one draft gets one entry.
            const earlier = changes.get(node.path)
            const prev = earlier === undefined ? change.prev : earlier.prev
            if (prev === undefined && change.next === undefined) {
              changes.delete(node.path)
            } else {
              changes.set(node.path, { prev, next: change.next })
            }
          }
          if (changes.size > 0) {
            for (const listener of this.#anyListeners) {
              listener(changes)
            }
          }
        }
      }
    } finally {
      this.#pending.clear()
      this.#delivering = false
    }
  }
}
