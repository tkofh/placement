// The type-level vocabulary of the model: node kinds, their props and
// outputs, and the index that maps every path in a model to its kind.
// Nothing here exists at runtime except through `import type`.
import type { Box, BoxInput } from '../../box.ts'
import type { Frame, FrameInput } from '../../frame.ts'
import type { LengthInput } from '../../length.ts'
import type { Offset } from '../../offset.ts'
import type { Point } from '../../point.ts'
import type { Rect } from '../../rect.ts'
import type { Flexbox } from '../flexbox.ts'

/**
 * A flex's gutter as plain data whose sides may be percentages of the
 * flex's placed rect: `top` and `bottom` of its height, `left` and `right`
 * of its width. A number is pixels, and an omitted side is `0`.
 */
export interface GutterInput {
  /** The inset from the top edge. */
  readonly top?: LengthInput | undefined
  /** The inset from the right edge. */
  readonly right?: LengthInput | undefined
  /** The inset from the bottom edge. */
  readonly bottom?: LengthInput | undefined
  /** The inset from the left edge. */
  readonly left?: LengthInput | undefined
}

/**
 * A translation as plain data whose components may be percentages of the
 * node's own size, as in CSS `translate`: `x` of its width, `y` of its
 * height. A number is pixels, and an omitted component is `0`.
 */
export interface TranslateInput {
  /** The horizontal translation. */
  readonly x?: LengthInput | undefined
  /** The vertical translation. */
  readonly y?: LengthInput | undefined
}

/**
 * The props of a group node, which places a rect against its parent's rect.
 * Every field is optional, and `undefined` resets a field to its default.
 * `update` replaces a field whole, so it never merges a plain input into
 * the one before it.
 */
export interface GroupProps {
  /**
   * The positioned box that `Box.apply` (from `placement/box`) solves
   * against the parent rect: a `Box`, or its fields as a
   * `BoxInput<LengthInput>`, whose percentages resolve against the parent
   * rect. Defaults to `Box.make({})`, which fills the parent.
   */
  readonly box?: Box | BoxInput<LengthInput> | undefined
  /**
   * The point of the rect, as a fraction of its size, that lands where the
   * box placed the rect's top-left corner. `Point.half` centers the rect on
   * that position. Defaults to `Point.zero`.
   */
  readonly origin?: Point | undefined
  /**
   * A final translation of the rect: a `Point`, or a `TranslateInput` whose
   * percentages resolve against the rect's own size. Defaults to
   * `Point.zero`.
   */
  readonly translate?: Point | TranslateInput | undefined
}

/**
 * The props of a flex node: a group whose rect, contracted by `gutter`,
 * holds its items. Every field is optional, and `undefined` resets a field
 * to its default.
 */
export interface FlexProps extends GroupProps {
  /**
   * The container spec that `Flexbox.apply` (from `placement/flexbox`)
   * solves the items with. Defaults to `Flexbox.make({})`.
   */
  readonly layout?: Flexbox | undefined
  /**
   * The inset of the content rect from the placed rect: an `Offset`, or a
   * `GutterInput` whose percentages resolve against the placed rect. The
   * node's output and its items' basis are the content rect. Defaults to
   * `Offset.zero`.
   */
  readonly gutter?: Offset | GutterInput | undefined
}

/**
 * The props of an item node, which a flex container places. `undefined`
 * resets a field to its default.
 */
export interface ItemProps {
  /**
   * The flex item that the parent's `Flexbox.apply` reads: a `Frame`, or
   * its fields as a `FrameInput<undefined, LengthInput>`, whose
   * percentages resolve against the parent's content rect. Horizontal
   * margins and sizes resolve against its width and vertical ones against
   * its height, which differs from CSS for vertical margins and matches
   * `@placement/vue`. A size that resolves to `NaN` is unset. The input
   * takes no `id`, because the path is the item's id. Defaults to
   * `Frame.make({})`.
   */
  readonly frame?: Frame | FrameInput<undefined, LengthInput> | undefined
}

/**
 * Every node kind: its props, the name of its output, and the kinds it
 * accepts as children. A new layout type adds an entry.
 */
export interface Kinds {
  group: {
    readonly props: GroupProps
    readonly output: 'rect'
    readonly accepts: 'group' | 'flex'
  }
  flex: {
    readonly props: FlexProps
    readonly output: 'rect'
    readonly accepts: 'item'
  }
  item: {
    readonly props: ItemProps
    readonly output: 'rect'
    readonly accepts: 'group' | 'flex'
  }
}

/** A node kind. */
export type Kind = keyof Kinds

/** The kinds a model's root can have. */
export type RootKind = 'group' | 'flex'

/** What each output name stands for. A new output type adds an entry. */
export interface Outputs {
  rect: Rect
}

/** An output name. */
export type OutputName = keyof Outputs

export type PropsOf<T extends Kind> = Kinds[T]['props']
export type OutputOf<T extends Kind> = Kinds[T]['output']
export type AcceptsOf<T extends Kind> = Kinds[T]['accepts']

/**
 * A model's paths, each mapped to the kind of its node. A path joins keys
 * from the root with dots, so the tree is implicit in the paths.
 */
export type Index = { readonly [path: string]: Kind }

/** The index of a model whose paths are only known at runtime. */
export type Dynamic = { readonly [path: string]: Kind }

/** The paths of an index. */
export type Paths<I extends Index> = keyof I & string

export type IsDynamic<I extends Index> = string extends keyof I ? true : false

export type Flatten<T> = { [K in keyof T]: T[K] } & {}

/** The phantom key that carries a spec's subtree index. */
export declare const SubIndex: unique symbol

/** A spec's descendants, by path relative to it. */
export type SubOf<S> = S extends { readonly [SubIndex]: infer I extends Index } ? I : never

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Keys that would read as a path or a position. */
export type BadKey = '' | `${string}.${string}` | `${Digit}${string}`

/** The type of a spec whose key is invalid. */
export interface InvalidKey<K extends string> {
  readonly 'invalid key': K
}

/** The type of a spec or insert whose key a sibling already has. */
export interface DuplicateKey<K extends string> {
  readonly 'duplicate key': K
}

/** The type of an insert whose parent does not accept the node. */
export interface NotAccepted<P extends Kind, T extends Kind> {
  readonly 'not accepted': { readonly parent: P; readonly child: T }
}

/** The type of an insert without a key. */
export interface MissingKey {
  readonly 'missing key': true
}

/** The structural part of a spec that the index types read. */
export interface SpecShape {
  readonly key: string | undefined
  readonly kind: Kind
  readonly [SubIndex]: Index
}

/** The entries a child contributes to its parent under the key `k`. */
export type Place<k extends string, H extends SpecShape> = { readonly [_ in k]: H['kind'] } & {
  readonly [J in Paths<SubOf<H>> as `${k}.${J}`]: SubOf<H>[J]
}

// TypeScript intersects every signature and property that matches a path,
// so a pattern stays sound only when its value covers whatever it might
// match, now or after an insert: any kind.
type Patterns<H extends SpecShape> = [Exclude<H['key'], undefined>] extends [never]
  ? { readonly [x: `${number}` | `${number}.${string}`]: Kind }
  : { readonly [x: string]: Kind }

type KeyAt<H extends SpecShape, N extends string> = H['key'] extends string ? H['key'] : N

/**
 * Folds a tuple of children into an index relative to their parent,
 * counting positions as it goes and collecting duplicate keys. A plain array
 * (from `.map`) and a child with a runtime key give patterns.
 */
type Fold<
  C extends ReadonlyArray<SpecShape>,
  Acc extends Index = {},
  Seen extends ReadonlyArray<unknown> = [],
  Keys extends string = never,
  Dupes extends string = never,
> = number extends C['length']
  ? { readonly sub: Patterns<C[number]>; readonly dupes: never }
  : C extends readonly [infer H extends SpecShape, ...infer T extends ReadonlyArray<SpecShape>]
    ? string extends H['key']
      ? Fold<T, Acc & Patterns<H>, [...Seen, unknown], Keys, Dupes>
      : Fold<
          T,
          Acc & Place<KeyAt<H, `${Seen['length']}`>, H>,
          [...Seen, unknown],
          Keys | KeyAt<H, `${Seen['length']}`>,
          Dupes | (KeyAt<H, `${Seen['length']}`> & Keys)
        >
    : { readonly sub: Acc; readonly dupes: Dupes }

/**
 * The subtree index of a container with key `K` and children `C`, or an
 * error type when a key is invalid or repeated.
 */
export type ContainerIndex<
  K extends string | undefined,
  C extends ReadonlyArray<SpecShape>,
> = K extends BadKey
  ? InvalidKey<K & string>
  : Fold<C> extends { readonly sub: infer S extends Index; readonly dupes: infer D extends string }
    ? [D] extends [never]
      ? Flatten<S>
      : DuplicateKey<D>
    : never

/** The full index of a model whose root is `S`. */
export type IndexOf<S extends SpecShape> = string extends S['key']
  ? Dynamic
  : Flatten<Place<KeyAt<S, 'root'>, S>> extends infer I extends Index
    ? I
    : never

/** The paths of an index whose nodes accept children. */
export type ContainerPaths<I extends Index> = {
  [J in Paths<I>]: [AcceptsOf<I[J]>] extends [never] ? never : J
}[Paths<I>]

/** The paths of an index that are children of `P`. */
export type ChildPaths<I extends Index, P extends string> =
  IsDynamic<I> extends true
    ? string
    : {
        [J in Paths<I>]: J extends `${P}.${infer R}`
          ? R extends `${string}.${string}`
            ? never
            : J
          : never
      }[Paths<I>]

/** The paths that `remove` accepts: every path but the root's. */
export type RemovablePaths<I extends Index> =
  IsDynamic<I> extends true ? Paths<I> : Extract<Paths<I>, `${string}.${string}`>

/** The index without `K` and its descendants. */
export type Without<I extends Index, K extends string> = {
  [J in Paths<I> as J extends K | `${K}.${string}` ? never : J]: I[J]
}

/** The output of the node at `K`. */
export type OutputAt<I extends Index, K extends Paths<I>> = OutputOf<I[K]>
