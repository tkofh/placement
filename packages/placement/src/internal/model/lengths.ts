// Turns the length inputs of node props into the numeric specs the solvers
// take. A percentage's basis is a tree decision, so each node resolves its
// own props here against the rect its kind names as the basis: a box
// against its parent rect, a gutter and a translation against the node's
// placed rect, a frame against its container's content rect. Horizontal
// fields resolve against the basis width and vertical fields against its
// height, as `useRect` and `internal/frame.ts` do in `@placement/vue`.
//
// Each input has one table that says what each of its fields is, and the
// check and the resolution both read it.
import * as AspectRatio from '../../aspectRatio.ts'
import * as Box from '../../box.ts'
import * as Frame from '../../frame.ts'
import * as Length from '../../length.ts'
import * as Offset from '../../offset.ts'
import * as Point from '../../point.ts'
import type { Rect } from '../../rect.ts'
import { isPlainRecord } from '../../utils/object.ts'
import type { BoxInput, FrameInput, GutterInput, TranslateInput } from './types.ts'

// What a field is: a length on an axis, a size on an axis, a ratio, or a
// plain number. A size that resolves to `NaN` is unset, because a frame
// reads a `NaN` size literally and a `NaN` bound poisons the solve, as
// `@placement/vue` has it. A box reads `NaN` as unset anyway. A margin, a
// gutter side, or a translation keeps its `NaN`, so a `NaN` margin stays
// auto.
type Field = 'x' | 'y' | 'width' | 'height' | 'ratio' | 'number'

type Table = { readonly [field: string]: Field }

// A table for the input `I` names each of its fields once.
type TableOf<I> = { readonly [K in keyof I]-?: Field }

const BOX = {
  top: 'y',
  right: 'x',
  bottom: 'y',
  left: 'x',
  width: 'width',
  height: 'height',
  aspectRatio: 'ratio',
  minWidth: 'width',
  minHeight: 'height',
  maxWidth: 'width',
  maxHeight: 'height',
} as const satisfies TableOf<BoxInput>

const FRAME = {
  offsetTop: 'y',
  offsetRight: 'x',
  offsetBottom: 'y',
  offsetLeft: 'x',
  width: 'width',
  height: 'height',
  aspectRatio: 'ratio',
  minWidth: 'width',
  minHeight: 'height',
  maxWidth: 'width',
  maxHeight: 'height',
  grow: 'number',
  shrink: 'number',
  align: 'number',
  stretch: 'number',
} as const satisfies TableOf<FrameInput>

const GUTTER = {
  top: 'y',
  right: 'x',
  bottom: 'y',
  left: 'x',
} as const satisfies TableOf<GutterInput>

const TRANSLATE = { x: 'x', y: 'y' } as const satisfies TableOf<TranslateInput>

const CHECKS: { readonly [F in Field]: (value: unknown) => boolean } = {
  x: Length.isLengthInput,
  y: Length.isLengthInput,
  width: Length.isLengthInput,
  height: Length.isLengthInput,
  ratio: AspectRatio.isAspectRatio,
  number: (value) => typeof value === 'number',
}

// An input with its lengths resolved: what the spec's own input takes.
type Resolved<T extends Table> = {
  -readonly [K in keyof T]?: T[K] extends 'ratio' ? AspectRatio.AspectRatio : number
}

function resolveField(field: Field, value: unknown, basis: Rect): unknown {
  switch (field) {
    case 'x':
      return Length.resolve(value as Length.LengthInput, basis.width)
    case 'y':
      return Length.resolve(value as Length.LengthInput, basis.height)
    case 'width':
    case 'height': {
      const size = Length.resolve(
        value as Length.LengthInput,
        field === 'width' ? basis.width : basis.height,
      )
      return Number.isNaN(size) ? undefined : size
    }
    case 'ratio':
    case 'number':
      return value
  }
}

/** A prop that takes a built spec `S` or a plain input that resolves to one. */
export interface Input<S> {
  /**
   * Checks for a spec, or for a plain object whose every field the input
   * has and, unless `undefined`, of the right type.
   */
  readonly check: (value: unknown) => boolean
  /**
   * The spec to solve: a built one as it is, a plain input resolved against
   * `basis`, or the spec of the empty input for `undefined`.
   */
  readonly resolve: (value: unknown, basis: Rect) => S
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

/** The `box` prop, against the parent rect. */
export const box: Input<Box.Box> = input(BOX, Box.isBox, Box.make)

/**
 * The `frame` prop, against the container's content rect. Vertical
 * margins resolve against its height, unlike CSS, to match
 * `@placement/vue`.
 */
export const frame: Input<Frame.Frame> = input(FRAME, Frame.isFrame, Frame.make)

/** The `gutter` prop, against the flex's placed rect. An omitted side is `0`. */
export const gutter: Input<Offset.Offset> = input(GUTTER, Offset.isOffset, (sides) =>
  Offset.trbl(sides.top ?? 0, sides.right ?? 0, sides.bottom ?? 0, sides.left ?? 0),
)

/**
 * The `translate` prop, against the rect it moves, as CSS `translate`
 * resolves. An omitted component is `0`.
 */
export const translate: Input<Point.Point> = input(TRANSLATE, Point.isPoint, (by) =>
  Point.make(by.x ?? 0, by.y ?? 0),
)

/**
 * Copies and freezes a plain input, with a `[width, height]` ratio pair in
 * it, so a spec never shares mutable data with its caller.
 *
 * @param value - The plain input.
 * @returns The frozen copy.
 */
export const freezeInput = (value: object): object =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([field, each]) => [
        field,
        Array.isArray(each) ? Object.freeze([...each]) : each,
      ]),
    ),
  )
