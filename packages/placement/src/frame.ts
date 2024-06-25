import { normalizeTRBL } from './utils/arguments'
import { type FinalMapFn, type MapFn, dual, pipe } from './utils/function'

const TypeBrand: unique symbol = Symbol('placement/frame')
type TypeBrand = typeof TypeBrand

export interface Frame {
  [TypeBrand]: TypeBrand
  readonly offsetTop: number
  readonly offsetRight: number
  readonly offsetBottom: number
  readonly offsetLeft: number
  readonly width: number
  readonly height: number
  readonly minWidth: number
  readonly minHeight: number
  readonly maxWidth: number
  readonly maxHeight: number
  readonly grow: number
  readonly shrink: number
  readonly align: number
  readonly justify: number
  pipe<R>(...fns: [...Array<MapFn<Frame>>, FinalMapFn<Frame, R>]): R
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

interface FrameInput {
  readonly offset?: number
  readonly offsetX?: number
  readonly offsetY?: number
  readonly offsetTop?: number
  readonly offsetRight?: number
  readonly offsetBottom?: number
  readonly offsetLeft?: number
  readonly size?: number
  readonly width?: number
  readonly height?: number
  readonly minSize?: number
  readonly minWidth?: number
  readonly minHeight?: number
  readonly maxSize?: number
  readonly maxWidth?: number
  readonly maxHeight?: number
  readonly grow?: number
  readonly shrink?: number
  readonly place?: number
  readonly align?: number
  readonly justify?: number
}

const FrameProto: Frame = {
  [TypeBrand]: TypeBrand,
  offsetTop: 0,
  offsetRight: 0,
  offsetBottom: 0,
  offsetLeft: 0,
  width: 0,
  height: 0,
  minWidth: Number.NEGATIVE_INFINITY,
  minHeight: Number.NEGATIVE_INFINITY,
  maxWidth: Number.POSITIVE_INFINITY,
  maxHeight: Number.POSITIVE_INFINITY,
  grow: 0,
  shrink: 0,
  align: 0,
  justify: 0,
  pipe(...fns) {
    return pipe(this, ...fns)
  },
}

function applyOffset(frame: Mutable<Frame>, input: FrameInput) {
  if (input.offset != null) {
    frame.offsetTop = input.offset
    frame.offsetRight = input.offset
    frame.offsetBottom = input.offset
    frame.offsetLeft = input.offset
  }
  if (input.offsetX != null) {
    frame.offsetLeft = input.offsetX
    frame.offsetRight = input.offsetX
  }
  if (input.offsetY != null) {
    frame.offsetTop = input.offsetY
    frame.offsetBottom = input.offsetY
  }
  if (input.offsetTop != null) {
    frame.offsetTop = input.offsetTop
  }
  if (input.offsetRight != null) {
    frame.offsetRight = input.offsetRight
  }
  if (input.offsetBottom != null) {
    frame.offsetBottom = input.offsetBottom
  }
  if (input.offsetLeft != null) {
    frame.offsetLeft = input.offsetLeft
  }
}

function applySize(frame: Mutable<Frame>, input: FrameInput) {
  if (input.size != null) {
    frame.width = input.size
    frame.height = input.size
  }
  if (input.width != null) {
    frame.width = input.width
  }
  if (input.height != null) {
    frame.height = input.height
  }
  if (input.minSize != null) {
    frame.minWidth = input.minSize
    frame.minHeight = input.minSize
  }
  if (input.minWidth != null) {
    frame.minWidth = input.minWidth
  }
  if (input.minHeight != null) {
    frame.minHeight = input.minHeight
  }
  if (input.maxSize != null) {
    frame.maxWidth = input.maxSize
    frame.maxHeight = input.maxSize
  }
  if (input.maxWidth != null) {
    frame.maxWidth = input.maxWidth
  }
  if (input.maxHeight != null) {
    frame.maxHeight = input.maxHeight
  }
}

function applyFlex(frame: Mutable<Frame>, input: FrameInput) {
  if (input.grow != null) {
    frame.grow = input.grow
  }
  if (input.shrink != null) {
    frame.shrink = input.shrink
  }
  if (input.place != null) {
    frame.align = input.place
    frame.justify = input.place
  }
  if (input.align != null) {
    frame.align = input.align
  }
  if (input.justify != null) {
    frame.justify = input.justify
  }
}

function makeFrame(input: FrameInput): Frame {
  const frame = Object.create(FrameProto) as Mutable<Frame>
  applyOffset(frame, input)
  applySize(frame, input)
  applyFlex(frame, input)
  return frame
}

export function frame(input: FrameInput): Frame {
  return makeFrame(input)
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
  return makeFrame({
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
  return makeFrame({
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
  return makeFrame({
    ...self,
    offsetTop: a,
    offsetBottom: b ?? a,
  })
})

export const setOffsetTop: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    offsetTop: a,
  })
})

export const setOffsetRight: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    offsetRight: a,
  })
})

export const setOffsetBottom: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    offsetBottom: a,
  })
})

export const setOffsetLeft: {
  (self: Frame, offset: number): Frame
  (offset: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
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
  return makeFrame({
    ...self,
    height: a,
    width: b ?? a,
  })
})

export const setWidth: {
  (self: Frame, width: number): Frame
  (width: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    width: a,
  })
})

export const setHeight: {
  (self: Frame, height: number): Frame
  (height: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
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
  return makeFrame({
    ...self,
    minHeight: a,
    minWidth: b ?? a,
  })
})

export const setMinWidth: {
  (self: Frame, minWidth: number): Frame
  (minWidth: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    minWidth: a,
  })
})

export const setMinHeight: {
  (self: Frame, minHeight: number): Frame
  (minHeight: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
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
  return makeFrame({
    ...self,
    maxHeight: a,
    maxWidth: b ?? a,
  })
})

export const setMaxWidth: {
  (self: Frame, maxWidth: number): Frame
  (maxWidth: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    maxWidth: a,
  })
})

export const setMaxHeight: {
  (self: Frame, maxHeight: number): Frame
  (maxHeight: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    maxHeight: a,
  })
})

export const setGrow: {
  (self: Frame, grow: number): Frame
  (grow: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    grow: a,
  })
})

export const setShrink: {
  (self: Frame, shrink: number): Frame
  (shrink: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
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
  return makeFrame({
    ...self,
    align: a,
    justify: b ?? a,
  })
})

export const setAlign: {
  (self: Frame, align: number): Frame
  (align: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    align: a,
  })
})

export const setJustify: {
  (self: Frame, justify: number): Frame
  (justify: number): (self: Frame) => Frame
} = dual(2, (self, a: number) => {
  return makeFrame({
    ...self,
    justify: a,
  })
})
