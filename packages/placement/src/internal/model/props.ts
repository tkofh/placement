// What a node's props mean. This module owns both halves of a prop: the
// check that `Model.group`, `Model.flex`, `Model.item`, and `update` run on
// what they are given, and the resolution that turns checked props into
// what the solvers take, against the basis that the node's kind names.
//
// A percentage's basis is a tree decision. A box resolves against its
// parent rect, a gutter and a translation against the node's placed rect,
// and a frame against its container's content rect. Horizontal fields
// resolve against the basis width and vertical fields against its height,
// as `useRect` and `internal/frame.ts` do in `@placement/vue`. The runtime
// hands each function its basis once and never sees a `Length`.
//
// Each plain input has one table that says what each of its fields is, and
// its check and its resolution both read it. The tables compose the field
// tables of core's input concepts, so a field a concept adds reaches the
// model without an edit here.
import * as AspectRatio from '../../aspectRatio.ts'
import * as Box from '../../box.ts'
import * as Frame from '../../frame.ts'
import * as Length from '../../length.ts'
import * as Offset from '../../offset.ts'
import * as Point from '../../point.ts'
import * as Rect from '../../rect.ts'
import { isPlainRecord } from '../../utils/object.ts'
import * as Alignment from '../alignment.ts'
import type { Field, FieldTable } from '../fields.ts'
import * as Flexbox from '../flexbox.ts'
import * as Margin from '../margin.ts'
import * as Sizing from '../sizing.ts'
import type {
  FlexProps,
  GroupProps,
  GutterInput,
  ItemProps,
  Kind,
  PropsOf,
  TranslateInput,
} from './types.ts'

/** The props of any node. */
export type NodeProps = GroupProps | FlexProps | ItemProps

type Table = { readonly [field: string]: Field }

const BOX = {
  top: 'y',
  right: 'x',
  bottom: 'y',
  left: 'x',
  ...Sizing.fields,
  ...Alignment.fields2d,
} as const satisfies FieldTable<Box.BoxInput<Length.LengthInput>>

const FRAME = {
  ...Sizing.fields,
  ...Margin.fields,
  ...Alignment.fields,
  grow: 'number',
  shrink: 'number',
} as const satisfies FieldTable<Frame.FrameInput<Length.LengthInput>>

const GUTTER = {
  top: 'y',
  right: 'x',
  bottom: 'y',
  left: 'x',
} as const satisfies FieldTable<GutterInput>

const TRANSLATE = { x: 'x', y: 'y' } as const satisfies FieldTable<TranslateInput>

const CHECKS: { readonly [F in Field]: (value: unknown) => boolean } = {
  x: Length.isLengthInput,
  y: Length.isLengthInput,
  ratio: AspectRatio.isAspectRatio,
  number: (value) => typeof value === 'number',
}

// An input with its lengths resolved: what the spec's own input takes.
type Resolved<T extends Table> = {
  -readonly [K in keyof T]?: T[K] extends 'ratio' ? AspectRatio.AspectRatio : number
}

// A length that resolves to `NaN` passes through: `Box`, `Frame`, and the
// margins each read it as unset or auto.
function resolveField(field: Field, value: unknown, basis: Rect.Rect): unknown {
  switch (field) {
    case 'x':
      return Length.resolve(value as Length.LengthInput, basis.width)
    case 'y':
      return Length.resolve(value as Length.LengthInput, basis.height)
    case 'ratio':
    case 'number':
      return value
  }
}

// A prop that takes a built spec `S` or a plain input that resolves to one.
interface Input<S> {
  /**
   * Checks for a spec, or for a plain object whose every field the input
   * has and, unless `undefined`, of the right type.
   */
  readonly check: (value: unknown) => boolean
  /**
   * The spec to solve: a built one as it is, a plain input resolved against
   * `basis`, or the spec of the empty input for `undefined`.
   */
  readonly resolve: (value: unknown, basis: Rect.Rect) => S
}

function input<T extends Table, S>(
  table: T,
  isSpec: (value: unknown) => value is S,
  build: (resolved: Resolved<T>) => S,
): Input<S> {
  const empty = build({})
  return {
    check: (value) =>
      isSpec(value) ||
      (isPlainRecord(value) &&
        Object.entries(value).every(([name, each]) => {
          const field = table[name]
          return field !== undefined && (each === undefined || CHECKS[field](each))
        })),
    resolve: (value, basis) => {
      if (value === undefined) {
        return empty
      }
      if (isSpec(value)) {
        return value
      }
      const resolved: Record<string, unknown> = {}
      for (const [name, each] of Object.entries(value as object)) {
        if (each !== undefined) {
          resolved[name] = resolveField(table[name] as Field, each, basis)
        }
      }
      return build(resolved as Resolved<T>)
    },
  }
}

const box: Input<Box.Box> = input(BOX, Box.isBox, Box.make)

const frameInput: Input<Frame.Frame> = input(FRAME, Frame.isFrame, Frame.make)

const gutter: Input<Offset.Offset> = input(GUTTER, Offset.isOffset, (sides) =>
  Offset.trbl(sides.top ?? 0, sides.right ?? 0, sides.bottom ?? 0, sides.left ?? 0),
)

const translate: Input<Point.Point> = input(TRANSLATE, Point.isPoint, (by) =>
  Point.make(by.x ?? 0, by.y ?? 0),
)

const defaultLayout = Flexbox.make({})

// Each prop's guard, by kind. A prop may also be `undefined`.
const GUARDS: { readonly [T in Kind]: Readonly<Record<string, (value: unknown) => boolean>> } = {
  group: { box: box.check, origin: Point.isPoint, translate: translate.check },
  flex: {
    box: box.check,
    origin: Point.isPoint,
    translate: translate.check,
    layout: Flexbox.isFlexbox,
    gutter: gutter.check,
  },
  item: { frame: frameInput.check },
}

// Copies and freezes a plain input, with a `[width, height]` ratio pair in
// it, so a spec never shares mutable data with its caller.
const freeze = (value: object): object =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([field, each]) => [
        field,
        Array.isArray(each) ? Object.freeze([...each]) : each,
      ]),
    ),
  )

/**
 * Checks props against a kind and returns a frozen copy. A plain input,
 * such as a box's fields, is copied and frozen too, so a spec never shares
 * mutable data with its caller.
 *
 * @param kind - The node kind.
 * @param props - The props to check.
 * @returns The frozen copy.
 * @throws `TypeError` when `props` is not an object, has a field the kind
 * lacks, or has a field of the wrong type, including a plain input with a
 * field it lacks or a length that is neither a number nor a `Length`.
 */
export function check<T extends Kind>(kind: T, props: unknown): PropsOf<T> {
  if (typeof props !== 'object' || props === null) {
    throw new TypeError(`The props of a ${kind} must be an object`)
  }
  const guards = GUARDS[kind]
  const copy: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(props)) {
    const guard = guards[field]
    if (guard === undefined) {
      throw new TypeError(`A ${kind} has no prop "${field}"`)
    }
    if (value !== undefined && !guard(value)) {
      throw new TypeError(`The "${field}" prop of a ${kind} has the wrong type`)
    }
    copy[field] = isPlainRecord(value) ? freeze(value) : value
  }
  return Object.freeze(copy) as PropsOf<T>
}

/**
 * Places a group or a flex in its parent rect: the box, then the origin and
 * the translation, as `useRect` does in `@placement/vue`. The box resolves
 * its percentages against the rect it is placed in, and the translation
 * against the rect it moves.
 *
 * @param props - The group or flex props.
 * @param parent - The parent rect.
 * @returns The placed rect.
 */
export function place(props: GroupProps, parent: Rect.Rect): Rect.Rect {
  let rect = Box.apply(box.resolve(props.box, parent), parent)
  if (props.origin !== undefined) {
    rect = Rect.align(rect, Point.make(rect.x, rect.y), props.origin)
  }
  if (props.translate !== undefined) {
    const by = translate.resolve(props.translate, rect)
    rect = Rect.translate(rect, by.x, by.y)
  }
  return rect
}

/**
 * A flex's content rect: its placed rect contracted by its gutter, which
 * resolves its percentages against the placed rect.
 *
 * @param props - The flex props.
 * @param placed - The flex's placed rect.
 * @returns The content rect.
 */
export function content(props: FlexProps, placed: Rect.Rect): Rect.Rect {
  return props.gutter === undefined
    ? placed
    : Rect.contract(placed, gutter.resolve(props.gutter, placed))
}

/**
 * The frame an item gives its container's solve. Its percentages resolve
 * against the container's content rect, its vertical margins against its
 * height, unlike CSS, to match `@placement/vue`.
 *
 * @param props - The item props.
 * @param content - The container's content rect.
 * @returns The frame.
 */
export const frame = (props: ItemProps, content: Rect.Rect): Frame.Frame =>
  frameInput.resolve(props.frame, content)

/**
 * The container spec a flex solves its items with.
 *
 * @param props - The flex props.
 * @returns The flexbox.
 */
export const layout = (props: FlexProps): Flexbox.Flexbox => props.layout ?? defaultLayout
