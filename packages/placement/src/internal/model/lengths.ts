// Turns the length inputs of node props into the numeric specs the solvers
// take. A percentage's basis is a tree decision, so each node resolves its
// own props here against the rect its kind names as the basis: a box
// against its parent rect, a gutter and a translation against the node's
// placed rect, a frame against its container's content rect. Horizontal
// fields resolve against the basis width and vertical fields against its
// height, as `useRect` and `internal/frame.ts` do in `@placement/vue`.
import * as Box from '../../box.ts'
import * as Frame from '../../frame.ts'
import * as Length from '../../length.ts'
import * as Offset from '../../offset.ts'
import * as Point from '../../point.ts'
import type { Rect } from '../../rect.ts'
import type { BoxInput, FrameInput, GutterInput, TranslateInput } from './types.ts'

const defaultBox = Box.make({})
const defaultFrame = Frame.make({})

/** Checks for a plain object, as a literal or a proxy of one gives. */
export const isPlain = (value: unknown): value is object => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Copies and freezes a plain input, with a `[width, height]` ratio pair in
 * it, so a spec never shares mutable data with its caller.
 *
 * @param input - The plain input.
 * @returns The frozen copy.
 */
export const freezeInput = (input: object): object =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(input).map(([field, value]) => [
        field,
        Array.isArray(value) ? Object.freeze([...value]) : value,
      ]),
    ),
  )

const isLengthInput = (value: unknown): boolean =>
  typeof value === 'number' || Length.isLength(value)

const isNumber = (value: unknown): boolean => typeof value === 'number'

const isAspectRatio = (value: unknown): boolean =>
  typeof value === 'number' ||
  (Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number')

type Guards = Readonly<Record<string, (value: unknown) => boolean>>

const X = ['left', 'right', 'width', 'minWidth', 'maxWidth'] as const
const Y = ['top', 'bottom', 'height', 'minHeight', 'maxHeight'] as const

const lengths = (fields: ReadonlyArray<string>): Guards =>
  Object.fromEntries(fields.map((field) => [field, isLengthInput]))

const BOX_FIELDS: Guards = { ...lengths([...X, ...Y]), aspectRatio: isAspectRatio }

const FRAME_FIELDS: Guards = {
  ...lengths([
    'offsetTop',
    'offsetRight',
    'offsetBottom',
    'offsetLeft',
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
  ]),
  aspectRatio: isAspectRatio,
  grow: isNumber,
  shrink: isNumber,
  align: isNumber,
  stretch: isNumber,
}

const GUTTER_FIELDS: Guards = lengths(['top', 'right', 'bottom', 'left'])

const TRANSLATE_FIELDS: Guards = lengths(['x', 'y'])

// A plain object whose every field is known and, unless `undefined`, of
// the right type.
const fieldsOf =
  (guards: Guards) =>
  (value: unknown): boolean =>
    isPlain(value) &&
    Object.entries(value).every(([field, each]) => {
      const guard = guards[field]
      return guard !== undefined && (each === undefined || guard(each))
    })

/** Checks for a `BoxInput`. */
export const isBoxInput: (value: unknown) => boolean = fieldsOf(BOX_FIELDS)

/** Checks for a `FrameInput`. */
export const isFrameInput: (value: unknown) => boolean = fieldsOf(FRAME_FIELDS)

/** Checks for a `GutterInput`. */
export const isGutterInput: (value: unknown) => boolean = fieldsOf(GUTTER_FIELDS)

/** Checks for a `TranslateInput`. */
export const isTranslateInput: (value: unknown) => boolean = fieldsOf(TRANSLATE_FIELDS)

const resolve = (input: Length.LengthInput | undefined, basis: number): number | undefined =>
  input === undefined ? undefined : Length.resolve(input, basis)

// A frame reads a `NaN` size literally, and a `NaN` bound poisons the
// solve, so a size that resolves to `NaN` is left unset instead, as
// `@placement/vue` does.
const size = (input: Length.LengthInput | undefined, basis: number): number | undefined => {
  const value = resolve(input, basis)
  return value !== undefined && Number.isNaN(value) ? undefined : value
}

/**
 * The box to solve, resolved against the parent rect.
 *
 * @param input - The `box` prop.
 * @param basis - The parent rect.
 * @returns The box.
 */
export function boxFor(input: Box.Box | BoxInput | undefined, basis: Rect): Box.Box {
  if (input === undefined) {
    return defaultBox
  }
  if (Box.isBox(input)) {
    return input
  }
  const { width, height } = basis
  return Box.make({
    top: resolve(input.top, height),
    right: resolve(input.right, width),
    bottom: resolve(input.bottom, height),
    left: resolve(input.left, width),
    width: resolve(input.width, width),
    height: resolve(input.height, height),
    aspectRatio: input.aspectRatio,
    minWidth: resolve(input.minWidth, width),
    minHeight: resolve(input.minHeight, height),
    maxWidth: resolve(input.maxWidth, width),
    maxHeight: resolve(input.maxHeight, height),
  })
}

/**
 * The frame to solve, resolved against the container's content rect.
 * Vertical margins resolve against its height, unlike CSS, to match
 * `@placement/vue`.
 *
 * @param input - The `frame` prop.
 * @param basis - The container's content rect.
 * @returns The frame.
 */
export function frameFor(input: Frame.Frame | FrameInput | undefined, basis: Rect): Frame.Frame {
  if (input === undefined) {
    return defaultFrame
  }
  if (Frame.isFrame(input)) {
    return input
  }
  const { width, height } = basis
  return Frame.make({
    offsetTop: resolve(input.offsetTop, height),
    offsetRight: resolve(input.offsetRight, width),
    offsetBottom: resolve(input.offsetBottom, height),
    offsetLeft: resolve(input.offsetLeft, width),
    width: size(input.width, width),
    height: size(input.height, height),
    aspectRatio: input.aspectRatio,
    minWidth: size(input.minWidth, width),
    minHeight: size(input.minHeight, height),
    maxWidth: size(input.maxWidth, width),
    maxHeight: size(input.maxHeight, height),
    grow: input.grow,
    shrink: input.shrink,
    align: input.align,
    stretch: input.stretch,
  })
}

/**
 * The gutter to contract by, resolved against the placed rect.
 *
 * @param input - The `gutter` prop.
 * @param basis - The flex's placed rect.
 * @returns The gutter.
 */
export function gutterFor(input: Offset.Offset | GutterInput, basis: Rect): Offset.Offset {
  if (Offset.isOffset(input)) {
    return input
  }
  const { width, height } = basis
  return Offset.trbl(
    resolve(input.top, height) ?? 0,
    resolve(input.right, width) ?? 0,
    resolve(input.bottom, height) ?? 0,
    resolve(input.left, width) ?? 0,
  )
}

/**
 * The translation, resolved against the node's own placed rect, as CSS
 * `translate` resolves.
 *
 * @param input - The `translate` prop.
 * @param basis - The rect before the translation.
 * @returns The translation.
 */
export function translateFor(input: Point.Point | TranslateInput, basis: Rect): Point.Point {
  if (Point.isPoint(input)) {
    return input
  }
  return Point.make(resolve(input.x, basis.width) ?? 0, resolve(input.y, basis.height) ?? 0)
}
