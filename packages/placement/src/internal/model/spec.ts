import { Pipeable } from 'curvy/utils'
import * as Props from './props.ts'
import type {
  AcceptsOf,
  ContainerIndex,
  Index,
  Kind,
  PropsOf,
  RootKind,
  SpecShape,
  SubIndex,
} from './types.ts'

const TypeBrand: unique symbol = Symbol('placement/model/spec')
type TypeBrand = typeof TypeBrand

/**
 * A node of a model: its kind, its props, its children, and the key it goes
 * by among its siblings. A spec is immutable data, and `Model.store` turns a
 * tree of them into a live store.
 *
 * The type parameters carry what the checker knows: `K` is the literal key,
 * or `undefined` for a node that its position names; `T` is the kind; `S`
 * indexes the node's descendants by path relative to it.
 *
 * The module exports this class as a type only. To construct one, use the
 * constructor for its kind, such as `Model.flex`.
 */
class Spec<
  K extends string | undefined = string | undefined,
  T extends Kind = Kind,
  S extends Index = Index,
>
  extends Pipeable
  implements SpecShape
{
  readonly [TypeBrand]: TypeBrand = TypeBrand
  declare readonly [SubIndex]: S

  /** The key, or `undefined` when the node's position among its siblings names it. */
  readonly key: K
  /** The node kind. */
  readonly kind: T
  /** The props, frozen. */
  readonly props: PropsOf<T>
  /** The children, in order, frozen. */
  readonly children: ReadonlyArray<Spec>

  constructor(key: K, kind: T, props: PropsOf<T>, children: ReadonlyArray<Spec>) {
    super()

    this.key = key
    this.kind = kind
    this.props = props
    this.children = children
  }

  /**
   * Formats the spec for Node console inspection, as `Spec flex "toolbar" (2)`.
   *
   * @returns The debug string.
   */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    const key = this.key === undefined ? '' : ` "${this.key}"`
    return `Spec ${this.kind}${key} (${this.children.length})`
  }
}

export type { Spec }

/**
 * Checks whether a value is a `Spec`.
 *
 * @param value - The value to check.
 * @returns `true` when `value` is a `Spec`.
 * @example
 * ```ts
 * Model.isSpec(Model.item({})) // true
 * Model.isSpec({ kind: 'item' }) // false
 * ```
 */
export const isSpec = (value: unknown): value is Spec =>
  typeof value === 'object' && value !== null && TypeBrand in value

/** The kinds each kind accepts as children, mirroring `Kinds['accepts']`. */
export const ACCEPTS: { readonly [T in Kind]: ReadonlySet<Kind> } = {
  group: new Set(['group', 'flex']),
  flex: new Set(['item']),
  item: new Set(['group', 'flex']),
}

/** The kinds a root can have, mirroring `RootKind`. */
export const ROOT_KINDS: ReadonlySet<Kind> = new Set<RootKind>(['group', 'flex'])

/**
 * Checks a key: non-empty, without a dot, and not starting with a digit, so
 * it never reads as a path or collides with a position.
 *
 * @param key - The key to check.
 * @throws `RangeError` when the key is invalid.
 */
export function checkKey(key: string): void {
  if (key === '' || key.includes('.') || /^\d/.test(key)) {
    throw new RangeError(
      `Invalid key "${key}": it must be non-empty, without a dot, and not start with a digit`,
    )
  }
}

/**
 * The key of the child at `index`: its own, else its position.
 *
 * @param child - The child spec.
 * @param index - Its position among its siblings.
 * @returns The key.
 */
export const keyAt = (child: Spec, index: number): string => child.key ?? `${index}`

function make(kind: Kind, args: ReadonlyArray<unknown>): Spec {
  const keyed = typeof args[0] === 'string'
  const key = keyed ? (args[0] as string) : undefined
  const props = (keyed ? args[1] : args[0]) ?? {}
  const children = (keyed ? args[2] : args[1]) ?? []

  if (key !== undefined) {
    checkKey(key)
  }
  if (!Array.isArray(children)) {
    throw new TypeError(`The children of a ${kind} must be an array`)
  }

  const accepts = ACCEPTS[kind]
  const seen = new Set<string>()
  for (const [index, child] of children.entries()) {
    if (!isSpec(child)) {
      throw new TypeError(`Child ${index} of a ${kind} is not a spec`)
    }
    if (!accepts.has(child.kind)) {
      throw new TypeError(`A ${kind} does not accept a ${child.kind} child`)
    }
    const childKey = keyAt(child, index)
    if (seen.has(childKey)) {
      throw new RangeError(`Two children of a ${kind} share the key "${childKey}"`)
    }
    seen.add(childKey)
  }

  return new Spec(key, kind, Props.check(kind, props), Object.freeze([...children]))
}

type Children<T extends Kind> = ReadonlyArray<Spec<string | undefined, AcceptsOf<T>>>

// A constructor's result: a spec, or the error type `ContainerIndex` gives.
type Made<K extends string | undefined, T extends Kind, C extends ReadonlyArray<Spec>> =
  ContainerIndex<K, C> extends infer S extends Index ? Spec<K, T, S> : ContainerIndex<K, C>

/**
 * A node constructor. The key comes first when there is one. Children are
 * kept in order, and a child without a key takes its position as its key.
 */
export interface Constructor<T extends Kind> {
  <const K extends string, const C extends Children<T> = []>(
    key: K,
    props?: PropsOf<T>,
    children?: C,
  ): Made<K, T, C>
  <const C extends Children<T> = []>(props?: PropsOf<T>, children?: C): Made<undefined, T, C>
}

/**
 * Creates a group spec: a rect placed by `box` against its parent's rect,
 * then moved by `origin` and `translate`. A group holds groups and flex
 * containers.
 *
 * @param key - The key. Omit it to let the node's position name it.
 * @param props - The group props. Defaults to `{}`.
 * @param children - The children. Defaults to `[]`.
 * @returns The spec.
 * @throws `RangeError` when the key is invalid or two children share a key.
 * @throws `TypeError` when a prop has the wrong type or a child is not a
 * group or a flex.
 * @example
 * ```ts
 * Model.group('canvas', { box: Box.make({ width: 400, height: 300 }) }, [
 *   Model.flex('toolbar', {}, [Model.item({})]),
 * ])
 * ```
 */
export const group: Constructor<'group'> = (...args: ReadonlyArray<unknown>) =>
  make('group', args) as never

/**
 * Creates a flex container spec. It is placed like a group, and its content
 * rect (its rect contracted by `gutter`) holds its items, which `layout`
 * solves. A flex holds items only.
 *
 * @param key - The key. Omit it to let the node's position name it.
 * @param props - The flex props. Defaults to `{}`.
 * @param children - The items. Defaults to `[]`.
 * @returns The spec.
 * @throws `RangeError` when the key is invalid or two children share a key.
 * @throws `TypeError` when a prop has the wrong type or a child is not an
 * item.
 * @example
 * ```ts
 * Model.flex('toolbar', { layout: Flexbox.make({ gap: 8 }) }, [
 *   Model.item({ frame: Frame.make({ width: 100 }) }),
 *   Model.item('b', { frame: Frame.make({ grow: 1 }) }),
 * ])
 * ```
 */
export const flex: Constructor<'flex'> = (...args: ReadonlyArray<unknown>) =>
  make('flex', args) as never

/**
 * Creates a flex item spec. Its parent flex places it from `frame`, and it
 * holds groups and flex containers placed against its rect.
 *
 * @param key - The key. Omit it to let the node's position name it.
 * @param props - The item props. Defaults to `{}`.
 * @param children - The children. Defaults to `[]`.
 * @returns The spec.
 * @throws `RangeError` when the key is invalid or two children share a key.
 * @throws `TypeError` when a prop has the wrong type or a child is not a
 * group or a flex.
 * @example
 * ```ts
 * Model.item('b', { frame: Frame.make({ grow: 1 }) })
 * ```
 */
export const item: Constructor<'item'> = (...args: ReadonlyArray<unknown>) =>
  make('item', args) as never
