import { Pipeable, dual } from 'curvy/utils'
import { type NormalizedSizing, normalizeSizing, normalizeTRBL } from './utils/arguments.ts'

const TypeBrand: unique symbol = Symbol('placement/frame')
type TypeBrand = typeof TypeBrand

export interface FrameInput {
  readonly offsetTop?: number | undefined
  readonly offsetRight?: number | undefined
  readonly offsetBottom?: number | undefined
  readonly offsetLeft?: number | undefined
  readonly width?: number | undefined
  readonly height?: number | undefined
  readonly aspectRatio?: number | undefined
  readonly minWidth?: number | undefined
  readonly minHeight?: number | undefined
  readonly maxWidth?: number | undefined
  readonly maxHeight?: number | undefined
  readonly grow?: number | undefined
  readonly shrink?: number | undefined
  readonly align?: number | undefined
  readonly stretch?: number | undefined
}

class Frame extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly offsetTop: number
  readonly offsetRight: number
  readonly offsetBottom: number
  readonly offsetLeft: number
  readonly grow: number
  readonly shrink: number
  // align and stretch default to +Infinity: inherit from the container.
  readonly align: number
  readonly stretch: number

  // Sizing inputs are stored raw (undefined = unset) and resolved lazily, so
  // unset-ness survives setter round-trips.
  readonly #width: number | undefined
  readonly #height: number | undefined
  readonly #aspectRatio: number | undefined
  readonly #minWidth: number | undefined
  readonly #minHeight: number | undefined
  readonly #maxWidth: number | undefined
  readonly #maxHeight: number | undefined

  #sizing: NormalizedSizing | undefined

  constructor(input: FrameInput) {
    super()

    this.offsetTop = input.offsetTop ?? 0
    this.offsetRight = input.offsetRight ?? 0
    this.offsetBottom = input.offsetBottom ?? 0
    this.offsetLeft = input.offsetLeft ?? 0
    this.grow = input.grow ?? 0
    this.shrink = input.shrink ?? 0
    this.align = input.align ?? Number.POSITIVE_INFINITY
    this.stretch = input.stretch ?? Number.POSITIVE_INFINITY

    this.#width = input.width
    this.#height = input.height
    this.#aspectRatio = input.aspectRatio
    this.#minWidth = input.minWidth
    this.#minHeight = input.minHeight
    this.#maxWidth = input.maxWidth
    this.#maxHeight = input.maxHeight
  }

  get #resolved(): NormalizedSizing {
    return (this.#sizing ??= normalizeSizing(
      this.#aspectRatio ?? 0,
      this.#width ?? Number.NaN,
      this.#height ?? Number.NaN,
      this.#minWidth ?? 0,
      this.#minHeight ?? 0,
      this.#maxWidth ?? Number.POSITIVE_INFINITY,
      this.#maxHeight ?? Number.POSITIVE_INFINITY,
    ))
  }

  get width(): number {
    return this.#resolved.width
  }

  get height(): number {
    return this.#resolved.height
  }

  get aspectRatio(): number {
    return this.#resolved.aspectRatio
  }

  get minWidth(): number {
    return this.#resolved.minWidth
  }

  get minHeight(): number {
    return this.#resolved.minHeight
  }

  get maxWidth(): number {
    return this.#resolved.maxWidth
  }

  get maxHeight(): number {
    return this.#resolved.maxHeight
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Frame [${this.width} x ${this.height}]`
  }

  // Own data only: the raw inputs, not the resolved sizing.
  toJSON() {
    return {
      offsetTop: this.offsetTop,
      offsetRight: this.offsetRight,
      offsetBottom: this.offsetBottom,
      offsetLeft: this.offsetLeft,
      width: this.#width,
      height: this.#height,
      aspectRatio: this.#aspectRatio,
      minWidth: this.#minWidth,
      minHeight: this.#minHeight,
      maxWidth: this.#maxWidth,
      maxHeight: this.#maxHeight,
      grow: this.grow,
      shrink: this.shrink,
      align: this.align,
      stretch: this.stretch,
    }
  }
}

export type { Frame }

export const frame = (input: FrameInput): Frame => new Frame(input)

export const isFrame = (value: unknown): value is Frame => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

// Setters rebuild from the raw inputs (toJSON), never the resolved sizing.
// Those with optional trailing arguments dispatch on isFrame: the data-last
// form's first argument is always a number, so the forms cannot collide.
export const setOffset: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetY: number, offsetX: number): Frame
  (
    self: Frame,
    offsetTop: number,
    offsetRight: number,
    offsetBottom: number,
    offsetLeft: number,
  ): Frame
  (offset: number): (self: Frame) => Frame
  (offsetY: number, offsetX: number): (self: Frame) => Frame
  (
    offsetTop: number,
    offsetRight: number,
    offsetBottom: number,
    offsetLeft: number,
  ): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, a: number, b?: number, c?: number, d?: number) => {
    const [top, right, bottom, left] = normalizeTRBL(a, b, c, d)
    return new Frame({
      ...self.toJSON(),
      offsetTop: top,
      offsetRight: right,
      offsetBottom: bottom,
      offsetLeft: left,
    })
  },
)

export const setOffsetX: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetLeft: number, offsetRight: number): Frame
  (offset: number): (self: Frame) => Frame
  (offsetLeft: number, offsetRight: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, left: number, right?: number) =>
    new Frame({ ...self.toJSON(), offsetLeft: left, offsetRight: right ?? left }),
)

export const setOffsetY: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetTop: number, offsetBottom: number): Frame
  (offset: number): (self: Frame) => Frame
  (offsetTop: number, offsetBottom: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, top: number, bottom?: number) =>
    new Frame({ ...self.toJSON(), offsetTop: top, offsetBottom: bottom ?? top }),
)

export const setOffsetTop: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetTop: offset }))

export const setOffsetRight: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetRight: offset }))

export const setOffsetBottom: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetBottom: offset }))

export const setOffsetLeft: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self: Frame, offset: number) => new Frame({ ...self.toJSON(), offsetLeft: offset }))

export const setSize: {
  (self: Frame, width: number, height?: number): Frame
  (width: number, height?: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, width: number, height?: number) =>
    new Frame({ ...self.toJSON(), width, height: height ?? width }),
)

export const setWidth: {
  (self: Frame, width: number): Frame
  (width: number): (self: Frame) => Frame
} = dual(2, (self: Frame, width: number) => new Frame({ ...self.toJSON(), width }))

export const setHeight: {
  (self: Frame, height: number): Frame
  (height: number): (self: Frame) => Frame
} = dual(2, (self: Frame, height: number) => new Frame({ ...self.toJSON(), height }))

export const setAspectRatio: {
  (self: Frame, aspectRatio: number): Frame
  (aspectRatio: number): (self: Frame) => Frame
} = dual(2, (self: Frame, aspectRatio: number) => new Frame({ ...self.toJSON(), aspectRatio }))

export const setMinSize: {
  (self: Frame, minWidth: number, minHeight?: number): Frame
  (minWidth: number, minHeight?: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, minWidth: number, minHeight?: number) =>
    new Frame({ ...self.toJSON(), minWidth, minHeight: minHeight ?? minWidth }),
)

export const setMinWidth: {
  (self: Frame, minWidth: number): Frame
  (minWidth: number): (self: Frame) => Frame
} = dual(2, (self: Frame, minWidth: number) => new Frame({ ...self.toJSON(), minWidth }))

export const setMinHeight: {
  (self: Frame, minHeight: number): Frame
  (minHeight: number): (self: Frame) => Frame
} = dual(2, (self: Frame, minHeight: number) => new Frame({ ...self.toJSON(), minHeight }))

export const setMaxSize: {
  (self: Frame, maxWidth: number, maxHeight?: number): Frame
  (maxWidth: number, maxHeight?: number): (self: Frame) => Frame
} = dual(
  (args) => isFrame(args[0]),
  (self: Frame, maxWidth: number, maxHeight?: number) =>
    new Frame({ ...self.toJSON(), maxWidth, maxHeight: maxHeight ?? maxWidth }),
)

export const setMaxWidth: {
  (self: Frame, maxWidth: number): Frame
  (maxWidth: number): (self: Frame) => Frame
} = dual(2, (self: Frame, maxWidth: number) => new Frame({ ...self.toJSON(), maxWidth }))

export const setMaxHeight: {
  (self: Frame, maxHeight: number): Frame
  (maxHeight: number): (self: Frame) => Frame
} = dual(2, (self: Frame, maxHeight: number) => new Frame({ ...self.toJSON(), maxHeight }))

export const setGrow: {
  (self: Frame, grow: number): Frame
  (grow: number): (self: Frame) => Frame
} = dual(2, (self: Frame, grow: number) => new Frame({ ...self.toJSON(), grow }))

export const setShrink: {
  (self: Frame, shrink: number): Frame
  (shrink: number): (self: Frame) => Frame
} = dual(2, (self: Frame, shrink: number) => new Frame({ ...self.toJSON(), shrink }))

export const setAlign: {
  (self: Frame, align: number): Frame
  (align: number): (self: Frame) => Frame
} = dual(2, (self: Frame, align: number) => new Frame({ ...self.toJSON(), align }))

export const setStretch: {
  (self: Frame, stretch: number): Frame
  (stretch: number): (self: Frame) => Frame
} = dual(2, (self: Frame, stretch: number) => new Frame({ ...self.toJSON(), stretch }))
