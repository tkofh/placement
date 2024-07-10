import { Pipeable } from './internal/pipeable'
import { normalizeTRBL } from './utils/arguments'
import { dual } from './utils/function'

const TypeBrand: unique symbol = Symbol('placement/frame')
type TypeBrand = typeof TypeBrand

interface FrameInput {
  readonly offsetTop?: number
  readonly offsetRight?: number
  readonly offsetBottom?: number
  readonly offsetLeft?: number
  readonly width?: number
  readonly height?: number
  readonly aspectRatio?: number
  readonly minWidth?: number
  readonly minHeight?: number
  readonly maxWidth?: number
  readonly maxHeight?: number
  readonly grow?: number
  readonly shrink?: number
  readonly align?: number
  readonly justify?: number
  readonly stretchMain?: number
  readonly stretchCross?: number
}

class Frame extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand

  readonly offsetTop: number = 0
  readonly offsetRight: number = 0
  readonly offsetBottom: number = 0
  readonly offsetLeft: number = 0
  readonly width: number = 0
  readonly height: number = 0
  readonly minWidth: number = 0
  readonly minHeight: number = 0
  readonly maxWidth: number = Number.POSITIVE_INFINITY
  readonly maxHeight: number = Number.POSITIVE_INFINITY
  readonly grow: number = 0
  readonly shrink: number = 0
  readonly align: number = 0
  readonly justify: number = 0
  readonly stretchMain: number = 0
  readonly stretchCross: number = 0

  constructor(frame: FrameInput) {
    super()

    this.offsetTop = frame.offsetTop ?? this.offsetTop
    this.offsetRight = frame.offsetRight ?? this.offsetRight
    this.offsetBottom = frame.offsetBottom ?? this.offsetBottom
    this.offsetLeft = frame.offsetLeft ?? this.offsetLeft
    this.width = Math.max(frame.width ?? this.width, 0)
    this.height = Math.max(frame.height ?? this.height, 0)
    this.minWidth = Math.max(frame.minWidth ?? this.minWidth, 0)
    this.minHeight = Math.max(frame.minHeight ?? this.minHeight, 0)
    this.maxWidth = Math.max(frame.maxWidth ?? this.maxWidth, 0)
    this.maxHeight = Math.max(frame.maxHeight ?? this.maxHeight, 0)
    this.grow = frame.grow ?? this.grow
    this.shrink = frame.shrink ?? this.shrink
    this.align = frame.align ?? this.align
    this.justify = frame.justify ?? this.justify
    this.stretchMain = frame.stretchMain ?? this.stretchMain
    this.stretchCross = frame.stretchCross ?? this.stretchCross
  }
}

export type { Frame }

export function frame(input: FrameInput): Frame {
  return new Frame(input)
}

export function isFrame(value: unknown): value is Frame {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

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
} = dual(2, (self, a?: number, b?: number, c?: number, d?: number) => {
  const [top, right, bottom, left] = normalizeTRBL(a, b, c, d)
  return new Frame({
    ...self,
    offsetTop: top,
    offsetRight: right,
    offsetBottom: bottom,
    offsetLeft: left,
  })
})

export const setOffsetX: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetLeft: number, offsetRight: number): Frame
  (offset: number): (self: Frame) => Frame
  (offsetLeft: number, offsetRight: number): (self: Frame) => Frame
} = dual(2, (self, a: number, b?: number) => {
  return new Frame({
    ...self,
    offsetLeft: a,
    offsetRight: b ?? a,
  })
})

export const setOffsetY: {
  (self: Frame, offset: number): Frame
  (self: Frame, offsetTop: number, offsetBottom: number): Frame
  (offset: number): (self: Frame) => Frame
  (offsetTop: number, offsetBottom: number): (self: Frame) => Frame
} = dual(2, (self, a: number, b?: number) => {
  return new Frame({
    ...self,
    offsetTop: a,
    offsetBottom: b ?? a,
  })
})

export const setOffsetTop: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    offsetTop: a,
  })
})

export const setOffsetRight: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    offsetRight: a,
  })
})

export const setOffsetBottom: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    offsetBottom: a,
  })
})

export const setOffsetLeft: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    offsetLeft: a,
  })
})

export const setSize: {
  (self: Frame, size: number): Frame
  (self: Frame, height: number, width: number): Frame
  (size: number): (self: Frame) => Frame
  (height: number, width: number): (self: Frame) => Frame
} = dual(2, (self, a: number, b?: number) => {
  return new Frame({
    ...self,
    height: a,
    width: b ?? a,
  })
})

export const setWidth: {
  (self: Frame, width: number): Frame
  (width: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    width: a,
  })
})

export const setHeight: {
  (self: Frame, height: number): Frame
  (height: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    height: a,
  })
})

export const setMinSize: {
  (self: Frame, size: number): Frame
  (self: Frame, minHeight: number, minWidth: number): Frame
  (size: number): (self: Frame) => Frame
  (minHeight: number, minWidth: number): (self: Frame) => Frame
} = dual(2, (self, a: number, b?: number) => {
  return new Frame({
    ...self,
    minHeight: a,
    minWidth: b ?? a,
  })
})

export const setMinWidth: {
  (self: Frame, minWidth: number): Frame
  (minWidth: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    minWidth: a,
  })
})

export const setMinHeight: {
  (self: Frame, minHeight: number): Frame
  (minHeight: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    minHeight: a,
  })
})

export const setMaxSize: {
  (self: Frame, size: number): Frame
  (self: Frame, maxHeight: number, maxWidth: number): Frame
  (size: number): (self: Frame) => Frame
  (maxHeight: number, maxWidth: number): (self: Frame) => Frame
} = dual(2, (self, a: number, b?: number) => {
  return new Frame({
    ...self,
    maxHeight: a,
    maxWidth: b ?? a,
  })
})

export const setMaxWidth: {
  (self: Frame, maxWidth: number): Frame
  (maxWidth: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    maxWidth: a,
  })
})

export const setMaxHeight: {
  (self: Frame, maxHeight: number): Frame
  (maxHeight: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    maxHeight: a,
  })
})

export const setGrow: {
  (self: Frame, grow: number): Frame
  (grow: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    grow: a,
  })
})

export const setShrink: {
  (self: Frame, shrink: number): Frame
  (shrink: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    shrink: a,
  })
})

export const setPlace: {
  (self: Frame, place: number): Frame
  (self: Frame, align: number, justify: number): Frame
  (place: number): (self: Frame) => Frame
  (align: number, justify: number): (self: Frame) => Frame
} = dual(2, (self, a: number, b?: number) => {
  return new Frame({
    ...self,
    align: a,
    justify: b ?? a,
  })
})

export const setAlign: {
  (self: Frame, align: number): Frame
  (align: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    align: a,
  })
})

export const setJustify: {
  (self: Frame, justify: number): Frame
  (justify: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    justify: a,
  })
})

export const setStretchMain: {
  (self: Frame, stretch: number): Frame
  (stretch: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    stretchMain: a,
  })
})

export const setStretchCross: {
  (self: Frame, stretch: number): Frame
  (stretch: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return new Frame({
    ...self,
    stretchCross: a,
  })
})
